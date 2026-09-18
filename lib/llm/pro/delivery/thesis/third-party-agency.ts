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
    // P3 一层示意：问主侧约谈/同步（宾语框，非替对方施事）
    new RegExp(`约${p}`, "g"),
    new RegExp(
      `(?:与|跟|和)${p}(?:进行)?(?:一次)?(?:无干扰的)?(?:深度)?(?:对话|沟通|商量|复盘|同步)`,
      "g",
    ),
    new RegExp(`向${p}(?:同步|说明|提出|表达)`, "g"),
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

/** Soft-repair shells that must not become user-facing strategy/means. */
const SCIENCE_SOFT_REPAIR_SHELLS: readonly string[] = [
  "本周选定一次你可开口的时间窗口，只陈述你侧身心极限与观察期请求——不写逐字开口稿、不代演对话。",
  "你在结构上更易感到绑定与投入压力",
  "关系议题上你更难推动对你重要的变动",
  "合局压力下你更难把兼职试水说出口",
  "结构上你更易处于配合而非主导",
  "你在本盘结构下承受该表象对应的约束与压力",
];

/** @deprecated Kept for regression string checks; soft-repair no longer stamps this into pages. */
export const SCIENCE_QUERENT_OPENING_HINT = SCIENCE_SOFT_REPAIR_SHELLS[0]!;

export function isScienceSoftRepairShell(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return SCIENCE_SOFT_REPAIR_SHELLS.some((s) => t === s);
}

/**
 * Full dialogue script / 逐字开口稿 in science user prose.
 * Quoted speech or multi-beat coaching-to-other = script.
 * 「说服男友 / 让他看见」alone is agency (softRepairThirdPartyAgency), not a dialogue script.
 */
