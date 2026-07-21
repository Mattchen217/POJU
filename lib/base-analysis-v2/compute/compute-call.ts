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
/** 单次 OpenRouter fetch 超时 —— 对齐 Vercel phase 300s 墙，不预留重试。 */
const COMPUTE_ATTEMPT_TIMEOUT_MS = 270_000;

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
 * ★ 单次生成、不打回：空/坏 JSON/结构 fatal → 本阶段失败（由上层/客户端决定是否再开一轮 phase）；
 *   soft 缺段 → 占位补全；简称 → sanitizer。质量靠 prompt/数据，不靠重发。
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

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("v2_compute_timeout")),
    COMPUTE_ATTEMPT_TIMEOUT_MS,
  );
  opts.signal?.addEventListener("abort", () => ctrl.abort(opts.signal?.reason), { once: true });

  try {
    const attemptStartedAt = Date.now();
    const heartbeat = setInterval(() => {
      const sec = Math.round((Date.now() - attemptStartedAt) / 1000);
      console.warn(`[v2/compute] still waiting on OpenRouter (${sec}s)…`);
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
      console.error(`[v2/compute] ❌ 空回复（不重发）`);
      return { ok: false, reason: "empty_response", attempts: 1 };
    }
    if (result.finish_reason === "length") {
      console.warn(
        `[v2/compute] ℹ️ finish_reason=length — 仍尝试解析，不重发`,
      );
    }

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      console.error(`[v2/compute] ❌ JSON 解析失败（不重发）`);
      return { ok: false, reason: "json_parse_failed", attempts: 1 };
    }

    const v = validateReportComputed(parsed);
    let report: ReportComputed;
    if (v.ok) {
      report = v.value;
    } else if (v.severity === "fatal") {
      // 仍尝试占位补全；补全后若几乎不可用再失败
      console.warn(
        `[v2/compute] ℹ️ 结构严重损坏(${v.reason}) — 占位补全尝试，不重发`,
      );
      report = fillMissingSegments(parsed);
      const v2 = validateReportComputed(report);
      if (!v2.ok && v2.severity === "fatal") {
        console.error(`[v2/compute] ❌ 占位后仍 fatal（不重发）`);
        return { ok: false, reason: `schema_invalid:${v.reason}`, attempts: 1 };
      }
    } else {
      console.warn(`[v2/compute] ℹ️ 个别段缺失(${v.reason}) — 占位补全,不打回`);
      report = fillMissingSegments(parsed);
    }

    const cleaned = sanitizeReportComputed(report, tenGodCtx);

    const simpResidue = findSimpLeak(cleaned);
    if (simpResidue) {
      console.warn(`[v2/compute] ℹ️ 清洗后简称残留(${simpResidue}) — 放行,不打回`);
    }

    console.log(
      `[v2/compute] ✅ ReportComputed 就绪 (单次生成, fell_back=${result.transport?.fell_back ?? false})`,
    );
    return { ok: true, value: cleaned, attempts: 1 };
  } catch (e) {
    const reason = isEmptyResponseError(e)
      ? "openrouter_empty"
      : `call_error:${e instanceof Error ? e.message : String(e)}`;
    console.error(`[v2/compute] ❌ ${reason}（不重发）`);
    return { ok: false, reason, attempts: 1 };
  } finally {
    clearTimeout(timer);
  }
}
