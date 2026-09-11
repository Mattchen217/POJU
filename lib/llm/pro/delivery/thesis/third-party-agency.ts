/**
 * Known third-party agency gate (explanatory layer).
 *
 * Product拍板: do NOT enumerate volition verbs (反对/期望…).
 * Detect whether a consultation-known third party appears as an action/feeling
 * participant outside a small allowlist of *topic frames* (你与男友的关系议题…).
 *
 * Delivery-phase only — do not import into POJU_IDENTITY.
 */

import type { CoveredAgendaItem } from "@/lib/llm/pro/delivery/reality-constraints";

/**
 * Finite role lexicon used only to *scan* agenda/question text for mentions.
 * The per-job party set is the intersection of this lexicon with consultation prose
 * (plus any explicit longer labels we add later) — not a volition verb list.
 */
export const THIRD_PARTY_ROLE_LEXICON: readonly string[] = [
  "前男友",
  "前女友",
  "创业伙伴",
  "合作伙伴",
  "合作方",
  "发起人",
  "旧部",
  "男友",
  "女友",
  "伴侣",
  "配偶",
  "丈夫",
  "妻子",
  "老公",
  "老婆",
  "婆婆",
  "公公",
  "母亲",
  "父亲",
  "父母",
  "家人",
  "老板",
  "上司",
  "领导",
  "同事",
  "朋友",
  "伙伴",
  "对方",
  "他方",
  "别人",
].sort((a, b) => b.length - a.length);

export type ThirdPartyExtractSource = {
  covered_agenda?: readonly CoveredAgendaItem[] | null;
  original_question?: string | null;
  desired_outcome?: string | null;
  /** Already-built prompt blobs (feeds / reality / QE) — optional extra scan. */
  extra_blobs?: readonly (string | null | undefined)[];
};

/** Join consultation text used for party extraction. */
export function consultationTextForThirdPartyExtract(
  source: ThirdPartyExtractSource,
): string {
  const parts: string[] = [];
  const q = source.original_question?.trim();
  if (q) parts.push(q);
  const want = source.desired_outcome?.trim();
  if (want) parts.push(want);
  for (const item of source.covered_agenda ?? []) {
    if (item.label?.trim()) parts.push(item.label.trim());
    if (item.answer?.trim()) parts.push(item.answer.trim());
  }
  for (const b of source.extra_blobs ?? []) {
    if (b?.trim()) parts.push(b.trim());
  }
  return parts.join("\n");
}

/**
 * Extract known third-party role nouns mentioned in this consultation.
 * Longest-first; returns unique labels sorted longest-first for matching.
 */
export function extractKnownThirdParties(
  source: ThirdPartyExtractSource,
): string[] {
  const blob = consultationTextForThirdPartyExtract(source);
  if (!blob) return [];
  const found = new Set<string>();
  for (const role of THIRD_PARTY_ROLE_LEXICON) {
    if (blob.includes(role)) found.add(role);
  }
  return [...found].sort((a, b) => b.length - a.length);
}

/**
 * Also collect role nouns that appear in explanatory prose itself
 * (catches invented parties not in agenda).
 */
export function thirdPartiesMentionedInText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const found = new Set<string>();
  for (const role of THIRD_PARTY_ROLE_LEXICON) {
    if (t.includes(role)) found.add(role);
  }
  return [...found].sort((a, b) => b.length - a.length);
}

