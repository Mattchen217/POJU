import {
  extractJson,
  SIMP_RE,
  TIME_ANCHOR_RE,
} from "@/lib/base-analysis-v2/compute/compute-call";
import { applyPlainFallbackToText } from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import { stripTimeAnchor } from "@/lib/base-analysis-v2/compute/strip-time-anchor";
import {
  buildEvidencePrompt,
  pickSegments,
} from "@/lib/base-analysis-v2/evidence/evidence-prompt";
import {
  fillFromComputeIfMissing,
  mergeTaskTrees,
  NARRATIVE_TASKS,
  validateTaskPaths,
} from "@/lib/base-analysis-v2/narrative/narrative-call";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import {
  findSegmentText,
  mapSegmentTexts,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import {
  autoMarkBareTerms,
  bareMingliWordInPlain,
  demoteWuxingMarkers,
  maskMarkersForAudit,
} from "@/lib/llm/sanitize/term-marking";

/** 单 Task 4–6 段依据，远小于此；给足防截断（原全量 12000 → 拆后 4096）。 */
export const EVIDENCE_TASK_MAX_TOKENS = 4096;
const EVIDENCE_TEMPERATURE = 0.35;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 180_000;
/** 4 Task 并发；单轮墙内完成，总预算对齐 Hobby 300s。 */
const TOTAL_TIMEOUT_MS = 300_000;

/** 与第2次正文同款分组（4+6+4+5=19）。 */
export const EVIDENCE_TASKS = NARRATIVE_TASKS;

/** 本命关系词：prompt 允许白话不打标；审计时不因残留而判 deterministic 失败。 */
const RELATION_PLAIN_ALLOW =
  /相刑|相冲|相害|相合|六合|半合|三合|刑冲|冲克/;

export type EvidenceOutcome =
  | { ok: true; value: ReportSegmentTextTree; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type RunEvidenceOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

/** 打标器兜底 + 五行还原；★ 不填软译槽 —— 留给 merge/finalize，翻译只吃干净代号。 */
export function polishEvidenceSegment(text: string, locale: string): string {
  const marked = autoMarkBareTerms(text, locale);
  return demoteWuxingMarkers(marked);
}

/**
 * 第3次依据校验（在打标兜底之后）：无时间锚 / 无简称 / 无残留裸真词。
 * 返回 deterministic 失败文案；null = 通过。
 */
export function findEvidenceLeak(tree: unknown, locale: string): string | null {
  const timePath = findSegmentText(tree, (t) => TIME_ANCHOR_RE.test(t));
  if (timePath) {
    return locale.startsWith("zh")
      ? `依据含时间锚(${timePath})。不能出现年份/岁数/具体大运名。`
      : `Evidence has a time anchor at ${timePath}. No years/ages/named decades.`;
  }

  const simpPath = findSegmentText(tree, (t) => SIMP_RE.test(t));
  if (simpPath) {
    return locale.startsWith("zh")
      ? `依据含十神简称(${simpPath})。必须用全称并打标（官杀→正官/七杀 等）。`
      : `Evidence has a Ten-God abbreviation at ${simpPath}. Use full names + markers.`;
  }

  let bareWord: string | null = null;
  const barePath = findSegmentText(tree, (t) => {
    const masked = maskMarkersForAudit(t);
    // 关系例外：允许相刑/相冲等白话
    const scrubbed = masked.replace(RELATION_PLAIN_ALLOW, "");
    bareWord = bareMingliWordInPlain(scrubbed);
    return bareWord !== null;
  });
  if (barePath) {
    const word = bareWord ?? "裸真词";
    return locale.startsWith("zh")
      ? `依据仍有裸命理词「${word}」(${barePath})。请打标成 ⟦t:<slug>|⟧（竖线后留空）。`
      : `Evidence still has bare term "${word}" at ${barePath}. Mark as ⟦t:<slug>|⟧ with empty slot.`;
  }

  return null;
}

function polishEvidenceTree(
  tree: ReportSegmentTextTree,
  locale: string,
): ReportSegmentTextTree {
  let polished = mapSegmentTexts(tree, (seg) => polishEvidenceSegment(seg, locale));
  polished = mapSegmentTexts(polished, (seg) =>
    applyPlainFallbackToText(seg, { includeSingles: false }),
  );
  polished = mapSegmentTexts(polished, (seg) => stripTimeAnchor(seg, locale));
  return polished;
}

type EvidenceTask = (typeof EVIDENCE_TASKS)[number];

/**
 * 单 Task：只喂这几段的双钥匙，输出这几段依据。
 * 只留真失败重试；时间锚/简称/裸词 → 代码清洗放行。
 */
async function runEvidenceTask(
  task: EvidenceTask,
  rc: ReportComputed,
  locale: string,
  opts: {
    session_id?: string;
    signal: AbortSignal;
    deadline: number;
  },
): Promise<
  | { ok: true; value: Record<string, unknown>; attempts: number }
  | { ok: false; reason: string; attempts: number }
> {
  let lastReason = "unknown";
  let retryHint: string | null = null;
  const subset = pickSegments(rc, task.paths);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() > opts.deadline || opts.signal.aborted) {
      lastReason = "total_timeout";
      console.warn(
        `[v2/evidence/${task.name}] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      break;
    }

    const { system, user } = buildEvidencePrompt(subset, locale, retryHint);

    try {
      const attemptStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
        console.warn(
          `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — still waiting (${sec}s)…`,
        );
      }, 30_000);

      let result;
      try {
        result = await openRouterChatCompletion({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: EVIDENCE_TEMPERATURE,
          max_tokens: EVIDENCE_TASK_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "high",
          timeout_ms: ATTEMPT_TIMEOUT_MS,
          session_id: opts.session_id,
          call_type: "v2_evidence",
          phase_name: `v2_evidence_${task.name}`,
          signal: opts.signal,
        });
      } finally {
        clearInterval(heartbeat);
      }

      const text = result.text ?? "";
      if (!text.trim()) {
        lastReason = "empty_response";
        retryHint = null;
        console.warn(
          `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — 空回复，重发`,
        );
        continue;
      }
      if (result.finish_reason === "length") {
        lastReason = "truncated";
        retryHint = null;
        console.warn(
          `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — finish_reason=length，重发`,
        );
        continue;
      }

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        retryHint = null;
        console.warn(
          `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — JSON 解析失败，重发`,
        );
        continue;
      }

      const keyErr = validateTaskPaths(parsed, task.paths, task.name, "evidence");
      if (keyErr) {
        console.warn(
          `[v2/evidence/${task.name}] ℹ️ ${keyErr} — 保留已出段,合并后兜底`,
        );
      }

      console.log(
        `[v2/evidence/${task.name}] ✅ Task 就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
      );
      return { ok: true, value: parsed as Record<string, unknown>, attempts: attempt };
    } catch (e) {
      if (isEmptyResponseError(e)) {
        lastReason = "openrouter_empty";
        retryHint = null;
        console.warn(
          `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — openrouter 空，重发`,
        );
        continue;
      }
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
      retryHint = null;
      console.warn(
        `[v2/evidence/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — 调用异常(${lastReason})，重发`,
      );
      continue;
    }
  }

  console.error(
    `[v2/evidence/${task.name}] ❌ ${MAX_ATTEMPTS} 次用尽，最后原因：${lastReason}`,
  );
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}

