import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  mergeTaskTrees,
  NARRATIVE_TASKS,
  validateTaskPaths,
} from "@/lib/base-analysis-v2/narrative/narrative-call";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import {
  mapSegmentTexts,
  readPath,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import {
  buildTranslatePrompt,
  type TranslateSummaryInput,
} from "@/lib/base-analysis-v2/translate/translate-prompt";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import { collapseMarkersToEmptySlots } from "@/lib/llm/sanitize/term-marking";

/** 正文+依据同 Task，段数约翻倍；给足防截断。 */
const TRANSLATE_TASK_MAX_TOKENS = 8192;
const TRANSLATE_TEMPERATURE = 0.35;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 180_000;
const TOTAL_TIMEOUT_MS = 300_000;

const MARKER_RE = /⟦t:[^⟧]+⟧/g;

export type TranslatedSummary = {
  keywords: string[];
  current_theme: string;
  dos: string[];
  donts: string[];
};

export type TranslateOutcome =
  | {
      ok: true;
      narrative: ReportSegmentTextTree;
      evidence: ReportSegmentTextTree;
      summary: TranslatedSummary;
      attempts: number;
    }
  | { ok: false; reason: string; attempts: number };

export type RunTranslateOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

export type TranslateInput = {
  narrative: ReportSegmentTextTree;
  evidence: ReportSegmentTextTree;
  summary: TranslateSummaryInput;
};

type TranslateTask = (typeof NARRATIVE_TASKS)[number];

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

/** 抽取路径子集成嵌套树（只含字符串叶）。 */
export function pickTextPaths(
  tree: ReportSegmentTextTree,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const v = readPath(tree, path);
    if (typeof v === "string" && v.trim()) {
      setPath(out, path, v);
    }
  }
  return out;
}

/** 收集文本中的标记列表（排序后可比）。 */
export function extractMarkers(text: string): string[] {
  return [...(text.match(MARKER_RE) ?? [])].sort();
}

/**
 * 校验翻译后标记是否原样保留（多重集相等）。
 * 返回失败原因；null = 通过。
 */
export function findMarkerDrift(
  srcEvidence: Record<string, unknown>,
  dstEvidence: Record<string, unknown>,
  paths: readonly string[],
): string | null {
  for (const path of paths) {
    const a = readPath(srcEvidence, path);
    const b = readPath(dstEvidence, path);
    if (typeof a !== "string" || typeof b !== "string") continue;
    const ma = extractMarkers(a);
    const mb = extractMarkers(b);
    if (ma.length === 0) continue;
    if (JSON.stringify(ma) !== JSON.stringify(mb)) {
      return `marker_drift:${path} expected=${ma.length} got=${mb.length}`;
    }
  }
  return null;
}

function parseSummary(raw: unknown, fallback: TranslateSummaryInput): TranslatedSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      keywords: [...fallback.keywords],
      current_theme: fallback.current_theme,
      dos: [...fallback.dos],
      donts: [...fallback.donts],
    };
  }
  const o = raw as Record<string, unknown>;
  const asStrArr = (v: unknown, fb: readonly string[]): string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim())
      ? (v as string[]).map((s) => s.trim())
      : [...fb];
  return {
    keywords: asStrArr(o.keywords, fallback.keywords),
    current_theme:
      typeof o.current_theme === "string" && o.current_theme.trim()
        ? o.current_theme.trim()
        : fallback.current_theme,
    dos: asStrArr(o.dos, fallback.dos),
    donts: asStrArr(o.donts, fallback.donts),
  };
}

async function runTranslateTask(
  task: TranslateTask,
  input: TranslateInput,
  locale: string,
  opts: {
    session_id?: string;
    signal: AbortSignal;
    deadline: number;
  },
): Promise<
  | {
      ok: true;
      narrative: Record<string, unknown>;
      evidence: Record<string, unknown>;
      summary?: TranslatedSummary;
      attempts: number;
    }
  | { ok: false; reason: string; attempts: number }
