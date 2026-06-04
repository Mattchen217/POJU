import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";

export type GlyphOutputViolationCategory =
  | "bazi_term"
  | "sign_narrative"
  | "prediction"
  | "legacy_framing";

export type GlyphOutputViolation = {
  category: GlyphOutputViolationCategory;
  label: string;
  snippet: string;
};

/** User message suffix when regenerating after sanitize audit failure. */
export const GLYPH_REGENERATION_USER_SUFFIX = `

⛔ 上一轮 JSON 违反 OUTPUT FRAMING 三道防线。请完整重写：
1. 禁干支/十神/日主/大运/流年/用神/八字/四柱/五行元素(金木水火土)/贵人 → 全部翻译成心理学/系统动力学描述
2. 禁签诗原文/具体历史人物/「签」字样 → 抽象为「经典东方叙事原型」
3. 禁「何时/即将/会遇到/将会」等未来预测 → 改为【当下时机评估】与认知反思
写每段前执行三道自检。`;

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const SHISHEN =
  "食神|七杀|正官|偏财|正财|比肩|劫财|伤官|偏印|正印|偏官|七殺|正財|偏財";

const BAZI_FRAME_TERMS =
  /日主|大运|流年|用神|忌神|调候|透出|坐地|格局|八字|四柱|天干|地支|命盘|命局|喜神|仇神|闲神/g;

const STEM_ELEMENT = new RegExp(`[${STEMS}][木火土金水]`, "g");
const STEM_BRANCH = new RegExp(`[${STEMS}][${BRANCHES}]`, "g");

const WUXING = "金|木|水|火|土";

/** 喜/忌/用 + 五行组合，如 喜土金、忌火、喜用水金 */
const WUXING_YONGXI_COMBO = new RegExp(
  `(?:喜用|喜|忌|用)[用]?[${WUXING}]{1,4}`,
  "g",
);

/** 五行作命理元素的单字语境 */
const WUXING_ELEMENT_CONTEXT = new RegExp(
  `(?:五行|[补缺旺弱偏轻重][${WUXING}]|[${WUXING}](?:元素|行|气|旺|弱|重|轻|偏多|偏少|不足|过重))`,
  "g",
);

/** 命理术语「贵人」 */
const GUIRen_TERM = /贵人(?:运|星|显|扶持|相助|助力|出现|临门|照命|帮身)?/g;

const LEGACY_FRAMING_ZH =
  /签文|灵签|求签|抽签|解签|卜签|庙签|观音|菩萨|佛祖|神明|神灵|占卜|算命|命理|保佑|祈福|寺庙|求神/g;
const LEGACY_FRAMING_EN =
  /\b(?:lot|divination|guan yin|kuan yin|bodhisattva|temple|deity|blessing|prayer|oracle|fortune|sacred|worship|auspicious|ominous)\b/gi;

/** Paired classical verse lines (e.g. 七言对句). */
const SIGN_POEM_PAIR = /[\u4e00-\u9fff]{5,8}[，,；;][\u4e00-\u9fff]{5,8}/g;

const PREDICTION_ZH =
  /何时|什么时候|几时|何时会|何时能|何时才|即将|就要|快要|会遇到|将会|一定会|迟早|不久[就便]?会|就要到来|就要发生|甘雨.*(?:降|来|至)|转机.*(?:来|至|到)/g;
const PREDICTION_EN =
  /\b(?:when will|will happen|will meet|about to|soon you will|going to happen|is coming|will arrive)\b/gi;

