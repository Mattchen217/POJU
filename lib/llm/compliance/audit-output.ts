/**
 * Audit-only output compliance detection (alert — never mutates text).
 * Aligns with docs/POJULIFE-定位与合规边界-v1.md
 *
 * 明确保留：事后 regex 检测能力，与 prompt JUDGMENT_CORE 互补；
 * 不因 prompt 宽泛化而删减 EN/ZH 行为词与术语指纹 pattern。
 */

import { maskMarkersForAudit } from "@/lib/llm/sanitize/term-marking";

export type OutputPolicyViolationCategory =
  | "bazi_term"
  | "marriage_chart_term"
  | "supernatural_promise"
  | "prediction"
  | "jixiong"
  | "divination"
  | "fear_mongering"
  | "chart_fingerprint"
  | "compliance_redline";

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
  [/\bfortune[- ]telling\b/gi, "fortune_telling"],
];

/** Match / marriage charting terms — translate to synergy/tension language in output. */
const EN_MARRIAGE_CHART_TERMS: Array<[RegExp, string]> = [
  [/\b(?:Liu He|Six Harmonies?|six harmony)\b/gi, "liu_he"],
  [/\b(?:Six Clash|Liu Chong|clash pattern)\b/gi, "chong"],
  [/\bheavenly connection\b/gi, "heavenly_connection"],
  [/\b(?:Liu Hai|Six Harms?)\b/gi, "liu_hai"],
  [/\b(?:San Xing|punishment star|Xing star)\b/gi, "xing_star"],
  [/\b(?:year|day|month|hour)\s+stem\b/gi, "stem_en"],
  [/\b(?:year|day|month|hour)\s+branch\b/gi, "branch_en"],
  [/\b(?:in (?:your|their|the) charts?|compatibility charts?)\b/gi, "charts_en"],
  [/\b(?:Heavenly Stem|Earthly Branch)\b/gi, "ganzhi_en"],
  [/\b(?:Year|Day|Month|Hour)\s+(?:Pillar|Stem|Branch)\b/gi, "pillar_en"],
  [/\b(?:year|day|month|hour)\s+pillar\b/gi, "pillar_en"],
  [/\b(?:stem[- ]branch|branch[- ]stem)\b/gi, "stem_branch_en"],
  [/\b(?:Jia|Yi|Bing|Ding|Wu|Ji|Geng|Xin|Ren|Gui)\s+(?:Zi|Chou|Yin|Mao|Chen|Si|Wu|Wei|Shen|You|Xu|Hai)\b/g, "stem_branch_pair"],
];

/** Supernatural outcome promises — red line (NOT bare spatial harmony / env-psych feng shui). */
const EN_SUPERNATURAL_PROMISE: Array<[RegExp, string]> = [
  [/\b(?:attract|draw|bring)\s+(?:wealth|fortune|money|prosperity)\b/gi, "attract_wealth"],
  [/\bwealth\s+activation\b/gi, "wealth_activation"],
  [/\b(?:boost|enhance|activate)\s+(?:your\s+)?(?:luck|fortune)\b/gi, "boost_luck"],
  [/\b(?:lucky|auspicious)\s+direction\b/gi, "lucky_direction"],
  [/\bamulet\b/gi, "amulet"],
  [/\bward\s+off\s+(?:evil|bad\s+luck|misfortune|disaster|calamity)\b/gi, "ward_off_evil"],
  [/\b(?:neutralize|dispel|counter)\s+(?:sha|negative\s+energy|bad\s+energy)\b/gi, "neutralize_sha"],
  [/\b(?:fish\s+tank|water\s+feature).{0,40}\b(?:boost|attract|bring|activate)\s+(?:wealth|fortune|luck|prosperity)\b/gi, "fish_tank_fortune"],
  [/\b(?:boost|attract|activate).{0,30}\b(?:wood|fire|earth|metal|water)\s+energy.{0,20}\b(?:fortune|wealth|luck|prosperity)\b/gi, "element_fortune_boost"],
  [/\b(?:will|going\s+to)\s+(?:get\s+rich|become\s+wealthy|attract\s+wealth)\b/gi, "future_wealth_promise"],
];

