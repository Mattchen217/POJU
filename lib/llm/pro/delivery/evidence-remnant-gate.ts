/**
 * Phase-4 evidence remnant gate (命盘总纲与依据渲染规范 §3.3).
 *
 * Blocks half-rendered junk before checkpoint / assemble:
 * - L383-class 【火】 / 【水:水】 brackets (not all 【】 — plain-fallback may use longer 【白话】)
 * - broken / unclosed ⟦w: / ⟦t: markers
 * - toxic connective pads repeated ≥2 in one paragraph (L383)
 * - leftover ⟦w: after encode / assemble (opts.ban_word_slots)
 */

/** L383-class narrative pads — presence ≥2 in one paragraph → fail. */
export const EVIDENCE_TOXIC_PAD_PHRASES = [
  "由此先带动这一层变化",
  "再托住后面这一段节奏",
  "对上眼前这一头选择",
  "衔接到这一环现实压力",
  "再落到你此刻能用的处",
] as const;

/** Bare five-element or alias dump inside 【】 (L383). */
const WUXING_BRACKET_RE = /【\s*[木火土金水]\s*】/u;
/** Half-rendered compound like 【水:水】 / 【火:火】. */
const COLON_BRACKET_RE = /【[^】]{0,12}:[^】]{0,12}】/u;
const BROKEN_W_OPEN_RE = /⟦(?:w|词):[^⟧]*$/m;
const BROKEN_T_OPEN_RE = /⟦t:[^⟧]*$/m;
const UNCLOSED_W_RE = /⟦(?:w|词):(?![^⟧]*⟧)/;
const UNCLOSED_T_RE = /⟦t:(?![^⟧]*⟧)/;

export type EvidenceRemnantHit = {
  reason: string;
  detail: string;
};

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while (i < hay.length) {
    const at = hay.indexOf(needle, i);
    if (at < 0) break;
    n += 1;
    i = at + needle.length;
  }
  return n;
}

/**
 * Scan evidence (or full book markdown) for half-render remnants.
 * Returns the first hit, or null when clean.
 *
 * `ban_word_slots`: after mark encode / assemble — leftover `⟦w:⟧` is illegal.
 * Leave false during connective mark (slots still present by design).
 */
export function findEvidenceRemnant(
  text: string,
  opts?: { ban_word_slots?: boolean },
): EvidenceRemnantHit | null {
  const t = text ?? "";
  if (!t.trim()) return null;

  const wx = t.match(WUXING_BRACKET_RE);
  if (wx) {
    return {
      reason: "evidence_remnant_bracket",
      detail: wx[0]!.slice(0, 32),
    };
  }
  const colon = t.match(COLON_BRACKET_RE);
  if (colon) {
    return {
      reason: "evidence_remnant_bracket",
      detail: colon[0]!.slice(0, 32),
    };
  }

  if (BROKEN_W_OPEN_RE.test(t) || UNCLOSED_W_RE.test(t)) {
    return { reason: "evidence_remnant_broken_w", detail: "unclosed_⟦w:" };
  }
  if (BROKEN_T_OPEN_RE.test(t) || UNCLOSED_T_RE.test(t)) {
    return { reason: "evidence_remnant_broken_t", detail: "unclosed_⟦t:" };
  }

  if (opts?.ban_word_slots && /⟦(?:w|词):[^⟧]+⟧/.test(t)) {
    return { reason: "evidence_remnant_leftover_w", detail: "⟦w: present" };
  }

  for (const pad of EVIDENCE_TOXIC_PAD_PHRASES) {
    const n = countOccurrences(t, pad);
    if (n >= 2) {
      return {
        reason: "evidence_remnant_toxic_pad",
        detail: `${pad}:${n}`,
      };
    }
  }

  return null;
}

export function assertEvidenceRemnantClean(
  text: string,
  opts?: { ban_word_slots?: boolean },
): { ok: true } | { ok: false; reason: string } {
  const hit = findEvidenceRemnant(text, opts);
  if (!hit) return { ok: true };
  return { ok: false, reason: `${hit.reason}:${hit.detail}` };
}
