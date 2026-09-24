/**
 * 【】中性平替兜底 —— 最后一道清洗层（只兜底，不替代金字系统）。
 *
 * 用途：sanitizer / autoMark 处理不了的简称或漏网命理词 → 【中性名词】，
 * 保证不打回重算、不裸露违规词、句式仍通顺。
 *
 * ⚠️ 不替代 ⟦t:slug|⟧。已打标区域必须跳过。
 * ⚠️ 第1次真算只跑「合称」平替，避免把 bazi_basis 里合法全称（七杀/伤官）误平替掉。
 * ⚠️ 依据/正文输出层 includeSingles:true → 手写表 + SSOT 派生 + 通用字尾兜底（覆盖最广）。
 */

import { POJU_TERMS } from "@/lib/glossary/pojulife-terms";
import { DAILY_WORD_EXEMPT_HAN } from "@/lib/llm/sanitize/term-marking";

/**
 * POJU Soft-gloss brand names (term.zh) — step-1 body must never *target*
 * these as plain-fallback. Mapping Soft-gloss is step-2 / mark-layer only.
 */
export const SOFT_GLOSS_BRAND_ZH = [
  "锚元",
  "助元",
  "显元",
  "潜元",
  "蕴元",
  "本元",
  "供源",
  "需养",
  "岁环",
  "流展",
  "世络",
  "时脉",
  "元核",
  "隐域",
  "纪元",
  "均势",
  "充沛",
  "柔蔓",
  "刚锋",
] as const;

const SOFT_GLOSS_BRAND_SET = new Set<string>(SOFT_GLOSS_BRAND_ZH);

/** Soft brand → true vernacular (no Soft shell, no 【】 brand wrap). */
export const SOFT_GLOSS_TO_VERNACULAR: Readonly<Record<string, string>> = {
  锚元: "根基承托",
  助元: "助力一侧",
  显元: "外显一面",
  潜元: "深层根基",
  蕴元: "内藏一层",
  本元: "本色底盘",
  供源: "补给来源",
  需养: "需要滋养",
  岁环: "这一年外境",
  流展: "展开节奏",
  世络: "人际脉络",
  时脉: "阶段节奏",
  元核: "核心底盘",
  隐域: "内隐一层",
  纪元: "这段较长阶段",
  均势: "势均力敌",
  充沛: "能量充裕",
  柔蔓: "柔韧延展",
  刚锋: "锋利一面",
};

export function isSoftGlossBrandZh(term: string): boolean {
  return SOFT_GLOSS_BRAND_SET.has(term);
}

/** 十神合称 / 合称漏网 —— sanitizer 上下文还原之后仍可能残留。 */
export const PLAIN_FALLBACK_COMPOUNDS: Readonly<Record<string, string>> = {
  财官杀: "外部责任与挑战",
  官杀: "外部挑战与压力",
  食伤: "表达与创造力",
  比劫: "同伴竞合力量",
  印枭: "内在支持与直觉",
  枭印: "深度直觉觉察",
  财官: "务实目标与责任",
  杀印: "压力下的内在转化",
  印绶护身: "有靠山的护持感",
  印来护身: "靠内在滋养稳住",
  护身符: "护持感",
};

/**
 * 正文/依据漏网单称 —— 仅用于输出层（不应裸露真词）。
 * 第1次 bazi_basis 禁止跑这张表。
 * 柱位/阶段用生活白话，禁止 Soft 映射壳与【年命结构】一类品牌壳。
 */
export const PLAIN_FALLBACK_BODY_SINGLES: Readonly<Record<string, string>> = {
  七杀: "外部挑战与压力",
  正官: "秩序与责任",
  伤官: "突破性表达",
  食神: "从容表达力",
  偏印: "深度直觉觉察",
  正印: "内在滋养",
  劫财: "同伴竞合力量",
  比肩: "并肩同行",
  偏财: "机动资源",
  正财: "稳健资源",
  日主: "内在本色",
  用神: "关键补给",
  喜神: "有益能量",
  忌神: "干扰能量",
  大运: "这段较长阶段",
  流年: "这一年外境",
  流时: "当下节奏",
  年支: "年这一层根基",
  月支: "月这一层根基",
  日支: "日子这一层根基",
  时支: "时辰这一层根基",
  年干: "年这一层外显",
  月干: "月这一层外显",
  日干: "日子这一层外显",
  时干: "时辰这一层外显",
  年柱: "年这一层",
  月柱: "月这一层",
  日柱: "日子这一层",
  时柱: "时辰这一层",
  地支: "深层根基",
  天干: "外显一面",
  藏干: "内藏一层",
  // 生克过程短语（单字五行可直出；「生水/制火」等过程词须平替）
  生水: "降温补给",
  生火: "助燃加压",
  生金: "加固输出",
  生木: "助长生长",
  生土: "加重承载",
  制火: "压住过热",
  泄土: "泄掉过载",
  泄秀: "输出疏导",
  调候: "调节燥热",
  喜用: "有益一侧",
  用忌: "有益与干扰",
  // 五行/金木水火土：交付规范允许原字直出，不打标、不平替（译员与读者都能懂）
  八字: "先天配置",
  护身: "护持感",
  ...SOFT_GLOSS_TO_VERNACULAR,
};

