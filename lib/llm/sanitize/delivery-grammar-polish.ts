/**
 * Conservative delivery copy grammar polish — safe a/an fixes + duplicate-word warnings.
 * Only touches visible text segments; preserves ⟦t:…⟧ markers verbatim.
 */

import { TERM_MARKER_PATTERN } from "@/lib/llm/sanitize/term-marking";

/** "a" before vowel letter, but consonant sound — do not change to "an". */
const A_BEFORE_VOWEL_EXCEPTIONS = new Set([
  "one",
  "once",
  "unique",
  "university",
  "union",
  "united",
  "unicorn",
  "user",
  "useful",
  "utopia",
  "uniform",
  "european",
  "eulogy",
  "ufo",
  "ukulele",
]);

/** Silent / vowel-sound "h" — "a hour" → "an hour". */
const A_TO_AN_H_VOWEL = /\ba (hour|honest|honor|honour|heir|herb)\b/gi;

const A_TO_AN_VOWEL = /\b(A|a) ([A-Za-z]\w*)/g;

const ADJACENT_DUPLICATE = /\b([A-Za-z]{2,})\s+\1\b/gi;

const DUPLICATE_ALLOW = new Set(["had", "buffalo"]);

export type GrammarPolishHit = { kind: "a_to_an" | "duplicate_word"; snippet: string };

export type GrammarPolishResult = {
  text: string;
  hits: GrammarPolishHit[];
};

function isEnglishLocale(locale: string): boolean {
  return locale.startsWith("en");
}

function shouldPolishLocale(locale: string): boolean {
  return !locale.startsWith("zh");
}

function fixArticleAn(segment: string): { text: string; fixes: GrammarPolishHit[] } {
  const fixes: GrammarPolishHit[] = [];
  let text = segment;

  text = text.replace(A_TO_AN_H_VOWEL, (match, word: string) => {
    fixes.push({ kind: "a_to_an", snippet: match });
    return `an ${word}`;
  });

  text = text.replace(A_TO_AN_VOWEL, (match, article: string, word: string) => {
    const lower = word.toLowerCase();
    if (A_BEFORE_VOWEL_EXCEPTIONS.has(lower)) return match;
    const first = lower[0];
    if (!first || !"aeiou".includes(first)) return match;
    fixes.push({ kind: "a_to_an", snippet: match });
    const repl = article === "A" ? "An" : "an";
    return `${repl} ${word}`;
  });

  return { text, fixes };
}

function auditAdjacentDuplicates(segment: string): GrammarPolishHit[] {
  const hits: GrammarPolishHit[] = [];
  ADJACENT_DUPLICATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ADJACENT_DUPLICATE.exec(segment)) !== null) {
    const word = m[1]!.toLowerCase();
    if (DUPLICATE_ALLOW.has(word)) continue;
    hits.push({ kind: "duplicate_word", snippet: m[0] });
  }
  return hits;
}

function polishPlainSegment(segment: string, locale: string): GrammarPolishResult {
  if (!segment) return { text: segment, hits: [] };

  const hits: GrammarPolishHit[] = [];
  let text = segment;

  if (isEnglishLocale(locale)) {
    const fixed = fixArticleAn(text);
    text = fixed.text;
    hits.push(...fixed.fixes);
  }

  if (shouldPolishLocale(locale)) {
    hits.push(...auditAdjacentDuplicates(text));
  }

  return { text, hits };
}

/** Polish one delivery string; markers stay untouched. */
export function polishDeliveryGrammar(text: string, locale: string): GrammarPolishResult {
  if (!text?.trim() || !shouldPolishLocale(locale)) {
    return { text, hits: [] };
  }

  const allHits: GrammarPolishHit[] = [];
  let result = "";
  let cursor = 0;

  TERM_MARKER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_MARKER_PATTERN.exec(text)) !== null) {
    const before = text.slice(cursor, m.index);
    const polished = polishPlainSegment(before, locale);
    result += polished.text;
    allHits.push(...polished.hits);
    result += m[0];
    cursor = m.index + m[0].length;
  }

  const tail = text.slice(cursor);
  const polishedTail = polishPlainSegment(tail, locale);
  result += polishedTail.text;
  allHits.push(...polishedTail.hits);

  if (allHits.length > 0) {
    const labels = allHits.slice(0, 4).map((h) => `${h.kind}:${h.snippet}`);
    console.warn(`[grammar-polish] locale=${locale}`, labels);
  }

  return { text: result, hits: allHits };
}

/** Walk JSON-like trees — polish string field values only (not object keys). */
export function polishDeepStringFields(value: unknown, locale: string): unknown {
  if (typeof value === "string") {
    return polishDeliveryGrammar(value, locale).text;
  }
  if (Array.isArray(value)) {
    return value.map((v) => polishDeepStringFields(v, locale));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = polishDeepStringFields(v, locale);
    }
    return out;
  }
  return value;
}
