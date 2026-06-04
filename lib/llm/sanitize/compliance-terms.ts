/**
 * Shared blacklist → whitelist term maps for LLM output compliance.
 * Used by Glyph prompts (primary) and sanitize fallback (text replace only, no LLM).
 */

export const EN_TERM_MAP: Record<string, string> = {
  // A. 八字/排盘
  Bazi: "personality profile",
  BaZi: "personality profile",
  "Ba Zi": "personality profile",
  "Four Pillars": "personality structure",
  "Day Master": "core nature",
  "Heavenly Stem": "",
  "Earthly Branch": "",
  "natal chart": "personality profile",
  "birth chart": "personality profile",
  "Yi Wood": "core trait",
  "Jia Wood": "core trait",
  "Bing Fire": "core trait",
  "Ding Fire": "core trait",
  "Wu Earth": "core trait",
  "Ji Earth": "core trait",
  "Geng Metal": "core trait",
  "Xin Metal": "core trait",
  "Ren Water": "core trait",
  "Gui Water": "core trait",

  // B. 十神
  "Ten Gods": "relational dynamics",
  "Seven Killings": "external pressure dynamics",
  "Eating God": "expressive intelligence",
  "Hurting Officer": "expressive drive",
  "Direct Wealth": "resource orientation",
  "Indirect Wealth": "resource orientation",
  "Direct Officer": "structure and authority dynamics",
  "Indirect Officer": "structure and authority dynamics",
  "Direct Resource": "support and learning dynamics",
  "Indirect Resource": "support and learning dynamics",
  Companion: "peer dynamics",
  "Rob Wealth": "peer dynamics",

  // C. 大运/流年
  "Luck Pillar": "major life cycle",
  "Luck Cycle": "major life cycle",
  "Da Yun": "major life cycle",
  "Major Luck": "10-year life cycle",
  "Decade Luck": "10-year life cycle",
  "Annual Pillar": "current annual cycle",
  "Liu Nian": "current annual cycle",
  "Fleeting Year": "current annual cycle",

  // D. 用神/五行 (phrase-level; elemental Wood/Fire handled by regex)
  "Useful God": "key supporting energy",
  "Yong Shen": "key supporting energy",
  "Favorable God": "key supporting energy",
  "Favorable Element": "beneficial quality",
  "Unfavorable Element": "quality to watch",
  "Ji Shen": "quality to watch",
  "Five Elements": "energy structure",
  "Wu Xing": "energy structure",

  // E. 格局
  "Ge Ju": "personality pattern",

  // F. 占卜/宗教
  "Divination Lot": "archetypal metaphor",
  Divination: "archetypal reflection",
  "drawing a lot": "engaging a metaphor",
  Oracle: "reflection tool",
  "Guan Yin": "",
  Bodhisattva: "",
  Buddha: "",
  deity: "",
  deities: "",
  Temple: "",
  shrine: "",
  "Fortune-telling": "analysis",
  blessing: "",
  prayer: "",
  sacred: "",
  worship: "",
  incense: "",
  altar: "",

  // G. 宿命/预测
  Fate: "inherent tendencies",
  Destiny: "life direction",
  Prediction: "insight",
  predict: "assess",
  forecast: "assessment",
  Karma: "pattern",
  karmic: "patterned",
  predestined: "naturally aligned",
  "meant to be": "naturally aligned",

  // H. 民间命理
  "Noble Person": "key supporter",
  Benefactor: "external support",
  "Nobleman luck": "external support",
  "Peach Blossom": "interpersonal energy",
};