/**
 * 从 SSOT 全量自动派生 —— 保证平替覆盖 ⊇ SSOT（双字以上；单字五行等不误伤）。
 * 手写表优先；此处只填缺口。
 * Soft-gloss term.zh 绝不当平替目标（否则 地支→【潜元】教模型抄 Soft）。
 */
export const SSOT_DERIVED_FALLBACK: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const t of POJU_TERMS) {
    if (t.ns !== "bazi") continue;
    const softPlain = SOFT_GLOSS_TO_VERNACULAR[t.term.zh];
    const plain = softPlain ?? `【${t.term.zh}】`;
    for (const w of [t.traditional, ...(t.aliases ?? [])]) {
      if (!w || w.length < 2) continue;
      if (DAILY_WORD_EXEMPT_HAN.has(w)) continue;
      if (isSoftGlossBrandZh(w)) continue;
      if (!m.has(w)) m.set(w, plain);
    }
    // Soft brand itself → vernacular (if it ever leaks bare).
    if (softPlain && !m.has(t.term.zh)) m.set(t.term.zh, softPlain);
  }
  return m;
})();

/**
 * SSOT 都没有的生僻命理词 —— 字尾特征兜底（保守，避免误伤「精神/明星」）。
 * 在标记/【】已保护的文本上跑。
 */
const MINGLI_SUFFIX_RE = /[\u4e00-\u9fa5]{1,3}(煞|刃|星|宫|格|禄|贵人)/g;

export function genericMingliFallback(text: string): string {
  if (!text) return text;
  return text.replace(MINGLI_SUFFIX_RE, "结构要素");
}

/** Strip Soft-gloss brand shells / bare Soft names to true vernacular. */
export function scrubSoftGlossBrandInText(text: string): string {
  if (!text) return text;
  let out = text;
  for (const brand of [...SOFT_GLOSS_BRAND_ZH].sort((a, b) => b.length - a.length)) {
    const plain = SOFT_GLOSS_TO_VERNACULAR[brand] ?? "结构要素";
    if (out.includes(`【${brand}】`)) out = out.split(`【${brand}】`).join(plain);
    if (out.includes(brand)) out = out.split(brand).join(plain);
  }
  // Legacy Soft pillar shells from older fallback maps.
  const legacyShells: ReadonlyArray<[string, string]> = [
    ["【年命结构】", "年这一层"],
    ["【月命结构】", "月这一层"],
    ["【日命结构】", "日子这一层"],
    ["【时命结构】", "时辰这一层"],
    ["【能量结构】", "先天配置"],
    ["【人生阶段】", "这段较长阶段"],
    ["【当下外境】", "这一年外境"],
  ];
  for (const [from, to] of legacyShells) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

export type PlainFallbackOptions = {
  /** Include body-only singles + SSOT 派生 + 通用字尾. Default false — compute must omit. */
  includeSingles?: boolean;
};

function buildMap(opts?: PlainFallbackOptions): ReadonlyArray<[string, string]> {
  const merged: Record<string, string> = { ...PLAIN_FALLBACK_COMPOUNDS };
  if (opts?.includeSingles) {
    Object.assign(merged, PLAIN_FALLBACK_BODY_SINGLES);
    for (const [w, plain] of SSOT_DERIVED_FALLBACK) {
      if (!(w in merged)) merged[w] = plain;
    }
  }
  return Object.entries(merged).sort((a, b) => b[0].length - a[0].length);
}

/** Replace bare fallback terms in one string; skip inside ⟦t:…⟧ markers. */
export function applyPlainFallbackToText(
  text: string,
  opts?: PlainFallbackOptions,
): string {
  if (!text) return text;

  const markers: string[] = [];
  const protectedText = text.replace(/⟦t:[^⟧]*⟧/g, (m) => {
    const i = markers.length;
    markers.push(m);
    return `\u0000M${i}\u0000`;
  });

  let out = scrubSoftGlossBrandInText(protectedText);
  for (const [from, to] of buildMap(opts)) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  out = scrubSoftGlossBrandInText(out);

  if (opts?.includeSingles) {
    // 已平替的【】先护住，避免字尾正则再吃「【孤鸾煞】」类
    const brackets: string[] = [];
    out = out.replace(/【[^】]*】/g, (m) => {
      const i = brackets.length;
      brackets.push(m);
      return `\u0000B${i}\u0000`;
    });
    out = genericMingliFallback(out);
    out = out.replace(/\u0000B(\d+)\u0000/g, (_, i: string) => brackets[Number(i)] ?? "");
  }

  return out.replace(/\u0000M(\d+)\u0000/g, (_, i: string) => markers[Number(i)] ?? "");
}

/** Deep-walk any JSON-like value and apply plain fallback to every string. */
export function applyPlainFallback<T>(obj: T, opts?: PlainFallbackOptions): T {
  if (typeof obj === "string") {
    return applyPlainFallbackToText(obj, opts) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => applyPlainFallback(item, opts)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = applyPlainFallback(value, opts);
    }
    return out as T;
  }
  return obj;
}
