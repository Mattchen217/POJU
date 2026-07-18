/**
 * LLM term marking architecture — single source projections for prompt + UI.
 * LLM writes ⟦t:id|plain⟧ (2-slot standard); UI fills soft via termOf SSOT.
 * Compatibility 3-slot ⟦t:id|soft|plain⟧ still parsed; soft is ignored at render.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeChartRelations, type RelationLabel } from "@/lib/calculations/relation-engine";
import { termPolarityById, type TermPolarity } from "@/lib/glossary/term-polarity";
import {
  BARE_GANZHI_MARKER,
  CLOSED_MATCH_RELATIONS,
  CLOSED_SET_REPLACE_IDS,
  CLOSED_SET_SLUG,
  CLOSED_SHEN_SHA,
  CLOSED_TEN_GODS,
  HIGH_RISK_COMPLIANCE_HAN,
  HIGH_RISK_SOFT_LABEL,
  isClosedSetMarkerId,
  isRelationMarkerId,
  isValidSexagenaryGanzhi,
  KEEP_CN_SLUGS,
  KEEP_CN_VISIBLE_SOFT,
  OUT_OF_SET_FORBIDDEN_EN,
  OUT_OF_SET_FORBIDDEN_HAN,
  RELATION_KIND_SOFT,
  RELATION_SURFACE_TERMS_ZH,
  TEN_GOD_TENSION_SOFT,
  relationKindFromMarkerId,
} from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import {
  TERM_GLOSSARY,
  type GlossaryConcept,
  type Locale,
  toGlossaryLocale,
} from "@/lib/glossary/term-glossary";
import {
  POJU_TERMS,
  glossOf,
  pojuTermBySlug,
  termOf,
  type PojuTerm,
} from "@/lib/glossary/pojulife-terms";
import {
  BANNED_TERMS_ZH,
  BANNED_TERM_SOFT_ZH,
  metaphorBlacklistForLocale,
} from "@/lib/llm/compliance/banned-terms";
import { buildClosedSetConstraintPromptBlock } from "@/lib/llm/prompts/term-closed-set-constraint";
import { STEMS } from "@/lib/match/data/stems-branches";
import {
  allShenshaHanSurfaces,
  normalizeShenshaLocale,
  resolveShensha,
  resolveShenshaSoftLabels,
  toShenshaId,
} from "@/lib/poju/shensha";

export type TermEntry = {
  id: string;
  forbidden: string[];
  soft: Record<Locale, string>;
  keep_cn?: boolean;
  plain: Record<Locale, string>;
};

/** Glossary rows injected into delivery prompts — from POJU_TERMS SSOT. */
function pojuToTermEntry(t: PojuTerm): TermEntry {
  const closed = CLOSED_SET_GLOSSARY_ENTRIES.find(
    (c) => c.id === t.traditional || CLOSED_SET_SLUG[c.id] === t.slug,
  );
  return {
    id: t.slug,
    forbidden: closed ? [...closed.forbidden_variants] : [t.traditional],
    soft: {
      zh: t.term.zh,
      en: t.term.en,
      es: t.term.es,
      de: t.term.de,
      fr: t.term.fr,
    },
    keep_cn: KEEP_CN_SLUGS.has(t.slug),
    plain: {
      zh: t.definition.zh,
      en: t.definition.en,
      es: t.definition.es,
      de: t.definition.de,
      fr: t.definition.fr,
    },
  };
}

function pickFiveLocale(
  bag: Partial<Record<Locale, string>> | undefined,
  loc: Locale,
): string {
  if (!bag) return "";
  return (bag[loc] || bag.en || bag.zh || "").trim();
}

function softLabel(entry: TermEntry, loc: Locale): string {
  // SSOT soft labels from POJU_TERMS win over KEEP_CN_VISIBLE_SOFT overrides.
  const poju = pojuTermBySlug(entry.id);
  if (poju) {
    return (poju.term[loc] || poju.term.en || poju.term.zh || "").trim();
  }
  const override = KEEP_CN_VISIBLE_SOFT[entry.id];
  if (override) {
    return pickFiveLocale(override, loc);
  }
  return (entry.soft[loc] || entry.soft.en || entry.soft.zh || "")
    .split(/\s*\/\s*/)[0]!
    .trim();
}

function conceptToTermEntry(c: GlossaryConcept): TermEntry | null {
  if (c.surface === "delete" || c.surface === "allow") return null;
  const id = CLOSED_SET_SLUG[c.id] ?? c.id.replace(/[^a-zA-Z0-9_]/g, "_");
  const poju = pojuTermBySlug(id) ?? (CLOSED_SET_SLUG[c.id] ? pojuTermBySlug(CLOSED_SET_SLUG[c.id]!) : undefined);
  if (poju) return pojuToTermEntry(poju);
  return {
    id,
    forbidden: [...c.forbidden_variants],
    soft: c.soft,
    keep_cn: KEEP_CN_SLUGS.has(id),
    plain: c.gloss,
  };
}

export const TERM_ENTRIES: TermEntry[] = (() => {
  const fromPoju = POJU_TERMS.map(pojuToTermEntry);
  const byId = new Map(fromPoju.map((e) => [e.id, e]));
  for (const c of TERM_GLOSSARY) {
    const e = conceptToTermEntry(c);
    if (!e) continue;
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return [...byId.values()];
})();

const TERM_BY_ID = new Map(TERM_ENTRIES.map((e) => [e.id, e]));

const DELIVERY_MARKING_ENTRIES: TermEntry[] = POJU_TERMS.map(pojuToTermEntry);

/** LLM term marker — UI parses `⟦t:id|visible|plain⟧` (plain optional). Legacy 2-segment + `⟦g|…⟧` supported. */
export const TERM_MARKER_PATTERN =
  /⟦t:([^|]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g;

function normalizeTermMarkerId(raw: string): string {
  if (!raw.includes(":")) return raw;
  const leaf = raw.split(":").pop()!;
  return TERM_BY_ID.has(leaf) ? leaf : raw;
}

/**
 * Fix C — 神煞 marker 软译格只填白话，绝不填 煞/刃 原名。
 * 原名可留在 id（如 shensha_孤鸾 / shensha.孤鸾煞），用户只见 soft label。
 */
export function repairShenshaMarkerSoftLabels(text: string, locale: string): string {
  if (!text?.trim() || !text.includes("⟦t:")) return text ?? "";
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(
    TERM_MARKER_PATTERN,
    (raw, rawId: string, visEsc: string, plainEsc?: string) => {
      const vis = unescapeMarkerPart(visEsc);
      const plain = plainEsc?.trim() ? unescapeMarkerPart(plainEsc) : undefined;

      let labels = resolveShenshaSoftLabels(vis, locale);
      if (!labels) {
        const leaf = String(rawId).includes(":")
          ? String(rawId).split(":").pop()!
          : String(rawId).replace(/^shensha_/, "");
        labels = resolveShenshaSoftLabels(leaf, locale);
        if (!labels && toShenshaId(leaf)) {
          const view = resolveShensha(leaf, normalizeShenshaLocale(locale));
          if (view.id !== "unknown" && view.label?.trim()) {
            labels = {
              slug: `shensha_${view.id}`,
              soft: view.label.trim(),
              plain: view.gloss?.trim() || view.label.trim(),
            };
          }
        }
      }
      if (!labels && String(rawId).startsWith("shensha_")) {
        const view = resolveShensha(String(rawId).slice("shensha_".length), normalizeShenshaLocale(locale));
        if (view.id !== "unknown" && view.label?.trim()) {
          labels = {
            slug: `shensha_${view.id}`,
            soft: view.label.trim(),
            plain: view.gloss?.trim() || view.label.trim(),
          };
        }
      }
      if (!labels) return raw;

      // Soft slot must never carry 煞/刃 原名 or zh_src / alias.
      if (vis === labels.soft && !/[煞刃]/.test(vis)) {
        if (rawId === labels.slug) return raw;
        return encodeTermMarker(labels.slug, labels.soft, plain ?? labels.plain);
      }
      return encodeTermMarker(labels.slug, labels.soft, plain ?? labels.plain);
    },
  );
}

export function repairChatTermMarkers(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text.replace(
    /(?<!⟦)t:([a-zA-Z0-9_:]+)\|([^|]+)\|?/g,
    (_m, rawId: string, visible: string) => {
      const id = normalizeTermMarkerId(rawId);
      const vis = visible.trim();
      if (!TERM_BY_ID.has(id) && !isRelationMarkerId(id)) return vis;
      const plain = plainByTermId(id, locale) ?? undefined;
      return encodeTermMarker(id, vis, plain);
    },
  );
  out = out.replace(
    /⟦t:([a-zA-Z0-9_:]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g,
    (raw, rawId: string, visEsc: string, plainEsc?: string) => {
      const id = normalizeTermMarkerId(rawId);
      if (id === rawId && (TERM_BY_ID.has(id) || isRelationMarkerId(id))) return raw;
      if (!TERM_BY_ID.has(id) && !isRelationMarkerId(id)) return unescapeMarkerPart(visEsc);
      const vis = unescapeMarkerPart(visEsc);
      const plain = plainEsc?.trim()
        ? unescapeMarkerPart(plainEsc)
        : plainByTermId(id, locale) ?? undefined;
      return encodeTermMarker(id, vis, plain);
    },
  );
  return repairShenshaMarkerSoftLabels(out, locale);
}

function escapeMarkerPart(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/⟧/g, "\\⟧");
}

export function unescapeMarkerPart(s: string): string {
  return s.replace(/\\(.)/g, "$1");
}

/**
 * Encode marker. Soft label is SSOT-owned at render — prefer 2-slot `⟦t:id|plain⟧`.
 * `visible` is ignored when `plain` is provided (kept for call-site compatibility).
 */
export function encodeTermMarker(id: string, visible: string, plain?: string): string {
  if (plain?.trim()) {
    return `⟦t:${id}|${escapeMarkerPart(plain.trim())}⟧`;
  }
  // Auto-mark without contextual plain: seed with SSOT soft as placeholder; render still overwrites.
  return `⟦t:${id}|${escapeMarkerPart(visible)}⟧`;
}

export type ParsedTermMarker = { id: string; visible: string; plain?: string; raw: string };

/** True when marker is compatibility 3-slot `⟦t:id|soft|plain⟧` (two `|`). */
export function isThreeSlotTermMarker(raw: string): boolean {
  return (raw.match(/\|/g) || []).length >= 2;
}

/**
 * Resolve contextual plain from a parsed marker.
 * Standard 2-slot: slot2 = plain. Compatibility 3-slot: slot3 = plain.
 */
export function resolveMarkerPlain(m: Pick<ParsedTermMarker, "raw" | "visible" | "plain">): string {
  if (isThreeSlotTermMarker(m.raw)) return (m.plain ?? "").trim();
  return (m.plain ?? m.visible ?? "").trim();
}

export function parseTermMarkers(text: string): ParsedTermMarker[] {
  const out: ParsedTermMarker[] = [];
  TERM_MARKER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_MARKER_PATTERN.exec(text)) !== null) {
    const raw = m[0];
    const slot2 = unescapeMarkerPart(m[2]);
    const isThreeSlot = isThreeSlotTermMarker(raw);
    // 3-slot: plain = slot3 (may be ""). 2-slot standard: plain = slot2 (contextual vernacular).
    const plain = isThreeSlot
      ? m[3] != null
        ? unescapeMarkerPart(m[3])
        : ""
      : slot2;
    out.push({
      id: normalizeTermMarkerId(m[1]),
      // Slot2 kept as `.visible` for 3-slot soft audits; render always overwrites via termOf.
      visible: slot2,
      plain,
      raw,
    });
  }
  return out;
}

