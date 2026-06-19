import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import signsData from "@/lib/glyph/data/signs.json";
import { detectComplianceViolations, filterDeletedTerms } from "@/lib/llm/sanitize/compliance-terms";
import { detectNarrativeSentences } from "@/lib/glyph/sanitize-narrative-sentences";
import { detectPredictionSentences } from "@/lib/glyph/sanitize-prediction-sentences";

export type GlyphOutputViolationCategory =
  | "bazi_term"
  | "sign_narrative"
  | "prediction"
  | "legacy_framing"
  | "compliance";

export type GlyphOutputViolation = {
  category: GlyphOutputViolationCategory;
  label: string;
  snippet: string;
};

const SIGN_POEM_PAIR = /[\u4e00-\u9fff]{5,8}[，,；;][\u4e00-\u9fff]{5,8}/g;

const STORY_FIGURE_PHRASES = [
  ...new Set(
    (signsData as Array<{ story_figure?: string }>)
      .map((s) => s.story_figure?.trim())
      .filter((v): v is string => Boolean(v)),
  ),
];

const NAMED_FIGURE_NAMES = [
  "杨六郎",
  "钟离权",
  "苏秦",
  "诸葛亮",
  "观音",
  "菩萨",
  "孔子",
  "赵子龙",
  "赵云",
  "唐僧",
  "孙悟空",
  "观音菩萨",
  "观世音",
  "吕洞宾",
  "姜子牙",
  "姜太公",
  "武则天",
  "刘备",
  "关羽",
  "张飞",
  "吕布",
  "韩信",
  "张良",
  "孙膑",
  "项羽",
  "包拯",
  "包公",
  "曹操",
  "周瑜",
  "王莽",
  "董卓",
  "苏东坡",
  "何文秀",
  "孟姜女",
];

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + len + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function collectRegexViolations(
  text: string,
  category: GlyphOutputViolationCategory,
  regex: RegExp,
  label: string,
  out: GlyphOutputViolation[],
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    out.push({
      category,
      label,
      snippet: snippetAround(text, match.index, match[0].length),
    });
  }
}

/** Divination "sign/lot" — not idioms like "cosmic sign" or "design". */
const GLYPH_FORBIDDEN_SIGN_REGEX =
  /\b(?:the|this|a|an|oracle|divination|fortune)\s+sign\b|\blot\b/gi;
const GLYPH_FORBIDDEN_ZH_QIAN_REGEX = /签(?:文|诗|意|号|筒)?|抽签|求签|灵签|解签/g;

function collectGlyphWordingViolations(text: string, locale: string, out: GlyphOutputViolation[]): void {
  if (locale.startsWith("zh")) {
    collectRegexViolations(text, "legacy_framing", GLYPH_FORBIDDEN_ZH_QIAN_REGEX, "forbidden_qian", out);
  } else {
    collectRegexViolations(text, "legacy_framing", GLYPH_FORBIDDEN_SIGN_REGEX, "forbidden_sign_lot", out);
  }
}

function collectFigureViolations(text: string, out: GlyphOutputViolation[]): void {
  for (const phrase of STORY_FIGURE_PHRASES) {
    if (!text.includes(phrase)) continue;
    out.push({
      category: "sign_narrative",
      label: `story_figure:${phrase}`,
      snippet: snippetAround(text, text.indexOf(phrase), phrase.length),
    });
  }
  for (const name of NAMED_FIGURE_NAMES) {
    if (!text.includes(name)) continue;
    out.push({
      category: "sign_narrative",
      label: `historical_figure:${name}`,
      snippet: snippetAround(text, text.indexOf(name), name.length),
    });
  }
}

/** Detect glyph-specific + compliance violations (audit only — no text mutation). */
export function detectGlyphOutputViolations(text: string, locale = "zh"): GlyphOutputViolation[] {
  if (!text?.trim()) return [];

  const violations: GlyphOutputViolation[] = [];

  for (const cv of detectComplianceViolations(text, locale)) {
    violations.push({
      category: "compliance",
      label: cv.label,
      snippet: cv.snippet,
    });
  }

  collectRegexViolations(text, "sign_narrative", SIGN_POEM_PAIR, "classical_verse_pair", violations);
  collectFigureViolations(text, violations);
  collectGlyphWordingViolations(text, locale, violations);
  for (const hit of detectNarrativeSentences(text, locale)) {
    violations.push({
      category: "sign_narrative",
      label: hit.label,
      snippet: hit.sentence.slice(0, 120),
    });
  }
  for (const hit of detectPredictionSentences(text, locale)) {
    violations.push({
      category: "prediction",
      label: hit.label,
      snippet: hit.sentence.slice(0, 120),
    });
  }

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.category}:${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectReadingStrings(reading: GlyphReadingContent): string[] {
  return [
    reading.wind_category_blurb,
    reading.classical_voice,
    reading.question_response ?? "",
    reading.命理双视角.命理看此事,
    reading.命理双视角.签文看此事,
    reading.命理双视角.两者印证或冲突,
    reading.synthesis ?? reading.meaning_for_question,
    reading.hidden_tension,
    reading.your_moment,
    reading.exploration.text,
    reading.exploration.duration_estimate,
    reading.reflection_question,
  ];
}

export function auditGlyphReadingContent(
  reading: GlyphReadingContent,
  locale = "zh",
): GlyphOutputViolation[] {
  const all: GlyphOutputViolation[] = [];
  for (const s of collectReadingStrings(reading)) {
    all.push(...detectGlyphOutputViolations(s, locale));
  }
  return all;
}

export function logGlyphOutputViolations(
  violations: GlyphOutputViolation[],
  context = "glyph-output",
): void {
  if (violations.length === 0) return;
  console.error(`[${context}] OUTPUT FRAMING violations (${violations.length}):`, violations);
}

/**
 * Audit-only — logs black-word hits, returns text unchanged.
 * Output quality is enforced by prompt, not post-hoc text mutation.
 */
export function sanitizeGlyphOutput(text: string, locale: string): string {
  const filtered = filterDeletedTerms(text);
  const violations = detectGlyphOutputViolations(filtered, locale);
  if (violations.length > 0) {
    logGlyphOutputViolations(violations, "glyph-audit");
  }
  return filtered;
}

/** Audit-only — logs violations per field, returns reading unchanged. */
export function sanitizeGlyphReadingContent(
  reading: GlyphReadingContent,
  locale: string,
): GlyphReadingContent {
  const violations = auditGlyphReadingContent(reading, locale);
  if (violations.length > 0) {
    logGlyphOutputViolations(violations, "glyph-reading-audit");
  }
  return reading;
}