> {
  const includeSummary = task.name === "retune_card";
  const srcNar = pickTextPaths(input.narrative, task.paths);
  const srcEv = pickTextPaths(input.evidence, task.paths);
  let lastReason = "unknown";
  let retryHint: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() > opts.deadline || opts.signal.aborted) {
      lastReason = "total_timeout";
      console.warn(
        `[v2/translate/${task.name}] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      break;
    }

    const payload: Record<string, unknown> = {
      narrative: srcNar,
      evidence: srcEv,
    };
    if (includeSummary) {
      payload.summary = {
        keywords: input.summary.keywords,
        current_theme: input.summary.current_theme,
        dos: input.summary.dos,
        donts: input.summary.donts,
      };
    }

    const { system, user } = buildTranslatePrompt(locale, payload, retryHint);

    try {
      const attemptStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
        console.warn(
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — still waiting (${sec}s)…`,
        );
      }, 30_000);

      let result;
      try {
        result = await openRouterChatCompletion({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: TRANSLATE_TEMPERATURE,
          max_tokens: TRANSLATE_TASK_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "medium",
          timeout_ms: ATTEMPT_TIMEOUT_MS,
          session_id: opts.session_id,
          call_type: "v2_translate",
          phase_name: `v2_translate_${task.name}`,
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
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — 空回复，重发`,
        );
        continue;
      }
      if (result.finish_reason === "length") {
        lastReason = "truncated";
        retryHint = null;
        console.warn(
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — finish_reason=length，重发`,
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
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — JSON 解析失败，重发`,
        );
        continue;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        lastReason = "not_object";
        retryHint = "输出必须是含 narrative / evidence 的 JSON 对象。";
        continue;
      }
      const root = parsed as Record<string, unknown>;
      const outNar = root.narrative;
      const outEv = root.evidence;
      if (!outNar || typeof outNar !== "object" || Array.isArray(outNar)) {
        lastReason = "missing_narrative";
        retryHint = "JSON 必须含 narrative 对象。";
        continue;
      }
      if (!outEv || typeof outEv !== "object" || Array.isArray(outEv)) {
        lastReason = "missing_evidence";
        retryHint = "JSON 必须含 evidence 对象。";
        continue;
      }

      const narErr = validateTaskPaths(outNar, task.paths, task.name, "narrative");
      const evErr = validateTaskPaths(outEv, task.paths, task.name, "evidence");
      if (narErr || evErr) {
        console.warn(
          `[v2/translate/${task.name}] ℹ️ ${narErr ?? evErr} — 保留已出段,合并后用中文兜底`,
        );
      }

      const drift = findMarkerDrift(srcEv, outEv as Record<string, unknown>, task.paths);
      if (drift) {
        lastReason = drift;
        retryHint = `标记被改动了(${drift})。所有 ⟦t:…⟧ 必须原样保留，一个字符都不能改。请重译。`;
        console.warn(
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — ${drift}，重发`,
        );
        continue;
      }

      const summary = includeSummary
        ? parseSummary(root.summary, input.summary)
        : undefined;

      console.log(
        `[v2/translate/${task.name}] ✅ Task 就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
      );
      return {
        ok: true,
        narrative: outNar as Record<string, unknown>,
        evidence: outEv as Record<string, unknown>,
        summary,
        attempts: attempt,
      };
    } catch (e) {
      if (isEmptyResponseError(e)) {
        lastReason = "openrouter_empty";
        retryHint = null;
        console.warn(
          `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — openrouter 空，重发`,
        );
        continue;
      }
      lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
      retryHint = null;
      console.warn(
        `[v2/translate/${task.name}] attempt ${attempt}/${MAX_ATTEMPTS} — 调用异常(${lastReason})，重发`,
      );
      continue;
    }
  }

  console.error(
    `[v2/translate/${task.name}] ❌ ${MAX_ATTEMPTS} 次用尽，最后原因：${lastReason}`,
  );
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}

/**
 * 把中文兜底树里缺的路径补进译后树（某 Task 全失败时不丢段）。
 */
function fillMissingFromZh(
  translated: ReportSegmentTextTree,
  zhFallback: ReportSegmentTextTree,
): ReportSegmentTextTree {
  const out: Record<string, unknown> = structuredClone(translated) as unknown as Record<
    string,
    unknown
  >;
  for (const path of NARRATIVE_TASKS.flatMap((t) => t.paths)) {
    const cur = readPath(out, path);
    if (typeof cur === "string" && cur.trim()) continue;
    const fb = readPath(zhFallback, path);
    if (typeof fb === "string" && fb.trim()) {
      setPath(out, path, fb);
    }
  }
  return out as unknown as ReportSegmentTextTree;
}

/**
 * 第4次调用：4 Task 并发翻译（正文+依据配对；Task4 含 summary 短词）。
 * 仅外文站调用；中文站跳过。
 */
export async function runTranslate(
  input: TranslateInput,
  locale: string,
  session_idOrOpts?: string | RunTranslateOptions,
): Promise<TranslateOutcome> {
  if (locale.startsWith("zh")) {
    return {
      ok: true,
      narrative: input.narrative,
      evidence: input.evidence,
      summary: {
        keywords: [...input.summary.keywords],
        current_theme: input.summary.current_theme,
        dos: [...input.summary.dos],
        donts: [...input.summary.donts],
      },
      attempts: 0,
    };
  }

  // 旧 checkpoint / 误填软译槽：压回干净代号，再喂翻译（字典只认 slug→用神）
  const evidenceClean = mapSegmentTexts(input.evidence, (t) =>
    collapseMarkersToEmptySlots(t),
  );
  const translateInput: TranslateInput = {
    ...input,
    evidence: evidenceClean,
  };

  const opts: RunTranslateOptions =
    typeof session_idOrOpts === "string" || session_idOrOpts === undefined
      ? { session_id: session_idOrOpts }
      : session_idOrOpts;

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("v2_translate_total_timeout")),
    TOTAL_TIMEOUT_MS,
  );
  opts.signal?.addEventListener("abort", () => ctrl.abort(opts.signal?.reason), {
    once: true,
  });
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  try {
    const results = await Promise.all(
      NARRATIVE_TASKS.map((t) =>
        runTranslateTask(t, translateInput, locale, {
          session_id: opts.session_id,
          signal: ctrl.signal,
          deadline,
        }),
      ),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      const reason = failed.map((f) => (!f.ok ? f.reason : "")).join(";");
      console.error(`[v2/translate] ❌ 全部 Task 失败：${reason}`);
      return { ok: false, reason: reason || "all_tasks_failed", attempts: MAX_ATTEMPTS };
    }

    if (failed.length > 0) {
      console.warn(
        `[v2/translate] ⚠️ ${failed.length}/${results.length} Task 失败，缺段用中文兜底`,
      );
    }

    const okResults = results.filter(
      (
        r,
      ): r is {
        ok: true;
        narrative: Record<string, unknown>;
        evidence: Record<string, unknown>;
        summary?: TranslatedSummary;
        attempts: number;
      } => r.ok,
    );

    const narMerged = fillMissingFromZh(
      mergeTaskTrees(okResults.map((r) => r.narrative)),
      translateInput.narrative,
    );
    const evMerged = fillMissingFromZh(
      mergeTaskTrees(okResults.map((r) => r.evidence)),
      translateInput.evidence,
    );

    const summaryFromTask =
      okResults.find((r) => r.summary)?.summary ??
      ({
        keywords: [...input.summary.keywords],
        current_theme: input.summary.current_theme,
        dos: [...input.summary.dos],
        donts: [...input.summary.donts],
      } satisfies TranslatedSummary);

    const attemptsMax = Math.max(...results.map((r) => r.attempts), 1);
    console.log(
      `[v2/translate] ✅ 翻译树就绪 (${okResults.length}/${results.length} tasks ok, attempts_max=${attemptsMax})`,
    );
    return {
      ok: true,
      narrative: narMerged,
      evidence: evMerged,
      summary: summaryFromTask,
      attempts: attemptsMax,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 把译后 summary 短词写回 ReportComputed（供 merge 卡片用）。 */
export function applyTranslatedSummary(
  rc: ReportComputed,
  summary: TranslatedSummary,
): ReportComputed {
  return {
    ...rc,
    summary: {
      ...rc.summary,
      keywords: summary.keywords,
      current_theme: summary.current_theme,
      dos: summary.dos,
      donts: summary.donts,
    },
  };
}