/** Strip markers for LLM history — SSOT soft label only; never model soft / contextual plain. */
export function stripMarkersForPrompt(text: string, locale = "en"): string {
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(TERM_MARKER_PATTERN, (raw, rawId: string, slot2: string, slot3?: string) => {
    const id = normalizeTermMarkerId(rawId);
    const ssot = termOf(id, locale);
    if (ssot) return ssot;
    const isThreeSlot = (raw.match(/\|/g) || []).length >= 2;
    if (isThreeSlot) return unescapeMarkerPart(slot2) || id;
    // 2-slot without SSOT: slot2 is contextual plain — don't leak into history as "term".
    return id;
  });
}

/**
 * 正文层降级：⟦t:id|贴题白话⟧ / ⟦t:id|软译|贴题白话⟧ → **只留贴题白话**（无软译、无金字、无 [···]）。
 * 与 stripMarkersForPrompt 的区别：那个留金字给 prompt/history，这个留白话给用户正文。
 * 模型没写贴题白话时退到软译，并留痕 —— 静默兜底 = 失败永远看不见。
 */
export function degradeMarkersToPlain(text: string, locale = "en"): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(TERM_MARKER_PATTERN, (raw, rawId: string, slot2: string, slot3?: string) => {
    const id = normalizeTermMarkerId(rawId);
    const isThreeSlot = (raw.match(/\|/g) || []).length >= 2;
    const contextual = unescapeMarkerPart(isThreeSlot ? (slot3 ?? "") : slot2).trim();
    if (contextual) return contextual;
    console.warn("[term-marking] body marker has no contextual plain — fell back to soft label", { id });
    return termOf(id, locale) || id;
  });
}

/** Remove bare t: leaks (no ⟦⟧) and broken markers so users never see raw tokens. */
export function stripBareTermMarkers(text: string): string {
  return text.replace(/(?<!⟦)t:[a-zA-Z0-9_:]+\|([^|]+)\|?/g, "$1");
}

/**
 * 白话 → 金字 的桥（双层制的接缝）。
 *
 * 上游 scrub 把裸词换成【正文白话】(BANNED_TERM_SOFT_ZH)；依据层要把白话升回【金字】(POJU_TERMS)。
 * 因此 label **必须从 BANNED_TERM_SOFT_ZH 取** —— scrub 产什么，桥就得认什么，绝不手抄。
 *
 * 手抄过一次的后果（实测）：decade 被抄成「当前阶段气候」，而 scrub 实产的是「当前这个阶段」
 * →「大运」被 scrub 成白话后，桥认不出来 → 永远升不成金字「纪元[···]」。
 * （banned-terms.ts:264 自己的注释就写着 never hand-maintain a parallel list。）
 */
function keepCnBridgeLabel(traditional: string): string | null {
  const plain = BANNED_TERM_SOFT_ZH[traditional];
  if (!plain) {
    // 表改了、桥没跟上 —— 静默的话这个词会永远停在白话层，没人看得见（铁律 #5）
    console.warn(
      `[term-marking] keep_cn 桥断了：BANNED_TERM_SOFT_ZH 里没有「${traditional}」，该词将停在白话层，升不成金字。`,
    );
    return null;
  }
  return plain;
}

/** Wrap bare keep_cn soft phrases that lack ⟦t:…⟧ markers (visible text = soft label only, no ganzhi). */
export function wrapBareKeepCnSoftTerms(text: string, locale: string): string {
  // 覆盖面维持现状（4 个 keep_cn slug）—— 扩到全部 14 条属于「双层制推广」，见文档末尾。
  const patterns = [
    { id: "decade", label: keepCnBridgeLabel("大运") },
    { id: "day_master", label: keepCnBridgeLabel("日主") },
    { id: "year", label: keepCnBridgeLabel("流年") },
    { id: "yong_shen", label: keepCnBridgeLabel("用神") },
    { id: "yong_shen", label: "用神" }, // 裸词漏网时也接住（原表就有这行，保留）
  ].filter((p): p is { id: string; label: string } => Boolean(p.label));

  const parts = text.split(/(⟦[^⟧]*⟧)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      let out = part;
      for (const { id, label } of patterns) {
        const re = new RegExp(`(?<![\\u4e00-\\u9fff])${label}(?![（(])`, "g");
        out = out.replace(re, (match) =>
          encodeTermMarker(id, match, plainByTermId(id, locale) ?? undefined),
        );
      }
      return out;
    })
    .join("");
}

/** 天干+五行常见合称（壬水/甲木…）——单字天干 lookahead 拦不住完整合称。 */
const STEM_ELEMENT_COMPOUNDS: string[] = Object.entries(STEMS).map(
  ([stem, info]) => `${stem}${info.wuxing}`,
);

/** 天干 → 闭集 slug（stem_xin → 莹珠，十个全在 pojulife-terms.ts 里）。 */
const STEM_TO_SLUG: Readonly<Record<string, string>> = {
  甲: "stem_jia",
  乙: "stem_yi",
  丙: "stem_bing",
  丁: "stem_ding",
  戊: "stem_wu",
  己: "stem_ji",
  庚: "stem_geng",
  辛: "stem_xin",
  壬: "stem_ren",
  癸: "stem_gui",
};

/**
 * 裸「干+五行」合称（辛金 / 乙木 / 丙火 …）→ 打成标记。
 *
 * 为什么必须在【服务端】做（铁律 #4：代码能确定的，绝不让模型做）：
 * 这张表(STEM_ELEMENT_COMPOUNDS)一直只接在 render 层的 autoMarkBareTerms 上；
 * 而门禁(delivery-gate stem_element)跑在服务端 —— 于是「辛金」变成一类
 * 【门禁拦得住、清洗器修不掉】的词，每次都得多烧一次 LLM repair 去改。
 * 2026-07-17 生产:底座因此从 2 次调用变 3 次，第 3 次还被截断、用残篇盖掉了完整报告。
 * replaceZhMingliStacks 只管「正印壬水」这种十神+干支组合，
 * removeStandaloneBareGanzhi 只管六十甲子(戊辰/丙辰)——「辛金」两头都不管。
 */
export function wrapBareStemElements(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const loc = toGlossaryLocale(locale);
  let out = text;
  for (const compound of STEM_ELEMENT_COMPOUNDS) {
    const stem = compound[0]!;
    const id = STEM_TO_SLUG[stem];
    if (!id || !termOf(id, loc)) continue;
    // 与 autoMarkBareTerms 双字合称同款：中文正文里「特质辛金与…」前后几乎总贴汉字，
    // 若用 Han 边界会 100% 漏网（正是 2026-07-17 生产那句）。只挡括号续写。
    const re = new RegExp(`${escapeRegExp(compound)}(?![（(])`, "g");
    out = out.replace(re, () => `⟦t:${id}|⟧`);
  }
  return out;
}

/** 五行 → 闭集 slug（pojulife-terms 里已齐：舒展/发散/承托/精练/润流）。 */
const WUXING_TO_SLUG: Readonly<Record<string, string>> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
};

/**
 * 裸五行 → 标记，**只在命理语境里**。
 * ⚠️ 绝不全局单字打标：木/树木、金/金钱、水/水平、火/上火、土/土地 会被啃烂
 * （CLOSED_WUXING 当初进 ALLOW 表就是这个护栏，那张表现在虽死，意图对）。
 * 只认两类句式：前置(为|是|属|主)+五行；后置 五行+(主|性|气|局)。均要求前后不贴汉字。
 */
