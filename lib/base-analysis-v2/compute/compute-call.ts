import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  openRouterChatCompletion,
  isEmptyResponseError,
} from "@/lib/llm/openrouter-shared";
import {
  fillMissingSegments,
  SEGMENT_PATHS,
  validateReportComputed,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { buildComputePrompt } from "@/lib/base-analysis-v2/compute/compute-prompt";
import { sanitizeReportComputed } from "@/lib/base-analysis-v2/compute/report-sanitizer";
import { extractTenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";
import {
  SIMP_RE,
  TIME_ANCHOR_RE,
} from "@/lib/base-analysis-v2/compute/leak-patterns";

export { SIMP_RE, TIME_ANCHOR_RE };

const COMPUTE_MAX_TOKENS = 16_000; // 正常 JSON~3600 + 真算推理空间；不压制输出
const MAX_ATTEMPTS = 3;
/** 单次 OpenRouter fetch 超时 —— 对齐 v1 xhigh（high 推理 + 宽 max_tokens）。 */
const COMPUTE_ATTEMPT_TIMEOUT_MS = 270_000;
/** 总超时：覆盖最多 3 次 attempt（仅真失败重试）。 */
const COMPUTE_TOTAL_TIMEOUT_MS = 900_000;

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

/** 诊断用：不触发重发。 */
export function findTimeAnchorLeak(rc: ReportComputed): string | null {
  return scanSegments(rc, (t) => TIME_ANCHOR_RE.test(t));
}

/** 诊断用：不触发重发。 */
export function findSimpLeak(rc: ReportComputed): string | null {
  return scanSegments(rc, (t) => SIMP_RE.test(t));
}

/**
 * 抽 JSON —— 强壮版:
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
 * 黄金首生成优先：除空/截断/JSON 解析失败/结构 fatal 外一律不打回；
 * 简称靠 sanitizer+【】平替；时间锚留给第3次输出端清洗。
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
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.35,
            max_tokens: COMPUTE_MAX_TOKENS,
            json_mode: true,
            reasoning_effort: "high",
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
        let report: ReportComputed;
        if (v.ok) {
          report = v.value;
        } else if (v.severity === "fatal") {
          lastReason = `schema_invalid:${v.reason}`;
          console.warn(
            `[v2/compute] attempt ${attempt}/${MAX_ATTEMPTS} — 结构严重损坏(${v.reason})，重发`,
          );
          continue;
        } else {
          console.warn(
            `[v2/compute] ℹ️ 个别段缺失(${v.reason}) — 占位补全,不打回`,
          );
          report = fillMissingSegments(parsed);
        }

        // 黄金首生成：简称代码清洗；时间锚不在此打回（输出端第3次清）
        const cleaned = sanitizeReportComputed(report, tenGodCtx);

        const simpResidue = findSimpLeak(cleaned);
        if (simpResidue) {
          console.warn(
            `[v2/compute] ℹ️ 清洗后简称残留(${simpResidue}) — 放行,不打回`,
          );
        }

        console.log(
          `[v2/compute] ✅ ReportComputed 就绪 (attempt ${attempt}/${MAX_ATTEMPTS}, 黄金首生成保留, fell_back=${result.transport?.fell_back ?? false})`,
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
