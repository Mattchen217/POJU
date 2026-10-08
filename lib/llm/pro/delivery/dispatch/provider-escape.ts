/**
 * Task-level provider escape: attempt 1 pins primary (StreamLake);
 * attempt 2 after transport / empty / null-finish allows DigitalOcean.
 */

import { openRouterProviderExtras } from "@/lib/llm/openrouter-provider-routing";
import { parseProviderIgnore, parseProviderOrder } from "@/lib/llm/openrouter-shared";

/** OpenRouter slug — DigitalOcean hosts deepseek/deepseek-v4-pro. */
export const DELIVERY_PROVIDER_ESCAPE_DEFAULT = "digitalocean";

/**
 * Failures that warrant attempt-2 with secondary provider.
 * Includes OpenRouter finish=`-` / empty (empty_after_null_finish), not only queue/socket.
 * Also: full-wall `llm_timeout` and mid-stream `slow_throughput` (StreamLake stall class).
 */
export function isProviderEscapeFailClass(reason: string): boolean {
  return (
    /provider_queue|midstream_disconnect|socket hang up|econnreset|other side closed|und_err|fetch failed|network|empty_after_|null_finish|empty_response|parse_fail|openrouter_http_413|openrouter_http_429|rate limit|token rate limit|llm_timeout|slow_throughput|reasoning_loop|finish_length/i.test(
      reason,
    )
  );
}

/**
 * Lab v3 内容枪：仅供应侧不可控 → 新 invoke + provider escape。
 * 不含 coerce/json 形状失败（那是生成侧，禁质量空转重试）。
 * `finish_length` = max_tokens 截断未成稿；`finish_cancelled` = 270s/客户端取消；
 * `json_truncated` = 半截 JSON（开着的引号/尾逗号）——供应未完稿，非质量尺。
 */
export function isV3LabTransportSupplyFail(reason: string): boolean {
  const r = reason.trim();
  if (!r) return false;
  return /llm_timeout|finish_cancelled|finish_length|json_truncated|slow_throughput|reasoning_loop|midstream|provider_queue|empty_after_|null_finish|empty_response|socket hang up|econnreset|fetch failed|openrouter_http_413|openrouter_http_429|rate limit/i.test(
    r,
  );
}

/**
 * OpenRouter finish_reason → 供应侧失败码（空响应 / 解析失败时用）。
 * `cancelled` 常出现在慢吞吐打满 270s 客户端 abort；不得落成 json_parse_failed（会跳过 Lab escape）。
 */
export function v3SupplyReasonFromFinish(
  finish: string | null | undefined,
  fallback: "empty_response" | "json_parse_failed",
): string {
  const f = (finish ?? "").trim().toLowerCase();
  if (f === "length") return "finish_length";
  if (f === "cancelled" || f === "canceled") return "finish_cancelled";
  if (f.includes("timeout")) return "llm_timeout";
  return fallback;
}

/** 半截 JSON：未闭合字符串或尾逗号——模型/流未写完，非合法坏形状。 */
export function looksLikeTruncatedModelJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/,\s*$/.test(t)) return true;
  if (/:\s*"[^"]*$/.test(t)) return true;
  const quotes = t.match(/"/g)?.length ?? 0;
  if (quotes % 2 === 1 && /"[^"]*$/.test(t)) return true;
  const opens = (t.match(/[{[]/g) ?? []).length;
  const closes = (t.match(/[}\]]/g) ?? []).length;
  return opens > closes && !/\}\s*$/.test(t);
}

/**
 * 空响应或 JSON 解析失败时的供应/质量分流。
 * cancelled/length/半截 → 供应侧；其余 → 原 fallback（生成侧形状）。
 */
export function v3FailReasonAfterUnusableJson(input: {
  finish: string | null | undefined;
  text: string;
  empty: boolean;
}): string {
  const fromFinish = v3SupplyReasonFromFinish(
    input.finish,
    input.empty ? "empty_response" : "json_parse_failed",
  );
  if (fromFinish !== "empty_response" && fromFinish !== "json_parse_failed") {
    return fromFinish;
  }
  if (!input.empty && looksLikeTruncatedModelJson(input.text)) {
    return "json_truncated";
  }
  return fromFinish;
}

function resolvePrimary(order: string[]): string {
  return order[0]?.trim() || "streamlake";
}

/**
 * Escape secondary: OPENROUTER_PROVIDER_ESCAPE → ORDER[1] → digitalocean.
 */
export function resolveDeliveryProviderEscapeSecondary(order?: string[]): string {
  const fromEnv = process.env.OPENROUTER_PROVIDER_ESCAPE?.trim();
  if (fromEnv) return fromEnv;
  const o = order ?? parseProviderOrder();
  const second = o[1]?.trim();
  if (second) return second;
  return DELIVERY_PROVIDER_ESCAPE_DEFAULT;
}

/**
 * Build OpenRouter `provider` body for a dispatch task attempt.
 * Attempt 1: pin StreamLake. Attempt 2+: StreamLake then DigitalOcean.
 */
export function deliveryDispatchProviderBody(attempt: number): Record<string, unknown> | undefined {
  const order = parseProviderOrder();
  const primary = resolvePrimary(order);

  if (attempt <= 1) {
    return openRouterProviderExtras({ lockedProvider: primary });
  }

  const secondary = resolveDeliveryProviderEscapeSecondary(order);
  if (!secondary || secondary.toLowerCase() === primary.toLowerCase()) {
    return openRouterProviderExtras({ lockedProvider: primary });
  }

  const ignore = parseProviderIgnore();
  if (!ignore.some((s) => s.toLowerCase() === "siliconflow")) {
    ignore.push("siliconflow");
  }
  const body: Record<string, unknown> = {
    order: [primary, secondary],
    allow_fallbacks: false,
  };
  if (ignore.length > 0) body.ignore = ignore;
  console.info("[delivery/dispatch] provider escape", {
    attempt,
    order: [primary, secondary],
  });
  return body;
}
