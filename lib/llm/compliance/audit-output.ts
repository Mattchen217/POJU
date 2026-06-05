/**
 * Audit-only output compliance detection (alert — never mutates text).
 * Aligns with docs/POJULIFE-定位与合规边界-v1.md
 */

export type OutputPolicyViolationCategory =
  | "bazi_term"
  | "prediction"
  | "jixiong"
  | "divination"
  | "fear_mongering"
  | "chart_fingerprint";

export type OutputPolicyViolation = {
  category: OutputPolicyViolationCategory;
  label: string;
  snippet: string;
};

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + len + 24);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushRegex(
  text: string,
  regex: RegExp,
  category: OutputPolicyViolationCategory,
  label: string,
  out: OutputPolicyViolation[],
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

function pushPatterns(
  text: string,
  patterns: RegExp[],
  category: OutputPolicyViolationCategory,
  label: string,
  out: OutputPolicyViolation[],
): void {
  for (const p of patterns) {
    const flags = p.flags.includes("g") ? p.flags : `${p.flags}g`;
    pushRegex(text, new RegExp(p.source, flags), category, label, out);
  }
}

/** Bazi / chart proprietary fingerprints — NOT bare Five Elements as personality. */
const EN_BAZI_TERMS: Array<[RegExp, string]> = [
  [/\b(?:Day Master|Yong Shen|Ji Shen|Da Yun|Four Pillars|Ba\s*Zi|Bazi)\b/gi, "bazi_en_term"],
  [/\b(?:Ten Gods|Seven Killings|Eating God|Hurting Officer|Useful God|Luck Pillar|Luck Cycle|Major Luck|Decade Luck)\b/gi, "bazi_en_term"],
  [/\b(?:Heavenly Stem|Earthly Branch|natal chart|birth chart)\b/gi, "chart_en_term"],
  [/\bin your chart\b/gi, "in_your_chart"],
  [/\b(?:qimen|dunjia)\b/gi, "qimen"],
  [/\bfeng\s*shui\b/gi, "feng_shui"],
  [/\bfortune[- ]telling\b/gi, "fortune_telling"],
];

const ZH_BAZI_TERMS: Array<[RegExp, string]> = [
  [/八字|四柱|日主|用神|忌神|大运|流年|十神|七杀|食神|伤官|命盘|命局|奇门|遁甲|风水|算命|命理/g, "bazi_zh_term"],
  [/天干|地支/g, "ganzhi"],
];

const EN_PREDICTION_PATTERNS: RegExp[] = [
  /\bwill\s+(?:marry|get married|become rich|get rich|succeed|win|get promoted)\b/i,
  /\bwill\s+happen\s+(?:on|in|by)\b/i,
  /\bwill\s+bring\s+(?:you\s+)?(?:luck|success)\b/i,
  /\bguaranteed\s+(?:success|outcome|win|marriage)\b/i,
  /\bdestined\s+to\s+(?:marry|win|succeed|fail)\b/i,
  /\bnext\s+(?:month|year|week).{0,40}\bwill\b/i,
];

const ZH_PREDICTION_PATTERNS: RegExp[] = [
  /会(?:结婚|发财|成功|升职|离婚|破产)/,
  /必将|必定|一定(?:会|要)/,
  /(?:下|明)个(?:月|年).{0,20}(?:会|将)/,
];

const EN_JIXIONG_REGEX =
  /\b(?:highly\s+)?(?:auspicious|inauspicious|good\s+luck|bad\s+luck|lucky|unlucky)\b/gi;
const ZH_JIXIONG_REGEX = /大吉|大凶|上吉|下凶|必成|必败|破财|运势大凶|吉利|不利|吉运|凶运/g;

const EN_DIVINATION_REGEX =
  /\b(?:hexagram casting|cast a hexagram|divination board|oracle compass|draw a lot|fortune telling)\b/gi;
const ZH_DIVINATION_REGEX = /起卦|卦象|抽签|求签|解签|占卜/g;

const EN_FEAR_REGEX =
  /\b(?:pay\s+(?:to|for)\s+(?:avoid|prevent|ward off)|unless you pay|disaster unless)\b/gi;
const ZH_FEAR_REGEX = /付费消灾|不(?:做|化解).{0,12}(?:灾难|大祸|破财)|否则.{0,8}(?:大凶|灾祸)/g;

const ZH_BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const ZH_WUXING = "金木水火土";
/** Stem-branch and branch-element combos — bazi fingerprint, not personality Wood/Fire. */
const ZH_STEM_BRANCH_REGEX = new RegExp(`[甲乙丙丁戊己庚辛壬癸][${ZH_BRANCHES}]`, "g");
const ZH_BRANCH_ELEMENT_REGEX = new RegExp(`[${ZH_BRANCHES}][${ZH_WUXING}]`, "g");

/** Detect policy violations. Does NOT flag bare Wood/Fire/Metal/Water/Earth or Yin-Yang as personality. */
export function detectOutputPolicyViolations(
  text: string,
  locale = "en",
): OutputPolicyViolation[] {
  if (!text?.trim()) return [];

  const violations: OutputPolicyViolation[] = [];
  const isZh = locale.startsWith("zh");

  if (isZh) {
    for (const [regex, label] of ZH_BAZI_TERMS) {
      pushRegex(text, regex, "bazi_term", label, violations);
    }
    pushPatterns(text, ZH_PREDICTION_PATTERNS, "prediction", "prediction_zh", violations);
    pushRegex(text, ZH_JIXIONG_REGEX, "jixiong", "jixiong_zh", violations);
    pushRegex(text, ZH_DIVINATION_REGEX, "divination", "divination_zh", violations);
    pushRegex(text, ZH_FEAR_REGEX, "fear_mongering", "fear_zh", violations);
  } else {
    for (const [regex, label] of EN_BAZI_TERMS) {
      const category: OutputPolicyViolationCategory = label.includes("chart")
        ? "chart_fingerprint"
        : "bazi_term";
      pushRegex(text, regex, category, label, violations);
    }
    pushPatterns(text, EN_PREDICTION_PATTERNS, "prediction", "prediction_en", violations);
    pushRegex(text, EN_JIXIONG_REGEX, "jixiong", "jixiong_en", violations);
    pushRegex(text, EN_DIVINATION_REGEX, "divination", "divination_en", violations);
    pushRegex(text, EN_FEAR_REGEX, "fear_mongering", "fear_en", violations);
  }

  // Cross-locale bazi fingerprints
  pushRegex(text, ZH_STEM_BRANCH_REGEX, "bazi_term", "stem_branch", violations);
  pushRegex(text, ZH_BRANCH_ELEMENT_REGEX, "bazi_term", "branch_element", violations);

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.category}:${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function logOutputPolicyViolations(
  violations: OutputPolicyViolation[],
  context = "output-policy-audit",
): void {
  if (violations.length === 0) return;
  console.error(`[${context}] Output policy violations (${violations.length}):`, violations);
}

export function auditOutputPolicyText(
  text: string,
  locale: string,
  context?: string,
): OutputPolicyViolation[] {
  const violations = detectOutputPolicyViolations(text, locale);
  if (violations.length > 0) {
    logOutputPolicyViolations(violations, context ?? "output-policy-audit");
  }
  return violations;
}