export function wrapBareWuxingInMingliContext(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const loc = toGlossaryLocale(locale);
  let out = text;
  for (const [han, id] of Object.entries(WUXING_TO_SLUG)) {
    if (!termOf(id, loc)) continue;
    // 前置：为火与土 / 是木，—— 后接与/和/顿号很常见，不能要求「后不贴汉字」
    // 只挡「为火主」「是木性」被切成两半的歧义续写
    out = out.replace(
      new RegExp(`(?<=[为是属主])${han}(?![主性气局木火土金水])`, "g"),
      `⟦t:${id}|⟧`,
    );
    // 后置：木主 / 火性 —— 要求前不贴汉字，避免树木/上火误伤
    out = out.replace(new RegExp(`(?<![\\u4e00-\\u9fff])${han}(?=[主性气局])`, "g"), `⟦t:${id}|⟧`);
  }
  return out;
}

/** 十神 → 闭集 slug（十个软译全在 pojulife-terms：流展/遇资/供源…）。 */
const TEN_GOD_TO_SLUG: Readonly<Record<string, string>> = {
  比肩: "bi_jian",
  劫财: "jie_cai",
  食神: "shi_shen",
  伤官: "shang_guan",
  偏财: "pian_cai",
  正财: "zheng_cai",
  七杀: "qi_sha",
  正官: "zheng_guan",
  偏印: "pian_yin",
  正印: "zheng_yin",
};

/**
 * 裸十神 → 标记。这是"门禁拦得住、清洗器修不掉"那一类的最后一块。
 *
 * 生产实况(2026-07-18)：报告写「你通过展现才华（食神）获取机会（偏财）」→
 * 门禁 term:食神/term:偏财 拦下 → 服务端无十神打标器 → 只能烧 repair 或卡住。
 * 天干(wrapBareStemElements)/五行(wrapBareWuxing)都做了，十神这一类一直空着。
 *
 * 十神都是双字、且不与常用汉语词撞（食神/偏财/七杀…不会误伤），比五行安全得多，
 * 但仍要求前后不贴汉字，避免吃掉「正财运」这类更长组合的一部分。
 * 长度降序，防「偏财」先被「财」类短词吃掉（这里都是双字，主要防将来扩表）。
 */
export function wrapBareTenGods(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const loc = toGlossaryLocale(locale);
  let out = text;
  const entries = Object.entries(TEN_GOD_TO_SLUG).sort((a, b) => b[0].length - a[0].length);
  for (const [han, id] of entries) {
    if (!termOf(id, loc)) continue;
    // 「以食神换」「正印生身」前后几乎总贴汉字；Han 双边界会 100% 漏网。
    // 只挡「正财运 / 食神格 / 偏财星」这类后缀粘连（文档要防的那种）。
    out = out.replace(new RegExp(`${escapeRegExp(han)}(?![运格星局宫])`, "g"), `⟦t:${id}|⟧`);
  }
  return out;
}

/**
 * 与闭集表面撞名的【日常汉语词】—— 永不自动补标。
 * 「平衡」是 CLOSED_STRUCTURAL 里唯一的日常词，且常作动词：自动补标会把模型写的白话
 * 「需要重新调整平衡」改写成金字「…调整均势[···]」，甚至把动词换成名词（"来均势耗元"）。
 * 显式 ⟦t:balanced_self|…⟧ 仍正常渲染 —— 这里只关掉"猜"，不动闭集。
 */
const AUTO_MARK_EXCLUDE_HAN: ReadonlySet<string> = new Set(["平衡"]);

/**
 * UI 兜底扫描集：合规高危 + 闭集全量 + 天干五行合称 + 神煞 i18n 全表（含孤鸾煞等）。
 * 按长度降序，避免短词先吃掉长词。
 */
const BARE_AUTO_MARK_HAN = [
  ...new Set([
    ...HIGH_RISK_COMPLIANCE_HAN,
    ...CLOSED_SET_REPLACE_IDS,
    ...STEM_ELEMENT_COMPOUNDS,
    ...allShenshaHanSurfaces(),
  ]),
]
  .filter((han) => !AUTO_MARK_EXCLUDE_HAN.has(han))
  .sort((a, b) => b.length - a.length);

/** 六十甲子干支对。裸单字天干/地支走 BARE_AUTO_MARK_HAN（带汉字边界，避免「孩子」误伤）。 */
const BARE_GANZHI_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Protect `"养"` / 「冲」 rhetorical single chars from auto-mark / soft-replace. */
export function protectQuotedSingleHanChars(text: string): {
  text: string;
  restore: (s: string) => string;
} {
  const slots: string[] = [];
  const masked = text.replace(
    /(?:'([\u4e00-\u9fff])'|"([\u4e00-\u9fff])"|「([\u4e00-\u9fff])」|『([\u4e00-\u9fff])』)/g,
    (full) => {
      const i = slots.length;
      slots.push(full);
      return `\uE050${i}\uE051`;
    },
  );
  return {
    text: masked,
    restore: (s: string) =>
      s.replace(/\uE050(\d+)\uE051/g, (_, idx: string) => slots[Number(idx)] ?? ""),
  };
}

function highRiskSoftBySlug(slug: string) {
  return Object.values(HIGH_RISK_SOFT_LABEL).find((h) => h.slug === slug) ?? null;
}

function resolveBareMarkLabels(
  hanId: string,
  locale: string,
): { slug: string; soft: string; plain: string } | null {
  const hr = HIGH_RISK_SOFT_LABEL[hanId as keyof typeof HIGH_RISK_SOFT_LABEL];
  if (hr) {
    const loc = toGlossaryLocale(locale);
    return {
      slug: hr.slug,
      soft: pickFiveLocale(hr.soft, loc),
      plain: pickFiveLocale(hr.gloss, loc),
    };
  }

  // 天干+五行合称（如壬水）→ 标为对应天干
  if (hanId.length === 2) {
    const stem = hanId[0]!;
    const element = hanId[1]!;
    const stemInfo = STEMS[stem as keyof typeof STEMS];
    if (stemInfo && stemInfo.wuxing === element) {
      const slug = CLOSED_SET_SLUG[stem] ?? stem;
      const ui = uiTermById(slug, locale) ?? uiTermById(stem, locale);
      if (ui) {
        return {
          slug,
          soft: ui.soft,
          plain: plainByTermId(slug, locale) ?? ui.plain,
        };
      }
    }
  }

  const slug = CLOSED_SET_SLUG[hanId] ?? hanId;
  const ui = uiTermById(slug, locale) ?? uiTermById(hanId, locale);
  if (ui) {
    return {
      slug,
      soft: ui.soft,
      plain: plainByTermId(slug, locale) ?? ui.plain,
    };
  }

  // 神煞 i18n 全表兜底（孤鸾煞/寡宿 等）
  return resolveShenshaSoftLabels(hanId, locale);
}

function markBareGanzhiInSegment(
  segment: string,
  locale: string,
  seenSlugs?: Set<string>,
  tryClaimMark?: () => boolean,
): string {
  if (!segment.trim()) return segment;
  const slug = BARE_GANZHI_MARKER.slug;
  if (seenSlugs?.has(slug)) return segment;

  const loc = toGlossaryLocale(locale);
  const soft = pickFiveLocale(BARE_GANZHI_MARKER.soft, loc);
  const plain = pickFiveLocale(BARE_GANZHI_MARKER.gloss, loc);
  const marker = encodeTermMarker(slug, soft, plain);

  const matches: Array<{ index: number; len: number }> = [];
  BARE_GANZHI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_GANZHI_RE.exec(segment)) !== null) {
    if (!isValidSexagenaryGanzhi(m[0])) continue;
    const prev = matches[matches.length - 1];
    if (prev && m.index < prev.index + prev.len) continue;
    matches.push({ index: m.index, len: m[0].length });
  }
  if (!matches.length) return segment;

  // First occurrence only for ganzhi-style auto marks.
  const first = matches[0]!;
  if (tryClaimMark && !tryClaimMark()) return segment;
  seenSlugs?.add(slug);
  return segment.slice(0, first.index) + marker + segment.slice(first.index + first.len);
}

/**
 * UI 渲染兜底：词表内裸命理词 + 高危合规词 + 裸干支（未在 ⟦t:⟧ 内）自动补标 → 软译呈现。
 * 只在标记外正文段扫描；整词替换；幂等（已包过的段不重复处理）。
 * 同一术语全文仅首次补标；每段（空行分段）最多补 2 个，降低括号密度。
 */
