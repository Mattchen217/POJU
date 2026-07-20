import {
  extractJson,
  SIMP_RE,
  TIME_ANCHOR_RE,
} from "@/lib/base-analysis-v2/compute/compute-call";
import { buildEvidencePrompt } from "@/lib/base-analysis-v2/evidence/evidence-prompt";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import {
  findSegmentText,
  mapSegmentTexts,
  validateSegmentKeys,
  type ReportSegmentTextTree,
} from "@/lib/base-analysis-v2/segment-text";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import {
  autoMarkBareTerms,
  bareMingliWordInPlain,
  forceSsotPlainInMarkers,
  maskMarkersForAudit,
} from "@/lib/llm/sanitize/term-marking";

const EVIDENCE_MAX_TOKENS = 12_000;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 270_000;
const TOTAL_TIMEOUT_MS = 900_000;

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

/** v1 打标器兜底 + 中立底座强制 SSOT 软译槽。 */
export function polishEvidenceSegment(text: string, locale: string): string {
  const marked = autoMarkBareTerms(text, locale);
  return forceSsotPlainInMarkers(marked, locale);
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

/**
 * 第3次调用：消费钥匙A+B → 依据树（含金字标记）。
 * 概率性失败无感重发；确定性失败（结构/时间锚/简称/裸词）带 ErrorMessage 重发。
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

  let lastReason = "unknown";
  let retryHint: string | null = null;

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
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline || ctrl.signal.aborted) {
        lastReason = "total_timeout";
        console.warn(
          `[v2/evidence] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})—— 停止重发。`,
        );
        break;
      }

      const { system, user } = buildEvidencePrompt(rc, locale, retryHint);

      try {
        const attemptStartedAt = Date.now();
        const heartbeat = setInterval(() => {
          const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
          console.warn(
            `[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — still waiting on OpenRouter (${sec}s)…`,
          );
        }, 30_000);

        let result;
        try {
          result = await openRouterChatCompletion({
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.35,
            max_tokens: EVIDENCE_MAX_TOKENS,
            json_mode: true,
            reasoning_effort: "high",
            timeout_ms: ATTEMPT_TIMEOUT_MS,
            session_id: opts.session_id,
            call_type: "v2_evidence",
            phase_name: "v2_evidence_high",
            signal: ctrl.signal,
          });
        } finally {
          clearInterval(heartbeat);
        }

        const text = result.text ?? "";
        if (!text.trim()) {
          lastReason = "empty_response";
          retryHint = null;
          console.warn(`[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — 空回复，重发`);
          continue;
        }
        if (result.finish_reason === "length") {
          lastReason = "truncated";
          retryHint = null;
          console.warn(
            `[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — finish_reason=length，重发`,
          );
          continue;
        }

        let parsed: unknown;
        try {
          parsed = extractJson(text);
        } catch {
          lastReason = "json_parse_failed";
          retryHint = null;
          console.warn(`[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — JSON 解析失败，重发`);
          continue;
        }

        const keyErr = validateSegmentKeys(parsed, "evidence");
        if (keyErr) {
          lastReason = `keys_invalid:${keyErr}`;
          retryHint = locale.startsWith("zh")
            ? `上一轮 key 结构不齐：${keyErr}。必须与输入同 key，每个段落值为含打标的依据字符串（不是嵌套对象）。`
            : `Previous key structure invalid: ${keyErr}. Mirror keys; each segment must be an evidence string (not a nested object).`;
          console.warn(
            `[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — ${keyErr}，带纠错重发`,
          );
          continue;
        }

        // Layer: v1 打标器兜底（裸真词补标）+ 强制空槽填 SSOT
        const polished = mapSegmentTexts(parsed as ReportSegmentTextTree, (seg) =>
          polishEvidenceSegment(seg, locale),
        );

        const leak = findEvidenceLeak(polished, locale);
        if (leak) {
          lastReason = `evidence_leak:${leak}`;
          retryHint = locale.startsWith("zh")
            ? `上一轮的依据里出现了时间锚(如2026年/丙午大运)、简称(如官杀/比劫)、或未打标的裸真词，这是错的。依据里不能有任何年份岁数大运名；命理词一律全称并打成 ⟦t:<slug>|⟧（竖线后留空）。详情：${leak}`
            : `Previous evidence had a time anchor, Ten-God abbreviation, or bare unmarked term. No years/ages/named decades; mark full terms as ⟦t:<slug>|⟧ with empty slot. Detail: ${leak}`;
          console.warn(
            `[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — 依据泄漏，带纠错重发`,
            { leak },
          );
          continue;
        }

        console.log(
          `[v2/evidence] ✅ 依据树就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
        );
        return { ok: true, value: polished, attempts: attempt };
      } catch (e) {
        if (isEmptyResponseError(e)) {
          lastReason = "openrouter_empty";
          retryHint = null;
          console.warn(`[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — openrouter 空，重发`);
          continue;
        }
        lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
        retryHint = null;
        console.warn(
          `[v2/evidence] attempt ${attempt}/${MAX_ATTEMPTS} — 调用异常(${lastReason})，重发`,
        );
        continue;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  console.error(`[v2/evidence] ❌ ${MAX_ATTEMPTS} 次用尽，最后原因：${lastReason}`);
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}
