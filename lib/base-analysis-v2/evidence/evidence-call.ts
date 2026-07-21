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
  dedupeBareTermBeforeMarker,
  demoteWuxingMarkers,
  maskMarkersForAudit,
  wrapBarePillars,
  wrapBareRelations,
} from "@/lib/llm/sanitize/term-marking";
import {
  V2_HARD_MAX_ATTEMPTS,
  V2_OUTPUT_MAX_TOKENS,
} from "@/lib/base-analysis-v2/v2-llm-budget";

/** @deprecated 用 V2_OUTPUT_MAX_TOKENS；保留别名给守卫/旧 import。 */
export const EVIDENCE_TASK_MAX_TOKENS = V2_OUTPUT_MAX_TOKENS;
const EVIDENCE_TEMPERATURE = 0.35;
/** 单次硬尝试 fetch 超时；硬重试共用 phase 总墙。 */
const ATTEMPT_TIMEOUT_MS = 120_000;
/** 4 Task 并发；对齐 Hobby 300s。 */
const TOTAL_TIMEOUT_MS = 300_000;

/** 与第2次正文同款分组（4+6+4+5=19）。 */
export const EVIDENCE_TASKS = NARRATIVE_TASKS;

export type EvidenceOutcome =
  | { ok: true; value: ReportSegmentTextTree; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type RunEvidenceOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

/**
 * 最后保险：对残留裸词，先尽力补打标（含柱位/关系词），再对补不上的走【】平替。
 * 不打回；代码兜死零裸露。
 */
export function forceRemarkAndFallback(text: string, locale: string): string {
  let out = dedupeBareTermBeforeMarker(text);
  out = autoMarkBareTerms(out, locale, {
    maxPerPara: Infinity,
    oncePerText: false,
  });
  out = wrapBarePillars(out, locale);
  out = wrapBareRelations(out, locale);
  out = dedupeBareTermBeforeMarker(out);
  out = demoteWuxingMarkers(out);
  out = applyPlainFallbackToText(out, { includeSingles: true });
  out = stripTimeAnchor(out, locale);
  return out;
}

/**
 * 打标器兜底 + 柱位/关系词补标 + 真词/标记去重 + 五行还原；★ 不填软译槽 —— 留给 merge/finalize。
 * 依据里出现的命理词无条件全打（不限每段2个）；承重筛选交给 prompt。
 * 先 dedupe 再打标，避免「日主⟦t:day_master|⟧」在全打下被打成双标记。
 */
export function polishEvidenceSegment(text: string, locale: string): string {
  let marked = dedupeBareTermBeforeMarker(text);
  marked = autoMarkBareTerms(marked, locale, {
    maxPerPara: Infinity,
    oncePerText: false,
  });
  marked = wrapBarePillars(marked, locale);
  marked = wrapBareRelations(marked, locale);
  marked = dedupeBareTermBeforeMarker(marked);
  return demoteWuxingMarkers(marked);
}

/**
 * 第3次依据校验（在打标兜底之后）：无时间锚 / 无简称 / 无残留裸真词。
 * 返回 deterministic 失败文案；null = 通过。
 * 关系词也要求打标（与产品统一金字），裸相刑/相冲计为泄漏。
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
    bareWord = bareMingliWordInPlain(masked);
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
    applyPlainFallbackToText(seg, { includeSingles: true }),
  );
  polished = mapSegmentTexts(polished, (seg) => stripTimeAnchor(seg, locale));
  return polished;
}

type EvidenceTask = (typeof EVIDENCE_TASKS)[number];

/**
 * 单 Task：只喂这几段的双钥匙，输出这几段依据。
 * ★ 硬错误可重试（空/截断/坏 JSON/连不上）；缺段合并后兜底；时间锚/简称/裸词清洗放行。
 *   质量问题不打回。
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
  const subset = pickSegments(rc, task.paths);
  const { system, user } = buildEvidencePrompt(subset, locale);
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= V2_HARD_MAX_ATTEMPTS; attempt++) {
    if (Date.now() > opts.deadline || opts.signal.aborted) {
      lastReason = "total_timeout";
      break;
    }

    try {
      const attemptStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
        console.warn(
          `[v2/evidence/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — still waiting (${sec}s)…`,
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
          max_tokens: V2_OUTPUT_MAX_TOKENS,
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
        console.warn(
          `[v2/evidence/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — 空回复，硬重试`,
        );
        continue;
      }
      if (result.finish_reason === "length") {
        lastReason = "truncated";
        console.warn(
          `[v2/evidence/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — finish_reason=length，硬重试`,
        );
        continue;
      }

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        console.warn(
          `[v2/evidence/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — JSON 解析失败，硬重试`,
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
        `[v2/evidence/${task.name}] ✅ Task 就绪 (hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
      );
      return { ok: true, value: parsed as Record<string, unknown>, attempts: attempt };
    } catch (e) {
      lastReason = isEmptyResponseError(e)
        ? "openrouter_empty"
        : `call_error:${e instanceof Error ? e.message : String(e)}`;
      console.warn(
        `[v2/evidence/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — ${lastReason}，硬重试`,
      );
      continue;
    }
  }

  console.error(
    `[v2/evidence/${task.name}] ❌ 硬重试用尽，最后原因：${lastReason}`,
  );
  return { ok: false, reason: lastReason, attempts: V2_HARD_MAX_ATTEMPTS };
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
      return { ok: false, reason: reason || "all_tasks_failed", attempts: 1 };
    }

    const trees = results
      .filter(
        (r): r is { ok: true; value: Record<string, unknown>; attempts: number } =>
          r.ok,
      )
      .map((r) => r.value);
    const merged = mergeTaskTrees(trees);
    const filled = fillFromComputeIfMissing(merged, rc, locale);
    let polished = polishEvidenceTree(filled, locale);

    // ★ 最后保险:检测到裸词 → 强制补救(不打回,代码兜死)
    let evResidue = findEvidenceLeak(polished, locale);
    if (evResidue) {
      console.warn(`[v2/evidence] ⚠️ 首轮清洗后残留(${evResidue}) — 强制补救`);
      polished = mapSegmentTexts(polished, (seg) =>
        forceRemarkAndFallback(seg, locale),
      );
      evResidue = findEvidenceLeak(polished, locale);
      if (evResidue) {
        console.warn(
          `[v2/evidence] ⚠️ 补救后仍残留(${evResidue}) — 需补 SSOT/平替表`,
        );
      } else {
        console.log(`[v2/evidence] ✅ 强制补救成功,依据无裸词`);
      }
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
