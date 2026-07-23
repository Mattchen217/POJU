import {
  extractJson,
} from "@/lib/base-analysis-v2/compute/compute-call";
import { applyPlainFallbackToText } from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import {
  buildNarrativePrompt,
  pickConclusions,
} from "@/lib/base-analysis-v2/narrative/narrative-prompt";
import {
  getNarrativeTaskByName,
  NARRATIVE_TASKS,
  type NarrativeTask,
} from "@/lib/base-analysis-v2/narrative/narrative-tasks";
import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import {
  findSegmentText,
  mapSegmentTexts,
  readPath,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";
import { bareMingliWordInPlain } from "@/lib/llm/sanitize/term-marking";
import {
  V2_HARD_MAX_ATTEMPTS,
  V2_OUTPUT_MAX_TOKENS,
} from "@/lib/base-analysis-v2/v2-llm-budget";

export { getNarrativeTaskByName, NARRATIVE_TASKS, type NarrativeTask };
export type { NarrativeTaskName } from "@/lib/base-analysis-v2/narrative/narrative-tasks";

const NARRATIVE_TEMPERATURE = 0.65;
/** 单次硬尝试 fetch 超时；硬重试共用 phase 总墙。 */
const ATTEMPT_TIMEOUT_MS = 120_000;
/** 4 Task 并发墙，对齐 Hobby 300s。 */
const TOTAL_TIMEOUT_MS = 300_000;

const CORNER_QUOTE_RE = /「[^「」]{1,40}」/;

export type NarrativeOutcome =
  | { ok: true; value: ReportSegmentTextTree; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type RunNarrativeOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

/** 校验指定 paths 是否都有非空字符串（单 Task 用）。 */
export function validateTaskPaths(
  obj: unknown,
  paths: readonly string[],
  taskName: string,
  kind: "narrative" | "evidence" = "narrative",
): string | null {
  if (!obj || typeof obj !== "object") {
    return `${kind}/${taskName}: not an object`;
  }
  for (const path of paths) {
    const v = readPath(obj, path);
    if (typeof v !== "string" || !v.trim()) {
      return `${kind}/${taskName}: missing/empty: ${path}`;
    }
  }
  return null;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (!cur[k] || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/** 深合并多个 Task 树（后写覆盖前写同路径）。 */
export function mergeTaskTrees(
  trees: readonly Record<string, unknown>[],
): ReportSegmentTextTree {
  const out: Record<string, unknown> = {};
  for (const tree of trees) {
    for (const path of SEGMENT_PATHS) {
      const v = readPath(tree, path);
      if (typeof v === "string" && v.trim()) {
        setPath(out, path, v);
      }
    }
  }
  return out as unknown as ReportSegmentTextTree;
}

/**
 * 合并后缺段 → 用第1次 core_conclusion 兜底（真内容），不填「暂缺」废话。
 */
export function fillFromComputeIfMissing(
  merged: ReportSegmentTextTree,
  rc: ReportComputed,
  locale: string,
): ReportSegmentTextTree {
  const root = structuredClone(merged) as unknown as Record<string, unknown>;
  const zh = locale.startsWith("zh");
  for (const path of SEGMENT_PATHS) {
    const v = readPath(root, path);
    if (typeof v === "string" && v.trim()) continue;
    const seg = readPath(rc, path) as SegmentComputed | undefined;
    const fallback =
      typeof seg?.core_conclusion === "string" && seg.core_conclusion.trim()
        ? seg.core_conclusion.trim()
        : zh
          ? "（本段内容暂缺。）"
          : "(This section is temporarily unavailable.)";
    setPath(root, path, fallback);
  }
  return root as unknown as ReportSegmentTextTree;
}

/**
 * 第2次正文校验：零标记 / 零角引号 / 零裸命理词。
 * 返回 deterministic 失败文案；null = 通过。
 */
export function findNarrativeBodyLeak(
  tree: unknown,
  locale: string,
): string | null {
  const markerPath = findSegmentText(tree, (t) => t.includes("⟦") || t.includes("⟧"));
  if (markerPath) {
    return locale.startsWith("zh")
      ? `正文含术语标记(${markerPath})。正文必须是纯白话，禁止出现 ⟦t:…⟧。`
      : `Body contains term markers at ${markerPath}. Plain prose only — no ⟦t:…⟧.`;
  }

  const quotePath = findSegmentText(tree, (t) => CORNER_QUOTE_RE.test(t));
  if (quotePath) {
    return locale.startsWith("zh")
      ? `正文含角引号「」(${quotePath})。不要用「」强调，把句子写清楚即可。`
      : `Body contains corner quotes at ${quotePath}. Do not use 「」 for emphasis.`;
  }

  let mingliWord: string | null = null;
  const mingliPath = findSegmentText(tree, (t) => {
    mingliWord = bareMingliWordInPlain(t);
    return mingliWord !== null;
  });
  if (mingliPath) {
    const word = mingliWord ?? "命理词";
    return locale.startsWith("zh")
      ? `正文含命理术语「${word}」(${mingliPath})。正文必须是纯白话，一个命理词都不能有。`
      : `Body contains metaphysics term "${word}" at ${mingliPath}. Plain prose only.`;
  }

  return null;
}

function polishNarrativeTree(
  tree: ReportSegmentTextTree,
  locale: string,
): ReportSegmentTextTree {
  let polished = mapSegmentTexts(tree, (seg) =>
    prepareBodyTextForGlossaryRender(seg, locale),
  );
  polished = mapSegmentTexts(polished, (seg) =>
    applyPlainFallbackToText(seg, { includeSingles: true }),
  );
  return polished;
}

/** 合并 Task 树 → 兜底 → 清洗（供单 Task HTTP fan-out 后客户端/服务端共用）。 */
export function assembleNarrativeTree(
  trees: readonly Record<string, unknown>[],
  rc: ReportComputed,
  locale: string,
): ReportSegmentTextTree {
  const merged = mergeTaskTrees(trees);
  const filled = fillFromComputeIfMissing(merged, rc, locale);
  const polished = polishNarrativeTree(filled, locale);
  const bodyResidue = findNarrativeBodyLeak(polished, locale);
  if (bodyResidue) {
    console.warn(
      `[v2/narrative] ℹ️ 清洗后正文残留(${bodyResidue}) — 放行,不打回`,
    );
  }
  return polished;
}

/**
 * 单 Task：只喂这几段的 core_conclusion，输出这几段白话。
 * ★ 硬错误可重试（空/截断/坏 JSON/连不上）；缺段合并后兜底；角引号/术语清洗放行。
 *   质量问题不打回。
 */
export async function runNarrativeTask(
  task: NarrativeTask,
  rc: ReportComputed,
  locale: string,
  opts: {
    session_id?: string;
    signal: AbortSignal;
    deadline: number;
  },
): Promise<{ ok: true; value: Record<string, unknown>; attempts: number } | { ok: false; reason: string; attempts: number }> {
  const subset = pickConclusions(rc, task.paths);
  const { system, user } = buildNarrativePrompt(subset, locale);
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
          `[v2/narrative/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — still waiting (${sec}s)…`,
        );
      }, 30_000);

      let result;
      try {
        result = await openRouterChatCompletion({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: NARRATIVE_TEMPERATURE,
          max_tokens: V2_OUTPUT_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "high",
          timeout_ms: ATTEMPT_TIMEOUT_MS,
          session_id: opts.session_id,
          call_type: "v2_narrative",
          phase_name: `v2_narrative_${task.name}`,
          signal: opts.signal,
        });
      } finally {
        clearInterval(heartbeat);
      }

      const text = result.text ?? "";
      if (!text.trim()) {
        lastReason = "empty_response";
        console.warn(
          `[v2/narrative/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — 空回复，硬重试`,
        );
        continue;
      }
      if (result.finish_reason === "length") {
        lastReason = "truncated";
        console.warn(
          `[v2/narrative/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — finish_reason=length，硬重试`,
        );
        continue;
      }

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        console.warn(
          `[v2/narrative/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — JSON 解析失败，硬重试`,
        );
        continue;
      }

      const keyErr = validateTaskPaths(parsed, task.paths, task.name);
      if (keyErr) {
        console.warn(`[v2/narrative/${task.name}] ℹ️ ${keyErr} — 保留已出段,合并后兜底`);
      }

      console.log(
        `[v2/narrative/${task.name}] ✅ Task 就绪 (hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
      );
      return { ok: true, value: parsed as Record<string, unknown>, attempts: attempt };
    } catch (e) {
      lastReason = isEmptyResponseError(e)
        ? "openrouter_empty"
        : `call_error:${e instanceof Error ? e.message : String(e)}`;
      console.warn(
        `[v2/narrative/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — ${lastReason}，硬重试`,
      );
      continue;
    }
  }

  console.error(
    `[v2/narrative/${task.name}] ❌ 硬重试用尽，最后原因：${lastReason}`,
  );
  return { ok: false, reason: lastReason, attempts: V2_HARD_MAX_ATTEMPTS };
}

/**
 * 第2次调用：4 Task 并发扩写 → 合并 → core_conclusion 兜底缺段 → 代码清洗。
 */
export async function runNarrative(
  rc: ReportComputed,
  locale: string,
  session_idOrOpts?: string | RunNarrativeOptions,
): Promise<NarrativeOutcome> {
  const opts: RunNarrativeOptions =
    typeof session_idOrOpts === "string" || session_idOrOpts === undefined
      ? { session_id: session_idOrOpts }
      : session_idOrOpts;

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("v2_narrative_total_timeout")),
    TOTAL_TIMEOUT_MS,
  );
  opts.signal?.addEventListener("abort", () => ctrl.abort(opts.signal?.reason), {
    once: true,
  });
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  try {
    const results = await Promise.all(
      NARRATIVE_TASKS.map((t) =>
        runNarrativeTask(t, rc, locale, {
          session_id: opts.session_id,
          signal: ctrl.signal,
          deadline,
        }),
      ),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      const reason = failed.map((f) => (!f.ok ? f.reason : "")).join(";");
      console.error(`[v2/narrative] ❌ 全部 Task 失败：${reason}`);
      return { ok: false, reason: reason || "all_tasks_failed", attempts: 1 };
    }

    const trees = results
      .filter((r): r is { ok: true; value: Record<string, unknown>; attempts: number } => r.ok)
      .map((r) => r.value);
    const polished = assembleNarrativeTree(trees, rc, locale);

    const attempts = Math.max(...results.map((r) => r.attempts), 1);
    const okCount = results.filter((r) => r.ok).length;
    console.log(
      `[v2/narrative] ✅ 正文树就绪 (${okCount}/${NARRATIVE_TASKS.length} tasks ok, attempts_max=${attempts})`,
    );
    return { ok: true, value: polished, attempts };
  } finally {
    clearTimeout(timer);
  }
}