/**
 * 第3次调用：4 Task 并发写依据 → 合并 → core_conclusion 兜底缺段 → 代码清洗。
 */
export async function runEvidence(
  rc: ReportComputed,
  locale: string,
  session_idOrOpts?: string | RunEvidenceOptions,
): Promise<EvidenceOutcome> {
  const opts: RunEvidenceOptions =
    typeof session_idOrOpts === "string" || session_idOrOpts === undefined
      ? { session_id: session_idOrOpts }
      : session_idOrOpts;

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("v2_evidence_total_timeout")),
    TOTAL_TIMEOUT_MS,
  );
  opts.signal?.addEventListener("abort", () => ctrl.abort(opts.signal?.reason), {
    once: true,
  });
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  try {
    const results = await Promise.all(
      EVIDENCE_TASKS.map((t) =>
        runEvidenceTask(t, rc, locale, {
          session_id: opts.session_id,
          signal: ctrl.signal,
          deadline,
        }),
      ),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      const reason = failed.map((f) => (!f.ok ? f.reason : "")).join(";");
      console.error(`[v2/evidence] ❌ 全部 Task 失败：${reason}`);
      return { ok: false, reason: reason || "all_tasks_failed", attempts: MAX_ATTEMPTS };
    }

    const trees = results
      .filter(
        (r): r is { ok: true; value: Record<string, unknown>; attempts: number } =>
          r.ok,
      )
      .map((r) => r.value);
    const merged = mergeTaskTrees(trees);
    const filled = fillFromComputeIfMissing(merged, rc, locale);
    const polished = polishEvidenceTree(filled, locale);

    const evResidue = findEvidenceLeak(polished, locale);
    if (evResidue) {
      console.warn(
        `[v2/evidence] ℹ️ 清洗后依据残留(${evResidue}) — 放行,不打回`,
      );
    }

    const attempts = Math.max(...results.map((r) => r.attempts), 1);
    const okCount = results.filter((r) => r.ok).length;
    console.log(
      `[v2/evidence] ✅ 依据树就绪 (${okCount}/${EVIDENCE_TASKS.length} tasks ok, attempts_max=${attempts})`,
    );
    return { ok: true, value: polished, attempts };
  } finally {
    clearTimeout(timer);
  }
}