export function isFullDialogueScriptProse(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[“"][^”"]{12,}[”"]/.test(t)) return true;
  const hasOther = /(?:他|对方|男友|女友|伴侣|家人)/.test(t);
  if (!hasOther) return false;
  const coaching = (
    t.match(
      /先(?:认可|说出)他|对话时先|接着表达|最后提出|他怕你|然后分享你|定期向他/g,
    ) ?? []
  ).length;
  return coaching >= 2;
}

/**
 * Strip quoted speech + dialogue-coaching beats. Returns "" if nothing usable remains.
 * Never injects a relationship opening template (that homogenized whole pages).
 * Agency phrases (说服男友/让他看见) are left for softRepairThirdPartyAgencyProse.
 */
export function collapseDialogueScriptProse(text: string): string {
  const t = text.trim();
  if (!t || !isFullDialogueScriptProse(t)) return t;
  let stripped = t
    .replace(/[“"][^”"]{8,}[”"]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const parts = stripped.split(/([。；;！？\n]+)/);
  let kept = "";
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i] ?? "";
    if (!seg) continue;
    if (/^[。；;！？\n]+$/.test(seg)) {
      if (kept && !/[。；;！？\n]$/.test(kept)) kept += seg;
      continue;
    }
    if (
      /先(?:认可|说出)他|对话时先|接着表达|最后提出|他怕你|然后分享你|定期向他|向他同步/.test(
        seg,
      )
    ) {
      continue;
    }
    kept += seg;
    const punct = parts[i + 1];
    if (punct && /^[。；;！？\n]+$/.test(punct)) {
      kept += punct;
      i += 1;
    }
  }
  kept = kept.replace(/\s{2,}/g, " ").trim();
  // Remaining agency (说服男友…) is OK here — softRepairThirdPartyAgencyProse handles it.
  if (kept.length < 24) return "";
  return kept;
}

export type ScienceAngleSoftRepairResult = {
  strategy: string;
  means: string[];
  /** When set, sanitize must drop the angle (→ angles_lt_3 / 纠错), not ship shells. */
  fail_reason: string | null;
};

/**
 * P3 science angle user prose soft-repair (rule 11):
 * - Strip dialogue scripts / third-party agency from strategy
 * - Drop script/shell means (do not stamp relationship hint onto sleep/career angles)
 * - If strategy collapses to a known soft-repair shell → fail (prefer 纠错 over假绿空壳页)
 */
export function softRepairScienceAngleUserProse(
  strategy: string,
  means: readonly string[],
  notes: string[],
  tag: string,
): ScienceAngleSoftRepairResult {
  const original = strategy.trim();
  let s = original;
  let ranDialogueCollapse = false;
  if (isFullDialogueScriptProse(s)) {
    const collapsed = collapseDialogueScriptProse(s);
    notes.push(`soft_repair_science_dialogue_script:${tag}_strategy`);
    s = collapsed;
    ranDialogueCollapse = true;
  }
  if (s) {
    const beforeAgency = s;
    s = softRepairThirdPartyAgencyProse(s, []);
    if (s !== beforeAgency) {
      notes.push(`soft_repair_third_party_strategy:${tag}`);
    }
  }
  // Fail only on empty / known shells / collapse left a stub — not on short-but-valid strategies.
  if (!s || isScienceSoftRepairShell(s)) {
    notes.push(`${tag}_science_strategy_collapsed_to_shell`);
    return {
      strategy: s || "",
      means: [],
      fail_reason: "science_strategy_collapsed_to_shell",
    };
  }
  if (ranDialogueCollapse && s.length < 40) {
    notes.push(`${tag}_science_strategy_collapsed_to_shell`);
    return {
      strategy: s,
      means: [],
      fail_reason: "science_strategy_collapsed_to_shell",
    };
  }
  if (detectKnownThirdPartyAgency(s, [])) {
    notes.push(`${tag}_third_party_agency_in_strategy`);
    return {
      strategy: s,
      means: [],
      fail_reason: "third_party_agency_in_strategy",
    };
  }

  const outMeans: string[] = [];
  for (let i = 0; i < means.length; i++) {
    const before = (means[i] ?? "").trim();
    if (!before) continue;
    if (isFullDialogueScriptProse(before)) {
      notes.push(`drop_science_dialogue_script_mean:${tag}_${i}`);
      continue;
    }
    let m = softRepairThirdPartyAgencyProse(before, []);
    if (m !== before) {
      notes.push(`soft_repair_third_party_means:${tag}_${i}`);
    }
    if (
      !m ||
      isScienceSoftRepairShell(m) ||
      detectKnownThirdPartyAgency(m, [])
    ) {
      notes.push(`drop_science_shell_or_agency_mean:${tag}_${i}`);
      continue;
    }
    if (!outMeans.includes(m)) outMeans.push(m);
  }
  if (outMeans.length === 0) {
    notes.push(`${tag}_science_means_empty_after_soft_repair`);
    return {
      strategy: s,
      means: [],
      fail_reason: "science_means_empty_after_soft_repair",
    };
  }
  return { strategy: s, means: outMeans, fail_reason: null };
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

/**
 * Write-layer evidence soft-repair (rule 11).
 * Keeps ⟦w:slug⟧; welds intimacy/partnership templates when agency leaks;
 * never LLM-retries quality.
 */
export function softRepairWriteEvidenceProse(input: {
  evidence: string;
  slug: string;
  calc_cite?: string | null;
  unit_claim?: string | null;
  inference_zh?: string | null;
  known_parties?: readonly string[];
}): { evidence: string; repaired: boolean; still_dirty: boolean; hit: string | null } {
  const parties = input.known_parties ?? [];
  const slug = input.slug.trim() || "该结构";
  const raw = input.evidence.trim();
  if (!raw) {
    return { evidence: raw, repaired: false, still_dirty: false, hit: null };
  }

  const ensureWTag = (text: string): string => {
    if (text.includes(`⟦w:${slug}⟧`)) return text;
    if (text.startsWith(slug)) return `⟦w:${slug}⟧${text.slice(slug.length)}`;
    return `⟦w:${slug}⟧${text}`;
  };

  const surfaceBlob = `${input.calc_cite ?? ""}\n${input.unit_claim ?? ""}`;
  const hit0 = detectKnownThirdPartyAgency(raw, parties);
  let evidence = softRepairThirdPartyAgencyProse(raw, parties);
  let repaired = evidence !== raw;

  const intimacy = isRelationshipFrictionSurface(surfaceBlob, parties);
  const partnership =
    !intimacy && isPartnershipFrictionSurface(surfaceBlob);
  const stillAfterSoft = detectKnownThirdPartyAgency(evidence, parties);

  const seed = (input.inference_zh ?? "").trim();
  const seedClean =
    seed && !detectKnownThirdPartyAgency(seed, parties) ? seed : "";

  const needsWeld =
    Boolean(hit0) ||
    Boolean(stillAfterSoft) ||
    (intimacy && /反对|价值否定|视为风险|抵触/.test(raw));

  if (needsWeld && intimacy) {
    const mechanism = seedClean || relationshipFrictionInferenceTemplate(slug);
    evidence = `就你侧的结构感受而言：${ensureWTag(mechanism)}`;
    repaired = true;
  } else if (needsWeld && partnership) {
    const mechanism = seedClean || partnershipFrictionInferenceTemplate(slug);
    evidence = `就你侧的结构感受而言：${ensureWTag(mechanism)}`;
    repaired = true;
  } else if (hit0 || stillAfterSoft) {
    const mechanism =
      seedClean ||
      softRepairThirdPartyAgencyProse(seed || raw, parties) ||
      "你在本盘结构下承受该表象对应的约束与压力";
    evidence = `就本案表象在你侧的压力而言：${ensureWTag(mechanism)}`;
    repaired = true;
  } else if (slug && /⟦w:/.test(raw) && !evidence.includes(`⟦w:${slug}⟧`)) {
    evidence = ensureWTag(evidence);
    repaired = true;
  }

  const hit = detectKnownThirdPartyAgency(evidence, parties);
  return {
    evidence: evidence.trim(),
    repaired,
    still_dirty: hit != null || !evidence.includes("⟦w:"),
    hit,
  };
}
