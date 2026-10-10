/**
 * Evidence polish for Phase-4 delivery.
 *
 * - Pre-connective / legacy: full encodeAndPolish (slots + autoMark fallback).
 * - Post-connective (current): slot encode only — never autoMark the vernacular
 *   between ⟦w:⟧ (that was shredding connective into gold walls).
 * - Post-encode: soft-mark adjacency + soft|element glue gates (Batch1 C).
 * - Template-leak ban for mark pad / connective (Batch1 D).
 */

import {
  countGapVernacularUnits,
  countHanChars,
  countLatinLetters,
  hasAdjacentWordSlotsWithoutVernacular,
  isZhLocale,
  maxTermMarkersPerClause,
  minStackBreakVernacular,
  MIN_ADJACENT_VERNACULAR_HAN,
  minAdjacentVernacular,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import {
  encodeAndPolishDeliveryEvidence,
  encodeTraditionalWordSlots,
  listUnresolvedWordSlots,
  normalizeTermMarkerIds,
  collapseMarkersToEmptySlots,
  rewriteMarkersWithSsotSoft,
} from "@/lib/llm/sanitize/term-marking";
import { localizeChartTokenForZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";
import { EVIDENCE_TOXIC_PAD_PHRASES } from "@/lib/llm/pro/delivery/evidence-remnant-gate";

/**
 * Neutral gap fillers (≥4 Han) for local adjacent-slot repair only.
 * 方案 A #4：禁「同时对应/以及这里」等空垫（会叠挂同 slug 金字）。
 */
export const NEUTRAL_SLOT_GAP_POOL_ZH = [
  "在机制上衔接",
  "由此引动",
  "并落到此处",
  "再对照结构",
] as const;

/** Local stack-break pad — 空衔接套话，strict 闸当填缝失败。 */
export const STACK_BREAK_PAD_ZH = "这一环接着落到下一点";

/** Legacy empty pads — strip when bridging duplicate same-token slots. */
const BANNED_EMPTY_SLOT_PADS_ZH = [
  "同时对应",
  "以及这里",
  "与此相关",
  "并在此处",
] as const;

/** Thin gap junk: punctuation / particles only — drop before padding (never keep 「、」+pad). */
const THIN_GAP_JUNK_RE = /^[\s、，。；：,.!?;:的与及和而之了着过]+$/u;

/**
 * Legacy glue phrases that may be stripped once then re-checked.
 * Toxic L383 pads are listed separately and always hard-fail (never "repaired").
 */
export const MARK_TEMPLATE_LEAK_PHRASES = [
  "并进一步关联到",
  "从结构与节奏上看，这两处机制是这样连上的",
  "从结构与节奏上看",
  "这两处机制是这样连上的",
  "这两处机制是这样连上",
  ...EVIDENCE_TOXIC_PAD_PHRASES,
] as const;

/** Phrases stripTemplateLeak may rewrite — excludes toxic pads (those hard-fail). */
const STRIPPABLE_TEMPLATE_LEAK_PHRASES = [
  "并进一步关联到",
  "从结构与节奏上看，这两处机制是这样连上的",
  "从结构与节奏上看",
  "这两处机制是这样连上的",
  "这两处机制是这样连上",
] as const;

/** Neutral stand-in when stripping a legacy leaked template. */
const TEMPLATE_LEAK_REPLACEMENT_ZH = NEUTRAL_SLOT_GAP_POOL_ZH[0]!;

const WUXING_RUN = "木火土金水";

function nextSlotGapPad(padIndex: { i: number }): string {
  const pad = NEUTRAL_SLOT_GAP_POOL_ZH[padIndex.i % NEUTRAL_SLOT_GAP_POOL_ZH.length]!;
  padIndex.i += 1;
  // Hard invariant: pad must clear adjacent-gold Han floor (否则软修后仍假红空转 LLM).
  if (countHanChars(pad) < MIN_ADJACENT_VERNACULAR_HAN) {
    return "在机制上衔接";
  }
  return pad;
}

/** True when gap has no usable vernacular — only space/punct/particles. */
export function isThinSlotGapJunk(gap: string): boolean {
  const t = (gap ?? "").trim();
  if (!t) return true;
  if (countHanChars(t) >= MIN_ADJACENT_VERNACULAR_HAN) return false;
  // Latin letters = real EN/ES/FR connective (e.g. " and leaves ") — never junk.
  // Old Han-only zero check ate twin same-token slots on soft EN encode.
  if (countLatinLetters(t) > 0) return false;
  return THIN_GAP_JUNK_RE.test(t) || countHanChars(t) === 0;
}

/**
 * Latin short coordinators with flanking space (⟦A⟧ and ⟦B⟧ keep…) — keep.
 * Glued gold-wall glue (⟧and⟦ / ⟧of⟦) stays broken for destack.
 */
function isLatinShortCoordinatorKeep(gap: string): boolean {
  const raw = gap ?? "";
  const t = raw.trim();
  if (!/^(?:,\s*)?(?:and|or|y|o|et|ou)$/i.test(t)) return false;
  // Require some whitespace in the gap so glued ⟧and⟦ is still broken.
  return /\s/.test(raw);
}

/**
 * Clause break + article starting the next NP (⟧; the ⟦ / ⟧, the ⟦ / ⟧. El ⟦).
 * Bare `the` alone stays broken; punct+article is normal EN/ES/FR continuity —
 * padding it into 「and that piles on more pressure」destroys readable drafts
 * (P5 soft en #3: `; the` / `, the` → pad-soup).
 */
function isLatinClauseArticleKeep(gap: string): boolean {
  const t = (gap ?? "").trim();
  return /^[,.;:!?，。；：]\s+(?:the|a|an|el|la|los|las|un|una|le|les|du|des)\s*$/i.test(
    t,
  );
}

/**
 * Clause break + short Chinese coordinator (⟧；而 ⟦ / ⟧，而 ⟦ / ⟧。且 ⟦).
 * Padding into 「这时压力又上来」destroys readable drafts (P6 soft zh dim4).
 */
function isZhClauseCoordinatorKeep(gap: string): boolean {
  const t = (gap ?? "").trim();
  return /^[,，、.;:!?。；：！？]+\s*[而且并]+$/.test(t);
}

/** Slash between parallel bookmarks (⟧/⟦ · 流年/大运…) — keep; not empty junk. */
function isSlashParallelKeep(gap: string): boolean {
  return /^\/$/.test((gap ?? "").trim());
}

export function findTemplateLeakPhrase(text: string): string | null {
  const t = text ?? "";
  for (const p of MARK_TEMPLATE_LEAK_PHRASES) {
    if (t.includes(p)) return p;
  }
  return null;
}

/** Toxic L383 pads — any hit is fail (not strip-repairable). */
export function findToxicPadPhrase(text: string): string | null {
  const t = text ?? "";
  for (const p of EVIDENCE_TOXIC_PAD_PHRASES) {
    if (t.includes(p)) return p;
  }
  return null;
}

/** 空衔接垫片族（C makeup 库存）— strict 闸硬失败，不进默认 template-leak 以免误杀 repair 路径。 */
const EMPTY_CONNECTIVE_PAD_ZH = [
  ...NEUTRAL_SLOT_GAP_POOL_ZH,
  STACK_BREAK_PAD_ZH,
] as const;

export function findEmptyConnectivePadPhrase(text: string): string | null {
  const t = text ?? "";
  const ranked = [...EMPTY_CONNECTIVE_PAD_ZH].sort((a, b) => b.length - a.length);
  for (const p of ranked) {
    if (t.includes(p)) return p;
  }
  return null;
}

export type SoftMakeupMode = "repair" | "fail";

export type SoftEncodeOpts = {
  makeup?: SoftMakeupMode;
  /** slug_only: store `⟦t:slug|⟧`; UI fills termOf/glossOf. ssot_fill: 3-slot dump. */
  store?: "ssot_fill" | "slug_only";
};

/** Strip legacy template-leak pads only; toxic pads must hard-fail upstream. */
export function stripTemplateLeakPhrases(text: string): string {
  let out = text ?? "";
  for (const p of STRIPPABLE_TEMPLATE_LEAK_PHRASES) {
    if (!out.includes(p)) continue;
    out = out.split(p).join(TEMPLATE_LEAK_REPLACEMENT_ZH);
  }
  for (const pad of [...NEUTRAL_SLOT_GAP_POOL_ZH, ...BANNED_EMPTY_SLOT_PADS_ZH]) {
    const re = new RegExp(`(?:${pad}){2,}`, "g");
    out = out.replace(re, pad);
  }
  out = out.replace(/，{2,}/g, "，");
  out = out.replace(/、，/g, "，");
  return out;
}

/**
 * Twin same-token slots across a clause break (`;` / `.` / `。`…) must stay —
 * collapsing them eats the second sticker and breaks grammar
 * (P5 soft es #5: `用神金⟧; ⟦用神金⟧` → one slot + 「a X en Y queda」).
 * Comma / 顿号 alone may still collapse (noun-stack glue).
 */
function isClauseBreakTwinKeepGap(gap: string): boolean {
  const t = (gap ?? "").trim();
  return /^[.;!?。；：！？]+$/.test(t);
}

function isDedupeCollapsibleSameTokenGap(gap: string): boolean {
  if (isClauseBreakTwinKeepGap(gap)) return false;
  const banned = BANNED_EMPTY_SLOT_PADS_ZH.some((p) => (gap ?? "").includes(p));
  return banned || isThinSlotGapJunk(gap);
}

/**
 * 方案 A #4：同卡重复 ⟦w:同词⟧ / ⟦t:同slug⟧ 去重。
 * 仅当两槽之间为空垫/薄 junk（空、标点、虚字）时塌成单槽。
 * 禁用「<4 汉字」一刀切——会把「，让这个」这类真连接吃掉，
 * 毁掉同词双槽（如 金…金…受制）的合法稿（P3 soft #2）。
 */
export function dedupeSameCardWordSlots(text: string): string {
  let out = text ?? "";
  if (!out.includes("⟧")) return out;

  // Collapse ⟦w:X⟧(empty pad)⟦w:X⟧ → ⟦w:X⟧
  const wRe =
    /⟦(?:w|词):([^⟧]+)⟧((?:[^⟦]|⟦(?!(?:w|词):))*?)⟦(?:w|词):\1⟧/g;
  let guard = 0;
  while (guard++ < 12) {
    const next = out.replace(wRe, (_m, token: string, gap: string) => {
      if (isDedupeCollapsibleSameTokenGap(gap ?? "")) {
        return `⟦w:${token}⟧`;
      }
      return _m;
    });
    if (next === out) break;
    out = next;
  }

  // Post-encode: ⟦t:slug|…⟧ … ⟦t:sameSlug|…⟧
  const tRe =
    /⟦t:([a-z0-9_]+)(\|[^\]]*)?⟧((?:[^⟦]|⟦(?!t:))*?)⟦t:\1(\|[^\]]*)?⟧/gi;
  guard = 0;
  while (guard++ < 12) {
    const next = out.replace(tRe, (_m, slug: string, rest: string, gap: string) => {
      if (isDedupeCollapsibleSameTokenGap(gap ?? "")) {
        return `⟦t:${slug}${rest ?? ""}⟧`;
      }
      return _m;
    });
    if (next === out) break;
    out = next;
  }

  // Strip leftover banned pads between any slots
  for (const pad of BANNED_EMPTY_SLOT_PADS_ZH) {
    out = out.split(pad).join("，");
  }
  out = out.replace(/，{2,}/g, "，");
  return out;
}

