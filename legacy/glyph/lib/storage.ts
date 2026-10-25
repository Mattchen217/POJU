import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

const GLYPH_FREE_USED_KEY = "pojulife_glyph_free_used_v1";

export type GlyphUsageSnapshot = {
  has_used_free: boolean;
  can_use_free: boolean;
};

/** Client-side free/paid quota (mirrors `/api/glyph/quota` when available). */
export async function checkGlyphUsage(): Promise<GlyphUsageSnapshot> {
  if (!isPaymentGatewayEnabled()) {
    return { has_used_free: false, can_use_free: true };
  }
  if (typeof window === "undefined") {
    return { has_used_free: false, can_use_free: true };
  }

  try {
    const res = await fetch("/api/glyph/quota", { method: "GET", cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { canUseFree?: boolean };
      const canUseFree = Boolean(data.canUseFree);
      return { has_used_free: !canUseFree, can_use_free: canUseFree };
    }
  } catch {
    // fall through to localStorage
  }

  const used = localStorage.getItem(GLYPH_FREE_USED_KEY) === "1";
  return { has_used_free: used, can_use_free: !used };
}

export function markGlyphFreeUsedLocal(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLYPH_FREE_USED_KEY, "1");
  } catch {
    // ignore
  }
}
