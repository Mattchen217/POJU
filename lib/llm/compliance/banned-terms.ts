/**
 * User-visible bare-term bans (base-analysis façade + payment audit).
 *
 * 【职责分裂 · 2026-07 收口】
 * - BANNED_TERMS_ZH = 哪些原词禁止裸露（审计视图）
 * - 软译值 = 一律从 SSOT POJU_TERMS 派生（termOf / traditional），不再手抄第二套
 * - 命运红线 = 薄表 FATE_LEXICON_SCRUB_ZH（无 SSOT 行，只禁+scrub，不是术语软译）
 *
 * Gate · sanitizer · prompts MUST all read from here — never maintain parallel soft maps.
 */

import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";

/** Bare technical / fate terms that must not appear in soft-visible user copy. */
export const BANNED_TERMS_ZH = [
  // Keep_cn / structural
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
  "年干",
  "月干",
  "日干",
  "时干",
  "年支",
  "月支",
  "日支",
  "时支",
  "主星",
  "副星",
  "通根",
  "透干",
  "坐支",
  "坐干",
  "本氣",
  "本气",
  "中氣",
  "中气",
  "余氣",
  "余气",
  "干支",
  "干合",
  "支合",
  "調候",
  "调候",
  "納音",
  "纳音",
  "墓庫",
  "墓库",
  "小運",
  "小运",
  "流月",
  "流日",
  "流時",
  "流时",
  "真太陽時",
  "真太阳时",
  "夫妻星",
  "配偶星",
  "八字",
  "四柱",
  "命盘",
  "命局",
  // Fate lexicon (no SSOT row — see FATE_LEXICON_SCRUB_ZH)
  "命运",
  "命定",
  "命理",
  "宿命",
  "判决",
  "天注定",
  // Out-of-set engine terms (never invent; audit-only, no soft replace)
  ...OUT_OF_SET_FORBIDDEN_HAN,
] as const;

export type BannedTermZh = (typeof BANNED_TERMS_ZH)[number];

/**
 * 非 SSOT 命运/合规红线：scrub 用的极薄替换（不是术语软译词典）。
 * 有 POJU_TERMS 行的词【禁止】写进这里。
 */
export const FATE_LEXICON_SCRUB_ZH: Readonly<Record<string, string>> = {
  命运: "人生轨迹",
  命定: "人生轨迹",
  命理: "能量配置",
  宿命: "人生轨迹",
  判决: "读数",
  天注定: "外部定论",
};

/** Resolve scrub/repair soft for a banned traditional — SSOT first, fate scrub second. */
export function softForBannedTraditionalZh(traditional: string): string | null {
  const t = pojuTermByTraditional(traditional, "bazi") ?? pojuTermByTraditional(traditional);
  if (t?.term.zh?.trim()) return t.term.zh.trim();
  const fate = FATE_LEXICON_SCRUB_ZH[traditional];
  return fate?.trim() || null;
}

/**
 * Derived view: banned traditional → soft (SSOT term.zh, or fate scrub).
 * 【不再手抄】大运/日柱等术语软译；与金字 termOf 同一事实源。
 */
export const BANNED_TERM_SOFT_ZH: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const word of BANNED_TERMS_ZH) {
    const soft = softForBannedTraditionalZh(word);
    if (soft) out[word] = soft;
  }
  return out;
})();

/**
 * 比喻黑名单 —— 已清空（2026-07-17）。
 *
 * 病史：机械比喻(引擎/散热片…)进表，是因为当年提示词拿它们当【示范句】→ 全员传染(事故 #1)；
 * 藤蔓被连坐误伤 —— 它是乙木的正确自然意象，禁它导致每个乙木盘烧 2 次 repair。
 * 示范句已在上一批清干净，病根已切 → 禁词表失去存在理由。
 *
 * 机制保留（门禁 hook / 否定式检测 / 三处消费点都是 for-of，空表 = 干净 no-op）：
 * 将来若真发现某个【有害】比喻，往这里加【一个词】即可，不必重建机制。
 * ⚠️ 防"所有用户比喻雷同"现在【只】靠提示词「主比喻由 day_master 现定」约束。
 * 若又雷同 → 加强那条约束或做「比喻↔五行匹配」代码检查，【不要】把词填回这里。
 */
export const METAPHOR_BLACKLIST_ZH: readonly string[] = [];

export const METAPHOR_BLACKLIST_EN: readonly string[] = [];

/**
 * Soft stand-ins used ONLY inside bold lead labels (`**label:**`).
 * Never apply these as full-document find/replace (historical: 养→滋养培育 broke good prose).
 */