/**
 * Pad thin gaps between adjacent ⟦w:⟧ slots so mark_adjacent_gold gate passes
 * without a full LLM retry. Only adds generic connective — never touches slot interiors.
 * Punctuation-only / particle gaps are discarded (never `、，pad`).
 */
export function repairAdjacentWordSlotGaps(text: string): string {
  const raw = text ?? "";
  if (!raw.includes("⟧") || !hasAdjacentWordSlotsWithoutVernacular(raw)) return raw;
  const padIndex = { i: 0 };
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (countHanChars(gap) >= MIN_ADJACENT_VERNACULAR_HAN) return `⟧${gap}⟦`;
    const pad = nextSlotGapPad(padIndex);
    if (isThinSlotGapJunk(gap)) return `⟧${pad}⟦`;
    const trimmed = gap.trim();
    return `⟧${trimmed}${pad}⟦`;
  });
}

/**
 * Soft (makeup=fail) B-assembly: only patch *broken* seams (empty / punct /
 * 半文言单字生克 / Latin one-word cycle glue). Meaningful short vernacular
 * (是 / 会消耗 / 同盘 / "keeps draining") is kept — never glue mechanical pads
 * onto good LLM drafts (#23/#24 pad-soup).
 */
const SOFT_HALF_CLASSICAL_BRIDGE_RE =
  /^(生|泄|克|冲|合|刑|害|冲克|相冲|相克|相生|相泄|引动|势叠加|势共振)$/;

