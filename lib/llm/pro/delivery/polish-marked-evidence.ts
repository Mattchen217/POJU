/**
 * Evidence polish for Phase-4 delivery.
 *
 * - Pre-connective / legacy: full encodeAndPolish (slots + autoMark fallback).
 * - Post-connective (current): slot encode only — never autoMark the vernacular
 *   between ⟦w:⟧ (that was shredding connective into gold walls).
 */

import {
  encodeAndPolishDeliveryEvidence,
  encodeTraditionalWordSlots,
  listUnresolvedWordSlots,
  normalizeTermMarkerIds,
  rewriteMarkersWithSsotSoft,
  WORD_SLOT_PATTERN,
  bracketUnresolvedTerm,
} from "@/lib/llm/sanitize/term-marking";

/** Count `⟦w:…⟧` / `⟦词:…⟧` slots in evidence (connective gate). */
export function countEvidenceWordSlots(text: string): number {
  if (!text?.trim()) return 0;
  return [...text.matchAll(/⟦(?:w|词):[^⟧]+⟧/g)].length;
}

/**
 * After connective: map word-slots → ⟦t:slug|soft|…⟧ for the frontend.
 * Does NOT autoMark bare soft/jargon in the connective prose.
 * Strips soft-gloss echo immediately after a marker (需养需养).
 */
export function encodeConnectiveEvidenceToTerms(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const slotted = encodeTraditionalWordSlots(text);
  if (slotted.unresolved.length > 0) {
    console.warn("[delivery/code-mark] unresolved word-slot → 【】 (delivery continues)", {
      where: "post_connective_encode",
      count: [...new Set(slotted.unresolved)].length,
      sample: [...new Set(slotted.unresolved)].slice(0, 12),
    });
  }

  let out = slotted.text.replace(/\s*\n+\s*/g, " ").trim();
  out = rewriteMarkersWithSsotSoft(normalizeTermMarkerIds(out, locale), locale);

  const still = listUnresolvedWordSlots(out);
  if (still.length > 0) {
    console.warn("[delivery/code-mark] unresolved word-slot → 【】 (delivery continues)", {
      where: "post_connective_encode_residual",
      count: [...new Set(still)].length,
      sample: [...new Set(still)].slice(0, 12),
    });
    WORD_SLOT_PATTERN.lastIndex = 0;
    out = out.replace(WORD_SLOT_PATTERN, (_m, raw: string) =>
      bracketUnresolvedTerm(String(raw).trim()),
    );
  }
  out = stripSoftGlossEchoAfterMarkers(out);
  return out.trim();
}

/**
 * Remove immediate soft-gloss echo after a term marker:
 * `⟦t:weak_self|需养|…⟧需养` → marker only.
 */
export function stripSoftGlossEchoAfterMarkers(text: string): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  return text.replace(/⟦t:([^⟧]+)⟧(\s*)([^\s⟦⟧，。；、,.!?]+)/g, (full, inner, ws, next) => {
    const soft = String(inner).split("|")[1]?.trim() ?? "";
    if (soft.length >= 2 && next === soft) {
      return `⟦t:${inner}⟧${ws ?? ""}`;
    }
    return full;
  });
}

/** Full polish (slots + autoMark) — use only before connective / legacy paths. */
export function polishMarkedEvidenceText(text: string, locale: string): string {
  return encodeAndPolishDeliveryEvidence(text, locale);
}
