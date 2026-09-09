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
} from "@/lib/llm/sanitize/term-marking";
import { localizeChartTokenForZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";
import { EVIDENCE_TOXIC_PAD_PHRASES } from "@/lib/llm/pro/delivery/evidence-remnant-gate";

/**
 * Neutral gap fillers (≥4 Han) for local adjacent-slot repair only.
 * Must NOT be L383 narrative templates — those are leak / remnant fails.
 */
const NEUTRAL_SLOT_GAP_POOL_ZH = [
  "同时对应",
  "以及这里",
  "与此相关",
  "并在此处",
] as const;

/** Thin gap junk: punctuation / particles only — drop before padding (never keep 「、」+pad). */
const THIN_GAP_JUNK_RE = /^[\s、，。；：,.!?;:的与及和而之了着过]+$/u;

/**
 * Legacy glue phrases that may be stripped once then re-checked.
 * Toxic L383 pads are listed separately and always hard-fail (never "repaired").
 */
export const MARK_TEMPLATE_LEAK_PHRASES = [
  "并进一步关联到",
  "从结构与节奏上看，这两处机制是这样连上的",
  "从结构与节奏上看",
  "这两处机制是这样连上的",
  "这两处机制是这样连上",
  ...EVIDENCE_TOXIC_PAD_PHRASES,
] as const;

/** Phrases stripTemplateLeak may rewrite — excludes toxic pads (those hard-fail). */
const STRIPPABLE_TEMPLATE_LEAK_PHRASES = [
  "并进一步关联到",
  "从结构与节奏上看，这两处机制是这样连上的",
  "从结构与节奏上看",
  "这两处机制是这样连上的",
  "这两处机制是这样连上",
] as const;

/** Neutral stand-in when stripping a legacy leaked template. */
const TEMPLATE_LEAK_REPLACEMENT_ZH = NEUTRAL_SLOT_GAP_POOL_ZH[0]!;

const WUXING_RUN = "木火土金水";

function nextSlotGapPad(padIndex: { i: number }): string {
  const pad = NEUTRAL_SLOT_GAP_POOL_ZH[padIndex.i % NEUTRAL_SLOT_GAP_POOL_ZH.length]!;
  padIndex.i += 1;
  return pad;
}

/** True when gap has no usable vernacular — only space/punct/particles. */
export function isThinSlotGapJunk(gap: string): boolean {
  const t = (gap ?? "").trim();
  if (!t) return true;
  if (countHanChars(t) >= MIN_ADJACENT_VERNACULAR_HAN) return false;
  return THIN_GAP_JUNK_RE.test(t) || countHanChars(t) === 0;
}

export function findTemplateLeakPhrase(text: string): string | null {
  const t = text ?? "";
  for (const p of MARK_TEMPLATE_LEAK_PHRASES) {
    if (t.includes(p)) return p;
  }
  return null;
}

/** Toxic L383 pads — any hit is fail (not strip-repairable). */
export function findToxicPadPhrase(text: string): string | null {
  const t = text ?? "";
  for (const p of EVIDENCE_TOXIC_PAD_PHRASES) {
    if (t.includes(p)) return p;
  }
  return null;
}

/** Strip legacy template-leak pads only; toxic pads must hard-fail upstream. */
export function stripTemplateLeakPhrases(text: string): string {
  let out = text ?? "";
  for (const p of STRIPPABLE_TEMPLATE_LEAK_PHRASES) {
    if (!out.includes(p)) continue;
    out = out.split(p).join(TEMPLATE_LEAK_REPLACEMENT_ZH);
  }
  for (const pad of NEUTRAL_SLOT_GAP_POOL_ZH) {
    const re = new RegExp(`(?:${pad}){2,}`, "g");
    out = out.replace(re, pad);
  }
  out = out.replace(/，{2,}/g, "，");
  out = out.replace(/、，/g, "，");
  return out;
}

/**
 * Pad thin gaps between adjacent ⟦w:⟧ slots so mark_adjacent_gold gate passes
 * without a full LLM retry. Only adds generic connective — never touches slot interiors.
 * Punctuation-only / particle gaps are discarded (never `、，pad`).
 */
export function repairAdjacentWordSlotGaps(text: string): string {
  const raw = text ?? "";
  if (!raw.includes("⟧") || !hasAdjacentWordSlotsWithoutVernacular(raw)) return raw;
  const padIndex = { i: 0 };
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (countHanChars(gap) >= MIN_ADJACENT_VERNACULAR_HAN) return `⟧${gap}⟦`;
    const pad = nextSlotGapPad(padIndex);
    if (isThinSlotGapJunk(gap)) return `⟧${pad}⟦`;
    const trimmed = gap.trim();
    return `⟧${trimmed}${pad}⟦`;
  });
}

const WORD_SLOT_FULL_RE = /⟦(?:w|词):[^⟧]+⟧/g;

/** Ordered list of `⟦w:…⟧` / `⟦词:…⟧` markers in evidence. */
export function listEvidenceWordSlotMarkers(text: string): string[] {
  WORD_SLOT_FULL_RE.lastIndex = 0;
  return [...(text ?? "").matchAll(WORD_SLOT_FULL_RE)].map((m) => m[0]!);
}

