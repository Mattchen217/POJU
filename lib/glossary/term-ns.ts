/**
 * Term namespace identity + availability.
 * ziwei is typed but unavailable until Phase 2 lands SSOT rows.
 */

export type TermNs = "bazi" | "qimen" | "glyph" | "zodiac" | "ziwei";

export type TermNsAvailability = "active" | "unavailable";

export const TERM_NS_ALL: readonly TermNs[] = [
  "bazi",
  "qimen",
  "glyph",
  "zodiac",
  "ziwei",
] as const;

/** Active namespaces currently have SSOT rows in POJU_TERMS. */
export const TERM_NS_AVAILABILITY: Readonly<Record<TermNs, TermNsAvailability>> = {
  bazi: "active",
  qimen: "active",
  glyph: "active",
  zodiac: "active",
  /** Phase 2: structure labels active; palace/star values remain disposition-gated. */
  ziwei: "active",
};

export function isTermNs(value: string): value is TermNs {
  return (TERM_NS_ALL as readonly string[]).includes(value);
}

export function isTermNsAvailable(ns: TermNs): boolean {
  return TERM_NS_AVAILABILITY[ns] === "active";
}
