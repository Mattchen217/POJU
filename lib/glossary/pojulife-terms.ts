/**
 * pojulife terminology SSOT — collaborator naming × code-side slugs.
 * B1: bazi core 41 (structural + ten gods + match relations + wuxing + yinyang + 五行/阴阳 concepts).
 */

import {
  ALLOW_CONCEPT_SLUG,
  CLOSED_MATCH_RELATIONS,
  CLOSED_STRUCTURAL,
  CLOSED_TEN_GODS,
  CLOSED_WUXING,
  CLOSED_YINYANG,
  slugForTraditional,
} from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import { TERM_GLOSSARY } from "@/lib/glossary/term-glossary";

export type TermLocale = "zh" | "en" | "es" | "de" | "fr";
export type TermNamespace = "bazi";

export type PojuTermEntry = {
  traditional: string;
  slug: string;
  ns: TermNamespace;
  /** User-visible soft label per locale (one word / compact phrase). */
  term: Record<TermLocale, string>;
};

/** B1 batch — must match coverage gate in verify-terms.ts */
export const B1_BAZI_TRADITIONALS: readonly string[] = [
  ...CLOSED_STRUCTURAL,
  ...CLOSED_TEN_GODS,
  ...CLOSED_MATCH_RELATIONS,
  ...CLOSED_WUXING,
  ...CLOSED_YINYANG,
  "五行",
  "阴阳",
] as const;

function firstSoftPart(raw: string): string {
  return raw.split(/\s*\/\s*/)[0]!.trim();
}

function termFromGlossaryClosed(traditional: string): Record<TermLocale, string> | null {
  const row = CLOSED_SET_GLOSSARY_ENTRIES.find((c) => c.id === traditional);
  if (!row) return null;
  return {
    zh: firstSoftPart(row.soft.zh),
    en: firstSoftPart(row.soft.en),
    es: firstSoftPart(row.soft.es),
    de: firstSoftPart(row.soft.de),
    fr: firstSoftPart(row.soft.fr),
  };
}

function termFromGlossaryAllow(traditional: string): Record<TermLocale, string> | null {
  const row = TERM_GLOSSARY.find((c) => c.id === traditional);
  if (!row) return null;
  return {
    zh: firstSoftPart(row.soft.zh),
    en: firstSoftPart(row.soft.en),
    es: firstSoftPart(row.soft.es),
    de: firstSoftPart(row.soft.de),
    fr: firstSoftPart(row.soft.fr),
  };
}

/** Entries not yet in closed glossary rows (yin/yang polarity chars). */
const B1_TERM_OVERRIDES: Record<string, Record<TermLocale, string>> = {
  阴: { zh: "阴", en: "Yin", es: "Yin", de: "Yin", fr: "Yin" },
  阳: { zh: "阳", en: "Yang", es: "Yang", de: "Yang", fr: "Yang" },
};

function buildB1Entry(traditional: string): PojuTermEntry {
  const slug = slugForTraditional(traditional);
  if (!slug) {
    throw new Error(`B1 missing slug mapping for traditional=${traditional}`);
  }
  const term =
    B1_TERM_OVERRIDES[traditional] ??
    termFromGlossaryClosed(traditional) ??
    termFromGlossaryAllow(traditional);
  if (!term) {
    throw new Error(`B1 missing glossary soft labels for traditional=${traditional}`);
  }
  return { traditional, slug, ns: "bazi", term };
}

/** B1 bazi core — slugs from code fact sources; naming from glossary (unchanged). */
export const POJULIFE_TERMS_B1: PojuTermEntry[] = B1_BAZI_TRADITIONALS.map(buildB1Entry);

/** All batches (extend with B2–B6). */
export const POJULIFE_TERMS: PojuTermEntry[] = [...POJULIFE_TERMS_B1];

/** Lookup by slug. */
export function pojuTermBySlug(slug: string): PojuTermEntry | undefined {
  return POJULIFE_TERMS.find((e) => e.slug === slug);
}

/** Lookup by traditional han. */
export function pojuTermByTraditional(traditional: string): PojuTermEntry | undefined {
  return POJULIFE_TERMS.find((e) => e.traditional === traditional);
}

/** Export allow concept slugs for verify script. */
export { ALLOW_CONCEPT_SLUG };