const ZH_SUPERNATURAL_PROMISE: Array<[RegExp, string]> = [
  [/招财|催运|催財|催水|催木|催火|催土|催金|避邪|化煞|挡灾|辟邪/g, "cui_yun_zh"],
  [/财位|文昌位|吉利方位|幸运方位/g, "lucky_sector_zh"],
  [/(?:放|摆|置).{0,12}(?:东|西|南|北|西北|东北|东南|西南).{0,20}(?:催|旺|招财|发财)/g, "directional_fortune_zh"],
  [/下(?:个)?月.{0,8}(?:发财|暴富|转运)/g, "future_fortune_zh"],
];

const ZH_MARRIAGE_CHART_TERMS: Array<[RegExp, string]> = [
  [/六合|六害|三刑|刑冲|合冲|刑害|宜婚|不宜婚/g, "marriage_zh"],
  [/年柱|月柱|日柱|时柱|干支/g, "pillar_zh"],
];

const ZH_BAZI_TERMS: Array<[RegExp, string]> = [
  [/八字|四柱|日主|用神|忌神|大运|流年|十神|七杀|食神|伤官|命盘|命局|奇门|遁甲|算命|命理/g, "bazi_zh_term"],
  [/天干|地支/g, "ganzhi"],
];

/** Stripe / payment-processor high-risk — even in negation (四产品统一拦截). */
const ZH_COMPLIANCE_REDLINE: Array<[RegExp, string]> = [
  [/占卜|命运|宿命|星象|吉凶/g, "compliance_redline_zh"],
];

/** 未来时间锚 + 结果承诺共现 — 窗口扫描，避免灾难性回溯（Block 54） */
const ZH_TIME_ANCHOR_RE =
  /(?:明年|后年|后半年|上半年|下半年|\d{1,2}年后|某个时段|这段时间|下一阶段|\d{1,2}月(?:份)?(?:内|里|时))/g;
const ZH_OUTCOME_PROMISE_RE =
  /(?:会|将|必将|一定|就能|就会).{0,12}(?:好转|改善|突破|拐点|转机|结婚|成交|升职|转运|成功|迎来|成局|落实|见效)/;
const ZH_TURNING_AT_TIME_RE = /(?:迎来|出现).{0,10}(?:拐点|转机|高峰|窗口|突破)/;
const ZH_SAAS_TIME_RE = /(?:效能拐点|高概率窗口|释放窗口|时空窗口)/g;
const ZH_SAAS_TIME_IN_RE = /(?:在|于|落在).{0,6}(?:明年|下半年|\d{1,2}月|某个时段)/;

const EN_TIME_ANCHOR_RE =
  /\b(?:next\s+(?:year|month|quarter)|later\s+this\s+year|in\s+\d+\s+years?|within\s+\d+\s+months?)\b/gi;
const EN_OUTCOME_PROMISE_RE =
  /\b(?:will|you(?:'ll|ll)|going\s+to|set\s+to)\b.{0,30}\b(?:marry|succeed|break\s+through|improve|turn\s+a\s+corner|close\s+the\s+deal|land\s+a|get\s+promoted)\b/i;
const EN_SAAS_TIME_RE =
  /\b(?:turning\s+point|breakthrough\s+window|inflection\s+point)\b/gi;
const EN_SAAS_TIME_IN_RE =
  /\b(?:in|by|around|comes?\s+in)\b.{0,12}\b(?:next\s+)?(?:year|month|quarter|H2)\b/i;

function pushPointPredictionViolations(
  text: string,
  locale: string,
  out: OutputPolicyViolation[],
): void {
  if (locale.startsWith("zh")) {
    ZH_TIME_ANCHOR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ZH_TIME_ANCHOR_RE.exec(text)) !== null) {
      const window = text.slice(m.index, Math.min(text.length, m.index + 48));
      if (ZH_OUTCOME_PROMISE_RE.test(window) || ZH_TURNING_AT_TIME_RE.test(window)) {
        out.push({
          category: "compliance_redline",
          label: "point_prediction_zh",
          snippet: snippetAround(text, m.index, Math.min(40, window.length)),
        });
        return;
      }
    }
    ZH_SAAS_TIME_RE.lastIndex = 0;
    while ((m = ZH_SAAS_TIME_RE.exec(text)) !== null) {
      const window = text.slice(m.index, Math.min(text.length, m.index + 32));
      if (ZH_SAAS_TIME_IN_RE.test(window)) {
        out.push({
          category: "compliance_redline",
          label: "point_prediction_saas_zh",
          snippet: snippetAround(text, m.index, Math.min(32, window.length)),
        });
        return;
      }
    }
    return;
  }

  EN_TIME_ANCHOR_RE.lastIndex = 0;
  let em: RegExpExecArray | null;
  while ((em = EN_TIME_ANCHOR_RE.exec(text)) !== null) {
    const window = text.slice(em.index, Math.min(text.length, em.index + 72));
    if (EN_OUTCOME_PROMISE_RE.test(window)) {
      out.push({
        category: "compliance_redline",
        label: "point_prediction_en",
        snippet: snippetAround(text, em.index, Math.min(48, window.length)),
      });
      return;
    }
  }
  EN_SAAS_TIME_RE.lastIndex = 0;
  while ((em = EN_SAAS_TIME_RE.exec(text)) !== null) {
    const window = text.slice(em.index, Math.min(text.length, em.index + 48));
    if (EN_SAAS_TIME_IN_RE.test(window)) {
      out.push({
        category: "compliance_redline",
        label: "point_prediction_saas_en",
        snippet: snippetAround(text, em.index, Math.min(40, window.length)),
      });
      return;
    }
  }
}

