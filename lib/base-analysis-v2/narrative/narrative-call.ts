import {
  extractJson,
} from "@/lib/base-analysis-v2/compute/compute-call";
import { applyPlainFallbackToText } from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import { buildNarrativePrompt } from "@/lib/base-analysis-v2/narrative/narrative-prompt";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import {
  fillMissingSegmentTexts,
  findSegmentText,
  mapSegmentTexts,
  validateSegmentKeys,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";
import { bareMingliWordInPlain } from "@/lib/llm/sanitize/term-marking";

const NARRATIVE_MAX_TOKENS = 12_000;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 270_000;
const TOTAL_TIMEOUT_MS = 900_000;

const CORNER_QUOTE_RE = /「[^「」]{1,40}」/;

export type NarrativeOutcome =
  | { ok: true; value: ReportSegmentTextTree; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type RunNarrativeOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

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

/**
 * 第2次调用：消费钥匙A → 白话正文树。
 * 概率性失败无感重发；确定性失败（结构/角引号/命理词/标记）带 ErrorMessage 重发。
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

  let lastReason = "unknown";
  let retryHint: string | null = null;

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
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline || ctrl.signal.aborted) {
        lastReason = "total_timeout";
        console.warn(
          `[v2/narrative] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})—— 停止重发。`,
        );
        break;
      }

      const { system, user } = buildNarrativePrompt(rc, locale, retryHint);

      try {
        const attemptStartedAt = Date.now();
        const heartbeat = setInterval(() => {
          const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
          console.warn(
            `[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — still waiting on OpenRouter (${sec}s)…`,
          );
        }, 30_000);

        let result;
        try {
          result = await openRouterChatCompletion({
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.45,
            max_tokens: NARRATIVE_MAX_TOKENS,
            json_mode: true,
            reasoning_effort: "high",
            timeout_ms: ATTEMPT_TIMEOUT_MS,
            session_id: opts.session_id,
            call_type: "v2_narrative",
            phase_name: "v2_narrative_high",
            signal: ctrl.signal,
          });
        } finally {
          clearInterval(heartbeat);
        }

        const text = result.text ?? "";
        if (!text.trim()) {
          lastReason = "empty_response";
          retryHint = null; // 概率性：无感重发
          console.warn(`[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — 空回复，重发`);
          continue;
        }
        if (result.finish_reason === "length") {
          lastReason = "truncated";
          retryHint = null;
          console.warn(
            `[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — finish_reason=length，重发`,
          );
          continue;
        }

        let parsed: unknown;
        try {
          parsed = extractJson(text);
        } catch {
          lastReason = "json_parse_failed";
          retryHint = null;
          console.warn(`[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — JSON 解析失败，重发`);
          continue;
        }

        let tree: ReportSegmentTextTree;
        const keyErr = validateSegmentKeys(parsed, "narrative");
        if (keyErr) {
          console.warn(
            `[v2/narrative] ℹ️ ${keyErr} — 占位补全,不打回`,
          );
          tree = fillMissingSegmentTexts(parsed, "narrative", locale);
        } else {
          tree = parsed as ReportSegmentTextTree;
        }

        // 不打回 —— 角引号/标记/命理词全部代码清洗后放行
        let polished = mapSegmentTexts(tree, (seg) =>
          prepareBodyTextForGlossaryRender(seg, locale),
        );
        polished = mapSegmentTexts(polished, (seg) =>
          applyPlainFallbackToText(seg, { includeSingles: true }),
        );

        const bodyResidue = findNarrativeBodyLeak(polished, locale);
        if (bodyResidue) {
          console.warn(
            `[v2/narrative] ℹ️ 清洗后正文残留(${bodyResidue}) — 放行,不打回`,
          );
        }

        console.log(
          `[v2/narrative] ✅ 正文树就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, 首生成保留, fell_back=${result.transport?.fell_back ?? false})`,
        );
        return { ok: true, value: polished, attempts: attempt };
      } catch (e) {
        if (isEmptyResponseError(e)) {
          lastReason = "openrouter_empty";
          retryHint = null;
          console.warn(`[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — openrouter 空，重发`);
          continue;
        }
        lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
        retryHint = null;
        console.warn(
          `[v2/narrative] attempt ${attempt}/${MAX_ATTEMPTS} — 调用异常(${lastReason})，重发`,
        );
        continue;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  console.error(`[v2/narrative] ❌ ${MAX_ATTEMPTS} 次用尽，最后原因：${lastReason}`);
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}