/** Full story_figure labels from signs.json — high-confidence narrative leaks. */
const STORY_FIGURE_PHRASES = [
  "钟离成道",
  "苏秦不第",
  "董永遇仙",
  "玉莲会十朋",
  "刘晨遇仙",
  "仁贵遇主",
  "苏娘走难",
  "斐度还带",
  "孔明点将观",
  "庞涓观阵",
  "书荐姜维",
  "武吉遇师",
  "罗通拜帅",
  "子牙弃官",
  "苏秦得志",
  "叶梦熊朝",
  "话梅止渴",
  "曹国舅为",
  "子仪封王",
  "姜太公遇文王",
  "李旦龙凤",
  "六郎逢救",
  "怀德招亲",
  "殷郊遇师",
  "李广机智",
  "钟馗得道",
  "刘基谏主",
  "李后寻包公",
  "赵子龙救阿斗",
  "棋盘大会",
  "佛印会东坡",
  "刘备求贤",
  "咬金聘仁贵",
  "桃园结义",
  "唐僧取经",
  "湘子遇宾",
  "李靖归山",
  "何文秀遇难",
  "姜女寻夫",
  "武则天登位",
  "董卓收吕布",
  "目莲救母",
  "行者得道",
  "姜维邓艾斗阵",
  "仁宗认母",
  "渭水钓鱼",
  "梁灏登科",
  "韩信挂帅",
  "王祥求鲤",
  "陶朱归五湖",
  "孔明入川",
  "太白醉捞明月",
  "刘备招亲",
  "马超追曹",
  "周武王登位",
  "禄山谋反",
  "董仲寻亲",
  "文王问卜",
  "张良隐山",
  "赤壁鏖兵",
  "苏小妹难夫",
  "唐僧得道",
  "女娲氏炼石",
  "马前覆水",
  "孙膑困庞涓",
  "霸王被困",
  "金精试窦儿",
  "汾阳祝寿",
  "梅开二度",
  "李密反唐",
  "文君访相如",
  "王莽求贤",
  "陈桥兵变",
  "秦败擒三帅",
  "伍员夜出昭关",
  "洪武看牛",
  "捧璧归赵",
  "临潼救驾",
  "暗扶倒铜旗",
  "智远投军",
  "风送滕王阁",
  "火烧葫芦谷",
  "李渊登位",
  "庄子试妻观",
  "韩文公遇雪",
  "商辂中三元",
  "咬金探地穴",
  "庞洪畏包公",
  "智服姜维",
  "苇佩遇仙",
  "三战吕布",
  "蔡卿报恩",
  "高君保招亲",
  "伯牙访友",
  "曹丕称帝",
  "窦燕山积善",
  "六出祁山",
  "吉平遇难",
  "陶三春挂帅",
  "三教谈道观",
];

/** Named historical / religious figures — avoid overly generic single morphemes. */
const NAMED_FIGURE_NAMES = [
  "杨六郎",
  "钟离权",
  "苏秦",
  "董永",
  "薛仁贵",
  "诸葛亮",
  "庞涓",
  "姜维",
  "姜子牙",
  "姜太公",
  "周文王",
  "武则天",
  "刘备",
  "关羽",
  "张飞",
  "吕布",
  "韩信",
  "张良",
  "孙膑",
  "项羽",
  "孔子",
  "包拯",
  "包公",
  "赵子龙",
  "赵云",
  "唐僧",
  "孙悟空",
  "观音菩萨",
  "观世音",
  "观音",
  "菩萨",
  "吕洞宾",
  "曹国舅",
  "韩湘子",
  "张果老",
  "何仙姑",
  "铁拐李",
  "汉钟离",
  "王莽",
  "董卓",
  "李世民",
  "李渊",
  "范蠡",
  "陶朱公",
  "司马相如",
  "卓文君",
  "伯牙",
  "郭子仪",
  "李靖",
  "马超",
  "曹操",
  "周瑜",
  "伍子胥",
  "安禄山",
  "苏小妹",
  "女娲",
  "目犍连",
  "邓艾",
  "宋仁宗",
  "韩文公",
  "商辂",
  "秦叔宝",
  "尉迟恭",
  "庞洪",
  "陶三春",
  "曹丕",
  "窦燕山",
  "吉平",
  "蔡卿",
  "滕王",
  "庄子",
  "李密",
  "湘子",
  "佛印",
  "苏东坡",
  "何文秀",
  "孟姜女",
  "文昌帝君",
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

function collectFigureViolations(text: string, out: GlyphOutputViolation[]): void {
  for (const phrase of STORY_FIGURE_PHRASES) {
    if (!text.includes(phrase)) continue;
    const idx = text.indexOf(phrase);
    out.push({
      category: "sign_narrative",
      label: `story_figure:${phrase}`,
      snippet: snippetAround(text, idx, phrase.length),
    });
  }
  for (const name of NAMED_FIGURE_NAMES) {
    if (!text.includes(name)) continue;
    const idx = text.indexOf(name);
    out.push({
      category: "sign_narrative",
      label: `historical_figure:${name}`,
      snippet: snippetAround(text, idx, name.length),
    });
  }
}

/** Detect OUTPUT FRAMING violations in a single user-visible string. */
export function detectGlyphOutputViolations(text: string): GlyphOutputViolation[] {
  if (!text?.trim()) return [];

  const violations: GlyphOutputViolation[] = [];

  collectRegexViolations(text, "bazi_term", STEM_ELEMENT, "stem_element", violations);
  collectRegexViolations(text, "bazi_term", STEM_BRANCH, "stem_branch", violations);
  collectRegexViolations(text, "bazi_term", BAZI_FRAME_TERMS, "bazi_frame_term", violations);
  collectRegexViolations(
    text,
    "bazi_term",
    new RegExp(SHISHEN, "g"),
    "shishen",
    violations,
  );
  collectRegexViolations(
    text,
    "bazi_term",
    WUXING_YONGXI_COMBO,
    "wuxing_yongxi_combo",
    violations,
  );
  collectRegexViolations(
    text,
    "bazi_term",
    WUXING_ELEMENT_CONTEXT,
    "wuxing_element_context",
    violations,
  );
  collectRegexViolations(text, "bazi_term", GUIRen_TERM, "guiren_term", violations);

  collectRegexViolations(
    text,
    "sign_narrative",
    SIGN_POEM_PAIR,
    "classical_verse_pair",
    violations,
  );
  collectFigureViolations(text, violations);
  collectRegexViolations(
    text,
    "sign_narrative",
    LEGACY_FRAMING_ZH,
    "legacy_framing_zh",
    violations,
  );
  collectRegexViolations(
    text,
    "sign_narrative",
    LEGACY_FRAMING_EN,
    "legacy_framing_en",
    violations,
  );

  collectRegexViolations(text, "prediction", PREDICTION_ZH, "prediction_zh", violations);
  collectRegexViolations(text, "prediction", PREDICTION_EN, "prediction_en", violations);

  // Deduplicate by label + snippet
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
    reading.命理双视角.命理看此事,
    reading.命理双视角.签文看此事,
    reading.命理双视角.两者印证或冲突,
    reading.meaning_for_question,
    reading.hidden_tension,
    reading.your_moment,
    reading.exploration.text,
    reading.exploration.duration_estimate,
    reading.reflection_question,
  ];
}

