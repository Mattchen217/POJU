import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import {
  SEGMENT_PATHS,
  validateReportComputed,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { buildComputePrompt } from "@/lib/base-analysis-v2/compute/compute-prompt";
import { sanitizeReportComputed } from "@/lib/base-analysis-v2/compute/report-sanitizer";
import { extractTenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";

const COMPUTE_MAX_TOKENS = 16_000; // 上限不预付:19段+真算推理,给宽
const MAX_ATTEMPTS = 3;
/** 单次 OpenRouter fetch 超时 —— 对齐 v1 xhigh（high 推理 + 宽 max_tokens）。 */
const COMPUTE_ATTEMPT_TIMEOUT_MS = 270_000;
/** 总超时：覆盖最多 3 次 attempt。 */
const COMPUTE_TOTAL_TIMEOUT_MS = 900_000;

/**
 * 时间锚兜底(补丁1 代码侧双保险)。
 * ⚠️ 关键微调:采纳朋友"扩覆盖",但【放行】补丁1 允许的中性词——
 *   放行:大运逢印 / 流年引动 / 岁运相冲(不带具体干支/数字/岁数)
 *   禁止:2026年 / 35岁 / 丙午大运 / 丙午流年 / 虚岁35 / 第三步大运 / 二〇二六年 / 交运
 * 所以【不】单独禁"流年|大运"二字(会误杀中性词),只禁它们跟具体干支/数字连用,
 * 以及独立的年份/岁数/序数大运/交运起运。
 */
export const TIME_ANCHOR_RE = new RegExp(
  [
    "(19|20)\\d{2}\\s*年?", // 2026 / 2026年
    "[一二三四五六七八九〇零]{2,4}年", // 二〇二六年
    "[1-9]\\d?\\s*(岁|周岁|虚岁)", // 35岁
    "(虚岁|周岁)\\s*[1-9]\\d?", // 虚岁35
    "第[一二三四五六七八九十\\d]+步?大运", // 第三步大运
    "[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\\s*(大运|流年|年|运)", // 丙午大运/丙午流年/丙午年
    "交运|起运", // 交运/起运(隐含时间点)
  ].join("|"),
);

/** Layer-3: Ten-God compound abbreviations that must not survive sanitizer. */
export const SIMP_RE = /(比劫|官杀|食伤|印枭|枭印|财官|杀印|财官杀)/;

function readSegment(rc: ReportComputed, path: string): SegmentComputed | undefined {
  const parts = path.split(".");
  let cur: unknown = rc;
  for (const key of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  if (!cur || typeof cur !== "object") return undefined;
  return cur as SegmentComputed;
}

function scanSegments(
  rc: ReportComputed,
  test: (text: string) => boolean,
): string | null {
  for (const path of SEGMENT_PATHS) {
    const seg = readSegment(rc, path);
    if (!seg) continue;
    if (test(seg.core_conclusion ?? "")) return `${path}.core_conclusion`;
    for (const b of seg.bazi_basis ?? []) {
      if (test(String(b))) return `${path}.bazi_basis:${b}`;
    }
  }
  // summary top-level strings (not only card_basis)
  const s = rc.summary;
  if (test(s.current_theme ?? "")) return "summary.current_theme";
  for (const k of s.keywords ?? []) {
    if (test(String(k))) return `summary.keywords:${k}`;
  }
  for (const d of s.dos ?? []) {
    if (test(String(d))) return `summary.dos:${d}`;
  }
  for (const d of s.donts ?? []) {
    if (test(String(d))) return `summary.donts:${d}`;
  }
  return null;
}

export function findTimeAnchorLeak(rc: ReportComputed): string | null {
  return scanSegments(rc, (t) => TIME_ANCHOR_RE.test(t));
}

/** Layer-3: catch Ten-God compound abbreviations that Layer-2 did not expand. */
export function findSimpLeak(rc: ReportComputed): string | null {
  return scanSegments(rc, (t) => SIMP_RE.test(t));
}

/**
 * 抽 JSON —— 强壮版(采纳朋友漏洞1):
 * high 模型可能在 JSON 前吐思维链前缀,带 ^ 锚点的旧正则会失败。
 * 改成抓【最外层 { ... }】,忽略前后所有 Markdown/废话。
 */
export function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no_json_object_found");
  return JSON.parse(match[0]!);
}

export type ComputeOutcome =
  | { ok: true; value: ReportComputed; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type RunComputeOptions = {
  session_id?: string;
  signal?: AbortSignal;
};

/**
 * 第1次调用:真算 → ReportComputed。
 * 三层纵深：Prompt 约束 → 上下文简称清洗 → 正则拦简称/时间锚并同参重发。
 * 全失败→ error(不落库、不进第2/3次),由 orchestrate 决定提示重试。
 */
export async function runCompute(
  structured: ProfileStructured,
  locale: string,
  session_idOrOpts?: string | RunComputeOptions,
): Promise<ComputeOutcome> {
  const opts: RunComputeOptions =
    typeof session_idOrOpts === "string" || session_idOrOpts === undefined
      ? { session_id: session_idOrOpts }
      : session_idOrOpts;

  const { system, user } = buildComputePrompt(structured, locale);
  const tenGodCtx = extractTenGodContext(structured);
  let lastReason = "unknown";

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("v2_compute_total_timeout")),
    COMPUTE_TOTAL_TIMEOUT_MS,
  );
  opts.signal?.addEventListener("abort", () => ctrl.abort(opts.signal?.reason), { once: true });
  const deadline = Date.now() + COMPUTE_TOTAL_TIMEOUT_MS;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline || ctrl.signal.aborted) {
        lastReason = "total_timeout";
        console.warn(
          `[v2/compute] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})—— 停止重发。`,
        );
        break;
      }

      try {
        const attemptStartedAt = Date.now();
        const heartbeat = setInterval(() => {
          const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — still waiting on OpenRouter (${sec}s)…`,
          );
        }, 30_000);

        let result;
        try {
          result = await openRouterChatCompletion({
            // 不传 model —— 走内置候选池(与 v1 一致,无占位符、无非法 slug)
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.35,
            max_tokens: COMPUTE_MAX_TOKENS,
            json_mode: true, // 强制 JSON(与 core_judgments 一致)
            reasoning_effort: "high", // 三次调用全 high
            timeout_ms: COMPUTE_ATTEMPT_TIMEOUT_MS,
            session_id: opts.session_id,
            call_type: "v2_compute",
            phase_name: "v2_compute_high",
            signal: ctrl.signal,
          });
        } finally {
          clearInterval(heartbeat);
        }

        const text = result.text ?? "";
        if (!text.trim()) {
          lastReason = "empty_response";
          console.warn(`[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 空回复，重发`);
          continue;
        }
        if (result.finish_reason === "length") {
          lastReason = "truncated";
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — finish_reason=length，max_tokens(${COMPUTE_MAX_TOKENS})吃光，重发`,
          );
          continue;
        }

        let parsed: unknown;
        try {
          parsed = extractJson(text);
        } catch {
          lastReason = "json_parse_failed";
          console.warn(`[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — JSON 解析失败，重发`);
          continue;
        }

        const v = validateReportComputed(parsed);
        if (!v.ok) {
          lastReason = `schema_invalid:${v.reason}`;
          const summary =
            parsed && typeof parsed === "object"
              ? (parsed as Record<string, unknown>).summary
              : undefined;
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 结构校验失败(${v.reason})，重发`,
            { summary_preview: summary },
          );
          continue;
        }

        // Layer-2: expand 官杀/食伤/比劫/印枭 using natal Ten-God context (0ms, $0)
        const cleaned = sanitizeReportComputed(v.value, tenGodCtx);

        const simpLeak = findSimpLeak(cleaned);
        if (simpLeak) {
          lastReason = `simp_leak:${simpLeak}`;
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 简称泄漏(${simpLeak})，重发`,
          );
          continue;
        }

        const timeLeak = findTimeAnchorLeak(cleaned);
        if (timeLeak) {
          lastReason = `time_anchor_leak:${timeLeak}`;
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 时间锚泄漏(${timeLeak})，重发`,
          );
          continue;
        }

        console.log(
          `[v2/compute] ✅ ReportComputed 就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, fell_back=${result.transport?.fell_back ?? false})`,
        );
        return { ok: true, value: cleaned, attempts: attempt };
      } catch (e) {
        if (isEmptyResponseError(e)) {
          lastReason = "openrouter_empty";
          console.warn(`[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — openrouter 空，重发`);
          continue;
        }
        lastReason = `call_error:${e instanceof Error ? e.message : String(e)}`;
        console.warn(
          `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 调用异常(${lastReason})，重发`,
        );
        continue;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  console.error(`[v2/compute] ❌ ${MAX_ATTEMPTS} 次用尽，最后原因：${lastReason}`);
  return { ok: false, reason: lastReason, attempts: MAX_ATTEMPTS };
}
