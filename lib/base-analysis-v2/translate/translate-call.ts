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
  collapseRenderBracketsToMarkers,
  expandMarkersToRenderBrackets,
  stripSpuriousZhBrackets,
  stripTranslateIslands,
} from "@/lib/base-analysis-v2/translate/render-for-translate";
import {
  buildTranslatePrompt,
  type TranslateSummaryInput,
} from "@/lib/base-analysis-v2/translate/translate-prompt";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import { collapseMarkersToEmptySlots } from "@/lib/llm/sanitize/term-marking";
import {
  V2_HARD_MAX_ATTEMPTS,
  V2_OUTPUT_MAX_TOKENS,
} from "@/lib/base-analysis-v2/v2-llm-budget";

const TRANSLATE_TEMPERATURE = 0.35;
/** 单次硬尝试 fetch 超时；硬重试共用 phase 总墙。 */
const ATTEMPT_TIMEOUT_MS = 120_000;
const TOTAL_TIMEOUT_MS = 300_000;

const MARKER_RE = /⟦t:[^⟧]+⟧/g;
/** 去掉标记后仍大量汉字 → 依据没翻（保标记过度粘贴）。 */
const HAN_RE = /[\u4e00-\u9fff]/g;

/** 把树中各 path 展开为渲染态 `[软译:释义]`，拆掉【平替】，并记录 slug 序。 */
function expandEvidenceTreeForTranslate(
  tree: Record<string, unknown>,
  paths: readonly string[],
): { tree: Record<string, unknown>; slugsByPath: Record<string, string[]> } {
  const out = structuredClone(tree) as Record<string, unknown>;
  const slugsByPath: Record<string, string[]> = {};
  for (const path of paths) {
    const v = readPath(out, path);
    if (typeof v !== "string" || !v.trim()) continue;
    if (!v.includes("⟦t:") && !v.includes("【")) continue;
    const { text, slugs } = expandMarkersToRenderBrackets(v, "zh");
    setPath(out, path, text);
    if (slugs.length > 0) slugsByPath[path] = slugs;
  }
  return { tree: out, slugsByPath };
}

/** 把译后 `[软译:释义]` 按序回填为 `⟦t:slug|⟧`，并剥残留中文伪岛。 */
function collapseEvidenceTreeAfterTranslate(
  tree: Record<string, unknown>,
  slugsByPath: Record<string, string[]>,
  paths: readonly string[],
): Record<string, unknown> {
  const out = structuredClone(tree) as Record<string, unknown>;
  for (const path of paths) {
    const v = readPath(out, path);
    if (typeof v !== "string") continue;
    const slugs = slugsByPath[path] ?? [];
    const collapsed =
      slugs.length > 0 ? collapseRenderBracketsToMarkers(v, slugs) : v;
    setPath(out, path, stripSpuriousZhBrackets(collapsed));
  }
  return out;
}

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
 * 按出现顺序，用原文标记覆盖译文标记（不打回）。
 * 译文文字保留；岛（标记）以原文为准。个数不同时尽量对齐已匹配部分。
 */
export function restoreMarkersInOrder(src: string, dst: string): string {
  const srcMarks = [...(src.match(MARKER_RE) ?? [])];
  if (srcMarks.length === 0) return dst;
  let i = 0;
  return dst.replace(MARKER_RE, () => {
    const m = srcMarks[i];
    i += 1;
    return m ?? "";
  });
}

