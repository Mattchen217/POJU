/**
 * Evidence polish for Phase-4 delivery.
 *
 * - Pre-connective / legacy: full encodeAndPolish (slots + autoMark fallback).
 * - Post-connective (current): slot encode only — never autoMark the vernacular
 *   between ⟦w:⟧ (that was shredding connective into gold walls).
 * - Post-encode: soft-mark adjacency + soft|element glue gates (Batch1 C).
 * - Template-leak ban for mark pad / connective (Batch1 D).
 */

import {
  countHanChars,
  hasAdjacentWordSlotsWithoutVernacular,
  MIN_ADJACENT_VERNACULAR_HAN,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import {
  encodeAndPolishDeliveryEvidence,
  encodeTraditionalWordSlots,
  listUnresolvedWordSlots,
  normalizeTermMarkerIds,
  rewriteMarkersWithSsotSoft,
  WORD_SLOT_PATTERN,
  bracketUnresolvedTerm,
} from "@/lib/llm/sanitize/term-marking";

/**
 * Neutral connective pad when model leaves ⟦w:⟧ slots too close.
 * MUST be natural user-facing vernacular — never internal join instructions.
 * (Legacy leak pad is banned in MARK_TEMPLATE_LEAK_PHRASES.)
 */
const SLOT_GAP_PAD_ZH = "并进一步关联到";

/**
 * Phrases that must never appear in user-visible evidence (mark pad / model echo).
 * Hitting any → mark_template_leak.
 */
export const MARK_TEMPLATE_LEAK_PHRASES = [
  "从结构与节奏上看，这两处机制是这样连上的",
  "从结构与节奏上看",
  "这两处机制是这样连上的",
  "这两处机制是这样连上",
] as const;

/** Natural replacement when stripping a leaked template phrase. */
const TEMPLATE_LEAK_REPLACEMENT_ZH = "并进一步关联到";

const WUXING_RUN = "木火土金水";

export function findTemplateLeakPhrase(text: string): string | null {
  const t = text ?? "";
  for (const p of MARK_TEMPLATE_LEAK_PHRASES) {
    if (t.includes(p)) return p;
  }
  return null;
}

/** Strip known template-leak pads; insert a short natural connective so gaps stay ≥4 Han. */
export function stripTemplateLeakPhrases(text: string): string {
  let out = text ?? "";
  for (const p of MARK_TEMPLATE_LEAK_PHRASES) {
    if (!out.includes(p)) continue;
    out = out.split(p).join(TEMPLATE_LEAK_REPLACEMENT_ZH);
  }
  out = out.replace(/(并进一步关联到){2,}/g, TEMPLATE_LEAK_REPLACEMENT_ZH);
  out = out.replace(/，{2,}/g, "，");
  return out;
}

/**
 * Pad thin gaps between adjacent ⟦w:⟧ slots so mark_adjacent_gold gate passes
 * without a full LLM retry. Only adds generic connective — never touches slot interiors.
 */
export function repairAdjacentWordSlotGaps(text: string): string {
  const raw = text ?? "";
  if (!raw.includes("⟧") || !hasAdjacentWordSlotsWithoutVernacular(raw)) return raw;
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (countHanChars(gap) >= MIN_ADJACENT_VERNACULAR_HAN) return `⟧${gap}⟦`;
    const trimmed = gap.trim();
    const pad = trimmed ? `${trimmed}，${SLOT_GAP_PAD_ZH}` : SLOT_GAP_PAD_ZH;
    return `⟧${pad}⟦`;
  });
}

/** Same gap rule for any `⟧…⟦` after encode (`⟦t:⟧` soft marks). */
export function hasAdjacentSoftMarksWithoutVernacular(text: string): boolean {
  return hasAdjacentWordSlotsWithoutVernacular(text);
}

/** Soft/term mark immediately followed by 五行 run (耗元火土 / 锚元水). */
export function findSoftGluedElement(text: string): string | null {
  const t = text ?? "";
  const re = /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const soft = String(m[1] ?? "").split("|")[1]?.trim() ?? "";
    const els = m[2] ?? "";
    if (els && soft) return `${soft}${els}`;
    if (els) return els;
  }
  return null;
}

/**
 * Element name + soft mark + same element echo, e.g. 水元素⟦t:…|锚元|…⟧水
 */
export function findElementSoftElementEcho(text: string): string | null {
  const t = text ?? "";
  const re = new RegExp(`([${WUXING_RUN}])元素\\s*⟦t:([^⟧]+)⟧\\s*\\1`);
  const m = t.match(re);
  if (m) return m[0]!;
  const re2 = new RegExp(`([${WUXING_RUN}])\\s*⟦t:([^⟧]+)⟧\\s*\\1`);
  const m2 = t.match(re2);
  if (m2) {
    const soft = String(m2[2] ?? "").split("|")[1]?.trim() ?? "";
    if (soft.length >= 2) return m2[0]!;
  }
  return null;
}

/** Pad thin gaps between adjacent ⟦t:⟧ marks (post-encode). */
export function repairAdjacentSoftMarkGaps(text: string): string {
  const raw = text ?? "";
  if (!raw.includes("⟧") || !hasAdjacentSoftMarksWithoutVernacular(raw)) return raw;
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (countHanChars(gap) >= MIN_ADJACENT_VERNACULAR_HAN) return `⟧${gap}⟦`;
    const trimmed = gap.trim();
    const pad = trimmed ? `${trimmed}，${SLOT_GAP_PAD_ZH}` : SLOT_GAP_PAD_ZH;
    return `⟧${pad}⟦`;
  });
}