export function autoMarkBareTerms(text: string, locale: string): string {
  // Phrase-first: never mark 月柱/正印/壬水 as three abutting softs.
  // Quoted single chars ("养") are rhetorical — do not auto-mark.
  const { text: protectedText, restore } = protectQuotedSingleHanChars(text);
  const folded = collapseChainedSoftReplaceArtifacts(replaceZhMingliStacks(protectedText));
  const seenSlugs = new Set<string>();
  // Seed with ids already marked by the model so auto-mark doesn't re-open them.
  for (const m of folded.matchAll(/⟦t:([a-zA-Z0-9_:]+)\|/g)) {
    if (m[1]) seenSlugs.add(m[1]);
  }

  const paragraphs = folded.split(/(\n\n+)/);
  return restore(
    collapseChainedSoftReplaceArtifacts(
      paragraphs
        .map((para) => {
          if (/^\n\n+$/.test(para)) return para;
          let marksInPara = 0;
          const parts = para.split(/(⟦[^⟧]*⟧)/g);
          return parts
            .map((part, i) => {
              if (i % 2 === 1) return part;
              let out = markBareGanzhiInSegment(part, locale, seenSlugs, () => {
                if (marksInPara >= 2) return false;
                marksInPara += 1;
                return true;
              });
              for (const hanId of BARE_AUTO_MARK_HAN) {
                if (marksInPara >= 2) break;
                const labels = resolveBareMarkLabels(hanId, locale);
                if (!labels || seenSlugs.has(labels.slug)) continue;
                const re =
                  hanId.length === 1
                    ? new RegExp(
                        `(?<![\\u4e00-\\u9fff])${escapeRegExp(hanId)}(?![\\u4e00-\\u9fff（(])`,
                        "g",
                      )
                    : new RegExp(`${escapeRegExp(hanId)}(?![（(])`, "g");
                out = out.replace(re, () => {
                  if (seenSlugs.has(labels.slug) || marksInPara >= 2) return hanId;
                  seenSlugs.add(labels.slug);
                  marksInPara += 1;
                  return encodeTermMarker(labels.slug, labels.soft, labels.plain);
                });
              }
              return out;
            })
            .join("");
        })
        .join(""),
    ),
  );
}

/** 先补 keep_cn 软词，再补闭集裸词。 */
/**
 * Common pinyin / typo aliases the model invents → closed-set English slugs.
 * Unknown compound ids (wu_yin_ban_he …) are demoted to soft text instead.
 */
export const MARKER_ID_ALIASES: Readonly<Record<string, string>> = {
  da_yun: "decade",
  dayun: "decade",
  major_luck: "decade",
  luck_pillar: "decade",
  liu_nian: "year",
  liunian: "year",
  ji_shen: "unfavorable_element",
  jishen: "unfavorable_element",
  xi_shen: "favorable_element",
  xishen: "favorable_element",
  yong_shen: "yong_shen",
  shen_ruo: "weak_self",
  shenruo: "weak_self",
  shen_qiang: "strong_self",
  shenqiang: "strong_self",
  ge_ju: "pattern",
  geju: "pattern",
  ming_pan: "natal_profile",
  mingpan: "natal_profile",
  ba_zi: "bazi",
  bazi: "bazi",
  si_zhu: "four_pillars",
  ri_zhu: "day_master",
  ri_zhu_day: "day_master",
  day_master_dm: "day_master",
  shi_shen: "shi_shen",
  shang_guan: "shang_guan",
  zheng_guan: "zheng_guan",
  qi_sha: "qi_sha",
  pian_cai: "pian_cai",
  zheng_cai: "zheng_cai",
  pian_yin: "pian_yin",
  zheng_yin: "zheng_yin",
  bi_jian: "bi_jian",
  jie_cai: "jie_cai",
  gua_su: "gua_su",
  guasu: "gua_su",
  yang_ren: "fei_ren",
  yangren: "fei_ren",
  fei_ren: "fei_ren",
  yang_blades: "fei_ren",
};

/** Invented pinyin that maps to 神煞 zh_src (then → shensha_* slug). */
const SHENSHA_PINYIN_TO_HAN: Readonly<Record<string, string>> = {
  gu_luan_sha: "孤鸾煞",
  guluan_sha: "孤鸾煞",
  gu_luan: "孤鸾煞",
  guluan: "孤鸾煞",
  yang_ren: "羊刃",
  yangren: "羊刃",
  gua_su_sha: "寡宿",
};

function stripOuterFullwidthParens(s: string): string {
  const t = s.trim();
  if (/^[（(].+[）)]$/.test(t) && t.length >= 3) {
    return t.slice(1, -1).trim() || t;
  }
  return t;
}

function isKnownRenderableMarkerId(id: string, locale: string): boolean {
  if (!id) return false;
  if (TERM_BY_ID.has(id)) return true;
  if (isClosedSetMarkerId(id)) return true;
  if (isRelationMarkerId(id)) return true;
  if (id === BARE_GANZHI_MARKER.slug) return true;
  if (highRiskSoftBySlug(id)) return true;
  if (id.startsWith("shensha_") && toShenshaId(id.slice("shensha_".length))) return true;
  if (uiTermById(id, locale)) return true;
  return false;
}

/**
 * Fix B — map invented pinyin marker ids to closed-set slugs;
 * demote unknown compounds to soft text (no broken paren-only render).
 * Also strips model-added outer （） around markers (Fix D belt).
 */
export function normalizeTermMarkerIds(text: string, locale: string): string {
  if (!text?.trim() || !text.includes("⟦t:")) return text ?? "";

  // Fix D belt — model must not wrap markers in extra parentheses.
  let out = text.replace(/[（(]\s*(⟦t:[^⟧]+⟧)\s*[）)]/g, "$1");

  TERM_MARKER_PATTERN.lastIndex = 0;
  out = out.replace(
    TERM_MARKER_PATTERN,
    (raw, rawId: string, visEsc: string, plainEsc?: string) => {
      const leaf = normalizeTermMarkerId(String(rawId));
      const alias = MARKER_ID_ALIASES[leaf] ?? MARKER_ID_ALIASES[leaf.toLowerCase()];
      let id = alias ?? leaf;
      const vis = stripOuterFullwidthParens(unescapeMarkerPart(visEsc));
      const plain = plainEsc?.trim() ? unescapeMarkerPart(plainEsc) : undefined;

      // shensha surfaces / invented pinyin like gu_luan_sha → closed soft slug when known
      if (!isKnownRenderableMarkerId(id, locale)) {
        const fromVis = resolveShenshaSoftLabels(vis, locale);
        if (fromVis) {
          id = fromVis.slug;
        } else {
          const han =
            SHENSHA_PINYIN_TO_HAN[leaf] ??
            SHENSHA_PINYIN_TO_HAN[leaf.toLowerCase()] ??
            leaf.replace(/^shensha[._]/, "");
          const fromId = resolveShenshaSoftLabels(han, locale);
          if (fromId) id = fromId.slug;
        }
      }

      if (isKnownRenderableMarkerId(id, locale)) {
        if (id !== String(rawId) || vis !== unescapeMarkerPart(visEsc)) {
          if (id !== leaf) {
            console.warn(`[term-marking] normalized marker id ${leaf} → ${id}`);
          }
          return encodeTermMarker(id, vis, plain);
        }
        return raw;
      }

      console.warn(
        `[term-marking] unknown marker id demoted to soft text: ${leaf}`,
        { visible: vis.slice(0, 40) },
      );
      return vis;
    },
  );

  // Collapse double fullwidth parens left by demotion / model wrapping.
  out = out.replace(/（{2,}([^（）]+)）{2,}/g, "（$1）");
  return out;
}

/**
 * Overwrite marker soft slots with SSOT terms so audits/history never see model-invented soft
 * (historical failure: stem_yi with bare stem-element in soft slot).
 * Also normalizes 2-slot id|plain into 3-slot id|SSOT|plain for parsers.
 */
/** SSOT 全部软译词（全 locale）—— 用来识别"模型把软译抄进了白话槽"。 */
const ALL_SOFT_LABEL_SURFACES: ReadonlySet<string> = new Set(
  POJU_TERMS.flatMap((t) => Object.values(t.term))
    .map((s) => String(s).trim())
    .filter(Boolean),
);

/**
 * 白话槽里填的是软译词（或术语原词）= 没解释，等于"用这个词解释这个词"。
 * 实测底座 13 个标记 12 个如此（⟦t:weak_self|需养⟧ → tooltip 弹出「需养」）。
 * 判空 → 让 SSOT definition 顶上。留痕，别静默（铁律 #5）。
 */
export function isNonExplanatoryPlain(plain: string, id: string, loc: string): boolean {
  const p = plain.trim();
  if (!p) return true;
  if (p === termOf(id, loc)) return true; // 抄了自己的软译
  if (p.length <= 6 && ALL_SOFT_LABEL_SURFACES.has(p)) return true; // 抄了别的术语的软译
  return false;
}

export function rewriteMarkersWithSsotSoft(text: string, locale: string): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  const loc = toGlossaryLocale(locale);
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(
    TERM_MARKER_PATTERN,
    (raw, rawId: string, slot2: string, slot3?: string) => {
      const id = normalizeTermMarkerId(rawId);
      const soft = termOf(id, loc);
      const isThreeSlot = (raw.match(/\|/g) || []).length >= 2;
      const plain = (
        isThreeSlot ? (slot3 ? unescapeMarkerPart(slot3) : "") : unescapeMarkerPart(slot2)
      ).trim();
      if (!soft) {
        console.warn(
          `[term-marking] 闭集外 slug「${id}」—— 模型自造。标记会被剥掉、句子会缺字。` +
            `若这个概念确实需要,要么进 pojulife-terms.ts,要么在提示词里要求它直接白话讲。`,
        );
        if (!isThreeSlot && plain) {
          return `⟦t:${id}||${escapeMarkerPart(plain)}⟧`;
        }
        return raw;
      }
      // 白话槽 = 软译词 → 视为没写，让 SSOT 固定白话顶上（铁律 #4：代码能定的别让模型做）
      const usable = isNonExplanatoryPlain(plain, id, loc) ? "" : plain;
      if (plain && !usable) {
        console.warn("[term-marking] 白话槽抄了软译词，已回落 SSOT 定义", { id, wrote: plain });
      }
      const plainOut = usable || glossOf(id, loc) || soft;
      return `⟦t:${id}|${escapeMarkerPart(soft)}|${escapeMarkerPart(plainOut)}⟧`;
    },
  );
}