/** Audit all user-visible strings in a Glyph reading payload. */
export function auditGlyphReadingContent(reading: GlyphReadingContent): GlyphOutputViolation[] {
  const all: GlyphOutputViolation[] = [];
  for (const s of collectReadingStrings(reading)) {
    all.push(...detectGlyphOutputViolations(s));
  }
  return all;
}

export function shouldRegenerateGlyphReading(reading: GlyphReadingContent): boolean {
  return auditGlyphReadingContent(reading).length > 0;
}

export function logGlyphOutputViolations(
  violations: GlyphOutputViolation[],
  context = "glyph-output",
): void {
  if (violations.length === 0) return;
  console.error(`[${context}] OUTPUT FRAMING violations (${violations.length}):`, violations);
}

/**
 * Display-layer fallback when the model leaks forbidden wording.
 * Best-effort masking — primary enforcement is prompt + optional regenerate.
 */
const REPLACEMENT_MAP_ZH: Array<[RegExp, string]> = [
  [/抽到的签/g, "直觉触发的原型隐喻"],
  [/这支签/g, "这个原型隐喻"],
  [/这张签/g, "这个原型隐喻"],
  [/这只签/g, "这个原型隐喻"],
  [/签文/g, "隐喻主题"],
  [/签的含义/g, "隐喻的含义"],
  [/求签/g, "触发 Glyph"],
  [/抽签/g, "触发 Glyph"],
  [/解签/g, "解读 Glyph"],
  [/卜签/g, "解读 Glyph"],
  [/上签/g, "顺风类隐喻"],
  [/中签/g, "流动类隐喻"],
  [/下签/g, "静水类隐喻"],
  [/灵签/g, "Glyph"],
  [/庙签/g, "Glyph"],
  [/日主/g, "人格核心架构"],
  [/大运/g, "10年生命周期"],
  [/流年/g, "当前年度周期"],
  [/用神/g, "认知资源偏好"],
  [/忌神/g, "需警惕的耗能模式"],
  [/八字/g, "行为蓝图"],
  [/四柱/g, "人格结构维度"],
  [/食神/g, "表达型智慧"],
  [/七杀/g, "外部规则压力"],
  [/正官/g, "结构规范力"],
  [/偏财/g, "外源资源流"],
  [/正财/g, "稳定资源流"],
  [/比肩/g, "同频支持力"],
  [/劫财/g, "竞争张力"],
  [/伤官/g, "突破表达力"],
  [/偏印/g, "隐性洞察"],
  [/正印/g, "滋养性支持"],
  [/喜用水金/g, "需补充:沉静的智慧与决断力"],
  [/喜土金/g, "你需要补充的能量:稳定感与清晰的结构判断"],
  [/忌火土/g, "需警惕:急躁与固执"],
  [/喜用[金木水火土]{1,4}/g, "需补充的认知资源"],
  [/喜[金木水火土]{1,4}/g, "你需要补充的能量"],
  [/忌[金木水火土]{1,4}/g, "需警惕的耗能模式"],
  [/用[金木水火土]/g, "认知资源偏好"],
  [/五行/g, "能量维度"],
  [/[金木水火土]元素/g, "能量特质"],
  [/[金木水火土]行/g, "能量倾向"],
  [/贵人扶持/g, "来自外界的助力"],
  [/贵人显/g, "外部支持增强的阶段"],
  [/贵人/g, "外部助力"],
  [/何时/g, "当下"],
  [/即将/g, "此刻可觉察的"],
  [/会遇到/g, "可留意的当下信号"],
  [/观音/g, "Glyph"],
  [/菩萨/g, "反思镜"],
  [/占卜/g, "反思"],
  [/算命/g, "自我觉察"],
  [/命理/g, "性格结构"],
];

