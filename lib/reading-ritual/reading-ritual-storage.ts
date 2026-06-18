export type ReadingRitualProduct = "poju" | "glyph" | "match" | "syncro";

const SEEN_PREFIX = "reading_ritual_seen_";

export function readingRitualSeenKey(product: ReadingRitualProduct): string {
  return `${SEEN_PREFIX}${product}`;
}

export function hasReadingRitualSeen(product: ReadingRitualProduct): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(readingRitualSeenKey(product)) === "1";
  } catch {
    return false;
  }
}

export function markReadingRitualSeen(product: ReadingRitualProduct): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(readingRitualSeenKey(product), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