export const ZH_TERM_MAP: Record<string, string> = {
  // A. 八字/排盘
  八字: "性格画像",
  四柱: "性格结构",
  命盘: "性格画像",
  日主: "核心特质",
  天干: "",
  地支: "",

  // B. 十神
  十神: "关系动力",
  七杀: "外部压力动力",
  食神: "表达型智慧",
  伤官: "表达驱动力",
  正财: "资源取向",
  偏财: "资源取向",
  正官: "结构与权威动力",
  偏官: "结构与权威动力",
  正印: "支持与学习动力",
  偏印: "支持与学习动力",
  比肩: "同侪动力",
  劫财: "同侪动力",

  // C. 大运/流年
  大运: "人生阶段",
  流年: "当前周期",
  流年大运: "人生阶段",

  // D. 用神/五行
  用神: "关键能量",
  喜神: "有利特质",
  忌神: "需留意的特质",
  五行: "能量结构",
  喜土金: "稳定与结构判断",
  忌火土: "急躁与固执",
  喜用水金: "沉静智慧与决断力",

  // E. 格局
  格局: "性格模式",

  // F. 占卜/宗教
  占卜: "原型隐喻",
  签文: "原型隐喻",
  抽签: "触发隐喻",
  求签: "触发隐喻",
  灵签: "原型隐喻",
  签: "隐喻",
  观音: "",
  菩萨: "",
  佛: "",
  寺庙: "",
  庙: "",
  算命: "分析",
  命理: "分析",
  保佑: "",
  祈福: "",
  求神: "",
  拜佛: "",
  神明: "",
  神灵: "",

  // G. 宿命/预测
  宿命: "先天倾向",
  命运: "人生方向",
  预测: "洞察",
  预言: "洞察",
  运势: "趋势状态",
  命中注定: "自然契合",
  注定: "自然契合",

  // H. 民间命理
  贵人: "外部助力",
  小人: "负面影响",
  桃花: "情感能量",
  驿马: "变动能量",
  刑冲: "摩擦张力",
  相克: "风格差异",
};

export const COMPLIANCE_MASK = "…";

const ZH_STEMS = "甲乙丙丁戊己庚辛壬癸";
const ZH_BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const ZH_WUXING = "金木水火土";

/** 喜/忌/喜用 + 五行 — only bazi combos, not daily 木桌 */
export const ZH_WUXING_YONGXI_REGEX = new RegExp(
  `(?:喜用|喜|忌|用)[用]?[${ZH_WUXING}]{1,4}`,
  "g",
);

export const ZH_STEM_ELEMENT_REGEX = new RegExp(`[${ZH_STEMS}][${ZH_WUXING}]`, "g");
export const ZH_STEM_BRANCH_REGEX = new RegExp(`[${ZH_STEMS}][${ZH_BRANCHES}]`, "g");

/** 五行 as element context only — not bare 金/木 in daily speech */
export const ZH_WUXING_ELEMENT_CONTEXT_REGEX = new RegExp(
  `[${ZH_WUXING}](?:元素|行|气|旺|弱|重|轻|偏多|偏少|不足|过重)`,
  "g",
);

export const ZH_GUIRen_REGEX = /贵人(?:运|星|显|扶持|相助|助力|出现|临门|照命|帮身)?/g;

/** EN: favorable/your + Wood/Fire — bazi context only */
export const EN_WUXING_ELEMENT_COMBO_REGEX =
  /\b(?:favorable|unfavorable|beneficial|your|as\s+(?:a\s+)?)\s*(?:Wood|Fire|Earth|Metal|Water)\b/gi;

export const EN_FAVORABLE_ELEMENT_REGEX =
  /\bF(?:avorable|avourable)\s+(?:Wood|Fire|Earth|Metal|Water|Element|Elements)\b/gi;

export const EN_UNFAVORABLE_ELEMENT_REGEX =
  /\bUnfavorable\s+(?:Wood|Fire|Earth|Metal|Water|Element|Elements)\b/gi;