/**
 * 双层交付的渲染层身份：
 * - body     正文层 —— 零金字。标记降级成贴题白话；裸词走「替换成白话」的合规网。
 * - evidence 依据层 —— 金字集中、默认折叠、允许"不好读"，密度上限放宽到 ≤3。
 * - legacy   未接双层制的老界面（Glyph / Match / 底座）—— 行为与改动前 100% 一致。
 */
export type MarkLayer = "body" | "evidence" | "legacy";

export function prepareTextForGlossaryRender(text: string, locale: string): string {
  const rewritten = rewriteMarkersWithSsotSoft(text, locale);
  const normalized = fillMissingMarkerPlain(
    repairShenshaMarkerSoftLabels(normalizeTermMarkerIds(rewritten, locale), locale),
    locale,
  );
  return autoMarkBareTerms(wrapBareKeepCnSoftTerms(normalized, locale), locale);
}

/** Remove broken / unclosed markers so users never see raw `⟦`. Intact closed markers become visible text. */
export function stripBrokenMarkers(text: string): string {
  let r = stripBareTermMarkers(text);
  if (!r.includes("⟦") && !r.includes("⟧")) return r;
  r = r
    .replace(
      /⟦t:[a-zA-Z0-9_:]+\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?(?=⟧|$)/g,
      (_match, v: string) => unescapeMarkerPart(v),
    )
    .replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, (_, d: string) =>
      d.replace(/\\(.)/g, "$1"),
    )
    .replace(/⟦/g, "")
    .replace(/⟧/g, "");
  return r;
}

export function plainByTermId(termId: string, locale: string): string | null {
  const loc = toGlossaryLocale(locale);
  const tension = TEN_GOD_TENSION_SOFT[termId as keyof typeof TEN_GOD_TENSION_SOFT];
  if (tension) return pickFiveLocale(tension, loc) || null;
  const relKind = relationKindFromMarkerId(termId);
  if (relKind) {
    const ssotKind = glossOf(relKind, loc);
    if (ssotKind && termId === relKind) return ssotKind;
    return pickFiveLocale(RELATION_KIND_SOFT[relKind], loc) || null;
  }
  if (termId === BARE_GANZHI_MARKER.slug) return pickFiveLocale(BARE_GANZHI_MARKER.gloss, loc) || null;
  const hr = highRiskSoftBySlug(termId);
  if (hr) return pickFiveLocale(hr.gloss, loc) || null;

  const leaf = termId.includes(":") ? termId.split(":").pop()! : termId;
  const fromSsot = glossOf(leaf, loc) ?? glossOf(termId, loc);
  if (fromSsot) return fromSsot;

  const entry = TERM_BY_ID.get(termId) ?? TERM_BY_ID.get(leaf);
  if (!entry) return null;
  return pickFiveLocale(entry.plain, loc) || null;
}

export function uiTermById(
  termId: string,
  locale: string,
): { soft: string; plain: string; polarity: TermPolarity } | null {
  const loc = toGlossaryLocale(locale);
  const tension = TEN_GOD_TENSION_SOFT[termId as keyof typeof TEN_GOD_TENSION_SOFT];
  if (tension) {
    const soft = pickFiveLocale(tension, loc);
    return { soft, plain: soft, polarity: termPolarityById(termId) };
  }
  const relKind = relationKindFromMarkerId(termId);
  if (relKind && termId !== relKind) {
    const soft = pickFiveLocale(RELATION_KIND_SOFT[relKind], loc);
    return { soft, plain: soft, polarity: termPolarityById(termId) };
  }
  if (termId === BARE_GANZHI_MARKER.slug) {
    return {
      soft: pickFiveLocale(BARE_GANZHI_MARKER.soft, loc),
      plain: pickFiveLocale(BARE_GANZHI_MARKER.gloss, loc),
      polarity: "neutral",
    };
  }
  const hr = highRiskSoftBySlug(termId);
  if (hr) {
    return {
      soft: pickFiveLocale(hr.soft, loc),
      plain: pickFiveLocale(hr.gloss, loc),
      polarity: "neutral",
    };
  }

  const leaf = termId.includes(":") ? termId.split(":").pop()! : termId;
  const poju = pojuTermBySlug(leaf) ?? pojuTermBySlug(termId);
  if (poju) {
    return {
      soft: termOf(poju.slug, loc) ?? poju.term.en,
      plain: glossOf(poju.slug, loc) ?? poju.definition.en,
      polarity: poju.polarity,
    };
  }

  const entry = TERM_BY_ID.get(termId) ?? TERM_BY_ID.get(leaf);
  if (!entry) return null;
  return {
    soft: softLabel(entry, loc),
    plain: pickFiveLocale(entry.plain, loc),
    polarity: termPolarityById(termId),
  };
}

/** Prompt projection: forbidden → id + soft (+ keep_cn hint). Plain excluded to save tokens. */
export function buildTermMarkingFewShot(locale: string): string {
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") {
    return `## 打标形态（原则 · 勿照抄任何具体比方）
\`⟦t:<slug>|<必须引用该用户亲口元素的贴题白话>⟧\`
- 软译词【不用你写】——系统从术语表填入；你写了也会被覆盖。
- 白话自检：换一个用户还成立？成立 → 不合格。
- 标记只出现在「依据与推理」块；正文零标记。`;
  }
  return `## Marker shape (principles only — do not copy stock metaphors)
\`⟦t:<slug>|<contextual plain that cites THIS user's own words>⟧\`
- Soft label is SSOT-filled; anything you write in that slot is overwritten.
- Self-check: would this plain still fit another user? If yes → rewrite.
- Markers only inside Evidence & reasoning; zero markers in body.`;
}

export type TermMarkingPromptOptions = {
  /**
   * Skip heavy few-shot / metaphor cues — for latency + anti-overfit (segment2 Call A).
   * Still includes closed-set id table + hard rules.
   */
  principlesOnly?: boolean;
  /**
   * 中立底座档:这一层【没有用户的具体处境】,所以不要求"贴题白话"。
   *
   * ⚠️ 名字只描述【提示词档位】,不描述代码行为。
   * 上一版叫 ssotPlainOnly —— 用代码行为给提示词档命名,结果我把
   * 「代码会用 SSOT 覆盖」当成指令写给了模型(「写了也会被丢弃」),
   * 模型失去载体 → 把术语解释挪进正文 → 门禁死循环 → 底座整个挂掉。
   * **代码要干什么,提示词不需要知道。** 别再往这一档里塞实现细节。
   */
  neutralBase?: boolean;
};

export function buildTermMarkingPromptBlock(
  locale: string,
  opts?: TermMarkingPromptOptions,
): string {
  const loc = toGlossaryLocale(locale);
  const langLabel =
    loc === "zh" ? "中文" : loc === "en" ? "English" : loc.toUpperCase();
  const principlesOnly = opts?.principlesOnly === true;
  const neutralBase = opts?.neutralBase === true;
  const rows = DELIVERY_MARKING_ENTRIES.map((e) => {
    const soft = softLabel(e, loc);
    const keep =
      e.keep_cn === true
        ? loc === "zh"
          ? "（可见软译只用上表词，禁括号干支）"
          : " (visible soft label only — no stem-branch in parens)"
        : "";
    const sample = e.forbidden.slice(0, principlesOnly || neutralBase ? 2 : 4).join(" / ");
    if (neutralBase) {
      // 必须让它看见【标记会渲染成什么】—— 上一版把这两列撤了(怕它抄软译),
      // 结果它连自己在标什么都不知道,只好在正文里自己解释一遍 → 裸术语 → 门禁炸。
      // 抄不抄无所谓:forceSsotPlainInMarkers() 会无条件覆盖,抄了也是白抄。
      return `| \`${e.id}\` | ${sample} | **${soft}** | ${glossOf(e.id, loc) ?? ""} |`;
    }
    return `| \`${e.id}\` | ${sample} | **${soft}**${keep} |`;
  }).join("\n");

  const rules = neutralBase
    ? `## 打标记规则（中立底座）
1. 格式：\`⟦t:<slug>|⟧\` —— **竖线保留，后面留空**。
2. 它会渲染成上表的【官方术语】，读者**点一下就展开【官方释义】那一整句**。
   也就是说，**这个术语已经自带解释了** —— 所以**不要在正文里再解释它一遍**，
   更不要为了解释它而写出它的术语原词（第 2 列那些）。标记本身就是解释。
3. **正文零标记**；标记只出现在「依据与推理」；一段依据 ≤3 金字。
4. **slug 必须取自上表**；自造 id 无效、句子会缺字 —— 上表没有的概念，**直接用白话讲，不打标**。
5. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）。`
    : principlesOnly
      ? `## 打标记规则（原则 · 严禁过拟合示例）
1. 格式：\`⟦t:<slug>|<贴题白话>⟧\` —— **软译词不用你写**（系统从术语表填入官方术语）。
2. 贴题白话必须引用【这位用户亲口说过的具体词/场景】；禁止通用词典比方。
3. 自检：换用户还成立？成立 → 重写。
4. **正文零标记**；标记只出现在「依据与推理」；一段依据 ≤3 金字；**slug 必须取自上表**；自造 id = 拒绝；闭集没有 → 不打标、直接白话。
5. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）。

${buildTermMarkingFewShot(locale)}`
      : `## 打标记规则
1. 格式：\`⟦t:<slug>|<贴题白话>⟧\` 或 \`⟦t:<slug>||<贴题白话>⟧\`
2. **软译词【不用写】**——上表 soft 仅供你识别概念；系统渲染时用官方术语覆盖你写的任何软译。
3. 贴题白话 = 结合本句意境 + 用户问题的人话；只进 tooltip；必须引用该用户亲口元素。
4. **正文零标记**；金字集中在「依据与推理」块；每段依据 ≤3 金字
5. 流年/大运类先归因外境再给掌控感
6. **签诗/古文不是术语**，不打标
7. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）
8. 若漏写贴题白话，UI 回退静态 gloss——禁止用与用户无关的通用句凑数
9. **slug 必须取自闭集**；自造 = 拒绝；没有对应概念 → 不打标、直接白话讲

${buildTermMarkingFewShot(locale)}

${buildClosedSetConstraintPromptBlock(locale)}`;

  const tableHeader = neutralBase
    ? `| slug | 禁/术语示例 | 官方术语 (${langLabel}) | 官方释义（读者点开就看到这句） |
|---|---|---|---|`
    : `| slug | 禁/术语示例 | 官方术语 (${langLabel}) |
|---|---|---|`;

  const intro = neutralBase
    ? `凡在「依据与推理」中引用下表概念：打 \`⟦t:<slug>|⟧\`（竖线后留空）。标记会渲染成上表的官方术语，点开即见官方释义。`
    : `凡在「依据与推理」中引用下表概念：打 \`⟦t:<slug>|<贴题白话>⟧\`。**软译词由系统从术语表填入**（下表 soft 列仅供对照）。`;

  return `# 术语标记（输出 JSON 字符串 · ${langLabel}）

${intro}

${tableHeader}
${rows}

${rules}`;
}

