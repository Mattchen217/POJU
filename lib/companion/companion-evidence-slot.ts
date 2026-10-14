/**
 * Companion evidence slot hard-gate (#10).
 * Empty / whitespace / placeholder / obvious mojibake or garbled content -> FAIL.
 * Shared by day gate + batch gate (Lab + production).
 */

export type CompanionEvidenceSlotFail = {
  failed_rule:
    | "companion_evidence_empty"
    | "companion_evidence_placeholder"
    | "companion_evidence_garbled"
    | "companion_evidence_too_thin";
  detail: string;
};

/** Strip closed-set term markers so we judge connective prose, not chrome. */
function stripEvidenceMarkers(s: string): string {
  return s
    .replace(/\u27E6t:[^|\u27E7]+\|[^\u27E7]*\u27E7/g, " ")
    .replace(/\u27E6w:[^|\u27E7]+\|[^\u27E7]*\u27E7/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole-slot placeholder tokens (category; not case phrases). */
const PLACEHOLDER_WHOLE_RE =
  /^(?:\.{2,}|\u2026+|tmp|tbd|todo|n\/?a|nil|null|none|empty|placeholder|\u5f85\u586b|\u5f85\u8865|\u5360\u4f4d|\u540c\u4e0a|\u6682\u7f3a|\u6682\u7528|\u65e0|\u65e0\u5185\u5bb9|\uff08\u7a7a\uff09|\(empty\)|\[evidence\]|\u4fe1\u53f7\u5e73\u8861\u89c1\u6458\u8981[.\u3002]?)$/i;

/** Sanitize leftover shell alone is not real evidence. */
const SANITIZE_SHELL_RE = /^\u4fe1\u53f7\u5e73\u8861\u89c1\u6458\u8981[.\u3002]?$/;

/**
 * Obvious mojibake / encoding garbage.
 * U+FFFD, CP1252 rendering of U+FFFD, classic UTF-8-as-Latin-1 clusters.
 */
function looksMojibakeOrGarbled(raw: string, plain: string): boolean {
  if (/\uFFFD/.test(raw) || /\u00ef\u00bf\u00bd/.test(raw)) return true;
  // UTF-8 bytes misread as Latin-1 / Windows-1252
  if (/\u00c3[\u0080-\u00BF]|\u00c2[\u0080-\u00BF]|\u00e2[\u20ac\u00c3\u00a2]/.test(raw)) {
    return true;
  }

  // After strip: mostly punctuation / symbols, almost no letters or CJK
  const letters = plain.replace(
    /[^\p{L}\p{N}\u4e00-\u9fff\u3400-\u4dbf]/gu,
    "",
  );
  if (plain.length >= 4 && letters.length < 2) return true;

  // Single char hammered
  if (plain.length >= 6) {
    const compact = plain.replace(/\s/g, "");
    const uniq = new Set([...compact]);
    if (uniq.size <= 2 && compact.length >= 6) return true;
  }

  return false;
}

/** Minimum connective prose after marker strip (category floor). */
const MIN_PLAIN_CHARS = 12;

/**
 * Assess one Companion day evidence slot.
 * Returns null when the slot is shippable; otherwise a hard-fail rule.
 */
export function assessCompanionEvidenceSlot(
  evidence: string | null | undefined,
): CompanionEvidenceSlotFail | null {
  const raw = typeof evidence === "string" ? evidence : "";
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      failed_rule: "companion_evidence_empty",
      detail:
        "evidence empty or whitespace-only -- machine gate hard-fail (no soft-pass)",
    };
  }

  if (PLACEHOLDER_WHOLE_RE.test(trimmed) || SANITIZE_SHELL_RE.test(trimmed)) {
    return {
      failed_rule: "companion_evidence_placeholder",
      detail:
        "evidence is placeholder/shell (.../TBD/pending-fill/signal-shell) -- hard-fail",
    };
  }

  const plain = stripEvidenceMarkers(trimmed);
  if (!plain) {
    return {
      failed_rule: "companion_evidence_empty",
      detail: "evidence has no prose after term-slot strip -- hard-fail",
    };
  }

  if (looksMojibakeOrGarbled(trimmed, plain)) {
    return {
      failed_rule: "companion_evidence_garbled",
      detail: "evidence looks mojibake/garbled/symbol-only -- hard-fail",
    };
  }

  if (plain.length < MIN_PLAIN_CHARS) {
    return {
      failed_rule: "companion_evidence_too_thin",
      detail: `evidence prose too thin (<${MIN_PLAIN_CHARS}) -- hard-fail`,
    };
  }

  return null;
}