/** EN Defense 2 — quoted maxims / sign-poem English (audit). */
export const EN_QUOTED_MAXIM_PREFIX_REGEX =
  /(?:ancient wisdom|the saying|classical verse|old maxim|quoted maxim|the verse|sign poem|the line reads)[:\s,—-]+['"]/gi;

export const EN_QUOTED_STRING_REGEX = /['"][^'"]{10,}['"]/g;

/** EN Defense 2 — warrior/figure story sequence (audit). */
export const EN_WARRIOR_WHO_REGEX =
  /\b(?:a|the)\s+(?:warrior|figure|hero|general|soldier|scholar|monk|sage|emperor|minister|lord)\s+who\b/gi;

export const EN_STORY_SEQUENCE_VERB_REGEX =
  /\bwho\s+(?:was|were|had been)\s+(?:defeated|captured|imprisoned|exiled|recalled|rescued|escaped|banished)/gi;

export const EN_STORY_SEQUENCE_NARRATIVE_REGEX =
  /\b(?:defeat(?:ed)?|capture(?:d)?|escape(?:d)?|recall(?:ed)?|exile(?:d)?).{0,80}(?:defeat|capture|escape|recall|exile|return)/gi;

export type ComplianceViolation = {
  label: string;
  snippet: string;
};

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + len + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function sortedMapEntries(map: Record<string, string>): Array<[string, string]> {
  return Object.entries(map).sort((a, b) => b[0].length - a[0].length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyZhRegexReplacements(text: string): string {
  let result = text;
  result = result.replace(/喜用水金/g, ZH_TERM_MAP["喜用水金"]!);
  result = result.replace(/喜土金/g, ZH_TERM_MAP["喜土金"]!);
  result = result.replace(/忌火土/g, ZH_TERM_MAP["忌火土"]!);
  result = result.replace(ZH_WUXING_YONGXI_REGEX, (m) => {
    if (m.startsWith("忌")) return "需留意的特质";
    return "有利特质";
  });
  result = result.replace(ZH_STEM_ELEMENT_REGEX, "核心特质");
  result = result.replace(ZH_STEM_BRANCH_REGEX, "核心特质");
  result = result.replace(ZH_WUXING_ELEMENT_CONTEXT_REGEX, "能量特质");
  result = result.replace(ZH_GUIRen_REGEX, "外部助力");
  return result;
}

function applyEnRegexReplacements(text: string): string {
  let result = text;
  result = result.replace(EN_FAVORABLE_ELEMENT_REGEX, "beneficial quality");
  result = result.replace(EN_UNFAVORABLE_ELEMENT_REGEX, "quality to watch");
  result = result.replace(EN_WUXING_ELEMENT_COMBO_REGEX, (m) => {
    if (/unfavorable/i.test(m)) return "quality to watch";
    if (/your/i.test(m)) return "core trait";
    return "beneficial quality";
  });
  return result;
}

function applyTermMap(text: string, map: Record<string, string>, locale: string): string {
  let result = text;
  for (const [term, replacement] of sortedMapEntries(map)) {
    if (locale.startsWith("zh")) {
      result = result.split(term).join(replacement);
    } else {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
      result = result.replace(re, replacement);
    }
  }
  return result.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

/** Detect terms still present after sanitization (for logging + mask). */
export function detectComplianceViolations(text: string, locale: string): ComplianceViolation[] {
  if (!text?.trim()) return [];
  const violations: ComplianceViolation[] = [];
  const isZh = locale.startsWith("zh");

  const pushRegex = (regex: RegExp, label: string) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      violations.push({
        label,
        snippet: snippetAround(text, m.index, m[0].length),
      });
    }
  };

  if (isZh) {
    pushRegex(ZH_STEM_ELEMENT_REGEX, "stem_element");
    pushRegex(ZH_STEM_BRANCH_REGEX, "stem_branch");
    pushRegex(ZH_WUXING_YONGXI_REGEX, "wuxing_yongxi");
    pushRegex(ZH_WUXING_ELEMENT_CONTEXT_REGEX, "wuxing_element");
    pushRegex(ZH_GUIRen_REGEX, "guiren");
    for (const term of sortedMapEntries(ZH_TERM_MAP).map(([k]) => k)) {
      if (term.length < 2) continue;
      if (text.includes(term)) {
        violations.push({
          label: `term:${term}`,
          snippet: snippetAround(text, text.indexOf(term), term.length),
        });
      }
    }
  } else {
    pushRegex(EN_FAVORABLE_ELEMENT_REGEX, "favorable_element");
    pushRegex(EN_UNFAVORABLE_ELEMENT_REGEX, "unfavorable_element");
    pushRegex(EN_WUXING_ELEMENT_COMBO_REGEX, "wuxing_combo");
    pushRegex(EN_QUOTED_MAXIM_PREFIX_REGEX, "quoted_maxim_prefix");
    pushRegex(EN_QUOTED_STRING_REGEX, "quoted_string");
    pushRegex(EN_WARRIOR_WHO_REGEX, "warrior_who_narrative");
    pushRegex(EN_STORY_SEQUENCE_VERB_REGEX, "story_sequence_verb");
    pushRegex(EN_STORY_SEQUENCE_NARRATIVE_REGEX, "story_sequence_narrative");
    for (const [term] of sortedMapEntries(EN_TERM_MAP)) {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      const m = re.exec(text);
      if (m) {
        violations.push({
          label: `term:${term}`,
          snippet: snippetAround(text, m.index, m[0].length),
        });
      }
    }
  }

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Mask remaining violation spans in text. */
function maskRemainingViolations(
  text: string,
  violations: ComplianceViolation[],
  locale: string,
): string {
  let result = text;
  for (const v of violations) {
    const idx = result.indexOf(v.snippet);
    if (idx >= 0 && v.snippet.length > 4) {
      result = result.slice(0, idx) + COMPLIANCE_MASK + result.slice(idx + v.snippet.length);
      continue;
    }
    // Re-detect exact match from label term
    const term = v.label.startsWith("term:") ? v.label.slice(5) : null;
    if (term && result.includes(term)) {
      result = result.split(term).join(COMPLIANCE_MASK);
    }
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export type ComplianceSanitizeResult = {
  text: string;
  violationsBefore: ComplianceViolation[];
  violationsAfter: ComplianceViolation[];
};

/**
 * Pure text replacement — no LLM. Applies shared term maps + bazi-context regexes.
 */
export function applyComplianceSanitize(text: string, locale: string): ComplianceSanitizeResult {
  const violationsBefore = detectComplianceViolations(text, locale);
  let result = text;

  if (locale.startsWith("zh")) {
    result = applyZhRegexReplacements(result);
    result = applyTermMap(result, ZH_TERM_MAP, locale);
  } else {
    result = applyEnRegexReplacements(result);
    result = applyTermMap(result, EN_TERM_MAP, locale);
  }

  let violationsAfter = detectComplianceViolations(result, locale);
  if (violationsAfter.length > 0) {
    result = maskRemainingViolations(result, violationsAfter, locale);
    violationsAfter = detectComplianceViolations(result, locale);
  }

  return { text: result, violationsBefore, violationsAfter };
}

/** Prompt block: reference shared compliance maps (Glyph OUTPUT FRAMING 防线 1). */
export function buildComplianceTranslationPromptBlock(): string {
  const zhSamples = [
    "日主 → 核心特质",
    "大运 → 人生阶段",
    "喜土金 → 稳定与结构判断",
    "贵人 → 外部助力",
    "八字/四柱 → 性格画像/性格结构",
  ];
  const enSamples = [
    "Day Master → core nature",
    "Major Luck → 10-year life cycle",
    "Noble Person → key supporter",
    "Four Pillars → personality structure",
  ];
  return `# 共享合规翻译表（与 sanitize 兜底同一份 compliance-terms）

输出 JSON 须将下列黑词译为白榜（完整表见 lib/llm/sanitize/compliance-terms.ts）：

中文示例：${zhSamples.join("；")}
英文示例：${enSamples.join("; ")}

⚠️ 五行字（金木水火土 / Wood-Fire-Earth-Metal-Water）**仅**在命理组合（喜土金、favorable Wood、your Water 等）中禁止；
日常用语（木桌、fire alarm）不在此列。`;
}
