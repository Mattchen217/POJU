/**
 * Phase 10 — soft labels for user-delivery ZFP slices / prompts.
 * Raw ZiweiFactPack stays traditional for computation; delivery projection never
 * falls back to traditional palace/star/pattern names.
 */

import {
  toTermLocale,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import { sha256Hex } from "@/lib/sha256";
import { ziweiTokenDisposition } from "@/lib/ziwei/token-disposition";

export function ziweiPatternHitId(name: string): string {
  // Isomorphic — soft-zfp is pulled into client via slice/delivery schema.
  return sha256Hex(new TextEncoder().encode(name.trim())).slice(0, 12);
}

/** Soft label or empty — never traditional fallback. */
export function softZiweiLabel(raw: string, localeInput: string = "zh"): string {
  const input = raw.trim();
  if (!input) return "";
  const locale = toTermLocale(localeInput);
  const resolved = resolvePojuTerm(input, { namespace: "ziwei" });
  if (resolved.status === "resolved") {
    return (resolved.term.term[locale] || resolved.term.term.en || resolved.term.term.zh).trim();
  }
  const disposition = ziweiTokenDisposition(input);
  if (disposition.status === "public_glossary") {
    // Should have resolved via SSOT; treat as blocked if not.
    return "";
  }
  // internal_only / unknown / forbidden / ambiguous → hide
  return "";
}

export function softZiweiLabelList(
  raws: readonly string[],
  localeInput: string = "zh",
): string[] {
  return raws.map((r) => softZiweiLabel(r, localeInput)).filter((s) => s.length > 0);
}

/** Ganzhi / age / year digits pass through; Han structure tokens soft-map or blank. */
export function softZiweiStructureField(
  raw: string,
  localeInput: string = "zh",
): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥0-9]+$/.test(t)) return t;
  return softZiweiLabel(t, localeInput);
}

export function softSihuaHit(
  hit: { mutagen?: string; star?: string; palace?: string },
  localeInput: string = "zh",
): { mutagen: string; star: string; palace: string } | null {
  const mutagen = softZiweiStructureField(hit.mutagen ?? "", localeInput);
  // Star/palace: soft or blank (never traditional)
  const star = softZiweiLabel(hit.star ?? "", localeInput);
  const palace = softZiweiLabel(hit.palace ?? "", localeInput);
  if (!mutagen && !star && !palace) return null;
  return { mutagen, star, palace };
}

export type SoftPatternHit = {
  hit_id: string;
  level: string;
  /** Soft palace labels only; never traditional. */
  palaces: string[];
};

export function softPatternHits(
  hits: readonly { name?: string; level?: string; palaces?: readonly string[] }[],
  localeInput: string = "zh",
): SoftPatternHit[] {
  const out: SoftPatternHit[] = [];
  for (const h of hits) {
    const name = (h.name ?? "").trim();
    if (!name) continue;
    out.push({
      hit_id: ziweiPatternHitId(name),
      level: (h.level ?? "neutral").trim() || "neutral",
      palaces: softZiweiLabelList(h.palaces ?? [], localeInput),
    });
  }
  return out;
}

/** Prompt-safe pattern refs (no classical 格名). */
export function patternHitRefsForPrompt(
  hits: readonly { name?: string; level?: string }[],
): string[] {
  return hits
    .map((h) => {
      const name = (h.name ?? "").trim();
      if (!name) return "";
      const level = (h.level ?? "neutral").trim() || "neutral";
      return `hit:${ziweiPatternHitId(name)}:${level}`;
    })
    .filter(Boolean);
}

export function toSoftLocale(localeInput?: string): TermLocale {
  return toTermLocale(localeInput ?? "zh");
}
