import { polishSanitizedText, splitIntoSentences } from "@/lib/glyph/sanitize-sentence-utils";

export const EN_PREDICTION_REPLACEMENT =
  "The emphasis is on your present readiness, not a schedule.";
export const ZH_PREDICTION_REPLACEMENT =
  "重点在于你此刻的准备与觉察，而非断言时间表。";

/** Future life-event phrasing — not generic "will help / will take". */
const EN_PREDICTION_SENTENCE_PATTERNS: RegExp[] = [
  /\bwhen\s+will\b/i,
  /\b(?:you|someone|a\s+partner|they|he|she|people|a\s+figure)\s+will\s+(?:meet|marry|get|be|appear|arrive|find|encounter|discover|see|have|become)\b/i,
  /\bwill\s+(?:meet|marry|get\s+married|appear|arrive|find|encounter|discover|be\s+(?:seen|met|found)|show\s+up|come\s+into|get\s+married)\b/i,
  /\b(?:is|are|'re)\s+going\s+to\s+(?:meet|marry|get|be|appear|happen|change|find|arrive|discover)\b/i,
  /\bgoing\s+to\s+(?:meet|marry|get\s+married|appear|happen|change|find|arrive)\b/i,
  /\b(?:soon|shortly)\s+(?:you\s+)?will\b/i,
  /\bwill\s+happen\b/i,
  /\babout\s+to\s+(?:meet|marry|happen|change|arrive|appear)\b/i,
  /\b(?:will|going\s+to|meet|marry|appear).*\bnext\s+(?:month|year|week|season)\b/i,
  /\bnext\s+(?:month|year|week|season).*\b(?:will|going\s+to|meet|marry|appear|happen)\b/i,
  /\bin\s+(?:the\s+)?(?:coming|near)\s+future\b/i,
];

const ZH_PREDICTION_SENTENCE_PATTERNS: RegExp[] = [
  /何时|什么时候|几时|何时会|何时能|何时才/,
  /会遇到|将会遇到|将会出现|就要遇到|快要遇到|一定会遇到/,
  /即将(?:遇到|出现|发生|结婚|再婚)|就要(?:到来|发生|结婚|再婚)|就要发生/,
  /(?:今年|明年|下(?:个)?月|不久|很快).*(?:会|将).*(?:遇到|出现|结婚|再婚|发生)/,
  /一定会|迟早会|不久[就便]?会/,
  /甘雨.*(?:降|来|至)|转机.*(?:来|至|到)/,
];

export type PredictionSentenceHit = {
  sentence: string;
  label: string;
};

function predictionPatterns(locale: string): RegExp[] {
  return locale.startsWith("zh") ? ZH_PREDICTION_SENTENCE_PATTERNS : EN_PREDICTION_SENTENCE_PATTERNS;
}

function replacementForLocale(locale: string): string {
  return locale.startsWith("zh") ? ZH_PREDICTION_REPLACEMENT : EN_PREDICTION_REPLACEMENT;
}

export { splitIntoSentences };

export function isPredictionSentence(sentence: string, locale: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  return predictionPatterns(locale).some((p) => {
    p.lastIndex = 0;
    return p.test(trimmed);
  });
}

export function detectPredictionSentences(
  text: string,
  locale: string,
): PredictionSentenceHit[] {
  const hits: PredictionSentenceHit[] = [];
  for (const sentence of splitIntoSentences(text)) {
    if (isPredictionSentence(sentence, locale)) {
      hits.push({
        sentence: sentence.trim(),
        label: locale.startsWith("zh") ? "prediction_zh_sentence" : "prediction_en_sentence",
      });
    }
  }
  return hits;
}

/**
 * Replace prediction sentences wholesale. Preserves non-prediction sentences verbatim.
 */
export function sanitizePredictionSentences(
  text: string,
  locale: string,
): { text: string; replaced: PredictionSentenceHit[] } {
  if (!text.trim()) return { text, replaced: [] };

  const replacement = replacementForLocale(locale);
  const replaced: PredictionSentenceHit[] = [];
  const out: string[] = [];

  for (const sentence of splitIntoSentences(text)) {
    if (isPredictionSentence(sentence, locale)) {
      replaced.push({
        sentence: sentence.trim(),
        label: locale.startsWith("zh") ? "prediction_zh_sentence" : "prediction_en_sentence",
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