/**
 * 中立底座专用:**无条件**用 SSOT 的官方术语 + 官方释义覆盖标记的两个槽。
 *
 * 这是【唯一】知道"底座 tooltip 用固定模板"这件事的地方 —— 提示词不知道、模型不知道。
 * 底座只有八字、没有用户处境 →「贴题白话」是伪需求(铁律 #4);
 * 但**别把这个决定翻译成对模型的指令** —— 上一版那么干,模型失去载体、
 * 把术语解释挪进正文,门禁把底座整个卡死。
 *
 * 下游(POJU 第2/4段 / Match / Glyph / Syncro)有用户处境 → 贴题白话是真需求 → 不许调这个函数。
 */
export function forceSsotPlainInMarkers(text: string, locale: string): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  const loc = toGlossaryLocale(locale);
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(TERM_MARKER_PATTERN, (raw, rawId: string) => {
    const id = normalizeTermMarkerId(String(rawId));
    const soft = termOf(id, loc);
    if (!soft) {
      // 闭集外 slug —— 保持原样交给 rewriteMarkersWithSsotSoft 的告警去管,别在这儿静默吃掉
      return raw;
    }
    const gloss = glossOf(id, loc) || soft;
    return `⟦t:${id}|${escapeMarkerPart(soft)}|${escapeMarkerPart(gloss)}⟧`;
  });
}

/**
 * Remove marker-plain text that leaked into body prose next to the marker.
 * Plain belongs only in tooltip (3rd field).
 */
export function stripLeakedMarkerPlainFromBody(text: string): string {
  if (!text?.trim() || !text.includes("⟦t:")) return text ?? "";
  let out = text;
  for (const m of parseTermMarkers(out)) {
    const plain = m.plain?.trim();
    if (!plain || plain.length < 8) continue;
    const idx = out.indexOf(m.raw);
    if (idx < 0) continue;
    const afterStart = idx + m.raw.length;
    const after = out.slice(afterStart);
    // Prefer removing plain immediately after the marker (possibly with light punctuation).
    const immediate = after.match(new RegExp(`^([，,、\\s]*)${escapeRegExp(plain)}`));
    if (immediate) {
      out = out.slice(0, afterStart) + after.slice(immediate[0].length);
      continue;
    }
    // Also strip a free-standing duplicate of the plain elsewhere in the same paragraph chunk.
    if (after.includes(plain)) {
      out = out.slice(0, afterStart) + after.replace(plain, "");
    }
  }
  // ⚠️ 绝不能用 /\s{2,}/ —— \s 含 \n，会把 \n\n 段落分隔吃成一个空格、整篇拍成一行。
  // 后果(2026-07-17 生产):repair-violations 是行级编辑器(split("\n") → 按行号打补丁)，
  // 换行没了 → lines.length===1 → 整篇当"一行"塞进 max_tokens:1400 → 截断 → 残篇覆盖完整报告。
  // 渲染层会 reflow，所以这个 bug 在页面上看不出来 —— 只有 repair 会踩。
  // [^\S\r\n] = 只并横向空白(空格/制表)，换行原样保留。
  return out.replace(/[^\S\r\n]{2,}/g, " ").trim();
}

const TEN_GOD_STACK = "正印|偏印|食神|伤官|正官|七杀|正财|偏财|比肩|劫财";
const STEM_COMPOUND_STACK =
  "[甲乙丙丁戊己庚辛壬癸](?:[子丑寅卯辰巳午未申酉戌亥]|[金木水火土])";

/** Single clean soft phrase — never build from per-token soft glosses. */
export const MINGLI_STACK_SOFT_PHRASE = "你内在那一股关键的支撑力";

/**
 * Whole-phrase replace for bare 命理 stacks (before per-token soft/auto-mark).
 * "月柱正印壬水" → one concept — not 你的能量结构+稳定支持力+壬水奔流.
 */
export function replaceZhMingliStacks(text: string): string {
  if (!text?.trim()) return text ?? "";
  let result = text;
  // 月柱正印壬水 / 月柱正印 / 日柱甲木
  result = result.replace(
    new RegExp(
      `(?:年|月|日|时)柱(?:(?:${TEN_GOD_STACK})(?:${STEM_COMPOUND_STACK})?|(?:${STEM_COMPOUND_STACK}))`,
      "g",
    ),
    MINGLI_STACK_SOFT_PHRASE,
  );
  // After pillar soft-replace left "你的能量结构正印壬水"
  result = result.replace(
    new RegExp(
      `(?:你的能量结构|当前阶段气候|当前时空效能)(?:(?:${TEN_GOD_STACK})(?:${STEM_COMPOUND_STACK})?|(?:${STEM_COMPOUND_STACK}))`,
      "g",
    ),
    MINGLI_STACK_SOFT_PHRASE,
  );
  // 正印壬水 (no pillar)
  result = result.replace(
    new RegExp(`(?:${TEN_GOD_STACK})(?:${STEM_COMPOUND_STACK})`, "g"),
    MINGLI_STACK_SOFT_PHRASE,
  );
  return result;
}

const CHAIN_SOFT_GLOSSES = [
  "你的能量结构",
  "当前阶段气候",
  "当前时空效能",
  "稳定支持力",
  "有利特质",
  "表达力",
  "规则感",
  "壬水奔流",
] as const;

/**
 * 软译词自带限定语 → 用户原句的限定语变重复：「当前流年」→「当前当前时空效能」。
 * 这一步不修，双字病还会顶掉 wrapBareKeepCnSoftTerms 的汉字 lookbehind，
 * 让本该变成金字「岁环[···]」的依据退化成裸露的 SaaS 词（第2段实测症状）。
 */
const DUP_SOFT_PREFIX_ZH = ["当前", "你的", "这个", "目前"] as const;

export function collapseDuplicatedSoftPrefix(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const p of DUP_SOFT_PREFIX_ZH) {
    out = out.replace(new RegExp(`${p}(?=${p})`, "g"), "");
  }
  return out;
}

/** Collapse abutting soft-replace glosses left by older token-chain sanitize / auto-mark. */
export function collapseChainedSoftReplaceArtifacts(text: string): string {
  if (!text?.trim()) return text ?? "";
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of CHAIN_SOFT_GLOSSES) {
      for (const b of CHAIN_SOFT_GLOSSES) {
        if (a === b) continue;
        const pair = a + b;
        if (result.includes(pair)) {
          result = result.split(pair).join(MINGLI_STACK_SOFT_PHRASE);
          changed = true;
        }
      }
    }
  }
  result = result.replace(
    /(?:你的能量结构|稳定支持力|有利特质|当前阶段气候|当前时空效能)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥金木水火土]/g,
    MINGLI_STACK_SOFT_PHRASE,
  );
  result = collapseDuplicatedSoftPrefix(result);
  return result;
}

/** True when ≥2 soft glosses abut — sentence was chewed by token chaining. */
export function hasChainedSoftReplaceArtifacts(text: string): boolean {
  if (!text?.trim()) return false;
  const masked = maskMarkersForAudit(text);
  for (let i = 0; i < CHAIN_SOFT_GLOSSES.length; i++) {
    for (let j = 0; j < CHAIN_SOFT_GLOSSES.length; j++) {
      if (i === j) continue;
      if (masked.includes(CHAIN_SOFT_GLOSSES[i]! + CHAIN_SOFT_GLOSSES[j]!)) return true;
    }
  }
  if (
    /(?:你的能量结构|稳定支持力|有利特质)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥金木水火土]/.test(
      masked,
    )
  ) {
    return true;
  }
  return false;
}

export function fillMissingMarkerPlain(text: string, locale: string): string {
  let out = text;
  for (const m of parseTermMarkers(text)) {
    if (resolveMarkerPlain(m)) continue;
    const fallback = plainByTermId(m.id, locale);
    if (!fallback) continue;
    // 2-slot standard: only contextual plain; SSOT soft applied at render via termOf.
    out = out.replace(m.raw, encodeTermMarker(m.id, m.visible, fallback));
  }
  return out;
}

export type OutOfSetAuditHit = { label: string; snippet: string };