/**
 * When the connective model drops some input `⟦w:⟧` slots, re-append the missing
 * markers with natural pads — prefer construction over LLM reject/retry loops
 * that burn minutes and hit Vercel 300s on P6 mark.
 *
 * Multiset semantics: input may repeat the same token (e.g. two `⟦w:正印⟧`).
 * Presence-only checks would skip the 2nd copy and still trip `mark_slots_dropped`.
 */
export function reinjectDroppedWordSlots(
  inputEvidence: string,
  outputEvidence: string,
): { text: string; reinjected: string[] } {
  const inSlots = listEvidenceWordSlotMarkers(inputEvidence);
  if (inSlots.length === 0) {
    return { text: outputEvidence ?? "", reinjected: [] };
  }
  let out = outputEvidence ?? "";
  const reinjected: string[] = [];
  const padIndex = { i: 0 };

  const slotKey = (slot: string): string => {
    const raw = slot.replace(/^⟦(?:w|词):/, "").replace(/⟧$/, "").trim();
    return raw.toLowerCase().replace(/\s+/g, "");
  };

  /** Remaining unmatched occurrences in output (consumed as we walk input). */
  const remaining = new Map<string, number>();
  for (const slot of listEvidenceWordSlotMarkers(out)) {
    const k = slotKey(slot);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }

  for (const slot of inSlots) {
    const k = slotKey(slot);
    const have = remaining.get(k) ?? 0;
    if (have > 0) {
      remaining.set(k, have - 1);
      continue;
    }
    const pad = nextSlotGapPad(padIndex);
    out = out.trimEnd();
    out = out ? `${out}${pad}${slot}` : slot;
    reinjected.push(slot);
  }
  if (reinjected.length > 0) {
    out = repairAdjacentWordSlotGaps(out);
  }
  return { text: out, reinjected };
}

/** Same gap rule for any `⟧…⟦` after encode (`⟦t:⟧` soft marks). */
export function hasAdjacentSoftMarksWithoutVernacular(text: string): boolean {
  return hasAdjacentWordSlotsWithoutVernacular(text);
}

/** Soft/term mark immediately followed by 五行 run (耗元火土 / 锚元水) or EN leftover (锚元water). */
export function findSoftGluedElement(text: string): string | null {
  const t = text ?? "";
  const re = /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4}|wood|fire|earth|metal|water)/gi;
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
  return repairAdjacentWordSlotGaps(text);
}

/** Insert connective between soft mark and glued 五行 (localize EN leftovers first). */
export function repairSoftGluedElements(text: string): string {
  const localized = localizeChartTokenForZh(text ?? "");
  return localized.replace(
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
  out = localizeChartTokenForZh(out);
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
 * Unresolved slots must NOT become user-visible 【】 — throw for mark retry.
 * Runs soft-layer gate; throws Error with reason for callers that retry.
 */
export function encodeConnectiveEvidenceToTerms(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const work = stripTemplateLeakPhrases(text);
  const slotted = encodeTraditionalWordSlots(work);
  if (slotted.unresolved.length > 0) {
    const sample = [...new Set(slotted.unresolved)].slice(0, 6).join(",");
    throw new Error(`unresolved_word_slot:${sample}`);
  }

  let out = slotted.text.replace(/\s*\n+\s*/g, " ").trim();
  out = rewriteMarkersWithSsotSoft(normalizeTermMarkerIds(out, locale), locale);
  // zh: strip leftover EN element/polarity atoms after traditional encode
  if (locale.toLowerCase().startsWith("zh")) {
    out = localizeChartTokenForZh(out);
  }

  const still = listUnresolvedWordSlots(out);
  if (still.length > 0) {
    const sample = [...new Set(still)].slice(0, 6).join(",");
    throw new Error(`unresolved_word_slot:${sample}`);
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
    if (slotted.unresolved.length > 0) {
      const sample = [...new Set(slotted.unresolved)].slice(0, 6).join(",");
      return {
        ok: false,
        reason: `unresolved_word_slot:${sample}`,
        text: work,
        notes: [],
      };
    }
    let out = slotted.text.replace(/\s*\n+\s*/g, " ").trim();
    out = rewriteMarkersWithSsotSoft(normalizeTermMarkerIds(out, locale), locale);
    const still = listUnresolvedWordSlots(out);
    if (still.length > 0) {
      const sample = [...new Set(still)].slice(0, 6).join(",");
      return {
        ok: false,
        reason: `unresolved_word_slot:${sample}`,
        text: work,
        notes: [],
      };
    }
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
      let softOnly = stripTemplateLeakPhrases(raw);
      if (locale.toLowerCase().startsWith("zh")) {
        softOnly = localizeChartTokenForZh(softOnly);
      }
      const gated = gateEncodedSoftEvidence(softOnly);
      return gated.text;
    } catch {
      const fallback = stripTemplateLeakPhrases(raw);
      return locale.toLowerCase().startsWith("zh")
        ? localizeChartTokenForZh(fallback)
        : fallback;
    }
  }
  let legacy = encodeAndPolishDeliveryEvidence(raw, locale);
  if (locale.toLowerCase().startsWith("zh")) {
    legacy = localizeChartTokenForZh(legacy);
  }
  return legacy;
}
