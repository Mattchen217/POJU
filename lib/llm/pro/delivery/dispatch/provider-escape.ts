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
 */
export function isProviderEscapeFailClass(reason: string): boolean {
  return (
    /provider_queue|midstream_disconnect|socket hang up|econnreset|other side closed|und_err|fetch failed|network|empty_after_|null_finish|empty_response|parse_fail|openrouter_http_413|openrouter_http_429|rate limit|token rate limit/i.test(
      reason,
    )
  );
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
