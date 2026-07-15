/**
 * LLM term marking architecture — single source projections for prompt + UI.
 * LLM writes ⟦t:id|visible⟧; UI reads markers; audit detects leaks (no mutate).
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

/** Glossary rows injected into delivery prompts (closed-set 命理 · cache-stable). */
const DELIVERY_MARKING_GLOSSARY_IDS = CLOSED_SET_REPLACE_IDS.filter((id) => id !== "羊刃");

function pickFiveLocale(
  bag: Partial<Record<Locale, string>> | undefined,
  loc: Locale,
): string {
  if (!bag) return "";
  return (bag[loc] || bag.en || bag.zh || "").trim();
}

function softLabel(entry: TermEntry, loc: Locale): string {
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
  return {
    id,
    forbidden: [...c.forbidden_variants],
    soft: c.soft,
    keep_cn: KEEP_CN_SLUGS.has(id),
    plain: c.gloss,
  };
}

export const TERM_ENTRIES: TermEntry[] = TERM_GLOSSARY.map(conceptToTermEntry).filter(
  (e): e is TermEntry => e !== null,
);

const TERM_BY_ID = new Map(TERM_ENTRIES.map((e) => [e.id, e]));

const DELIVERY_MARKING_ENTRIES: TermEntry[] = DELIVERY_MARKING_GLOSSARY_IDS.map((hanId) => {
  const concept = CLOSED_SET_GLOSSARY_ENTRIES.find((c) => c.id === hanId);
  return concept ? conceptToTermEntry(concept) : null;
}).filter((e): e is TermEntry => e !== null);

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

export function encodeTermMarker(id: string, visible: string, plain?: string): string {
  const vis = escapeMarkerPart(visible);
  if (plain?.trim()) {
    return `⟦t:${id}|${vis}|${escapeMarkerPart(plain)}⟧`;
  }
  return `⟦t:${id}|${vis}⟧`;
}

export type ParsedTermMarker = { id: string; visible: string; plain?: string; raw: string };

export function parseTermMarkers(text: string): ParsedTermMarker[] {
  const out: ParsedTermMarker[] = [];
  TERM_MARKER_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_MARKER_PATTERN.exec(text)) !== null) {
    out.push({
      id: normalizeTermMarkerId(m[1]),
      visible: unescapeMarkerPart(m[2]),
      plain: m[3] ? unescapeMarkerPart(m[3]) : undefined,
      raw: m[0],
    });
  }
  return out;
}

/** Strip markers for LLM history — visible text only; dynamic plain + id never enter prefix. */
export function stripMarkersForPrompt(text: string): string {
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(
    TERM_MARKER_PATTERN,
    (_, _id: string, visible: string, _plain?: string) => unescapeMarkerPart(visible),
  );
}

/** Remove bare t: leaks (no ⟦⟧) and broken markers so users never see raw tokens. */
export function stripBareTermMarkers(text: string): string {
  return text.replace(/(?<!⟦)t:[a-zA-Z0-9_:]+\|([^|]+)\|?/g, "$1");
}

/** Wrap bare keep_cn soft phrases that lack ⟦t:…⟧ markers (visible text = soft label only, no ganzhi). */
export function wrapBareKeepCnSoftTerms(text: string, locale: string): string {
  const patterns: Array<{ id: string; label: string }> = [
    { id: "decade", label: "当前阶段气候" },
    { id: "day_master", label: "你的核心特质" },
    { id: "year", label: "当前时空效能" },
    { id: "yong_shen", label: "关键平衡能量" },
    { id: "yong_shen", label: "用神" },
  ];

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
].sort((a, b) => b.length - a.length);

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

