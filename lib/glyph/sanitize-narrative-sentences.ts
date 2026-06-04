import { polishSanitizedText, splitIntoSentences } from "@/lib/glyph/sanitize-sentence-utils";
import {
  EN_QUOTED_MAXIM_PREFIX_REGEX,
  EN_QUOTED_STRING_REGEX,
  EN_STORY_SEQUENCE_NARRATIVE_REGEX,
  EN_STORY_SEQUENCE_VERB_REGEX,
  EN_WARRIOR_WHO_REGEX,
} from "@/lib/llm/sanitize/compliance-terms";

export const EN_NARRATIVE_REPLACEMENT =
  "This mirrors a classic Eastern theme: resilience that ripens in stillness, re-emerging stronger after adversity.";
export const EN_QUOTED_MAXIM_REPLACEMENT =
  "The principle here is widening perspective through patient reflection.";
export const ZH_NARRATIVE_REPLACEMENT =
  "这映照出经典东方叙事原型：在静守中沉淀、于逆境后再度浮现的韧性。";

/** English: quoted maxims / sign-poem English renderings. */
const EN_QUOTED_MAXIM_PATTERNS: RegExp[] = [
  EN_QUOTED_MAXIM_PREFIX_REGEX,
  EN_QUOTED_STRING_REGEX,
];

/** English: historical story sequence (even without names). */
const EN_STORY_SEQUENCE_PATTERNS: RegExp[] = [
  EN_WARRIOR_WHO_REGEX,
  EN_STORY_SEQUENCE_VERB_REGEX,
  /\b(?:defeated|captured|escaped|exiled|recalled|retreated|lay\s+still|lay\s+low|went\s+into\s+hiding)\b/i,
  /\b(?:mirrors|echoes|recalls|evokes)\s+(?:the\s+story\s+of|a\s+tale\s+of|the\s+tale\s+of)\b/i,
  EN_STORY_SEQUENCE_NARRATIVE_REGEX,
];
const ZH_NARRATIVE_PATTERNS: RegExp[] = [
  /['"][^'"]{6,}['"]/,
  /(?:典故|故事|传说).{0,20}(?:说|讲|述)/,
];

export type NarrativeSentenceHit = {
  sentence: string;
  label: string;
  replacement: string;
};

function narrativePatterns(locale: string): RegExp[] {
  if (locale.startsWith("zh")) return ZH_NARRATIVE_PATTERNS;
  return [...EN_QUOTED_MAXIM_PATTERNS, ...EN_STORY_SEQUENCE_PATTERNS];
}

function replacementForHit(sentence: string, locale: string): string {
  if (locale.startsWith("zh")) return ZH_NARRATIVE_REPLACEMENT;
  const isQuoted =
    EN_QUOTED_MAXIM_PATTERNS.some((p) => {
      p.lastIndex = 0;
      return p.test(sentence);
    }) || /['"][^'"]{10,}['"]/.test(sentence);
  return isQuoted ? EN_QUOTED_MAXIM_REPLACEMENT : EN_NARRATIVE_REPLACEMENT;
}

export function isNarrativeViolationSentence(sentence: string, locale: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  return narrativePatterns(locale).some((p) => {
    p.lastIndex = 0;
    return p.test(trimmed);
  });
}

export function detectNarrativeSentences(
  text: string,
  locale: string,
): NarrativeSentenceHit[] {
  const hits: NarrativeSentenceHit[] = [];
  for (const sentence of splitIntoSentences(text)) {
    if (!isNarrativeViolationSentence(sentence, locale)) continue;
    hits.push({
      sentence: sentence.trim(),
      label: locale.startsWith("zh") ? "narrative_zh_sentence" : "narrative_en_sentence",
      replacement: replacementForHit(sentence, locale),
    });
  }
  return hits;
}

/** Replace entire narrative-violation sentences; never partial in-sentence edits. */
export function sanitizeNarrativeSentences(
  text: string,
  locale: string,
): { text: string; replaced: NarrativeSentenceHit[] } {
  if (!text.trim()) return { text, replaced: [] };

  const replaced: NarrativeSentenceHit[] = [];
  const out: string[] = [];

  for (const sentence of splitIntoSentences(text)) {
    if (isNarrativeViolationSentence(sentence, locale)) {
      const replacement = replacementForHit(sentence, locale);
      replaced.push({
        sentence: sentence.trim(),
        label: locale.startsWith("zh") ? "narrative_zh_sentence" : "narrative_en_sentence",
        replacement,
      });
      const needsSpace = out.length > 0 && !/\s$/.test(out[out.length - 1] ?? "");
      out.push((needsSpace ? " " : "") + replacement + " ");
    } else {
      out.push(sentence);
    }
  }

  let joined = out.join("");
  joined = joined.replace(/([.!?。！？])([^\s])/g, "$1 $2");
  joined = polishSanitizedText(joined);
  return { text: joined, replaced };
}
