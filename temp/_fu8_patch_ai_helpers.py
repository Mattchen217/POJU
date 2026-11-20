from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

old = '''import type { AnswerClass, AnswerEvent, ModelAnswerDraft, ProposedWrite, UnresolvedAnswerItem, UnresolvedAnswerReason } from "./types";
'''
new = '''import type {
  AnswerClass,
  AnswerEvent,
  IntakeControlItem,
  ModelAnswerDraft,
  ProposedWrite,
  SourceQuoteRejection,
  UnresolvedAnswerItem,
  UnresolvedAnswerReason,
  UnresolvedModelAspect,
} from "./types";
'''
assert old in text
text = text.replace(old, new, 1)

old = '''/** Stable pending item identity: source_turn_id + extracted-item index. Never text alone. */
export function unresolvedItemId(sourceTurnId: string, extractedIndex: number): string {
  return `${sourceTurnId}#${extractedIndex}`;
}
'''
new = '''/** Stable pending item identity: source_turn_id + extracted-item index. Never text alone. */
export function unresolvedItemId(sourceTurnId: string, extractedIndex: number): string {
  return `${sourceTurnId}#${extractedIndex}`;
}

export function unresolvedAspectId(sourceTurnId: string, aspectIndex: number): string {
  return `${sourceTurnId}#aspect#${aspectIndex}`;
}

export function intakeControlItemId(
  sourceTurnId: string,
  kind: IntakeControlItem["kind"],
  index = 0,
): string {
  return `${sourceTurnId}#control#${kind}#${index}`;
}

const MAX_SOURCE_QUOTE_LENGTH = 2000;

/**
 * Conservative normalization for deterministic source-quote grounding.
 * Unicode + whitespace + safe punctuation only. No semantic similarity.
 */
export function normalizeAnswerGroundingText(text: string): string {
  let s = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[；]/g, ";")
    .replace(/[：]/g, ":")
    .replace(/[？]/g, "?")
    .replace(/[！]/g, "!")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[【]/g, "[")
    .replace(/[】]/g, "]")
    .replace(/[、]/g, ",");
  return s.replace(/\s+/gu, " ").trim();
}

export type SourceQuoteGroundingResult =
  | { ok: true }
  | { ok: false; reason: SourceQuoteRejection["reason"] };

/**
 * A model extraction is grounded only when the normalized source_quote is a
 * contiguous substring of the normalized user statement.
 */
export function groundSourceQuote(
  sourceQuote: string,
  statement: string,
): SourceQuoteGroundingResult {
  if (sourceQuote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const quote = normalizeAnswerGroundingText(sourceQuote);
  const hay = normalizeAnswerGroundingText(statement);
  if (!quote) return { ok: false, reason: "source_quote_empty" };
  if (!hay.includes(quote)) return { ok: false, reason: "source_quote_not_grounded" };
  return { ok: true };
}
'''
assert old in text
text = text.replace(old, new, 1)

p.write_text(text.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
print("helpers inserted")