/** Half-classical / empty bridges → one short causal clause (≥4 Han). */
const SOFT_BROKEN_BRIDGE_REWRITE_ZH: Readonly<Record<string, string>> = {
  生: '还会去生养',
  泄: '会不断消耗',
  克: '会直接压制',
  冲: '会直接冲撞',
  合: '会勾连在一起',
  刑: '会互相刑伤',
  害: '会互相拖累',
  冲克: '冲撞压制',
  相冲: '彼此冲撞',
  相克: '彼此压制',
  相生: '彼此生养',
  相泄: '彼此消耗',
  引动: '又进一步带动',
  势叠加: '压力一层层叠上来',
  势共振: '气势互相呼应',
  无: '当中还缺少',
  为: '在这里就是',
};

/** Same category rewrite for foreign soft B (Chinese bridge left untranslated). */
const SOFT_BROKEN_BRIDGE_REWRITE_EN: Readonly<Record<string, string>> = {
  生: 'also keeps feeding',
  泄: 'keeps draining capacity',
  克: 'presses hard against',
  冲: 'collides straight into',
  合: 'gets tangled with',
  刑: 'keeps wounding each other',
  害: 'keeps dragging each other down',
  冲克: 'collides and presses',
  相冲: 'clash against each other',
  相克: 'press against each other',
  相生: 'feed each other',
  相泄: 'drain each other',
  引动: 'then pulls the next beat',
  势叠加: 'pressure stacks layer on layer',
  势共振: 'the pressure echoes back',
  无: 'is still missing',
  为: 'here means',
  produces: 'keeps feeding capacity into',
  producing: 'keeps feeding capacity into',
  generates: 'keeps feeding capacity into',
  generating: 'keeps feeding capacity into',
  nourishes: 'keeps feeding capacity into',
  nourishing: 'keeps feeding capacity into',
  feeds: 'keeps feeding capacity into',
  feeding: 'keeps feeding capacity into',
  drains: 'keeps draining capacity from',
  draining: 'keeps draining capacity from',
};

const SOFT_BROKEN_BRIDGE_REWRITE_ES: Readonly<Record<string, string>> = {
  生: 'también sigue alimentando',
  泄: 'sigue drenando capacidad',
  克: 'presiona fuerte contra',
  冲: 'choca de frente con',
  合: 'se enreda con',
  刑: 'se hieren entre sí',
  害: 'se arrastran entre sí',
  冲克: 'choca y presiona',
  相冲: 'chocan entre sí',
  相克: 'se presionan entre sí',
  相生: 'se alimentan entre sí',
  相泄: 'se drenan entre sí',
  引动: 'y luego tira del siguiente tramo',
  势叠加: 'la presión se apila capa a capa',
  势共振: 'la presión hace eco',
  无: 'aún falta',
  为: 'aquí significa',
};

const SOFT_BROKEN_BRIDGE_REWRITE_FR: Readonly<Record<string, string>> = {
  生: 'continue aussi à nourrir',
  泄: 'continue à drainer la capacité',
  克: 'appuie fort contre',
  冲: 'heurte de plein fouet',
  合: "s'emmêle avec",
  刑: "se blessent l'un l'autre",
  害: "se tirent vers le bas",
  冲克: 'heurte et appuie',
  相冲: "s'entrechoquent",
  相克: "se pressent l'un l'autre",
  相生: "se nourrissent l'un l'autre",
  相泄: "se drainent l'un l'autre",
  引动: 'puis tire le prochain temps',
  势叠加: 'la pression s’empile couche après couche',
  势共振: 'la pression résonne',
  无: 'manque encore',
  为: 'ici veut dire',
};

/** Empty / punct-only gaps. */
const SOFT_ADJACENT_CLAUSES_ZH = [
  '这时压力又上来',
  '接着又加压过来',
  '这一环更难稳住',
] as const;

const SOFT_ADJACENT_CLAUSES_EN = [
  'and that piles on more pressure',
  'which makes it harder to steady',
  'so the next beat hits harder',
] as const;

const SOFT_ADJACENT_CLAUSES_ES = [
  'y eso suma más presión',
  'lo que hace más difícil estabilizarse',
  'así que el siguiente tramo golpea más fuerte',
] as const;

const SOFT_ADJACENT_CLAUSES_FR = [
  'et ça ajoute encore de la pression',
  'ce qui rend plus dur de se stabiliser',
  'donc le prochain temps frappe plus fort',
] as const;

/** Rare: consecutive broken gaps need a longer break clause. */
const SOFT_STACK_CLAUSES_ZH = [
  '这时又多了一层压力',
  '接着把回旋余地收窄',
  '让这边更难稳住节奏',
  '于是承压感再抬一档',
] as const;

const SOFT_STACK_CLAUSES_EN = [
  'and another layer of pressure stacks on',
  'which narrows the room to steady yourself',
  'making this beat even harder to hold',
  'so the squeeze tightens another notch',
] as const;

const SOFT_STACK_CLAUSES_ES = [
  'y se apila otra capa de presión',
  'lo que estrecha el margen para estabilizarse',
  'haciendo este tramo aún más difícil de sostener',
  'así que el apriete sube otro punto',
] as const;

const SOFT_STACK_CLAUSES_FR = [
  'et une autre couche de pression s’empile',
  'ce qui rétrécit la marge pour se stabiliser',
  'rendant ce temps encore plus dur à tenir',
  'donc l’étau se resserre d’un cran',
] as const;

/** Latin glue / one-word cycle alone — not a real clause. */
const SOFT_LATIN_GLUE_RE =
  /^(?:and|or|of|to|the|a|an|y|o|de|a|et|ou|du|des|,?\s*and|,?\s*y|,?\s*et)$/i;