const EN_COMPLIANCE_REDLINE: Array<[RegExp, string]> = [
  [/\b(?:horoscope|astrology|psychic)\b/gi, "compliance_redline_en"],
  [/\b(?:fortune[- ]?telling|divination)\b/gi, "compliance_redline_en"],
  [/\b(?:destiny|fate)\b/gi, "compliance_redline_en"],
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
  /** Marker-safe text for bazi/chart fingerprint — avoids false hits on soft-translate visible (e.g. 表达从容（食神）). */
  const markerSafeText = maskMarkersForAudit(text);

  if (isZh) {
    for (const [regex, label] of ZH_BAZI_TERMS) {
      pushRegex(markerSafeText, regex, "bazi_term", label, violations);
    }
    for (const [regex, label] of ZH_COMPLIANCE_REDLINE) {
      pushRegex(text, regex, "compliance_redline", label, violations);
    }
    pushPointPredictionViolations(text, locale, violations);
    for (const item of ZH_MARRIAGE_CHART_TERMS) {
      const [regex, label] = typeof item === "string" ? [item, "marriage_zh"] as const : item;
      pushRegex(markerSafeText, regex, "marriage_chart_term", label, violations);
    }
    for (const [regex, label] of ZH_SUPERNATURAL_PROMISE) {
      pushRegex(text, regex, "supernatural_promise", label, violations);
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
      pushRegex(markerSafeText, regex, category, label, violations);
    }
    for (const [regex, label] of EN_COMPLIANCE_REDLINE) {
      pushRegex(text, regex, "compliance_redline", label, violations);
    }
    pushPointPredictionViolations(text, locale, violations);
    for (const [regex, label] of EN_MARRIAGE_CHART_TERMS) {
      pushRegex(markerSafeText, regex, "marriage_chart_term", label, violations);
    }
    for (const [regex, label] of EN_SUPERNATURAL_PROMISE) {
      pushRegex(text, regex, "supernatural_promise", label, violations);
    }
    pushPatterns(text, EN_PREDICTION_PATTERNS, "prediction", "prediction_en", violations);
    pushRegex(text, EN_JIXIONG_REGEX, "jixiong", "jixiong_en", violations);
    pushRegex(text, EN_DIVINATION_REGEX, "divination", "divination_en", violations);
    pushRegex(text, EN_FEAR_REGEX, "fear_mongering", "fear_en", violations);
  }

  // Cross-locale bazi fingerprints (marker-safe — soft-translate display must not false-positive)
  pushRegex(markerSafeText, ZH_STEM_BRANCH_REGEX, "bazi_term", "stem_branch", violations);
  pushRegex(markerSafeText, ZH_BRANCH_ELEMENT_REGEX, "bazi_term", "branch_element", violations);

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

export function logBaziTermObservations(text: string, locale: string, context = "final-delivery"): void {
  const violations = detectOutputPolicyViolations(text, locale).filter(
    (v) => v.category === "bazi_term" || v.category === "chart_fingerprint",
  );
  if (violations.length === 0) return;
  console.log(
    `[${context}] bazi_term observe-only (${violations.length}):`,
    violations.slice(0, 5).map((v) => v.label),
  );
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