const REPLACEMENT_MAP_EN: Array<[RegExp, string]> = [
  [/\bfortune slip\b/gi, "archetypal metaphor"],
  [/\bdivine slip\b/gi, "archetypal metaphor"],
  [/\blot drawing\b/gi, "Glyph reflection"],
  [/\bdrawing lots\b/gi, "engaging a metaphor"],
  [/\bdivination\b/gi, "reflection"],
  [/\boracle\b/gi, "Glyph"],
  [/\boracle bone\b/gi, "Glyph pattern"],
  [/\bcasting lots\b/gi, "engaging a metaphor"],
  [/\bday master\b/gi, "core personality matrix"],
  [/\bmajor luck cycle\b/gi, "major life cycle"],
  [/\bannual cycle\b/gi, "current annual cycle"],
  [/\byong shen\b/gi, "cognitive resource preference"],
  [/\bfour pillars\b/gi, "behavioral blueprint dimensions"],
  [/\bwhen will\b/gi, "your present readiness for"],
  [/\bwill happen\b/gi, "may be reflected in your present patterns"],
  [/\babout to\b/gi, "you may notice in the present"],
  [/\bwill meet\b/gi, "you may notice signals for"],
];

function replacementMapForLocale(locale: string): Array<[RegExp, string]> {
  return locale.startsWith("zh") ? REPLACEMENT_MAP_ZH : REPLACEMENT_MAP_EN;
}

export function sanitizeGlyphOutput(text: string, locale: string): string {
  let result = text;
  const map = replacementMapForLocale(locale);

  for (const [pattern, replacement] of map) {
    result = result.replace(pattern, replacement);
  }

  // Mask stem-branch pairs after phrase replacements
  result = result.replace(STEM_ELEMENT, "人格架构");
  result = result.replace(STEM_BRANCH, "结构组合");

  return result;
}

/** Sanitize all user-visible strings in a Glyph reading payload. */
export function sanitizeGlyphReadingContent(
  reading: GlyphReadingContent,
  locale: string,
): GlyphReadingContent {
  const s = (text: string) => sanitizeGlyphOutput(text, locale);

  return {
    ...reading,
    wind_category_blurb: s(reading.wind_category_blurb),
    classical_voice: s(reading.classical_voice),
    命理双视角: {
      命理看此事: s(reading.命理双视角.命理看此事),
      签文看此事: s(reading.命理双视角.签文看此事),
      两者印证或冲突: s(reading.命理双视角.两者印证或冲突),
    },
    meaning_for_question: s(reading.meaning_for_question),
    hidden_tension: s(reading.hidden_tension),
    your_moment: s(reading.your_moment),
    exploration: {
      ...reading.exploration,
      text: s(reading.exploration.text),
      duration_estimate: s(reading.exploration.duration_estimate),
    },
    reflection_question: s(reading.reflection_question),
  };
}