/** 对 Task 内各 path 的 evidence 做标记回填。 */
export function restoreEvidenceMarkers(
  srcEv: Record<string, unknown>,
  dstEv: Record<string, unknown>,
  paths: readonly string[],
): Record<string, unknown> {
  const out = structuredClone(dstEv) as Record<string, unknown>;
  for (const path of paths) {
    const a = readPath(srcEv, path);
    const b = readPath(out, path);
    if (typeof a === "string" && typeof b === "string" && a.includes("⟦t:")) {
      setPath(out, path, restoreMarkersInOrder(a, b));
    }
  }
  return out;
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

/** 去掉标记岛 / 渲染态括号岛后统计汉字数（依据「粘贴未译」检测用）。 */
export function countHanOutsideMarkers(text: string): number {
  return (stripTranslateIslands(text).match(HAN_RE) ?? []).length;
}

/**
 * 依据周围文字必须译成目标语。若去掉标记后仍保留大半汉字 → 判定未译。
 * （常见失败：怕改标记，把整段中文 evidence 原样粘贴。）
 */
export function findEvidenceStillChinese(
  srcEvidence: Record<string, unknown>,
  dstEvidence: Record<string, unknown>,
  paths: readonly string[],
): string | null {
  for (const path of paths) {
    const a = readPath(srcEvidence, path);
    const b = readPath(dstEvidence, path);
    if (typeof a !== "string" || typeof b !== "string") continue;
    const srcHan = countHanOutsideMarkers(a);
    if (srcHan < 12) continue;
    const dstHan = countHanOutsideMarkers(b);
    if (dstHan >= Math.max(12, Math.floor(srcHan * 0.45))) {
      return `evidence_untranslated:${path} han=${dstHan}/${srcHan}`;
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
  // 喂模型：页面渲染态 [软译:释义]；拆掉【平替】；原 srcEv 仍留 ⟦t:⟧ 供漂移回填对照
  const { tree: evidenceForModel, slugsByPath } = expandEvidenceTreeForTranslate(
    srcEv,
    task.paths,
  );
  const narrativeForModel = structuredClone(srcNar) as Record<string, unknown>;
  for (const path of task.paths) {
    const v = readPath(narrativeForModel, path);
    if (typeof v === "string" && v.includes("【")) {
      setPath(
        narrativeForModel,
        path,
        expandMarkersToRenderBrackets(v, "zh").text,
      );
    }
  }

  const payload: Record<string, unknown> = {
    narrative: narrativeForModel,
    evidence: evidenceForModel,
  };
  if (includeSummary) {
    payload.summary = {
      keywords: input.summary.keywords,
      current_theme: input.summary.current_theme,
      dos: input.summary.dos,
      donts: input.summary.donts,
    };
  }

  const { system, user } = buildTranslatePrompt(locale, payload);
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
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — still waiting (${sec}s)…`,
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
          max_tokens: V2_OUTPUT_MAX_TOKENS,
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
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — 空回复，硬重试`,
        );
        continue;
      }
      if (result.finish_reason === "length") {
        lastReason = "truncated";
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — finish_reason=length，硬重试`,
        );
        continue;
      }

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = "json_parse_failed";
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — JSON 解析失败，硬重试`,
        );
        continue;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        lastReason = "not_object";
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — not_object，硬重试`,
        );
        continue;
      }
      const root = parsed as Record<string, unknown>;
      const outNar = root.narrative;
      const outEv = root.evidence;
      if (!outNar || typeof outNar !== "object" || Array.isArray(outNar)) {
        lastReason = "missing_narrative";
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — missing_narrative，硬重试`,
        );
        continue;
      }
      if (!outEv || typeof outEv !== "object" || Array.isArray(outEv)) {
        lastReason = "missing_evidence";
        console.warn(
          `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — missing_evidence，硬重试`,
        );
        continue;
      }

      const narErr = validateTaskPaths(outNar, task.paths, task.name, "narrative");
      const evErr = validateTaskPaths(outEv, task.paths, task.name, "evidence");
      if (narErr || evErr) {
        console.warn(
          `[v2/translate/${task.name}] ℹ️ ${narErr ?? evErr} — 保留已出段,合并后用中文兜底`,
        );
      }

      // 渲染态括号 → ⟦t:slug|⟧；再与原文对照漂移回填（软，不重发）
      let evidenceOut = collapseEvidenceTreeAfterTranslate(
        outEv as Record<string, unknown>,
        slugsByPath,
        task.paths,
      );
      const drift = findMarkerDrift(srcEv, evidenceOut, task.paths);
      if (drift) {
        evidenceOut = restoreEvidenceMarkers(srcEv, evidenceOut, task.paths);
        console.warn(
          `[v2/translate/${task.name}] ℹ️ ${drift} — 已代码回填标记,不重试`,
        );
      }

      const stillZh = findEvidenceStillChinese(srcEv, evidenceOut, task.paths);
      if (stillZh) {
        console.warn(
          `[v2/translate/${task.name}] ℹ️ ${stillZh} — 观测放行,不打回（调 prompt/数据）`,
        );
      }

      const summary = includeSummary
        ? parseSummary(root.summary, input.summary)
        : undefined;

      console.log(
        `[v2/translate/${task.name}] ✅ Task 就绪 (hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
      );
      return {
        ok: true,
        narrative: outNar as Record<string, unknown>,
        evidence: evidenceOut,
        summary,
        attempts: attempt,
      };
    } catch (e) {
      lastReason = isEmptyResponseError(e)
        ? "openrouter_empty"
        : `call_error:${e instanceof Error ? e.message : String(e)}`;
      console.warn(
        `[v2/translate/${task.name}] hard attempt ${attempt}/${V2_HARD_MAX_ATTEMPTS} — ${lastReason}，硬重试`,
      );
      continue;
    }
  }

  console.error(
    `[v2/translate/${task.name}] ❌ 硬重试用尽，最后原因：${lastReason}`,
  );
  return { ok: false, reason: lastReason, attempts: V2_HARD_MAX_ATTEMPTS };
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

  // 旧 checkpoint / 误填软译槽：压回空槽，再展开为渲染态 [软译:释义] 喂翻译
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
      return { ok: false, reason: reason || "all_tasks_failed", attempts: 1 };
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