const SOFT_LATIN_CYCLE_ONE_WORD_RE =
  /^(?:(?:the|which\s+is)\s+)?(?:produces|producing|generates|generating|nourishes|nourishing|feeds|feeding|drains|draining)(?:\s+the)?$/i;

const SOFT_MECHANICAL_PAD_RE =
  /带来压力|又加重了负担|会持续加重承压感|与此同时还有|与此同时压力加重|这让压力加重|这时压力又上来|接着又加压过来|这一环更难稳住|这时又多了一层压力|接着把回旋余地收窄|让这边更难稳住节奏|于是承压感再抬一档|压力再抬一档|piles on more pressure|makes it harder to steady|next beat hits harder|another layer of pressure stacks|narrows the room to steady|squeeze tightens another notch|suma más presión|más difícil estabilizarse|otra capa de presión|ajoute encore de la pression|plus dur de se stabiliser|autre couche de pression/;

function softLocaleFamily(locale: string): "zh" | "en" | "es" | "fr" {
  const l = locale.trim().toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  return "en";
}

function softBrokenBridgeMap(locale: string): Readonly<Record<string, string>> {
  switch (softLocaleFamily(locale)) {
    case "es":
      return SOFT_BROKEN_BRIDGE_REWRITE_ES;
    case "fr":
      return SOFT_BROKEN_BRIDGE_REWRITE_FR;
    case "en":
      return SOFT_BROKEN_BRIDGE_REWRITE_EN;
    default:
      return SOFT_BROKEN_BRIDGE_REWRITE_ZH;
  }
}

function softAdjacentClauses(locale: string): readonly string[] {
  switch (softLocaleFamily(locale)) {
    case "es":
      return SOFT_ADJACENT_CLAUSES_ES;
    case "fr":
      return SOFT_ADJACENT_CLAUSES_FR;
    case "en":
      return SOFT_ADJACENT_CLAUSES_EN;
    default:
      return SOFT_ADJACENT_CLAUSES_ZH;
  }
}

function softStackClauses(locale: string): readonly string[] {
  switch (softLocaleFamily(locale)) {
    case "es":
      return SOFT_STACK_CLAUSES_ES;
    case "fr":
      return SOFT_STACK_CLAUSES_FR;
    case "en":
      return SOFT_STACK_CLAUSES_EN;
    default:
      return SOFT_STACK_CLAUSES_ZH;
  }
}

function nextSoftClause(
  pool: readonly string[],
  padIndex: { i: number },
  minUnits: number,
  locale = "zh",
): string {
  for (let n = 0; n < pool.length; n++) {
    const clause = pool[(padIndex.i + n) % pool.length]!;
    if (countGapVernacularUnits(clause, locale) >= minUnits) {
      padIndex.i += n + 1;
      return clause;
    }
  }
  padIndex.i += 1;
  return pool[0]!;
}

function gapCoreParts(gap: string): { lead: string; trail: string; core: string } {
  const lead = gap.match(/^[，,、；;\s]*/)?.[0] ?? '';
  const trail = gap.match(/[，,、；;\s]*$/)?.[0] ?? '';
  const core = gap.slice(lead.length, gap.length - trail.length).trim();
  return { lead, trail, core };
}

function hasSoftMechanicalPad(gap: string): boolean {
  return SOFT_MECHANICAL_PAD_RE.test(gap ?? '');
}

/** Latin punct / tiny glue with no real vernacular clause. */
function isThinLatinSlotGapJunk(gap: string): boolean {
  const t = (gap ?? "").trim();
  if (!t) return true;
  if (/^[\s,.;:!?，。；：、]+$/.test(t)) return true;
  if (SOFT_LATIN_GLUE_RE.test(t)) return true;
  if (SOFT_LATIN_CYCLE_ONE_WORD_RE.test(t)) return true;
  // leftover Chinese classical with no Latin clause yet
  if (countHanChars(t) > 0 && countLatinLetters(t) === 0) {
    if (SOFT_HALF_CLASSICAL_BRIDGE_RE.test(t)) return true;
    if (countHanChars(t) <= 2) return true;
  }
  return false;
}

/**
 * Soft A/B: seam is broken only when empty/punct/particle or 半文言单字桥
 * (zh) / Latin one-word cycle glue (en/es/fr).
 * 「是 / 会消耗 / 同盘 / keeps draining」count as real connective — do not pad.
 * 顿号 `、` alone = noun-stack glue — keep; UI peels to cluster.
 * 与/和/及 alone = short-but-real coordinator (「A 与 B 这两头…」) — keep;
 * padding them into 「这时压力又上来」destroys readable drafts (P3 soft pad-soup).
 */
export function isBrokenSoftConnectiveGap(
  gap: string,
  locale = "zh",
): boolean {
  const trimmed = (gap ?? "").trim();
  // Lone list/sentence punct = deliberate clause break (⟧. ⟦ / ⟧；⟦).
  // Padding these into 「y eso suma más presión」destroys readable multi-sentence drafts
  // (P4 soft es #3: period/semicolon between bookmarks → pad-soup).
  if (/^[,，、.;:!?。；：！？]+$/.test(trimmed)) return false;
  // Parallel slash (⟧/⟦) — keep; padding → pad-soup (P6 soft zh dim4).
  if (isSlashParallelKeep(gap)) return false;
  if (isZhLocale(locale)) {
    const { core } = gapCoreParts(gap);
    // Short coordinators are real vernacular (mirror ES " y " / zh 是) — never pad.
    if (/^[与和及]+$/.test(core)) return false;
    // `；而` / `，而` = clause break + coordinator — keep (P6 soft zh dim4).
    if (isZhClauseCoordinatorKeep(gap)) return false;
    if (isThinSlotGapJunk(gap)) return true;
    if (!core) return true;
    if (SOFT_HALF_CLASSICAL_BRIDGE_RE.test(core)) return true;
    if (core in SOFT_BROKEN_BRIDGE_REWRITE_ZH && countHanChars(core) <= 2) {
      return true;
    }
    return false;
  }
  // Latin: only empty/punct/glue/cycle/Chinese leftover — NOT letter-floor.
  // #32: " es " / ", así " are short-but-real (like zh 是) — padding them → pad-soup.
  // Spaced and/y/et = zh 与/和/及 — never pad into soup.
  if (isLatinShortCoordinatorKeep(gap)) return false;
  // `; the` / `, the` = next-NP article after clause break — keep (P5 soft en #3).
  if (isLatinClauseArticleKeep(gap)) return false;
  if (isThinLatinSlotGapJunk(gap)) return true;
  const { core } = gapCoreParts(gap);
  if (!core) return true;
  if (SOFT_HALF_CLASSICAL_BRIDGE_RE.test(core)) return true;
  if (SOFT_LATIN_CYCLE_ONE_WORD_RE.test(core)) return true;
  if (SOFT_LATIN_GLUE_RE.test(core)) return true;
  const bridge = softBrokenBridgeMap(locale);
  const key = core.toLowerCase();
  if (core in bridge || key in bridge) {
    // Chinese half-classical leftover or one-word EN cycle mapped for rewrite.
    return true;
  }
  return false;
}

