/**
 * Pass economy product ids (Eastern OS naming).
 * Internal engine routes may still say "poju"; ledger always uses "pivot".
 */
export const PASS_PRODUCTS = ["atmos", "pivot", "match", "syncro", "glyph"] as const;

export type PassProduct = (typeof PASS_PRODUCTS)[number];

export function isPassProduct(value: string): value is PassProduct {
  return (PASS_PRODUCTS as readonly string[]).includes(value);
}

/** Map classic/internal product slugs → Pass ledger product. */
export function toPassProduct(slug: string): PassProduct | null {
  const s = slug.trim().toLowerCase();
  if (s === "poju" || s === "pivot") return "pivot";
  if (isPassProduct(s)) return s;
  return null;
}