export const LEAD_LABEL_METAPHOR_SOFT_ZH: Readonly<Record<string, string>> = {
  持续燃烧的引擎: "持续运转的核心",
  手机散热片: "调节出口",
  随时能翻的参考书: "随时可查阅的依据",
  散热缺口: "调节不足",
  冷却模块: "调节环节",
  引擎: "方式",
  藤蔓: "攀援",
};

export const LEAD_LABEL_METAPHOR_SOFT_EN: Readonly<Record<string, string>> = {
  "steady-burning engine": "steady core drive",
  "phone heatsink": "release valve",
  "always-open reference book": "ready reference",
  "heat-dissipation gap": "release shortfall",
  "cooling module": "release step",
  engine: "drive",
  vine: "climb",
};

/**
 * Deterministic pre-gate scrub: rewrite metaphor-blacklist hits ONLY inside
 * bold lead / pull-quote labels (`**…:**` / `> **…:**` / fullwidth `：`).
 * Body copy is untouched.
 */
export function scrubBannedMetaphorInLeadLabels(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const softMap = locale.startsWith("zh")
    ? LEAD_LABEL_METAPHOR_SOFT_ZH
    : LEAD_LABEL_METAPHOR_SOFT_EN;
  const bans = [...metaphorBlacklistForLocale(locale)].sort((a, b) => b.length - a.length);

  const rewriteLabel = (label: string): string | null => {
    const hay = locale.startsWith("zh") ? label : label.toLowerCase();
    if (!bans.some((b) => hay.includes(locale.startsWith("zh") ? b : b.toLowerCase()))) {
      return null;
    }
    let next = label;
    for (const ban of bans) {
      const soft = softMap[ban];
      if (!soft) continue;
      if (locale.startsWith("zh")) {
        if (next.includes(ban)) next = next.split(ban).join(soft);
      } else {
        const re = new RegExp(ban.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
        if (re.test(next)) next = next.replace(re, soft);
      }
    }
    return next === label ? null : next;
  };

  // Form A: **label:** / **label：** (colon inside bold)
  let out = text.replace(
    /^([ \t]*(?:>\s*)?\*\*)([^*:\n：]{1,40})([:：]\*\*)/gm,
    (full, open: string, label: string, close: string) => {
      const next = rewriteLabel(label);
      if (!next) return full;
      console.warn("[scrub-lead-label] rewrote banned metaphor in label slot", {
        from: label,
        to: next,
      });
      return `${open}${next}${close}`;
    },
  );

  // Form B: **label**: / **label**： (colon outside bold — common LLM variant)
  out = out.replace(
    /^([ \t]*(?:>\s*)?\*\*)([^*\n]{1,40})(\*\*[ \t]*[:：])/gm,
    (full, open: string, label: string, close: string) => {
      const next = rewriteLabel(label);
      if (!next) return full;
      console.warn("[scrub-lead-label] rewrote banned metaphor in label slot (colon-out)", {
        from: label,
        to: next,
      });
      return `${open}${next}${close}`;
    },
  );

  return out;
}

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

/** Unique zh soft labels used by ban map + KEEP_CN façade (for audit mask + collision scan). */
export function collectCanonicalSoftLabelsZh(
  extra: readonly string[] = [],
): string[] {
  const set = new Set<string>();
  for (const v of Object.values(BANNED_TERM_SOFT_ZH)) {
    const t = v.trim();
    if (t.length >= 2) set.add(t);
  }
  for (const v of extra) {
    const t = v.trim();
    if (t.length >= 2) set.add(t);
  }
  return [...set].sort((a, b) => b.length - a.length);
}

/**
 * Soft labels must not be mutual substrings (else term-audit includes()-match false-fires).
 * Returns colliding pairs [shorter, longer].
 */
export function findSoftLabelSubstringCollisions(
  softs: readonly string[],
): Array<[string, string]> {
  const unique = [...new Set(softs.map((s) => s.trim()).filter((s) => s.length >= 2))];
  const hits: Array<[string, string]> = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = 0; j < unique.length; j++) {
      if (i === j) continue;
      const a = unique[i]!;
      const b = unique[j]!;
      if (b.includes(a) && a !== b) hits.push([a, b]);
    }
  }
  return hits;
}

/** Mask known soft labels so forbidden-term includes() cannot hit inside approved softs. */
export function maskKnownSoftLabelsZh(text: string, softs: readonly string[]): string {
  let out = text;
  const sorted = [...softs].sort((a, b) => b.length - a.length);
  for (const soft of sorted) {
    if (!soft || soft.length < 2) continue;
    if (!out.includes(soft)) continue;
    const ph = "\uFFFC".repeat(soft.length);
    out = out.split(soft).join(ph);
  }
  return out;
}