export function hasBrokenSoftConnectiveGaps(
  text: string,
  locale = 'zh',
): boolean {
  const re = /⟧([^⟦]*)⟦/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? '')) !== null) {
    if (isBrokenSoftConnectiveGap(m[1] ?? '', locale)) return true;
  }
  return false;
}

/**
 * Soft stack: only *broken* seams advance the gold-wall run.
 * Meaningful short vernacular resets the run (not a 金字墙).
 */
export function hasExcessBrokenSoftTermStack(
  text: string,
  locale = 'zh',
): boolean {
  const maxConsecutive = maxTermMarkersPerClause(locale);
  let run = 1;
  const re = /⟧([^⟦]*)⟦/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? '')) !== null) {
    if (isBrokenSoftConnectiveGap(m[1] ?? '', locale)) {
      run += 1;
      if (run > maxConsecutive) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/** Patch only broken soft seams; leave meaningful short LLM connective intact. */
export function thickenShortAdjacentGapsForSoft(
  text: string,
  locale = "zh",
): string {
  const raw = text ?? "";
  if (!raw.includes("⟧") || !hasBrokenSoftConnectiveGaps(raw, locale)) {
    return raw;
  }
  const padIndex = { i: 0 };
  const bridge = softBrokenBridgeMap(locale);
  const floor = minAdjacentVernacular(locale);
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (!isBrokenSoftConnectiveGap(gap, locale)) return `⟧${gap}⟦`;
    const { lead, trail, core } = gapCoreParts(gap);
    const rewritten =
      bridge[core] ?? bridge[core.toLowerCase()] ?? undefined;
    if (rewritten) {
      // Latin: keep spaces so pads never glue onto bookmarks (#32).
      if (!isZhLocale(locale)) {
        const body = rewritten.trim();
        return `⟧${lead || " "}${body}${trail || " "}⟦`;
      }
      return `⟧${lead}${rewritten}${trail}⟦`;
    }
    const clause = nextSoftClause(
      softAdjacentClauses(locale),
      padIndex,
      floor,
      locale,
    );
    if (!isZhLocale(locale)) {
      return `⟧ ${clause.trim()} ⟦`;
    }
    return `⟧${clause}⟦`;
  });
}

/**
 * Soft destack: only when consecutive *broken* seams exceed the stack ceiling.
 * Replace that broken gap with one clean ≥8-unit clause — never append onto good text.
 */
export function breakExcessTermStacksForSoft(
  text: string,
  locale = "zh",
): string {
  const raw = text ?? "";
  if (!raw.includes("⟧")) return raw;
  if (!hasExcessBrokenSoftTermStack(raw, locale)) return raw;
  const maxConsecutive = maxTermMarkersPerClause(locale);
  let run = 1;
  const padIndex = { i: 0 };
  return raw.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    if (!isBrokenSoftConnectiveGap(gap, locale)) {
      run = 1;
      return `⟧${gap}⟦`;
    }
    run += 1;
    if (run > maxConsecutive) {
      run = 1;
      return `⟧${nextSoftClause(
        softStackClauses(locale),
        padIndex,
        minStackBreakVernacular(locale),
        locale,
      )}⟦`;
    }
    return `⟧${gap}⟦`;
  });
}

/** Collapse residual pad-soup / 抢抢资源 / legacy glue. */
export function scrubSoftAssemblyArtifacts(
  text: string,
  locale = "zh",
): string {
  let out = text ?? "";
  if (isZhLocale(locale)) {
    out = out.replace(/抢抢资源/g, "抢资源");
    out = out.replace(/着，压力再抬一档/g, "，");
    out = out.replace(/，压力再抬一档/g, "，");
    out = out.replace(/压力再抬一档/g, "");
  }
  out = out.replace(/⟧([^⟦]*)⟦/g, (_m, gap: string) => {
    let g = gap ?? "";
    if (isZhLocale(locale) && g.includes("又加重了负担")) {
      g = g.split("又加重了负担").join("");
      if (!isBrokenSoftConnectiveGap(g, locale) && !hasSoftMechanicalPad(g)) {
        return `⟧${g}⟦`;
      }
      return "⟧这时压力又上来⟦";
    }
    // Strip「着」only when glued onto a known mechanical pad core (这一环着).
    // Never strip real aspect verbs: 藏着 / 压着 / 护着 (P3 soft #2).
    if (isZhLocale(locale)) {
      const trimmed = g.trim();
      if (/^[\u4e00-\u9fff]{2,4}着$/.test(trimmed)) {
        const stripped = g.replace(/着(\s*)$/u, "$1");
        const core = stripped.trim();
        if (
          hasSoftMechanicalPad(core) ||
          softAdjacentClauses(locale).some((c) => core === c)
        ) {
          return `⟧${stripped}⟦`;
        }
      }
    }
    if (!hasSoftMechanicalPad(g)) return `⟧${g}⟦`;
    const hits = g.match(new RegExp(SOFT_MECHANICAL_PAD_RE.source, "gi"));
    if (!hits || hits.length < 2) return `⟧${g}⟦`;
    return `⟧${softStackClauses(locale)[0]}⟦`;
  });
  return out;
}

/**
 * Soft B: patch broken seams only. Good LLM drafts with short-but-real
 * connective (是/会消耗/同盘 / keeps draining) are left alone.
 */