/** Insert connective between soft mark and glued 五行. */
export function repairSoftGluedElements(text: string): string {
  return (text ?? "").replace(
    /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4})/g,
    (_full, inner: string, els: string) => {
      return `⟦t:${inner}⟧所对应的${els}`;
    },
  );
}

export type SoftEvidenceGateResult =
  | { ok: true; text: string; notes: string[] }
  | { ok: false; reason: string; text: string; notes: string[] };

/**
 * Post-encode soft-layer gates (Batch1 C). Local repair then hard fail.
 */
export function gateEncodedSoftEvidence(text: string): SoftEvidenceGateResult {
  const notes: string[] = [];
  let out = stripTemplateLeakPhrases(text ?? "");
  const leak = findTemplateLeakPhrase(out);
  if (leak) {
    return {
      ok: false,
      reason: `mark_template_leak:${leak}`,
      text: out,
      notes: [`mark_template_leak:${leak}`],
    };
  }

  if (hasAdjacentSoftMarksWithoutVernacular(out)) {
    out = repairAdjacentSoftMarkGaps(out);
    notes.push("soft_adjacent_repaired");
  }
  if (hasAdjacentSoftMarksWithoutVernacular(out)) {
    return {
      ok: false,
      reason: "mark_adjacent_soft_gold",
      text: out,
      notes,
    };
  }

  if (findSoftGluedElement(out)) {
    out = repairSoftGluedElements(out);
    notes.push("soft_glued_element_repaired");
  }
  const glued = findSoftGluedElement(out);
  if (glued) {
    return {
      ok: false,
      reason: `soft_glued_element:${glued}`,
      text: out,
      notes,
    };
  }

  const echo = findElementSoftElementEcho(out);
  if (echo) {
    return {
      ok: false,
      reason: `soft_element_echo:${echo.slice(0, 24)}`,
      text: out,
      notes,
    };
  }

  return { ok: true, text: out.trim(), notes };
}

/** Count `⟦w:…⟧` / `⟦词:…⟧` slots in evidence (connective gate). */
export function countEvidenceWordSlots(text: string): number {
  if (!text?.trim()) return 0;
  return [...text.matchAll(/⟦(?:w|词):[^⟧]+⟧/g)].length;
}

/**
 * After connective: map word-slots → ⟦t:slug|soft|…⟧ for the frontend.
 * Does NOT autoMark bare soft/jargon in the connective prose.
 * Runs soft-layer gate; throws Error with reason for callers that retry.
 */
export function encodeConnectiveEvidenceToTerms(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const work = stripTemplateLeakPhrases(text);
  const slotted = encodeTraditionalWordSlots(work);
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
  const gated = gateEncodedSoftEvidence(out);
  if (!gated.ok) {
    throw new Error(gated.reason);
  }
  if (gated.notes.length) {
    console.info("[delivery/code-mark] soft-layer notes", { notes: gated.notes });
  }
  return gated.text;
}

/**
 * Soft-preview for mark validate: encode then soft-gate without throw.
 */
export function previewSoftEvidenceForMark(
  wordSlotEvidence: string,
  locale: string,
): SoftEvidenceGateResult {
  if (!wordSlotEvidence?.trim()) return { ok: true, text: "", notes: [] };
  let work = stripTemplateLeakPhrases(wordSlotEvidence);
  const stillLeak = findTemplateLeakPhrase(work);
  if (stillLeak) {
    return {
      ok: false,
      reason: `mark_template_leak:${stillLeak}`,
      text: work,
      notes: [],
    };
  }

  try {
    const slotted = encodeTraditionalWordSlots(work);
    let out = slotted.text.replace(/\s*\n+\s*/g, " ").trim();
    out = rewriteMarkersWithSsotSoft(normalizeTermMarkerIds(out, locale), locale);
    WORD_SLOT_PATTERN.lastIndex = 0;
    out = out.replace(WORD_SLOT_PATTERN, (_m, raw: string) =>
      bracketUnresolvedTerm(String(raw).trim()),
    );
    out = stripSoftGlossEchoAfterMarkers(out);
    return gateEncodedSoftEvidence(out);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "soft_preview_fail";
    return { ok: false, reason, text: work, notes: [] };
  }
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

/**
 * Evidence polish for sanitize paths.
 * If text already has ⟦w:⟧ / ⟦t:⟧ → encode-only / soft-gate (no autoMark).
 * Otherwise legacy full polish.
 */
export function polishMarkedEvidenceText(text: string, locale: string): string {
  const raw = text ?? "";
  if (/⟦(?:w|词|t):/.test(raw)) {
    try {
      if (/⟦(?:w|词):/.test(raw)) {
        return encodeConnectiveEvidenceToTerms(raw, locale);
      }
      const gated = gateEncodedSoftEvidence(stripTemplateLeakPhrases(raw));
      return gated.text;
    } catch {
      return stripTemplateLeakPhrases(raw);
    }
  }
  return encodeAndPolishDeliveryEvidence(raw, locale);
}
