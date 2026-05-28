import { isLikelyPwaContext } from "@/lib/client/pwa-standalone";

/** Visibility ratio per homepage product card (0 = off-screen / unmounted). */
const visibility = new Map<string, number>();
const subscribers = new Set<() => void>();
let granted = new Set<string>();

const CARD_STAGGER_MS: Record<string, number> = {
  poju: 0,
  glyph: 400,
  syncro: 800,
  match: 1200,
};

export function marketingSplineStaggerMs(cardKey: string): number {
  return CARD_STAGGER_MS[cardKey] ?? 0;
}

/** Non-PWA: all visible cards may run WebGL. PWA: cap concurrent scenes by viewport width. */
export function maxMarketingSplineSlots(): number {
  if (typeof window === "undefined") return 4;
  if (!isLikelyPwaContext()) return 8;
  if (window.innerWidth >= 1024) return 4;
  if (window.innerWidth >= 640) return 2;
  return 1;
}

function recomputeGranted(): Set<string> {
  const max = maxMarketingSplineSlots();
  const ranked = [...visibility.entries()]
    .filter(([, ratio]) => ratio > 0.08)
    .sort((a, b) => b[1] - a[1]);
  return new Set(ranked.slice(0, max).map(([id]) => id));
}

function notifyIfChanged(next: Set<string>) {
  const same =
    next.size === granted.size && [...next].every((id) => granted.has(id));
  if (same) return;
  granted = next;
  subscribers.forEach((fn) => fn());
}

export function setMarketingSplineVisibility(cardKey: string, ratio: number) {
  if (ratio <= 0) visibility.delete(cardKey);
  else visibility.set(cardKey, ratio);
  notifyIfChanged(recomputeGranted());
}

export function clearMarketingSplineVisibility(cardKey: string) {
  visibility.delete(cardKey);
  notifyIfChanged(recomputeGranted());
}

export function marketingSplineSlotGranted(cardKey: string): boolean {
  return granted.has(cardKey);
}

export function subscribeMarketingSplineSlots(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/** Re-evaluate slot caps after resize / orientation change (PWA). */
export function refreshMarketingSplineSlots(): void {
  granted = recomputeGranted();
  subscribers.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", refreshMarketingSplineSlots, { passive: true });
}