export function assembleSoftConnectiveStructuralIfNeeded(
  text: string,
  locale = "zh",
): string {
  let out = text ?? "";
  if (
    !hasBrokenSoftConnectiveGaps(out, locale) &&
    !hasExcessBrokenSoftTermStack(out, locale)
  ) {
    out = scrubSoftAssemblyArtifacts(out, locale);
    return peelSoftGluedWuxingConnective(out, locale);
  }
  if (hasBrokenSoftConnectiveGaps(out, locale)) {
    out = thickenShortAdjacentGapsForSoft(out, locale);
  }
  if (hasExcessBrokenSoftTermStack(out, locale)) {
    out = breakExcessTermStacksForSoft(out, locale);
  }
  out = scrubSoftAssemblyArtifacts(out, locale);
  return peelSoftGluedWuxingConnective(out, locale);
}

const WORD_SLOT_FULL_RE = /⟦(?:w|词):[^⟧]+⟧/g;

/** Ordered list of `⟦w:…⟧` / `⟦词:…⟧` markers in evidence. */
export function listEvidenceWordSlotMarkers(text: string): string[] {
  WORD_SLOT_FULL_RE.lastIndex = 0;
  return [...(text ?? "").matchAll(WORD_SLOT_FULL_RE)].map((m) => m[0]!);
}

/** Inner 真词 of each `⟦w:⟧` / `⟦词:⟧`, order preserved. */
export function listEvidenceWordSlotInteriors(text: string): string[] {
  return [...(text ?? "").matchAll(/⟦(?:w|词):([^⟧]+)⟧/g)].map((m) =>
    String(m[1] ?? "").trim(),
  );
}

/**
 * Soft B-assembly: when slot counts match, stamp input `⟦w:⟧` markers onto
 * output by ordinal. Connective-only jobs must not mutate slot interiors
 * (model CoT often doubles a 干支尾字: 流年丙午→流年丙午午).
 * Does not invent/drop slots — count mismatch stays for the gate.
 */
export function restoreWordSlotInteriorsFromInput(
  inputEvidence: string,
  outputEvidence: string,
): { text: string; restored: number } {
  const inSlots = listEvidenceWordSlotMarkers(inputEvidence);
  const out = outputEvidence ?? "";
  if (inSlots.length === 0) return { text: out, restored: 0 };
  const outSlots = listEvidenceWordSlotMarkers(out);
  if (outSlots.length !== inSlots.length) return { text: out, restored: 0 };
  let restored = 0;
  let i = 0;
  const text = out.replace(/⟦(?:w|词):[^⟧]+⟧/g, () => {
    const next = inSlots[i]!;
    if (outSlots[i] !== next) restored += 1;
    i += 1;
    return next;
  });
  return { text, restored };
}

/**
 * When the connective model drops some input `⟦w:⟧` slots, re-append the missing
 * markers with natural pads — prefer construction over LLM reject/retry loops
 * that burn minutes and hit Vercel 300s on P6 mark.
 *
 * Multiset semantics: input may repeat the same token (e.g. two `⟦w:正印⟧`).
 * Presence-only checks would skip the 2nd copy and still trip `mark_slots_dropped`.
 */
export function reinjectDroppedWordSlots(
  inputEvidence: string,
  outputEvidence: string,
): { text: string; reinjected: string[] } {
  const inSlots = listEvidenceWordSlotMarkers(inputEvidence);
  if (inSlots.length === 0) {
    return { text: outputEvidence ?? "", reinjected: [] };
  }
  let out = outputEvidence ?? "";
  const reinjected: string[] = [];
  const padIndex = { i: 0 };

  const slotKey = (slot: string): string => {
    const raw = slot.replace(/^⟦(?:w|词):/, "").replace(/⟧$/, "").trim();
    return raw.toLowerCase().replace(/\s+/g, "");
  };

  /** Remaining unmatched occurrences in output (consumed as we walk input). */
  const remaining = new Map<string, number>();
  for (const slot of listEvidenceWordSlotMarkers(out)) {
    const k = slotKey(slot);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }

  for (const slot of inSlots) {
    const k = slotKey(slot);
    const have = remaining.get(k) ?? 0;
    if (have > 0) {
      remaining.set(k, have - 1);
      continue;
    }
    const pad = nextSlotGapPad(padIndex);
    out = out.trimEnd();
    out = out ? `${out}${pad}${slot}` : slot;
    reinjected.push(slot);
  }
  if (reinjected.length > 0) {
    out = repairAdjacentWordSlotGaps(out);
  }
  return { text: out, reinjected };
}

/**
 * Soft (makeup=fail) reinject: same multiset drop repair as
 * {@link reinjectDroppedWordSlots}, but pads are soft causal clauses
 * (not banned empty-link「在机制上衔接」).
 * Typical fail: model swallows `⟦w:受制⟧` into「被压制住了」→ slots 6/7.
 */
export function reinjectDroppedWordSlotsForSoft(
  inputEvidence: string,
  outputEvidence: string,
): { text: string; reinjected: string[] } {
  const inSlots = listEvidenceWordSlotMarkers(inputEvidence);
  if (inSlots.length === 0) {
    return { text: outputEvidence ?? "", reinjected: [] };
  }
  let out = outputEvidence ?? "";
  const outCount = countEvidenceWordSlots(out);
  // Equal/over count: never append. 叠尾字 (流年丙午→流年丙午午) is ordinal-stamp
  // territory — key-mismatch reinject would invent a 16th slot (#26).
  if (outCount >= inSlots.length) {
    return { text: out, reinjected: [] };
  }
  const reinjected: string[] = [];
  const padIndex = { i: 0 };

  const slotKey = (slot: string): string => {
    const raw = slot.replace(/^⟦(?:w|词):/, "").replace(/⟧$/, "").trim();
    return raw.toLowerCase().replace(/\s+/g, "");
  };

  const remaining = new Map<string, number>();
  for (const slot of listEvidenceWordSlotMarkers(out)) {
    const k = slotKey(slot);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }

  for (const slot of inSlots) {
    const k = slotKey(slot);
    const have = remaining.get(k) ?? 0;
    if (have > 0) {
      remaining.set(k, have - 1);
      continue;
    }
    const pad = nextSoftClause(
      SOFT_STACK_CLAUSES_ZH,
      padIndex,
      MIN_ADJACENT_VERNACULAR_HAN,
    );
    out = out.trimEnd();
    out = out ? `${out}${pad}${slot}` : slot;
    reinjected.push(slot);
  }
  if (reinjected.length > 0) {
    out = assembleSoftConnectiveStructuralIfNeeded(out, "zh");
  }
  return { text: out, reinjected };
}

