/** Deterministic lookup tables for Energy Matrix (zero LLM). */

export type StemInfo = {
  han: string;
  pinyin: string;
  en: string;
  element: "Wood" | "Fire" | "Earth" | "Metal" | "Water";
  yin_yang: "Yang" | "Yin";
};

export type BranchInfo = {
  han: string;
  pinyin: string;
  zodiac_en: string;
  element: "Wood" | "Fire" | "Earth" | "Metal" | "Water";
};

export const HEAVENLY_STEMS: Record<string, StemInfo> = {
  甲: { han: "甲", pinyin: "jiǎ", en: "Yang Wood", element: "Wood", yin_yang: "Yang" },
  乙: { han: "乙", pinyin: "yǐ", en: "Yin Wood", element: "Wood", yin_yang: "Yin" },
  丙: { han: "丙", pinyin: "bǐng", en: "Yang Fire", element: "Fire", yin_yang: "Yang" },
  丁: { han: "丁", pinyin: "dīng", en: "Yin Fire", element: "Fire", yin_yang: "Yin" },
  戊: { han: "戊", pinyin: "wù", en: "Yang Earth", element: "Earth", yin_yang: "Yang" },
  己: { han: "己", pinyin: "jǐ", en: "Yin Earth", element: "Earth", yin_yang: "Yin" },
  庚: { han: "庚", pinyin: "gēng", en: "Yang Metal", element: "Metal", yin_yang: "Yang" },
  辛: { han: "辛", pinyin: "xīn", en: "Yin Metal", element: "Metal", yin_yang: "Yin" },
  壬: { han: "壬", pinyin: "rén", en: "Yang Water", element: "Water", yin_yang: "Yang" },
  癸: { han: "癸", pinyin: "guǐ", en: "Yin Water", element: "Water", yin_yang: "Yin" },
};

export const EARTHLY_BRANCHES: Record<string, BranchInfo> = {
  子: { han: "子", pinyin: "zǐ", zodiac_en: "Rat", element: "Water" },
  丑: { han: "丑", pinyin: "chǒu", zodiac_en: "Ox", element: "Earth" },
  寅: { han: "寅", pinyin: "yín", zodiac_en: "Tiger", element: "Wood" },
  卯: { han: "卯", pinyin: "mǎo", zodiac_en: "Rabbit", element: "Wood" },
  辰: { han: "辰", pinyin: "chén", zodiac_en: "Dragon", element: "Earth" },
  巳: { han: "巳", pinyin: "sì", zodiac_en: "Snake", element: "Fire" },
  午: { han: "午", pinyin: "wǔ", zodiac_en: "Horse", element: "Fire" },
  未: { han: "未", pinyin: "wèi", zodiac_en: "Goat", element: "Earth" },
  申: { han: "申", pinyin: "shēn", zodiac_en: "Monkey", element: "Metal" },
  酉: { han: "酉", pinyin: "yǒu", zodiac_en: "Rooster", element: "Metal" },
  戌: { han: "戌", pinyin: "xū", zodiac_en: "Dog", element: "Earth" },
  亥: { han: "亥", pinyin: "hài", zodiac_en: "Pig", element: "Water" },
};

export const TEN_GOD_ARCHETYPE: Record<string, string> = {
  正印: "The Scholar",
  偏印: "The Mystic",
  正财: "The Provider",
  偏财: "The Strategist",
  正官: "The Director",
  七杀: "The Maverick",
  食神: "The Creator",
  伤官: "The Performer",
  比肩: "The Ally",
  劫财: "The Rival",
  日元: "The Self",
  元男: "The Self",
  元女: "The Self",
};

export const DA_YUN_THEMES = [
  "Resource",
  "Expression",
  "Visibility",
  "Forge",
  "Rooting",
  "Authority",
  "Wisdom",
  "Return",
] as const;

export const ZODIAN_HAN_TO_EN: Record<string, string> = {
  鼠: "Rat",
  牛: "Ox",
  虎: "Tiger",
  兔: "Rabbit",
  龙: "Dragon",
  蛇: "Snake",
  马: "Horse",
  羊: "Goat",
  猴: "Monkey",
  鸡: "Rooster",
  狗: "Dog",
  猪: "Pig",
};

const ELEMENT_ZH: Record<string, string> = {
  Wood: "木",
  Fire: "火",
  Earth: "土",
  Metal: "金",
  Water: "水",
};

const ZODIAN_EN_TO_HAN: Record<string, string> = Object.fromEntries(
  Object.entries(ZODIAN_HAN_TO_EN).map(([han, en]) => [en, han]),
);

export function isZhMatrixLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

export function elementLabelLocalized(element: string, locale: string): string {
  return isZhMatrixLocale(locale) ? (ELEMENT_ZH[element] ?? element) : element;
}

export function formatStemDisplay(stem: string, locale: string): string {
  const info = getStemInfo(stem);
  if (!info) return stem;
  if (isZhMatrixLocale(locale)) {
    const yy = info.yin_yang === "Yin" ? "阴" : "阳";
    return `${yy}${ELEMENT_ZH[info.element]}`;
  }
  return info.en;
}

export function formatBranchDisplay(
  branch: string,
  locale: string,
  lifeStage?: string | null,
): string {
  const info = getBranchInfo(branch);
  if (!info) return branch;
  if (isZhMatrixLocale(locale)) {
    const zodiac = ZODIAN_EN_TO_HAN[info.zodiac_en] ?? info.zodiac_en;
    const parts = [zodiac, ELEMENT_ZH[info.element]];
    if (lifeStage) parts.push(lifeStage);
    return parts.join(" · ");
  }
  const base = `${info.zodiac_en} · ${info.element}`;
  return lifeStage ? `${base} · ${lifeStage}` : base;
}

export function getStemInfo(stem: string): StemInfo | null {
  const ch = stem.trim().charAt(0);
  return HEAVENLY_STEMS[ch] ?? null;
}

export function getBranchInfo(branch: string): BranchInfo | null {
  const ch = branch.trim().charAt(0);
  return EARTHLY_BRANCHES[ch] ?? null;
}

export function getTenGodArchetype(tenGod: string): string {
  return TEN_GOD_ARCHETYPE[tenGod.trim()] ?? tenGod;
}

export function splitGanzhi(ganzhi: string): { stem: string; branch: string } {
  const s = ganzhi.trim();
  return { stem: s.charAt(0), branch: s.charAt(1) ?? "" };
}

export function formatHiddenStemsDisplay(stems: string[], locale: string): string {
  if (!stems.length) return isZhMatrixLocale(locale) ? "无" : "—";
  const parts = stems.map((st) => {
    const info = getStemInfo(st);
    return info ? elementLabelLocalized(info.element, locale) : st;
  });
  const unique = [...new Set(parts)];
  const label = isZhMatrixLocale(locale) ? "藏干" : "Hidden";
  return `${label}: ${unique.join("·")}`;
}

export function elementCssClass(element: string): string {
  const map: Record<string, string> = {
    Wood: "el-w",
    Fire: "el-f",
    Earth: "el-e",
    Metal: "el-m",
    Water: "el-water",
  };
  return map[element] ?? "";
}

export function isEngineRawPattern(text: string): boolean {
  return /日主\s*.+[,，]\s*四柱/.test(text) || /^日主\s+\S/.test(text.trim());
}