export function prepareTextForGlossaryRender(text: string, locale: string): string {
  const normalized = fillMissingMarkerPlain(
    repairShenshaMarkerSoftLabels(normalizeTermMarkerIds(text, locale), locale),
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
  if (relKind) return pickFiveLocale(RELATION_KIND_SOFT[relKind], loc) || null;
  if (termId === BARE_GANZHI_MARKER.slug) return pickFiveLocale(BARE_GANZHI_MARKER.gloss, loc) || null;
  const hr = highRiskSoftBySlug(termId);
  if (hr) return pickFiveLocale(hr.gloss, loc) || null;
  const entry = TERM_BY_ID.get(termId);
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
  if (relKind) {
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
  const entry = TERM_BY_ID.get(termId);
  if (!entry) return null;
  return {
    soft: softLabel(entry, loc),
    plain: pickFiveLocale(entry.plain, loc),
    polarity: termPolarityById(termId),
  };
}

/** Prompt projection: forbidden → id + soft (+ keep_cn hint). Plain excluded to save tokens. */
export function buildTermMarkingFewShot(locale: string): string {
  // Principles only — never seed concrete metaphors (models overfit and copy them).
  const loc = toGlossaryLocale(locale);
  if (loc === "zh") {
    return `## 打标形态（原则 · 勿照抄任何具体比方）
\`⟦t:<id>|<≤6字软译>|<必须引用该用户亲口元素的白话>⟧\`
- 正文只留软译词；白话**只**在第3格（tooltip）。
- 白话自检：换一个用户还成立？成立 → 不合格。`;
  }
  return `## Marker shape (principles only — do not copy stock metaphors)
\`⟦t:<id>|<short soft label>|<plain that cites THIS user's own words>⟧\`
- Body shows soft label only; plain is tooltip-only.
- Self-check: would this plain still fit another user? If yes → rewrite.`;
}

export type TermMarkingPromptOptions = {
  /**
   * Skip heavy few-shot / metaphor cues — for latency + anti-overfit (segment2 Call A).
   * Still includes closed-set id table + hard rules.
   */
  principlesOnly?: boolean;
};

export function buildTermMarkingPromptBlock(
  locale: string,
  opts?: TermMarkingPromptOptions,
): string {
  const loc = toGlossaryLocale(locale);
  const langLabel =
    loc === "zh" ? "中文" : loc === "en" ? "English" : loc.toUpperCase();
  const principlesOnly = opts?.principlesOnly === true;
  const rows = DELIVERY_MARKING_ENTRIES.map((e) => {
    const soft = softLabel(e, loc);
    const keep =
      e.keep_cn === true
        ? loc === "zh"
          ? "（可见软译只用上表词，禁括号干支）"
          : " (visible soft label only — no stem-branch in parens)"
        : "";
    const sample = e.forbidden.slice(0, principlesOnly ? 2 : 4).join(" / ");
    return `| \`${e.id}\` | ${sample} | **${soft}**${keep} |`;
  }).join("\n");

  const rules = principlesOnly
    ? `## 打标记规则（原则 · 严禁过拟合示例）
1. \`<可见文本>\` = 软翻译词（短）；**正文只出现这一格**；**软译词本身不得含裸干支或「乙木/丙火」类合称**。
2. \`<该处白话>\` **只进 tooltip**，【禁止】写进正文句子；必须引用【这位用户亲口说过的具体词/场景】；禁止通用词典比方。
3. 自检：换用户还成立？成立 → 重写。
4. 一段金字 ≤2；**id 必须取自上表闭集 slug**；自造 id（da_yun / ji_shen 等）= 拒绝；闭集没有 → **不打标，直接白话**；标记外勿套括号。
5. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）。

${buildTermMarkingFewShot(locale)}`
    : `## 打标记规则
1. \`<可见文本>\` = 你写出的软翻译词（**只用上表 soft 词；禁裸干支、禁「乙木/丙火」类合称、禁括号干支**）
2. \`<该处白话>\` = **结合本句意境 + 用户问题**现写的人话；白话**不出现在正文**，只进标记第 3 段（UI tooltip）；必须引用该用户亲口元素，禁套用固定比方。
3. **只用当前交付语言**；标记**只包软翻译词**
4. 流年/大运类先归因外境再给掌控感
5. **每段金字 ≤2**；首次打标、后文白话
6. **签诗/古文不是术语**，不打标
7. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）
8. 若漏写第 3 段白话，UI 会回退静态词典——**务必写全三段位**；但禁止用与用户无关的通用词典句凑数
9. **id 必须取自闭集**；自造 slug = 拒绝；没有对应概念 → 不打标、直接白话讲

${buildTermMarkingFewShot(locale)}

${buildClosedSetConstraintPromptBlock(locale)}`;

  return `# 术语软翻译 + 标记（输出 JSON 字符串 · ${langLabel}）

凡涉及下表命理术语，**用对应语言的软翻译词替换原文**，并打 **三段位**标记：\`⟦t:<id>|<可见文本>|<该处白话>⟧\`

| id | 禁/术语示例 | 软翻译 (${langLabel}) |
|---|---|---|
${rows}

${rules}`;
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
  return out.replace(/\s{2,}/g, " ").trim();
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
    if (m.plain?.trim()) continue;
    const fallback = plainByTermId(m.id, locale);
    if (!fallback) continue;
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
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
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
): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];
  for (const chunk of text.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith("##")) continue;
    const count = parseTermMarkers(chunk).length;
    if (count > maxPerParagraph) {
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

/** Broken / incomplete markers and visible-text shape issues. */
export function auditMarkerCompleteness(text: string): OutOfSetAuditHit[] {
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
    if (!m.plain?.trim()) {
      hits.push({ label: "marker_missing_plain", snippet: m.raw.slice(0, 48) });
    }
    const vis = m.visible.trim();
    if (/^(the|a|an)\s+(the|a|an)\b/i.test(vis)) {
      hits.push({ label: "marker_visible_article_dup", snippet: vis.slice(0, 40) });
    } else if (/^(the|a|an)\s/i.test(vis)) {
      hits.push({ label: "marker_visible_leading_article", snippet: vis.slice(0, 40) });
    }
    // Slot-2 soft must be vernacular — never leak stem+element or bare Ganzhi into user-visible text.
    if (GANZHI_IN_SOFT.test(vis)) {
      hits.push({ label: "marker_visible_ganzhi", snippet: vis.slice(0, 40) });
    }
  }

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