/** Detect engine-out-of-set 神煞/术语 in delivery text (audit-only). */
export function auditOutOfSetTerms(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const hits: OutOfSetAuditHit[] = [];

  for (const han of OUT_OF_SET_FORBIDDEN_HAN) {
    if (masked.includes(han)) {
      hits.push({ label: `out_of_set_term:${han}`, snippet: han });
    }
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(masked)) {
      hits.push({ label: `out_of_set_term:${en}`, snippet: en });
    }
  }

  const closedSlugs = new Set(Object.values(CLOSED_SET_SLUG));
  /** Generic Match-relation glossary slugs — not instance RelationLabel ids; must not be used as markers (use vernacular). */
  const genericRelationGlossarySlugs = new Set(
    CLOSED_MATCH_RELATIONS.map((han) => CLOSED_SET_SLUG[han]).filter(Boolean) as string[],
  );
  const groupedForbidden = new Set(["ten_gods", "auxiliary_stars", "noble_support", "wealth_stars", "officer_stars", "resource_stars", "peer_stars", "punishment", "clash", "six_harmonies"]);
  for (const m of parseTermMarkers(text)) {
    if (groupedForbidden.has(m.id)) {
      hits.push({ label: `out_of_set_marker_id:${m.id}`, snippet: m.raw.slice(0, 40) });
    } else if (genericRelationGlossarySlugs.has(m.id)) {
      // e.g. liu_chong — closed glossary exists but base-analysis must use vernacular / instance chong_* ids only
      hits.push({ label: `out_of_set_marker_id:${m.id}`, snippet: m.raw.slice(0, 40) });
    } else if (
      !closedSlugs.has(m.id) &&
      !TERM_BY_ID.has(m.id) &&
      !isRelationMarkerId(m.id) &&
      m.id !== BARE_GANZHI_MARKER.slug &&
      !m.id.startsWith("shensha_")
    ) {
      // Invented slug (e.g. da_yun / ji_shen) — reject; closed set miss → vernacular, no marker.
      hits.push({ label: `out_of_set_marker_id:${m.id}`, snippet: m.raw.slice(0, 40) });
    }
  }

  return hits;
}

function blobMatchesOutOfSetForbidden(blob: string): boolean {
  for (const han of OUT_OF_SET_FORBIDDEN_HAN) {
    if (blob.includes(han)) return true;
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    const re = new RegExp(`\\b${escapeRegExp(en)}\\b`, "i");
    if (re.test(blob)) return true;
  }
  return false;
}

function cleanupAfterOutOfSetStrip(text: string): string {
  return text
    .replace(/\[···\]/g, "")
    .replace(/[、，,]{2,}/g, "，")
    // ⚠️ 绝不能用 /\s{2,}/ —— \s 含 \n，会把段落分隔吃成空格（见 stripLeakedMarkerPlainFromBody）。
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+([,.;:!?])/g, "$1")
    .trim();
}