/** Same gap rule for any `⟧…⟦` after encode (`⟦t:⟧` soft marks). */
export function hasAdjacentSoftMarksWithoutVernacular(text: string): boolean {
  return hasAdjacentWordSlotsWithoutVernacular(text);
}

/** Soft/term mark immediately followed by 五行 run (耗元火土 / 锚元水) or EN leftover (锚元water). */
export function findSoftGluedElement(text: string): string | null {
  const t = text ?? "";
  const re = /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4}|wood|fire|earth|metal|water)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const soft = String(m[1] ?? "").split("|")[1]?.trim() ?? "";
    const els = m[2] ?? "";
    if (els && soft) return `${soft}${els}`;
    if (els) return els;
  }
  return null;
}

/**
 * Soft B: peel bare 五行 glued onto a mark (「午火⟧火势」→「午火⟧的势头」).
 * Keeps the following vernacular; drops only the echo atom(s). Category fix —
 * not a case phrase table. Hinge language follows locale (never inject 这边 into EN).
 */
export function peelSoftGluedWuxingConnective(
  text: string,
  locale = "zh",
): string {
  const zh = isZhLocale(locale);
  const bareHinge = zh ? "这边" : " here ";
  const peel = (slot: string, els: string, rest: string): string => {
    if (zh && rest.startsWith("势")) return `${slot}的势头${rest.slice(1)}`;
    if (zh && rest.startsWith("气")) return `${slot}的力气${rest.slice(1)}`;
    if (rest.trim().length > 0) return `${slot}${rest}`;
    return `${slot}${bareHinge}`;
  };
  let out = text ?? "";
  // Pre-encode: only when w-interior already holds the atom (true echo / 叠尾).
  out = out.replace(
    /(⟦(?:w|词):([^⟧]+)⟧)\s*([木火土金水]{1,4})([\u4e00-\u9fff]*)/g,
    (full, slot: string, interior: string, els: string, rest: string) => {
      if (![...els].every((ch) => interior.includes(ch))) return full;
      return peel(slot, els, rest ?? "");
    },
  );
  // Post-encode t-marks: any glued 五行 is illegal outside slots.
  out = out.replace(
    /(⟦t:[^⟧]+⟧)\s*([木火土金水]{1,4})([\u4e00-\u9fff]*)/g,
    (_m, slot: string, els: string, rest: string) => peel(slot, els, rest ?? ""),
  );
  // Latin leftovers after t-marks — hinge in target language.
  out = out.replace(
    /(⟦t:[^⟧]+⟧)\s*(wood|fire|earth|metal|water)\b/gi,
    (_m, slot: string) => `${slot}${bareHinge}`,
  );
  return out;
}

/**
 * Element name + soft mark + same element echo, e.g. 水元素⟦t:…|锚元|…⟧水
 */
export function findElementSoftElementEcho(text: string): string | null {
  const t = text ?? "";
  const re = new RegExp(`([${WUXING_RUN}])元素\\s*⟦t:([^⟧]+)⟧\\s*\\1`);
  const m = t.match(re);
  if (m) return m[0]!;
  const re2 = new RegExp(`([${WUXING_RUN}])\\s*⟦t:([^⟧]+)⟧\\s*\\1`);
  const m2 = t.match(re2);
  if (m2) {
    const soft = String(m2[2] ?? "").split("|")[1]?.trim() ?? "";
    if (soft.length >= 2) return m2[0]!;
  }
  return null;
}

/** Pad thin gaps between adjacent ⟦t:⟧ marks (post-encode). */
export function repairAdjacentSoftMarkGaps(text: string): string {
  return repairAdjacentWordSlotGaps(text);
}

/** Insert connective between soft mark and glued 五行 (localize EN leftovers first). */
export function repairSoftGluedElements(
  text: string,
  locale = "zh",
): string {
  const localized = isZhLocale(locale)
    ? localizeChartTokenForZh(text ?? "")
    : (text ?? "");
  const peeled = peelSoftGluedWuxingConnective(localized, locale);
  if (!findSoftGluedElement(peeled)) return peeled;
  // Fallback: keep element behind a vernacular hinge (legacy repair path).
  if (!isZhLocale(locale)) {
    return peeled.replace(
      /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4}|wood|fire|earth|metal|water)/gi,
      (_full, inner: string) => `⟦t:${inner}⟧ here `,
    );
  }
  return peeled.replace(
    /⟦t:([^⟧]+)⟧\s*([木火土金水]{1,4})/g,
    (_full, inner: string, els: string) => {
      return `⟦t:${inner}⟧所对应的${els}`;
    },
  );
}

export type SoftEvidenceGateResult =
  | { ok: true; text: string; notes: string[] }
  | { ok: false; reason: string; text: string; notes: string[] };

/**
 * Post-encode soft-layer gates (Batch1 C). Default: local repair then hard fail.
 * `makeup: fail` = v3 A-gate; glued 五行 echo is deterministic B-peel (not C strip).
 * `locale`: only zh runs EN→汉五行/极性本地化；en 连接里的 fire/wood 必须保持西文，禁被改成裸「火/木」。
 */
