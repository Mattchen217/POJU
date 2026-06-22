import { parseProviderIgnore, parseProviderOrder } from "@/lib/llm/openrouter-shared";

export type OpenRouterRoutePath = "chat" | "once";

export function providerMatchesOrderEntry(served: string, orderSlug: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const s = norm(served);
  const o = norm(orderSlug);
  if (!s || !o) return false;
  if (s === o) return true;
  const sBase = s.split("/")[0]!;
  const oBase = o.split("/")[0]!;
  return sBase === oBase || s.includes(oBase) || o.includes(sBase);
}

/** Map OpenRouter response `provider` (e.g. StreamLake) to ORDER slug (e.g. streamlake). */
export function normalizeProviderSlugForLock(served: string): string {
  const trimmed = served.trim();
  const order = parseProviderOrder();
  for (const slug of order) {
    if (providerMatchesOrderEntry(trimmed, slug)) return slug;
  }
  return trimmed.toLowerCase();
}

export function servedProviderInOrder(served: string | null | undefined): boolean {
  if (!served?.trim()) return true;
  const order = parseProviderOrder();
  if (order.length === 0) return true;
  return order.some((slug) => providerMatchesOrderEntry(served, slug));
}

export function isProviderEscapeHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Build `provider` body for OpenRouter.
 * - `lockedProvider` → order: [locked] + allow_fallbacks:false
 * - else → full OPENROUTER_PROVIDER_ORDER + allow_fallbacks:false (in-list failover only)
 */
export function openRouterProviderExtras(options?: {
  lockedProvider?: string;
  extra_ignore?: string[];
}): Record<string, unknown> | undefined {
  const ignore = parseProviderIgnore();
  if (options?.extra_ignore?.length) {
    for (const slug of options.extra_ignore) {
      const s = slug.trim();
      if (s && !ignore.includes(s)) ignore.push(s);
    }
  }

  const locked = options?.lockedProvider?.trim();
  const order = locked ? [locked] : parseProviderOrder();
  const out: Record<string, unknown> = {};

  if (order.length > 0) {
    out.order = order;
    out.allow_fallbacks = false;
  }

  if (ignore.length > 0) {
    out.ignore = ignore;
  }

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

export function resolveSessionLockedProvider(
  sessionLocked: string | null | undefined,
  servedProvider: string | null | undefined,
): string | undefined {
  if (sessionLocked?.trim()) return sessionLocked.trim();
  if (!servedProvider?.trim()) return undefined;
  return normalizeProviderSlugForLock(servedProvider);
}
