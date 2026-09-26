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
    // Agenda label / cite topic:「对方对兼职的反应」「伙伴的态度」
    new RegExp(`${p}对[^。；\n]{0,24}的(?:反应|态度|接受度|依赖)`, "g"),
    new RegExp(`${p}的(?:反应|态度|接受度)`, "g"),
    // Reality constraint (P3 可执行)：资源/盘在对方侧；对方为发起人/资源方（名词框，非替其做心理）
    new RegExp(`${p}(?:侧|那边|手里)(?:的)?(?:资源|项目|盘|门槛)?`, "g"),
    new RegExp(`(?:资源|项目|盘)(?:主要)?在${p}(?:侧|那边|手里)?`, "g"),
    new RegExp(`${p}(?:是|为|作为)(?:发起人|资源方|合作方|合伙人)`, "g"),
    new RegExp(`若${p}(?:拒绝|不接受|坚持|要求)`, "g"),
    new RegExp(`${p}(?:拒绝|不接受)(?:兼职|全职|试水)?`, "g"),
    // Partnership scene: counterpart pressure as *condition*; querent acts after.
    new RegExp(
      `(?:当|在)?${p}(?:再次)?(?:施压|催促|画饼|要求|拒绝)(?:全职|兼职|试水)?(?:时|场)?`,
      "g",
    ),
    new RegExp(`${p}催促场`, "g"),
    new RegExp(`${p}火阵`, "g"),
    new RegExp(`被${p}的(?:急躁|催促|节奏|高压|火势)`, "g"),
    new RegExp(`${p}的(?:急躁|高压)`, "g"),
    new RegExp(`${p}施加的(?:全职|兼职)?压力`, "g"),
    new RegExp(`不被${p}的(?:节奏|催促|画饼)(?:裹挟)?`, "g"),
    new RegExp(`不因${p}(?:画饼|催促|施压)`, "g"),
    new RegExp(`${p}的节奏裹挟`, "g"),
    new RegExp(`被${p}的节奏带着走`, "g"),
    new RegExp(`(?:观察|看)${p}诚意`, "g"),
    new RegExp(`和${p}诚意`, "g"),
    new RegExp(`发给${p}`, "g"),
    new RegExp(`(?:明确)?告诉${p}`, "g"),
    new RegExp(`由于${p}资源主导`, "g"),
    new RegExp(`${p}资源主导(?:的格局)?`, "g"),
    new RegExp(`等待${p}画饼`, "g"),
    new RegExp(`${p}的[“"]全职要求[”"]`, "g"),
    // Counterpart pressure as object of querent-side retune (泄掉/转化), not替对方施事
    new RegExp(`泄掉${p}的催促(?:压力)?`, "g"),
    new RegExp(`${p}的催促(?:压力)?`, "g"),
    // Visibility / acceptance / indispensability — querent-side, party as object
    new RegExp(`让${p}看到`, "g"),
    new RegExp(`让${p}承认`, "g"),
    new RegExp(`倒逼${p}承认`, "g"),
    new RegExp(`${p}无法绕开`, "g"),
    new RegExp(`${p}无法(?:短期)?(?:复制|替代|绕开)`, "g"),
    new RegExp(`${p}也更容易接受`, "g"),
    new RegExp(`${p}体系`, "g"),
    new RegExp(`融入${p}(?:体系|项目)?`, "g"),
    new RegExp(`注入${p}(?:的)?项目`, "g"),
    new RegExp(`与${p}在股权`, "g"),
    new RegExp(
      `(?:当|在)?${p}(?:以)?[“"]?全职[^”"]{0,12}[”"]?(?:施压|催促)?`,
      "g",
    ),
    new RegExp(`${p}频繁画饼`, "g"),
    new RegExp(`催促你立刻决定的对话`, "g"),
    new RegExp(`摸清${p}真实意图`, "g"),
    new RegExp(`借${p}平台`, "g"),
    new RegExp(`${p}资源分布`, "g"),
    // Counterpart stance as *window signal* / condition (querent retune), not agency
    new RegExp(
      `将${p}[“"「]?[^”"」]{0,24}[”"」]?的?(?:强硬)?态度[，,]?视为`,
      "g",
    ),
    new RegExp(`${p}的(?:强硬)?态度`, "g"),
    new RegExp(`把${p}的(?:要求|催促|画饼|态度)当作(?:窗口|信号)?`, "g"),
    new RegExp(`${p}团队`, "g"),
    new RegExp(`${p}是资源(?:发起方|方|主导)`, "g"),
    new RegExp(`${p}(?:是|为|作为)(?:发起人|资源方|资源发起方|合作方|合伙人)`, "g"),
    // Object of replaceability:「可以找别人」「换成别人」— not agency
    new RegExp(`(?:找|请|换|用|雇)${p}`, "g"),
    // P3 一层示意：问主侧约谈/同步（宾语框，非替对方施事）
    new RegExp(`约${p}`, "g"),
    new RegExp(
      `(?:与|跟|和)${p}(?:进行)?(?:一次)?(?:无干扰的)?(?:深度)?(?:对话|沟通|商量|复盘|同步|谈判)`,
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

/** Partner already refused part-time / set full-time gate — not「你难开口」. */
const PARTNERSHIP_REJECTION_SURFACE_RE =
  /拒绝|不同意|不接受|必须全职|才给核心|直接拒绝|全职才能/;

/** Covered fact: counterpart already rejected part-time / demanded full-time. */
export function isPartnershipRejectionSurface(surfaceText: string): boolean {
  const t = surfaceText.trim();
  if (!t) return false;
  if (!PARTNERSHIP_REJECTION_SURFACE_RE.test(t)) return false;
  return /兼职|全职|核心|合伙|合作|反应|接受/.test(t);
}

/** Tech / output replaceability surfaces → expression_creativity (食神). */
export function isTechOutputSurface(surfaceText: string): boolean {
  return /技术|壁垒|执行者|替代技术|可替换|输出能力/.test(surfaceText.trim());
}

/** Legal / advisor resource surfaces — not peer 比肩. */
export function isLegalAdvisorSurface(surfaceText: string): boolean {
  return /律师|顾问|合同|书面|法务|协议/.test(surfaceText.trim());
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
    if (isPartnershipRejectionSurface(blob)) {
      return "全职门槛已立时，结构上你更易落入配合与让步位";
    }
    if (/兼职|全职|试水/.test(blob)) {
      return "合局压力下你更难把兼职试水说出口";
    }
    if (isTechOutputSurface(blob)) {
      return "你的技术输出在结构上更易被当成可替换的执行位";
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
  "全职门槛已立时，结构上你更易落入配合与让步位",
  "你的技术输出在结构上更易被当成可替换的执行位",
  "结构上你更易处于配合而非主导",
  "你在本盘结构下承受该表象对应的约束与压力",
];

/** @deprecated Kept for regression string checks; soft-repair no longer stamps this into pages. */
export const SCIENCE_QUERENT_OPENING_HINT = SCIENCE_SOFT_REPAIR_SHELLS[0]!;

export function isScienceSoftRepairShell(text: string): boolean {
  const t = text
    .trim()
    .replace(/^[「『"']+|[」』"']+$/g, "")
    .replace(/[。．.！？!?；;…]+$/g, "")
    .trim();
  if (!t) return true;
  return SCIENCE_SOFT_REPAIR_SHELLS.some((s) => {
    const core = s.replace(/[。．.！？!?；;…]+$/g, "").trim();
    if (!core) return false;
    // Exact or mean that is only the shell (+ tiny trailing noise)
    return t === core || (t.startsWith(core) && t.length <= core.length + 4);
  });
}

/** Strip shell sentences glued into longer strategy (fill#4 lead-in leak). */
export function stripEmbeddedScienceSoftRepairShells(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const parts = t.split(/([。；;！？\n]+)/);
  let kept = "";
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i] ?? "";
    if (!seg) continue;
    if (/^[。；;！？\n]+$/.test(seg)) {
      if (kept && !/[。；;！？\n]$/.test(kept)) kept += seg;
      continue;
    }
    if (isScienceSoftRepairShell(seg)) continue;
    kept += seg;
    const punct = parts[i + 1];
    if (punct && /^[。；;！？\n]+$/.test(punct)) {
      kept += punct;
      i += 1;
    }
  }
  return kept.replace(/\s{2,}/g, " ").trim();
}

/** Soft-repair / model left truncated debris (变成。 / 框架： / 对的执念). */
export function isTruncatedScienceStrategy(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/[：:]\s*$/.test(t)) return true;
  if (/变成。\s*/.test(t)) return true;
  if (/就会软化，变成/.test(t)) return true;
  if (/沟通时可以用这样的框架/.test(t)) return true;
  // Object deleted mid-phrase (第三方软修或模型避写「对方」后的残句)
  if (/对的执念|形成的体感|而是这个事实|：比如。|比如。\s|挂钩：比如/.test(t)) {
    return true;
  }
  if (/如果是后者/.test(t) && !/前者|如果是前者|两种|两种里/.test(t)) {
    return true;
  }
  // Empty clause after colon / dangling 「比如」
  if (/[：:]\s*[。；;\n]/.test(t)) return true;
  return false;
}

const HE_ANAPHORA_AGENCY_RE =
  /(?:让|说服|请求|邀请)他|他(?:担心|害怕|焦虑|反对|更)|对他的(?:担忧|反对|期望)|先认可他的|他同意/;

/**
 * When intimacy roles already appear in the angle, neutralize 他-anaphora agency
 * (他担心/让他/说服他…) that the noun-based detector misses after topic-frame strip.
 * `force`: still rewrite 他-agency after soft-repair removed the 男友 noun.
 */
export function softRepairIntimacyAnaphoraProse(
  text: string,
  opts?: { force?: boolean },
): string {
  const t = text.trim();
  if (!t) return t;
  if (!opts?.force && !/(?:男友|女友|伴侣|家人|父母|配偶)/.test(t)) return t;

  return t
    .split(/([。；;！？\n]+)/)
    .map((seg) => {
      if (!seg || /^[。；;！？\n]+$/.test(seg)) return seg;
      if (!HE_ANAPHORA_AGENCY_RE.test(seg)) return seg;
      if (/观察期|半年/.test(seg)) {
        return "你侧把身心极限与观察期请求说清楚，把对立收成共同面对的议题";
      }
      return "你侧先把身心极限与边界说清楚，不把推进力押在说服关系对象上";
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasResidualIntimacyAnaphoraAgency(
  text: string,
  opts?: { force?: boolean },
): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!opts?.force && !/(?:男友|女友|伴侣|家人|父母|配偶)/.test(t)) return false;
  return HE_ANAPHORA_AGENCY_RE.test(t);
}

/**
 * Full dialogue script / 逐字开口稿 in science user prose.
 * Quoted speech or multi-beat coaching-to-other = script.
 * 「说服男友 / 让他看见」alone is agency (softRepairThirdPartyAgency), not a dialogue script.
 */
export function isFullDialogueScriptProse(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Long quoted speech / multi-quote scripts — not short role labels（「技术架构负责人」）
  if (/[“"][^”"]{20,}[”"]/.test(t)) return true;
  // Speech verbs must be real coaching-to-other — NOT substring hits like 问题/说明
  const speechToOther =
    /告诉|开口|回复|说道|问他|问她|问你|跟他说|对他说|开口说/.test(t);
  if ((t.match(/[“「]/g) ?? []).length >= 2 && speechToOther) {
    return true;
  }
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
  const intimacyCtx =
    /(?:男友|女友|伴侣|家人|父母|配偶)/.test(original) ||
    /关系|沟通|破冰|观察期|亲密/.test(original);
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
    const beforeAna = s;
    s = softRepairIntimacyAnaphoraProse(s, { force: intimacyCtx });
    if (s !== beforeAna) {
      notes.push(`soft_repair_intimacy_anaphora_strategy:${tag}`);
    }
    const beforeStrip = s;
    s = stripEmbeddedScienceSoftRepairShells(s);
    if (s !== beforeStrip) {
      notes.push(`strip_science_soft_repair_shell_sentence:${tag}`);
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
  if (isTruncatedScienceStrategy(s)) {
    notes.push(`${tag}_science_strategy_truncated`);
    return {
      strategy: s,
      means: [],
      fail_reason: "science_strategy_truncated",
    };
  }
  if (
    detectKnownThirdPartyAgency(s, []) ||
    hasResidualIntimacyAnaphoraAgency(s, { force: intimacyCtx })
  ) {
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
    const beforeAna = m;
    m = softRepairIntimacyAnaphoraProse(m, { force: intimacyCtx });
    if (m !== beforeAna) {
      notes.push(`soft_repair_intimacy_anaphora_means:${tag}_${i}`);
    }
    m = stripEmbeddedScienceSoftRepairShells(m);
    if (
      !m ||
      isScienceSoftRepairShell(m) ||
      detectKnownThirdPartyAgency(m, []) ||
      hasResidualIntimacyAnaphoraAgency(m, { force: intimacyCtx })
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

/** Fixed sentence for partnership / 兼职试水 cards (expectation / hard-to-open). */
export function partnershipFrictionInferenceTemplate(slug: string): string {
  const s = slug.trim() || "该结构";
  return `${s}使你在合作推进上更易处于配合位；开口试水或争取节奏时，压力落在你侧。`;
}

/** Fixed sentence when covered fact is already-rejected part-time / full-time gate. */
export function partnershipRejectionInferenceTemplate(slug: string): string {
  const s = slug.trim() || "该结构";
  return `${s}使你在全职门槛已立时更易落入配合与让步位；议价与节奏压力落在你侧，而非「还没开口」。`;
}

const WRITE_FRICTION_SHELL_PREFIX =
  /^(?:就你侧的结构感受而言|就本案表象在你侧的压力而言)[:：]/;

const ASSIGN_CLAIM_PASTE_RE =
  /本卡须证明[：:]|末卡收束[：:]由/;

/**
 * Soft-repair weld left only the short intimacy/partnership shell
 * (no path-serving 。 clauses). Lab: merge/fill 前必须消。
 */
export function isWriteFrictionShellEvidence(evidence: string): boolean {
  const t = evidence.trim();
  if (ASSIGN_CLAIM_PASTE_RE.test(t)) return true;
  if (!WRITE_FRICTION_SHELL_PREFIX.test(t)) {
    // Rejection / partnership one-liner (± ⟦w:⟧) without real path clauses.
    const body = t.replace(/⟦w:[^⟧]+⟧/g, "").trim();
    const stops = (body.match(/[。！？]/g) ?? []).length;
    if (
      /全职门槛已立时更易落入配合与让步位/.test(body) &&
      stops < 2 &&
      body.length < 160
    ) {
      return true;
    }
    if (
      /合作推进上更易处于配合位/.test(body) &&
      body.length < 120 &&
      stops < 2
    ) {
      return true;
    }
    return false;
  }
  const body = t.replace(WRITE_FRICTION_SHELL_PREFIX, "").trim();
  // Shell uses ； only — no sentence-final 。！？ means still the one-liner weld.
  if (!/[。！？]/.test(body)) return true;
  return body.length < 72;
}

function scrubLockProseForWriteExpand(
  text: string,
  parties: readonly string[],
): string {
  let t = softRepairThirdPartyAgencyProse((text ?? "").trim(), parties);
  t = t
    .replace(/[“"][^”"]{6,}[”"]/g, "")
    .replace(/^做「[^」]{0,80}」/g, "")
    .replace(/^护栏：避开「[^」]{0,80}」/g, "护栏：")
    .replace(/^执行中易踩的假进展\/盲区：/g, "")
    .replace(/^停主切辅条件：转向「辅轨」/g, "须停主切辅")
    .replace(/^停主切辅条件：转向「[^」]{1,40}」/g, "须停主切辅")
    .replace(/^此表象说明结构上：/g, "")
    .replace(/^本卡须证明[：:][\s\S]*/g, "")
    .replace(/本卡须证明[：:][^。；]*/g, "")
    .replace(/^末卡收束[：:][\s\S]*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

/**
 * Expand past the short friction weld using claim/cite (querent-side).
 * Always ≥1 。-terminated clause after the mechanism seed.
 */
export function expandWriteEvidencePastFrictionShell(input: {
  slug: string;
  calc_cite?: string | null;
  unit_claim?: string | null;
  inference_zh?: string | null;
  intimacy: boolean;
  known_parties?: readonly string[];
}): string {
  const parties = input.known_parties ?? [];
  const slug = input.slug.trim() || "该结构";
  const seed = (input.inference_zh ?? "").trim();
  const seedClean =
    seed && !detectKnownThirdPartyAgency(seed, parties) ? seed : "";
  const surfaceBlob = `${input.calc_cite ?? ""}\n${input.unit_claim ?? ""}`;
  const rejection =
    !input.intimacy && isPartnershipRejectionSurface(surfaceBlob);
  const mechanism =
    seedClean ||
    (input.intimacy
      ? relationshipFrictionInferenceTemplate(slug)
      : rejection
        ? partnershipRejectionInferenceTemplate(slug)
        : partnershipFrictionInferenceTemplate(slug));

  const ensureWTag = (text: string): string => {
    if (text.includes(`⟦w:${slug}⟧`)) return text;
    if (text.startsWith(slug)) return `⟦w:${slug}⟧${text.slice(slug.length)}`;
    return `⟦w:${slug}⟧${text}`;
  };

  const claim = scrubLockProseForWriteExpand(input.unit_claim ?? "", parties);
  const cite = scrubLockProseForWriteExpand(input.calc_cite ?? "", parties);

  const clauses: string[] = [];
  clauses.push(ensureWTag(mechanism.replace(/[。；;]+$/g, "")));

  const pushUnique = (raw: string) => {
    const s = raw.replace(/[。；;]+$/g, "").trim();
    if (s.length < 10) return;
    if (isScienceSoftRepairShell(s)) return;
    if (clauses.some((c) => c.includes(s.slice(0, 16)) || s.includes(c.slice(0, 16)))) {
      return;
    }
    if (detectKnownThirdPartyAgency(s, parties)) return;
    clauses.push(s);
  };

  if (claim) pushUnique(claim);
  if (cite && cite !== claim) pushUnique(cite);

  if (rejection && clauses.length < 3) {
    pushUnique(
      "全职门槛已立后，合作宫摩擦压缩你侧议价空间，节奏只能从让步位重开",
    );
  }

  if (clauses.length < 2) {
    pushUnique(
      input.intimacy
        ? "推进主路径时若开口与节奏已失控、无法停顿回血，须立即熔断当前动作并退回休整"
        : "推进主路径时若配合位过耗或节奏失控，须立即熔断当前动作并退回休整",
    );
  }

  return `${clauses.join("。")}。`.replace(/。{2,}/g, "。").trim();
}

/**
 * Write-layer evidence soft-repair (rule 11).
 * Keeps ⟦w:slug⟧; welds intimacy/partnership templates when agency leaks;
 * never LLM-retries quality. Short friction shells are expanded from claim/cite.
 */
export function softRepairWriteEvidenceProse(input: {
  evidence: string;
  slug: string;
  calc_cite?: string | null;
  unit_claim?: string | null;
  inference_zh?: string | null;
  known_parties?: readonly string[];
  /** Default true. False on science/P4/P5/P6 — agency soft-repair only, no intimacy template. */
  allow_friction_weld?: boolean;
}): { evidence: string; repaired: boolean; still_dirty: boolean; hit: string | null } {
  const parties = input.known_parties ?? [];
  const slug = input.slug.trim();
  const raw = input.evidence.trim();
  if (!raw) {
    return { evidence: raw, repaired: false, still_dirty: false, hit: null };
  }

  const ensureWTag = (text: string): string => {
    if (text.includes(`⟦w:${slug}⟧`)) return text;
    if (text.startsWith(slug)) return `⟦w:${slug}⟧${text.slice(slug.length)}`;
    return `⟦w:${slug}⟧${text}`;
  };

  const allowFrictionWeld = input.allow_friction_weld !== false;
  const surfaceBlob = `${input.calc_cite ?? ""}\n${input.unit_claim ?? ""}`;
  const hit0 = detectKnownThirdPartyAgency(raw, parties);
  let evidence = softRepairThirdPartyAgencyProse(raw, parties);
  let repaired = evidence !== raw;

  const intimacy =
    allowFrictionWeld && isRelationshipFrictionSurface(surfaceBlob, parties);
  const partnership =
    allowFrictionWeld &&
    !intimacy &&
    isPartnershipFrictionSurface(surfaceBlob);
  const stillAfterSoft = detectKnownThirdPartyAgency(evidence, parties);

  if (!slug) {
    const stillShell = isWriteFrictionShellEvidence(evidence);
    const claimPaste = /本卡须证明|末卡收束[：:]由/.test(evidence);
    return {
      evidence: evidence.trim(),
      repaired,
      still_dirty: stillAfterSoft != null || stillShell || claimPaste,
      hit: stillAfterSoft ?? (stillShell || claimPaste ? "friction_shell" : null),
    };
  }

  const seed = (input.inference_zh ?? "").trim();
  const seedClean =
    seed && !detectKnownThirdPartyAgency(seed, parties) ? seed : "";

  const needsWeld =
    Boolean(hit0) ||
    Boolean(stillAfterSoft) ||
    (intimacy && /反对|价值否定|视为风险|抵触/.test(raw));

  if (needsWeld && (intimacy || partnership)) {
    evidence = expandWriteEvidencePastFrictionShell({
      slug,
      calc_cite: input.calc_cite,
      unit_claim: input.unit_claim,
      inference_zh: seedClean || input.inference_zh,
      intimacy: intimacy || !partnership,
      known_parties: parties,
    });
    repaired = true;
  } else if (hit0 || stillAfterSoft) {
    const mechanism =
      seedClean ||
      softRepairThirdPartyAgencyProse(seed || raw, parties) ||
      "你在本盘结构下承受该表象对应的约束与压力";
    evidence = expandWriteEvidencePastFrictionShell({
      slug,
      calc_cite: input.calc_cite,
      unit_claim: input.unit_claim,
      inference_zh: mechanism,
      intimacy: false,
      known_parties: parties,
    });
    repaired = true;
  } else if (slug && /⟦w:/.test(raw) && !evidence.includes(`⟦w:${slug}⟧`)) {
    evidence = ensureWTag(evidence);
    repaired = true;
  }

  // Incoming short shell (prior soft-repair debt) → expand even without agency hit.
  if (isWriteFrictionShellEvidence(evidence)) {
    evidence = expandWriteEvidencePastFrictionShell({
      slug,
      calc_cite: input.calc_cite,
      unit_claim: input.unit_claim,
      inference_zh: seedClean || input.inference_zh,
      intimacy:
        allowFrictionWeld &&
        (intimacy || isRelationshipFrictionSurface(evidence, parties)),
      known_parties: parties,
    });
    repaired = true;
  }

  const hit = detectKnownThirdPartyAgency(evidence, parties);
  const stillShell = isWriteFrictionShellEvidence(evidence);
  const claimPaste = /本卡须证明|末卡收束[：:]由/.test(evidence);
  return {
    evidence: evidence.trim(),
    repaired,
    still_dirty:
      hit != null || !evidence.includes("⟦w:") || stillShell || claimPaste,
    hit: hit ?? (stillShell || claimPaste ? "friction_shell" : null),
  };
}