/** Strip engine-out-of-set 神煞 from persisted chat text (markers + bare terms). */
export function stripForbiddenShenSha(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const m of parseTermMarkers(out)) {
    const blob = `${m.visible} ${m.plain ?? ""}`;
    if (blobMatchesOutOfSetForbidden(blob)) {
      out = out.replace(m.raw, "");
    }
  }
  const sortedHan = [...OUT_OF_SET_FORBIDDEN_HAN].sort((a, b) => b.length - a.length);
  for (const han of sortedHan) {
    out = out.replace(new RegExp(escapeRegExp(han), "g"), "");
  }
  for (const en of OUT_OF_SET_FORBIDDEN_EN) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(en)}\\b`, "gi"), "");
  }
  return cleanupAfterOutOfSetStrip(out);
}

function markerViolatesShenShaInstance(
  blob: string,
  allowed: Set<string>,
): boolean {
  if (blobMatchesOutOfSetForbidden(blob)) return true;
  for (const name of CLOSED_SHEN_SHA) {
    if (blob.includes(name) && (allowed.size === 0 || !allowed.has(name))) return true;
  }
  if (
    blob.includes("羊刃") &&
    (allowed.size === 0 || (!allowed.has("飞刃") && !allowed.has("羊刃")))
  ) {
    return true;
  }
  return false;
}

/**
 * Last-resort degrade: strip out-of-set shen_sha + relations (markers and bare phrases).
 * Used when circuit-breaker retries are exhausted — deliver clean text instead of erroring.
 */
export function stripOutOfSetFactTerms(
  text: string,
  structured: ProfileStructured | null,
  opts?: { relations?: RelationLabel[] },
): string {
  if (!text?.trim()) return text ?? "";
  let out = text;

  if (structured) {
    const rels = opts?.relations ?? computeChartRelations(structured);
    const allowedRelIds = new Set(rels.map((r) => r.id));
    for (const m of parseTermMarkers(out)) {
      if (isRelationMarkerId(m.id) && (allowedRelIds.size === 0 || !allowedRelIds.has(m.id))) {
        out = out.split(m.raw).join("");
      }
    }

    const allowedShenSha = collectInstanceShenSha(structured);
    for (const m of parseTermMarkers(out)) {
      const blob = `${m.visible} ${m.plain ?? ""}`;
      if (markerViolatesShenShaInstance(blob, allowedShenSha)) {
        out = out.split(m.raw).join("");
      }
    }

    for (const name of CLOSED_SHEN_SHA) {
      if (allowedShenSha.size === 0 || !allowedShenSha.has(name)) {
        out = out.replace(new RegExp(escapeRegExp(name), "g"), "");
      }
    }
    if (allowedShenSha.size === 0 || (!allowedShenSha.has("飞刃") && !allowedShenSha.has("羊刃"))) {
      out = out.replace(/羊刃/g, "");
    }

    const relSnippets = [
      ...new Set(
        auditRelationsAgainstInstance(out, structured, opts)
          .map((h) => h.snippet)
          .filter(Boolean),
      ),
    ].sort((a, b) => b.length - a.length);
    for (const snippet of relSnippets) {
      out = out.replace(new RegExp(escapeRegExp(snippet), "g"), "");
    }
  }

  out = stripForbiddenShenSha(out);

  for (const hit of auditOutOfSetTerms(out)) {
    if (hit.snippet) {
      out = out.replace(new RegExp(escapeRegExp(hit.snippet), "gi"), "");
    }
  }

  if (structured) {
    for (const hit of auditShenShaAgainstInstance(out, structured)) {
      if (hit.snippet) {
        out = out.replace(new RegExp(escapeRegExp(hit.snippet), "g"), "");
      }
    }
  }

  return cleanupAfterOutOfSetStrip(out);
}

export function countDistinctTermIds(text: string): number {
  const ids = new Set(parseTermMarkers(text).map((m) => m.id));
  return ids.size;
}

/** Depth ids beyond day_master / decade / year / yong_shen — grounding audit. */
export const GROUNDING_DEPTH_TERM_IDS = new Set(
  Object.values(CLOSED_SET_SLUG).filter(
    (slug) =>
      !["day_master", "decade", "year", "yong_shen", "bazi", "natal_profile", "four_pillars"].includes(
        slug,
      ),
  ),
);

export type GroundingAuditResult = {
  distinctCount: number;
  depthCount: number;
  ids: string[];
};

export function auditGroundingMarkers(
  text: string,
  minDistinct: number,
  minDepth = 1,
): GroundingAuditResult | null {
  const markers = parseTermMarkers(text);
  const ids = [...new Set(markers.map((m) => m.id))];
  const depthCount = ids.filter((id) => GROUNDING_DEPTH_TERM_IDS.has(id)).length;
  const result: GroundingAuditResult = { distinctCount: ids.length, depthCount, ids };
  if (ids.length < minDistinct || depthCount < minDepth) return result;
  return null;
}

/** Detect bare stem-branch pairs outside term markers (EN deliveries often leak 癸酉/壬申). */
export function auditBareGanzhi(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const hits: OutOfSetAuditHit[] = [];
  BARE_GANZHI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_GANZHI_RE.exec(masked)) !== null) {
    hits.push({ label: "bare_ganzhi", snippet: m[0] });
  }
  return hits;
}

/** Warn when a paragraph packs too many golden term markers (luxury delivery density cap). */
export function auditTermMarkerDensity(
  text: string,
  maxPerParagraph = 2,
  /** Folded「依据与推理」allows denser gold marks (default-collapsed). */
  maxEvidenceParagraph = 5,
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];
  for (const chunk of text.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith("##")) continue;
    const isEvidence =
      /^\*\*依据与推理/.test(trimmed) ||
      /^\*\*Evidence\b/i.test(trimmed) ||
      /^\*\*Rationale\b/i.test(trimmed);
    const max = isEvidence ? maxEvidenceParagraph : maxPerParagraph;
    const count = parseTermMarkers(chunk).length;
    if (count > max) {
      hits.push({
        label: `term_density:${count}`,
        snippet: trimmed.replace(/\s+/g, " ").slice(0, 72),
      });
    }
  }
  return hits;
}

export const BARE_SIGN_POEM_PATTERN =
  /[\u4e00-\u9fff]{7,}[，,；;、][\u4e00-\u9fff]{5,}/g;

export function detectBrokenMarkers(text: string): boolean {
  if (!text.includes("⟦")) return false;
  const opens = text.match(/⟦/g)?.length ?? 0;
  const closes = text.match(/⟧/g)?.length ?? 0;
  if (opens !== closes) return true;
  // Trailing unclosed marker region
  const lastOpen = text.lastIndexOf("⟦");
  const lastClose = text.lastIndexOf("⟧");
  if (lastOpen > lastClose) return true;
  // Open delimiter without closing ⟧ before next ⟦ or EOF
  if (/⟦(?:(?!⟧).)*$/.test(text)) return true;
  return false;
}

/** Collect shen_sha actually present in structured pillars_detail. */
export function collectInstanceShenSha(structured: ProfileStructured): Set<string> {
  const allowed = new Set<string>();
  if (!structured.pillars_detail) return allowed;
  for (const key of ["year", "month", "day", "hour"] as const) {
    for (const s of structured.pillars_detail[key]?.shen_sha ?? []) {
      allowed.add(s);
    }
  }
  return allowed;
}

/** Shen_sha in text must match instance inventory; empty inventory → no shen_sha names at all. */
export function auditShenShaAgainstInstance(
  text: string,
  structured: ProfileStructured,
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const allowed = collectInstanceShenSha(structured);
  const hits: OutOfSetAuditHit[] = [];

  const checkName = (name: string) => {
    if (!masked.includes(name)) return;
    if (allowed.size === 0 || !allowed.has(name)) {
      hits.push({
        label: allowed.size === 0 ? `shen_sha_forbidden_empty_instance:${name}` : `shen_sha_not_in_instance:${name}`,
        snippet: name,
      });
    }
  };

  for (const name of CLOSED_SHEN_SHA) checkName(name);
  if (masked.includes("羊刃")) {
    if (allowed.size === 0 || (!allowed.has("飞刃") && !allowed.has("羊刃"))) {
      hits.push({
        label:
          allowed.size === 0
            ? "shen_sha_forbidden_empty_instance:羊刃"
            : "shen_sha_not_in_instance:羊刃",
        snippet: "羊刃",
      });
    }
  }

  return hits;
}

const BRANCH_CHARS = "子丑寅卯辰巳午未申酉戌亥";
const STEM_CHARS = "甲乙丙丁戊己庚辛壬癸";

/** Extract bare relation phrases (branch-pair / sanhe / stem-he) from audit-masked text. */
export function extractBareRelationPhrases(masked: string): string[] {
  const out = new Set<string>();
  const reBranchPair = new RegExp(
    `[${BRANCH_CHARS}][${BRANCH_CHARS}](?:相冲|相刑|相害|六合[^、，。；\\s]{0,8}|半合[^、，。；\\s]{0,12}|三合[^、，。；\\s]{0,12})`,
    "g",
  );
  const reSanhe = new RegExp(`[${BRANCH_CHARS}]{3}三合[^、，。；\\s]{0,12}`, "g");
  const reStemHe = new RegExp(`日主[${STEM_CHARS}][${STEM_CHARS}]相合[^、，。；\\s]{0,12}`, "g");
  for (const re of [reBranchPair, reSanhe, reStemHe]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) out.add(m[0]);
  }
  return [...out];
}

function phraseAllowed(phrase: string, allowedHan: Set<string>): boolean {
  if (allowedHan.has(phrase)) return true;
  for (const han of allowedHan) {
    if (phrase.startsWith(han) || han.startsWith(phrase)) return true;
  }
  return false;
}

/** Relations in text must match computeChartRelations inventory; empty inventory → no relation words. */
export function auditRelationsAgainstInstance(
  text: string,
  structured: ProfileStructured,
  opts?: { relations?: RelationLabel[] },
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const masked = maskMarkersForAudit(text);
  const rels = opts?.relations ?? computeChartRelations(structured);
  const allowedIds = new Set(rels.map((r) => r.id));
  const allowedHan = new Set(rels.map((r) => r.han));
  const hits: OutOfSetAuditHit[] = [];

  for (const m of parseTermMarkers(text)) {
    if (!isRelationMarkerId(m.id)) continue;
    if (allowedIds.size === 0 || !allowedIds.has(m.id)) {
      hits.push({
        label:
          allowedIds.size === 0
            ? `relation_forbidden_empty_instance:${m.id}`
            : `relation_not_in_instance:${m.id}`,
        snippet: m.raw.slice(0, 48),
      });
    }
  }

  if (allowedHan.size === 0) {
    for (const term of RELATION_SURFACE_TERMS_ZH) {
      if (masked.includes(term)) {
        hits.push({
          label: `relation_forbidden_empty_instance:${term}`,
          snippet: term,
        });
      }
    }
    for (const phrase of extractBareRelationPhrases(masked)) {
      hits.push({
        label: `relation_forbidden_empty_instance:${phrase}`,
        snippet: phrase,
      });
    }
    return hits;
  }

  for (const phrase of extractBareRelationPhrases(masked)) {
    if (!phraseAllowed(phrase, allowedHan)) {
      hits.push({
        label: `relation_not_in_instance:${phrase}`,
        snippet: phrase,
      });
    }
  }

  return hits;
}

/** Ganzhi / stem-element surfaces banned in user-visible plain (tooltip) slots. */
const PLAIN_SLOT_GANZHI_RE =
  /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]|[甲乙丙丁戊己庚辛壬癸][木火土金水]/;

/** Ten-god originals + umbrella — must not appear in contextual plain (tooltip). */
const PLAIN_SLOT_TEN_GOD_BANS_ZH = ["十神", ...CLOSED_TEN_GODS] as const;

/**
 * Contextual plain (2-slot slot2 / 3-slot slot3) is user-visible tooltip copy.
 * Apply the same ban families as body text — never treat plain as a jargon dump.
 */
export function auditMarkerPlainBanned(text: string, locale = "zh"): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];
  const zh = locale.startsWith("zh");
  const metaphors = metaphorBlacklistForLocale(locale);
  const termBansZh = zh
    ? [...new Set([...BANNED_TERMS_ZH, ...PLAIN_SLOT_TEN_GOD_BANS_ZH])].sort(
        (a, b) => b.length - a.length,
      )
    : [];

  for (const m of parseTermMarkers(text)) {
    const plain = resolveMarkerPlain(m);
    if (!plain) continue;
    const snippet = plain.slice(0, 48);

    if (zh) {
      const ganzhi = plain.match(PLAIN_SLOT_GANZHI_RE);
      if (ganzhi) {
        hits.push({ label: `marker_plain_banned:${ganzhi[0]}`, snippet });
      }
      for (const term of termBansZh) {
        if (plain.includes(term)) {
          hits.push({ label: `marker_plain_banned:${term}`, snippet });
          break;
        }
      }
      for (const phrase of metaphors) {
        if (plain.includes(phrase)) {
          hits.push({ label: `marker_plain_banned:${phrase}`, snippet });
          break;
        }
      }
    } else {
      const lower = plain.toLowerCase();
      for (const phrase of metaphors) {
        if (lower.includes(phrase.toLowerCase())) {
          hits.push({ label: `marker_plain_banned:${phrase}`, snippet });
          break;
        }
      }
      // EN stem-element compounds sometimes leak as "Yi wood" / bare pinyin — light check
      if (/\b(yi|jia|bing|ding|wu|ji|geng|xin|ren|gui)\s+(wood|fire|earth|metal|water)\b/i.test(plain)) {
        hits.push({ label: "marker_plain_banned:stem_element", snippet });
      }
    }
  }

  return hits;
}

/** Broken / incomplete markers and visible-text shape issues. */
export function auditMarkerCompleteness(text: string, locale = "zh"): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];

  if (detectBrokenMarkers(text)) {
    const idx = text.indexOf("⟦");
    hits.push({
      label: "broken_marker",
      snippet: idx >= 0 ? text.slice(idx, idx + 48).replace(/\s+/g, " ") : "⟦…",
    });
  }

  const GANZHI_IN_SOFT =
    /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]|[甲乙丙丁戊己庚辛壬癸][木火土金水]/;

  for (const m of parseTermMarkers(text)) {
    // Standard 2-slot `⟦t:slug|plain⟧` — plain is slot2. Compat 3-slot — plain is slot3.
    // Only report when plain is truly empty (not "missing because we expected a 3rd slot").
    if (!resolveMarkerPlain(m)) {
      hits.push({ label: "marker_missing_plain", snippet: m.raw.slice(0, 48) });
    }
    // Model-written soft only exists on compatibility 3-slot. On 2-slot, slot2 is contextual
    // plain (SSOT owns visible soft via termOf) — never run marker_visible_* against it.
    if (!isThreeSlotTermMarker(m.raw)) continue;
    const vis = m.visible.trim();
    if (/^(the|a|an)\s+(the|a|an)\b/i.test(vis)) {
      hits.push({ label: "marker_visible_article_dup", snippet: vis.slice(0, 40) });
    } else if (/^(the|a|an)\s/i.test(vis)) {
      hits.push({ label: "marker_visible_leading_article", snippet: vis.slice(0, 40) });
    }
    // Compat slot-2 soft must be vernacular — never leak stem+element or bare Ganzhi.
    if (GANZHI_IN_SOFT.test(vis)) {
      hits.push({ label: "marker_visible_ganzhi", snippet: vis.slice(0, 40) });
    }
  }

  // Plain slot = user-visible tooltip — same ban families as body.
  hits.push(...auditMarkerPlainBanned(text, locale));

  return hits;
}

/** Mask marked regions before forbidden-term audit. */
export function maskMarkersForAudit(text: string): string {
  let r = text;
  TERM_MARKER_PATTERN.lastIndex = 0;
  r = r.replace(TERM_MARKER_PATTERN, " ");
  r = r.replace(/⟦g\|((?:\\.|[^|\\])*)\|((?:\\.|[^|]|\\[^⟧])*?)⟧/g, " ");
  return r;
}