export function gateEncodedSoftEvidence(
  text: string,
  opts?: { makeup?: SoftMakeupMode; locale?: string },
): SoftEvidenceGateResult {
  const makeup = opts?.makeup ?? "repair";
  const locale = (opts?.locale ?? "zh").trim().toLowerCase() || "zh";
  const notes: string[] = [];
  let out = makeup === "fail" ? (text ?? "") : stripTemplateLeakPhrases(text ?? "");
  if (locale.startsWith("zh")) {
    out = localizeChartTokenForZh(out);
  }
  if (makeup === "fail") {
    const emptyPad = findEmptyConnectivePadPhrase(out);
    if (emptyPad) {
      return {
        ok: false,
        reason: `mark_empty_link_pad:${emptyPad}`,
        text: out,
        notes: [`mark_empty_link_pad:${emptyPad}`],
      };
    }
  }
  const leak = findTemplateLeakPhrase(out);
  if (leak) {
    return {
      ok: false,
      reason: `mark_template_leak:${leak}`,
      text: out,
      notes: [`mark_template_leak:${leak}`],
    };
  }

  if (hasAdjacentSoftMarksWithoutVernacular(out)) {
    if (makeup === "fail") {
      // Noun-stacks from composite `⟦w:大运戊戌偏印⟧` encode to adjacent `⟦t:⟧` — allowed.
    } else {
      out = repairAdjacentSoftMarkGaps(out);
      notes.push("soft_adjacent_repaired");
    }
  }
  if (makeup !== "fail" && hasAdjacentSoftMarksWithoutVernacular(out)) {
    return {
      ok: false,
      reason: "mark_adjacent_soft_gold",
      text: out,
      notes,
    };
  }

  if (findSoftGluedElement(out)) {
    out = repairSoftGluedElements(out, locale);
    notes.push("soft_glued_element_repaired");
  }
  const glued = findSoftGluedElement(out);
  if (glued) {
    return {
      ok: false,
      reason: `soft_glued_element:${glued}`,
      text: out,
      notes,
    };
  }

  const echo = findElementSoftElementEcho(out);
  if (echo) {
    return {
      ok: false,
      reason: `soft_element_echo:${echo.slice(0, 24)}`,
      text: out,
      notes,
    };
  }

  return { ok: true, text: out.trim(), notes };
}

/** Count `⟦w:…⟧` / `⟦词:…⟧` slots in evidence (connective gate). */
export function countEvidenceWordSlots(text: string): number {
  if (!text?.trim()) return 0;
  return [...text.matchAll(/⟦(?:w|词):[^⟧]+⟧/g)].length;
}

/**
 * After connective: map word-slots → ⟦t:slug|soft|…⟧ for the frontend.
 * Does NOT autoMark bare soft/jargon in the connective prose.
 * Unresolved slots must NOT become user-visible 【】 — throw for mark retry.
 * Runs soft-layer gate; throws Error with reason for callers that retry.
 */
export function encodeConnectiveEvidenceToTerms(
  text: string,
  locale: string,
  opts?: SoftEncodeOpts,
): string {
  const makeup = opts?.makeup ?? "repair";
  const store = opts?.store ?? (makeup === "fail" ? "slug_only" : "ssot_fill");
  if (!text?.trim()) return text ?? "";
  const work =
    makeup === "fail"
      ? dedupeSameCardWordSlots(text)
      : dedupeSameCardWordSlots(stripTemplateLeakPhrases(text));
  const slotted = encodeTraditionalWordSlots(work);
  if (slotted.unresolved.length > 0) {
    const sample = [...new Set(slotted.unresolved)].slice(0, 6).join(",");
    throw new Error(`unresolved_word_slot:${sample}`);
  }

  let out = slotted.text.replace(/\s*\n+\s*/g, " ").trim();
  const normalized = normalizeTermMarkerIds(out, locale);
  out =
    store === "slug_only"
      ? collapseMarkersToEmptySlots(normalized)
      : rewriteMarkersWithSsotSoft(normalized, locale);
  // zh: strip leftover EN element/polarity atoms after traditional encode
  if (locale.toLowerCase().startsWith("zh")) {
    out = localizeChartTokenForZh(out);
  }

  const still = listUnresolvedWordSlots(out);
  if (still.length > 0) {
    const sample = [...new Set(still)].slice(0, 6).join(",");
    throw new Error(`unresolved_word_slot:${sample}`);
  }
  out = stripSoftGlossEchoAfterMarkers(out);
  const gated = gateEncodedSoftEvidence(out, { makeup, locale });
  if (!gated.ok) {
    throw new Error(gated.reason);
  }
  if (gated.notes.length) {
    console.info("[delivery/code-mark] soft-layer notes", { notes: gated.notes });
  }
  return gated.text;
}

/**
 * Soft-preview for mark validate: encode then soft-gate without throw.
 */
export function previewSoftEvidenceForMark(
  wordSlotEvidence: string,
  locale: string,
  opts?: SoftEncodeOpts,
): SoftEvidenceGateResult {
  if (!wordSlotEvidence?.trim()) return { ok: true, text: "", notes: [] };
  try {
    const text = encodeConnectiveEvidenceToTerms(wordSlotEvidence, locale, opts);
    return { ok: true, text, notes: [] };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "soft_preview_fail";
    return { ok: false, reason, text: wordSlotEvidence, notes: [] };
  }
}

/**
 * Remove immediate soft-gloss echo after a term marker:
 * `⟦t:weak_self|需养|…⟧需养` → marker only.
 */
export function stripSoftGlossEchoAfterMarkers(text: string): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  return text.replace(/⟦t:([^⟧]+)⟧(\s*)([^\s⟦⟧，。；、,.!?]+)/g, (full, inner, ws, next) => {
    const soft = String(inner).split("|")[1]?.trim() ?? "";
    if (soft.length >= 2 && next === soft) {
      return `⟦t:${inner}⟧${ws ?? ""}`;
    }
    return full;
  });
}

/**
 * Evidence polish for sanitize paths.
 * If text already has ⟦w:⟧ / ⟦t:⟧ → encode-only / soft-gate (no autoMark).
 * Otherwise legacy full polish.
 */
export function polishMarkedEvidenceText(text: string, locale: string): string {
  const raw = text ?? "";
  if (/⟦(?:w|词|t):/.test(raw)) {
    try {
      if (/⟦(?:w|词):/.test(raw)) {
        return encodeConnectiveEvidenceToTerms(raw, locale);
      }
      let softOnly = stripTemplateLeakPhrases(raw);
      if (locale.toLowerCase().startsWith("zh")) {
        softOnly = localizeChartTokenForZh(softOnly);
      }
      const gated = gateEncodedSoftEvidence(softOnly, { locale });
      return gated.text;
    } catch {
      const fallback = stripTemplateLeakPhrases(raw);
      return locale.toLowerCase().startsWith("zh")
        ? localizeChartTokenForZh(fallback)
        : fallback;
    }
  }
  let legacy = encodeAndPolishDeliveryEvidence(raw, locale);
  if (locale.toLowerCase().startsWith("zh")) {
    legacy = localizeChartTokenForZh(legacy);
  }
  return legacy;
}
