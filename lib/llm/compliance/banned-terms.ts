/**
 * Single source of truth for user-visible bans (base-analysis façade + payment audit).
 * Gate · sanitizer · prompts MUST all read from here — never maintain parallel lists.
 */

import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";

/** Bare technical terms that must not appear in soft-visible user copy (use soft map). */
export const BANNED_TERMS_ZH = [
  // Keep_cn / structural — PART 2 missed 日主; Fix C closes the gap
  "日主",
  "身弱",
  "身强",
  "身旺",
  "用神",
  "喜神",
  "忌神",
  "天干",
  "地支",
  "藏干",
  // Timing / chart structure
  "大运",
  "流年",
  "日柱",
  "月柱",
  "时柱",
  "年柱",
  "八字",
  "四柱",
  "命盘",
  "命局",
  // Fate lexicon
  "命运",
  "命定",
  "命理",
  "宿命",
  "判决",
  "天注定",
  // Out-of-set engine terms (never invent)
  ...OUT_OF_SET_FORBIDDEN_HAN,
] as const;

export type BannedTermZh = (typeof BANNED_TERMS_ZH)[number];

/** Required soft gloss for each high-traffic banned term (prompt + sanitize). */
export const BANNED_TERM_SOFT_ZH: Readonly<Record<string, string>> = {
  日主: "你的核心特质",
  身弱: "能量供给容易跟不上",
  身强: "燃料底盘充沛",
  身旺: "燃料底盘充沛",
  用神: "关键平衡能量",
  喜神: "有利特质",
  忌神: "需留意的特质",
  天干: "显性特质层",
  地支: "隐性特质层",
  藏干: "内在支撑层",
  大运: "当前这个阶段",
  流年: "当前时空效能",
  日柱: "你的能量结构",
  月柱: "你的能量结构",
  时柱: "你的能量结构",
  年柱: "你的能量结构",
  八字: "你的能量结构",
  四柱: "你的能量结构",
  命盘: "你的能量结构",
  命局: "你的能量结构",
  命运: "人生轨迹",
  命定: "人生轨迹",
  命理: "能量配置",
  宿命: "人生轨迹",
  判决: "读数",
  天注定: "外部定论",
};

export const METAPHOR_BLACKLIST_ZH = [
  "持续燃烧的引擎",
  "手机散热片",
  "随时能翻的参考书",
  "散热缺口",
  "冷却模块",
  "引擎",
] as const;

export const METAPHOR_BLACKLIST_EN = [
  "steady-burning engine",
  "phone heatsink",
  "always-open reference book",
  "heat-dissipation gap",
  "cooling module",
  "engine",
] as const;

export const BANNED_TERMS_EN = [
  "day master",
  "weak self",
  "strong self",
  "fate",
  "destiny",
  "natal chart",
  "ba zi",
  "bazi",
  "da yun",
  "liu nian",
] as const;

/** Terms that hard-block delivery when still bare in soft-visible / masked text. */
export function isHardBannedTermLabel(label: string): boolean {
  if (label === "metaphor_blacklist") return true;
  if (!label.startsWith("term:")) return false;
  const term = label.slice("term:".length);
  if (BANNED_TERMS_ZH.includes(term as BannedTermZh)) return true;
  if (term.startsWith("命")) return true;
  return false;
}

export function bannedTermsForLocale(locale: string): readonly string[] {
  return locale.startsWith("zh") ? BANNED_TERMS_ZH : BANNED_TERMS_EN;
}

export function metaphorBlacklistForLocale(locale: string): readonly string[] {
  return locale.startsWith("zh") ? METAPHOR_BLACKLIST_ZH : METAPHOR_BLACKLIST_EN;
}

/** Soft-replace pairs for payment sanitize (longest-first preferred by callers). */
export function bannedTermSoftReplacePairsZh(): ReadonlyArray<[string, string]> {
  return Object.entries(BANNED_TERM_SOFT_ZH).sort((a, b) => b[0].length - a[0].length);
}

/**
 * Auto-injected into base-analysis system prompt — never hand-maintain a parallel list.
 */
export function buildForbiddenTermsPromptBlock(locale: string): string {
  if (locale.startsWith("zh")) {
    const softLines = Object.entries(BANNED_TERM_SOFT_ZH)
      .slice(0, 18)
      .map(([k, v]) => `${k}→「${v}」`)
      .join("；");
    return `# 用户可见正文 · 绝对禁词（写了 = 整篇被拦 = 白烧一次调用）

【禁词】${BANNED_TERMS_ZH.join(" / ")}
  → 必须软译（对照）：${softLines}…
【禁用比喻·黑名单】${METAPHOR_BLACKLIST_ZH.join(" / ")}
  → 主比喻必须由此人 structured（day_master 五行 + strength + yong_shen）现定；换盘还成立 = 套话 = 重写
【禁裸干支】甲乙丙丁戊己庚辛壬癸 / 子丑寅卯辰巳午未申酉戌亥 及「丙火」类合称一律不得裸露——要么 ⟦t:…⟧ 三段位，要么纯白话
【收尾】禁「这不是命运/不是命定」否定式。✓「这是你的能量配置读数。怎么用它，取决于你自己。」`;
  }

  return `# User-visible body · absolute bans (violation = rejected = wasted paid call)

[Banned] ${BANNED_TERMS_EN.join(" / ")}
  → Soft-translate (e.g. day master → "your core nature"; weak self → "fuel runs short easily")
[Metaphor blacklist] ${METAPHOR_BLACKLIST_EN.join(" / ")}
  → Main metaphor from this chart's day_master + strength + yong_shen only
[No bare Ganzhi] Never bare stems/branches or "Bing fire" compounds — full ⟦t:…⟧ or plain vernacular
[Closing] Never "this is not fate" negations. ✓ "This is your energy-config readout. How you use it is yours."`;
}

/** Compact repair instruction from concrete gate hits. */
export function buildViolationRepairInstruction(
  violations: ReadonlyArray<{ label: string; snippet: string }>,
  locale: string,
): string {
  const hits = violations.slice(0, 12);
  const lines = hits.map((v, i) => `${i + 1}. ${v.label} @ 「${v.snippet.slice(0, 48)}」`);
  if (locale.startsWith("zh")) {
    const softHint = hits
      .filter((v) => v.label.startsWith("term:"))
      .map((v) => {
        const term = v.label.slice("term:".length);
        const soft = BANNED_TERM_SOFT_ZH[term];
        return soft ? `「${term}」→「${soft}」` : null;
      })
      .filter(Boolean)
      .join("；");
    return `下面这份报告只有几处违规。请【只修这几处】，其余【一字不动】：

${lines.join("\n")}
${softHint ? `\n软译对照：${softHint}` : ""}
${hits.some((v) => v.label === "metaphor_blacklist") ? "\n若标签/句子含黑名单词（如「引擎」），只换该标签或该句，【禁止】改动全文比喻主线。" : ""}

【禁止】重写其他段落、【禁止】改动未标出的好句子、【禁止】增删章节。
原样返回整篇 Markdown（含未改动部分），不要 JSON、不要前言。`;
  }

  return `This report has only a few violations. Fix ONLY these spots; leave everything else BYTE-IDENTICAL:

${lines.join("\n")}

Do NOT rewrite other paragraphs, do NOT change the main metaphor arc, do NOT add/remove sections.
Return the full Markdown (including untouched parts). No JSON, no preamble.`;
}