export function mergeThirdPartySets(
  ...sets: readonly (readonly string[])[]
): string[] {
  const found = new Set<string>();
  for (const s of sets) {
    for (const p of s) {
      const t = p.trim();
      if (t) found.add(t);
    }
  }
  return [...found].sort((a, b) => b.length - a.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Allowlist: party only as *topic* / *object of querent action*, not as agent.
 * Examples OK:
 * - 你与男友的关系议题
 * - 面对伙伴时
 * - 只能加入旧部的盘子（旧部 = 宾语/所属，非施事）
 */
export function isThirdPartyInTopicFrameOnly(
  text: string,
  party: string,
): boolean {
  const t = text.trim();
  if (!t || !party) return true;
  if (!t.includes(party)) return true;

  const p = escapeRe(party);
  // Strip all safe spans that contain this party, then see if party remains.
  const safeRes: RegExp[] = [
    new RegExp(
      `(?:你)?(?:在)?(?:与|跟|和|面对|关于|针对|相对)${p}(?:的)?(?:关系|议题|方面|之间|互动|张力|摩擦)?`,
      "g",
    ),
    new RegExp(`${p}(?:关系|议题|方面|之间)`, "g"),
    // Querent-as-agent, party as object / venue
    new RegExp(
      `(?:加入|进入|投奔|跟随|听从|配合)${p}(?:的)?(?:盘子|项目|公司|团队|局|安排)?`,
      "g",
    ),
    new RegExp(`跟${p}一起`, "g"),
    new RegExp(`与${p}(?:合作|创业|共事|一起)`, "g"),
    new RegExp(`${p}的(?:盘子|项目|公司|团队|局|安排)`, "g"),
  ];
  let stripped = t;
  for (const re of safeRes) {
    stripped = stripped.replace(re, "〔题〕");
  }
  return !stripped.includes(party);
}

/**
 * True when a known party appears outside topic frames in explanatory prose.
 * Hit string is for gate reason (party + short context), not a verb match.
 */
export function detectKnownThirdPartyAgency(
  text: string,
  knownParties: readonly string[],
): string | null {
  const t = text.trim();
  if (!t) return null;

  const parties = mergeThirdPartySets(
    knownParties,
    thirdPartiesMentionedInText(t),
  );
  if (parties.length === 0) return null;

  for (const party of parties) {
    if (!t.includes(party)) continue;
    if (isThirdPartyInTopicFrameOnly(t, party)) continue;

    // Structural causatives / querent-as-causer — always agency (绕写).
    const p = escapeRe(party);
    const causative = t.match(
      new RegExp(`(?:让|使|令|叫|导致|引发|催生|促使|逼)${p}|你(?:让|使|令|叫)${p}`),
    );
    if (causative) return causative[0]!;

    // Any remaining non-topic mention = party is participating in the claim.
    const idx = t.indexOf(party);
    const from = Math.max(0, idx - 4);
    const to = Math.min(t.length, idx + party.length + 12);
    return t.slice(from, to);
  }

  // Legacy leak tokens that never belong in natal explanatory layer.
  if (/合盘/.test(t)) return "合盘";
  if (/第三人/.test(t)) return "第三人";
  return null;
}

/**
 * Soft-repair: neutralize agency spans to querent-side pressure (rule 11).
 * Does not depend on volition verb lists.
 */
export function softRepairThirdPartyAgencyProse(
  text: string,
  knownParties: readonly string[] = [],
): string {
  const t = text.trim();
  if (!t || !detectKnownThirdPartyAgency(t, knownParties)) return t;

  const replacementFor = (blob: string): string => {
    if (/兼职|全职|试水/.test(blob)) {
      return "合局压力下你更难把兼职试水说出口";
    }
    if (/话语权|从属|加入|主导/.test(blob)) {
      return "结构上你更易处于配合而非主导";
    }
    if (
      /男友|女友|伴侣|配偶|夫妻|关系|亲密|恋爱|婚姻/.test(blob) ||
      knownParties.some((p) => /男友|女友|伴侣|配偶|老公|老婆/.test(p))
    ) {
      return "关系议题上你更难推动对你重要的变动";
    }
    return "你在结构上更易感到绑定与投入压力";
  };

  // Drop / rewrite sentences that still have agency.
  let out = t
    .split(/([。；;！？\n]+)/)
    .map((seg) => {
      if (!seg || /^[。；;！？\n]+$/.test(seg)) return seg;
      if (!detectKnownThirdPartyAgency(seg, knownParties)) return seg;
      return replacementFor(seg);
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Strip leftover party mentions outside topic frames.
  const parties = mergeThirdPartySets(
    knownParties,
    thirdPartiesMentionedInText(out),
  );
  for (const party of parties) {
    if (isThirdPartyInTopicFrameOnly(out, party)) continue;
    out = out.split(party).join("外部角色");
  }

  out = out
    .replace(/合盘/g, "本盘结构")
    .replace(/第三人/g, "外部角色")
    .replace(/外部角色外部角色/g, "外部角色")
    .trim();

  if (detectKnownThirdPartyAgency(out, knownParties)) {
    out = replacementFor(t);
  }
  return out || "你在本盘结构下承受该表象对应的约束与压力";
}

/** Intimacy / family roles — scheme C weld only for these, not 旧部/创业伙伴. */
const INTIMACY_ROLE_RE =
  /男友|女友|伴侣|配偶|丈夫|妻子|老公|老婆|前男友|前女友|家人|父母|母亲|父亲|婆婆|公公/;
const INTIMACY_TOPIC_RE =
  /恋爱|婚姻|分手|亲密关系|感情|夫妻宫|关系摩擦/;

/** Business-collaborator surfaces (career partner) — separate from intimacy C. */
const PARTNERSHIP_SURFACE_RE =
  /创业伙伴|旧部|合作方|发起人|话语权|兼职|全职|盘子|创业邀约/;

/**
 * Relationship-friction surface? (scheme C intimacy weld)
 * Only romantic/family — NOT “any known third party” (那会把创业伙伴焊成亲密关系腔).
 */
export function isRelationshipFrictionSurface(
  surfaceText: string,
  knownParties: readonly string[] = [],
): boolean {
  const blob = surfaceText.trim();
  if (!blob) return false;
  if (INTIMACY_TOPIC_RE.test(blob)) return true;
  if (INTIMACY_ROLE_RE.test(blob)) return true;
  return knownParties.some(
    (p) => INTIMACY_ROLE_RE.test(p) && blob.includes(p),
  );
}

/** Career / collaborator friction — querent-side weld, not intimacy wording. */
export function isPartnershipFrictionSurface(surfaceText: string): boolean {
  return PARTNERSHIP_SURFACE_RE.test(surfaceText.trim());
}

/** Fixed sentence for relationship_friction cards (scheme C · intimacy). */
export function relationshipFrictionInferenceTemplate(slug: string): string {
  const s = slug.trim() || "该结构";
  return `${s}使你在亲密关系议题上更易感到推进阻力；张力并存时，压力落在你侧的开口与节奏上。`;
}

/** Fixed sentence for partnership / 兼职试水 cards. */
export function partnershipFrictionInferenceTemplate(slug: string): string {
  const s = slug.trim() || "该结构";
  return `${s}使你在合作推进上更易处于配合位；开口试水或争取节奏时，压力落在你侧。`;
}