/** Terms that hard-block delivery when still bare in soft-visible / masked text. */
export function isHardBannedTermLabel(label: string): boolean {
  if (label === "metaphor_blacklist") return true;
  // 依据块 0 锚点 / 缺块 = 结论悬空；单行 repair 救不了，必须整篇重生成。
  if (label === "evidence_zero_anchor" || label === "evidence_block_missing") return true;
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
 * Auto-injected into base-analysis system prompt.
 * 【一套事实源】术语软译只认 SSOT；本块不再塞第二套白话对照表。
 */
export function buildForbiddenTermsPromptBlock(locale: string): string {
  if (locale.startsWith("zh")) {
    return `# 用户可见正文 · 绝对禁词（裸露原词 = 整篇被拦 = 白烧一次调用）

【禁裸原词】命理传统字面（日主/大运/流年/四柱/用神/身弱…及集外神煞名等）禁止以【任何形式】裸露出现，包括否定式、对比式、引用式。
  ✗ 所谓的命运  ✗ 这不是命定  ✗ 裸写「大运」「日柱」
术语概念可以讲，但【只走 SSOT 打标】：\`⟦t:<slug>|⟧\`（竖线后留空；可见软译由系统按术语表填入，如大运→纪元、日柱→元核）。
【禁止】自造第二套白话软译（对照表外的说法一律不要写）。

【命运红线】命运/命定/命理/宿命/判决/天注定 — 禁止出现；不要拿它们当反面例子。用这个盘自己的机制正面说。

【主比喻·现定】主比喻必须由**这个人的** structured（day_master 五行 + strength + yong_shen）现场生成；
  换一个命盘还成立 = 套话 = 重写。别套用任何现成意象，让比喻从这盘的能量结构里长出来。

【禁裸干支】甲乙丙丁戊己庚辛壬癸 / 子丑寅卯辰巳午未申酉戌亥 及丙火/乙木类合称一律不得裸露——要么 ⟦t:<slug>|⟧（软译由系统填），要么纯白话意象。
【标记】id 必须取自闭集 slug 清单；自造 slug（如 da_yun / ji_shen）= 直接拒绝。闭集没有对应概念 → 【不打标，直接白话讲】。
【收尾】禁「这不是命运/不是命定」否定式。收尾句由系统统一追加，你不用写。`;
  }

  return `# User-visible body · absolute bans (bare jargon = rejected = wasted paid call)

[Bare jargon ban] Traditional chart jargon must not appear literally in any form (including negation/scare-quotes).
  Concepts OK only via SSOT markers: \`⟦t:<slug>|⟧\` (system fills soft from the term table — one soft set only).
  Do NOT invent a second vernacular soft map.
[Fate red line] fate / destiny / verdict-style words — never, including "this is not fate".
[Main metaphor · chart-native] Main metaphor must be generated from THIS person's structured (day_master element + strength + yong_shen);
  if it still fits another chart = stock = rewrite.
[No bare Ganzhi] Never bare stems/branches or "Bing fire"/"Yi wood" compounds — use \`⟦t:<slug>|⟧\` or plain vernacular.
[Markers] ids must be closed-set slugs only; invented ids are rejected. No closed concept → plain vernacular, no marker.
[Closing] Never "this is not fate" negations. Closing line is appended by the system — do not write one.`;
}

/** Compact repair instruction — model returns patches JSON only, not full document. */
export function buildViolationRepairInstruction(
  violations: ReadonlyArray<{ label: string; snippet: string }>,
  locale: string,
): string {
  const hits = violations.slice(0, 12);
  const lines = hits.map((v, i) => `${i + 1}. ${v.label} @ 「${v.snippet.slice(0, 64)}」`);
  if (locale.startsWith("zh")) {
    const softHint = hits
      .filter((v) => v.label.startsWith("term:"))
      .map((v) => {
        const term = v.label.slice("term:".length);
        const soft = softForBannedTraditionalZh(term);
        return soft ? `「${term}」→「${soft}」(SSOT)` : null;
      })
      .filter(Boolean)
      .join("；");
    return `下列违规点需要补丁。只输出 JSON {"patches":[{"find":"<含违规词的整句>","replace":"<改写后的整句>"}]}，【禁止】重吐全文：

${lines.join("\n")}
${softHint ? `\n软译对照（SSOT）：${softHint}` : ""}
${hits.some((v) => v.label === "metaphor_blacklist") ? "\n黑名单比喻：重写【整句】使其通顺且字面不再出现禁词（含否定式提及也不行）。勿只替换最短词。" : ""}

规则：find = 原文中真实存在的整句；replace = 自然通顺的合规整句；术语软译只认 SSOT；找不到的 find 会被拒。`;
  }

  return `Emit ONLY JSON {"patches":[{"find":"<full sentence>","replace":"<rewritten sentence>"}]} — never rewrite the full document.

${lines.join("\n")}

Rewrite the full sentence containing each hit so it is natural and contains no banned words (including negated mentions). find must be exact; missing finds are rejected.`;
}
