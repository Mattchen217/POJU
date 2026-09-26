/**
 * Fact-pack assign (P3–P6): category gates for unit_claim + calc_cite.
 * Foundation uses inventory pick_ids instead — do not route it here.
 *
 * Iron laws 14–15: categories only; **prompt/page duty is primary**;
 * this gate only verifies the same scale. Soft-repair cites when possible
 * (rule 11) — do not LLM-retry for paste-claim-as-cite.
 */

import { proseEchoesCollectedAgenda, proseEchoesSituation } from "./situation-echo";
import {
  packHasQimenLock,
  QIMEN_HOST_GUEST_BIND_RE,
} from "./qimen-structure-anchors";

const STRUCTURE_TOKEN_RE =
  /[甲乙丙丁戊己庚辛壬癸]|[子丑寅卯辰巳午未申酉戌亥]|日主|用神|喜神|忌神|身强|身弱|月令|年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月|正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|食伤|藏干|透干|相冲|相刑|相害|半合|六合|三合|贵人|将星|华盖|禄神|客克主|主克客|主生客|客生主|值符|值使|陰遁|阴遁|陽遁|阳遁|開門|开门|休門|休门|生門|生门|傷門|伤门|杜門|杜门|景門|景门|死門|死门|驚門|惊門|惊门/;

/**
 * Negotiation / delivery prescriptions — not a chart structure claim.
 * Category only: action-frame shells + common execution verbs after 须证明.
 */
const ACTION_PRESCRIPTION_RE =
  /(?:本维|本卡)须证明[：:].{0,48}(?:提出|建立|借助|争取|开口|谈判|协议|书面|试用|转全职|股权|律师|话语权|画饼|试水|兼职|不可替代|条件谈判|柔性)|(?:兼职试水|全职过去|股权节点|找律师|书面协议|口头画饼|今晚可完成)/;

/**
 * Fill-layer means / ability-brochure tails. Correct on P3 fill strategy+means;
 * wrong inside assign unit_claim (iron 13: claim = structure to prove).
 * Categories: life-action prose; shensha written as personality/ability.
 * Personality family (印重性格白话): 思虑/保守 synonyms — complete the set, not Lab stems.
 */
const MEANS_LAYER_TAIL_RE =
  /求财|技术转化|技术输出|不可急进|急进|节奏杠杆|精力配比|沟通协作|一层第一步|开口谈|先兼职|兼职试水|兼职节奏|转全职|全职跳入|全职投入|全职加码|冒进全职|全职风险|不宜冒进|不宜.{0,8}(?:加码|冒进)|须待.{0,16}窗口|宜以客位|宜以.{0,24}(?:姿态|进取|开创|守养|藏隐|退避|显名|露锋|试探)|宜进取开创|宜守养休整|宜藏隐试探|宜退避防损|宜显名|宜守结构节奏|守结构节奏|待水旺|本维兑现|靠近补给|远离过耗|借势|侧翼借势|话语权|画饼|赢得尊重|实际贡献|协议明确|以柔克刚|技术价值|加重筹码|争取权益|利益争取|守住能量|合伙关系|结构性摩擦|天然受限|乐于(?:付出)?技术|(?:生身)?加重?(?:思虑过多|思虑过重|思虑保守)|思虑过多|思虑过重|思虑保守|易(?:于)?思虑|容易思虑|行动保守|保守求稳|借.{0,8}(?:贵人|将星).{0,6}之|之(?:谋略|魄力|和解|洞察|回旋|周密)/;

/**
 * calc_cite must be fact-pack / 真算 excerpt — not fill advice or situation gloss.
 * Category: prescription / personality brochure glued onto an otherwise pack-like cite.
 */
const CITE_MEANS_ADVICE_RE =
  /宜等待|等待水旺|不宜冒进|不宜加码|宜守|宜以客位|宜进取开创|宜守养|宜藏隐|宜退避|容易思虑|易(?:于)?思虑|思虑过多|思虑过重|思虑保守|保守求稳|行动保守|乐于(?:付出)?技术|利益争取|暗示.{0,12}(?:摩擦|关系)|结构性摩擦|技术输出是你的|核心价值|角色力量偏在技术/;

/** True when calc_cite is fill-advice / personality brochure (not a pack excerpt). */
export function citeHasMeansAdvice(cite: string): boolean {
  return CITE_MEANS_ADVICE_RE.test(cite.trim());
}

const MAX_CLAIM_CHARS = 72;

/** Mid-clause cut / soft-strip debris — not a finished structure sentence. */
const INCOMPLETE_CLAIM_END_RE = /[为中之而与的其以则是在]$/u;

/** 「食神主」abort — not bare「日主」. */
const TEN_GOD_HOST_ABORT_RE =
  /(?:食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|印星|财星|官星|食伤)主$/u;

const PACK_LINE_HINT_RE =
  /^(日主|用神|喜神|忌神|年柱|月柱|日柱|时柱|本盘合冲|当前大运|当前流年|当前运岁)/;

const REL_OVERLAP = [
  "相冲",
  "相害",
  "相刑",
  "半合",
  "六合",
  "三合",
  "食神",
  "偏印",
  "正印",
  "用神",
  "喜神",
  "忌神",
  "大运",
  "流年",
  "流月",
] as const;

export type FactPackAssignClaimUnit = {
  path: string;
  unit_claim: string;
  calc_cite: string;
  /** P4 only — used for ≥1 timing↔奇门 bind when lock present. */
  moat_class?: string | null;
};

export type FactPackAssignClaimGateOpts = {
  chart_fact_pack?: string | null;
  eastern_calc_slice?: string | null;
  situation_material?: string | null;
};

/**
 * When fact-pack / slice has 奇门锁盘 and the page has timing slots:
 * ≥1 timing unit must bind 主客/值符值使 in claim+cite.
 * Other timing units may stay pure 大运流年 (dual timing is product design).
 */
export function assessP4QimenTimingBinding(
  units: readonly FactPackAssignClaimUnit[],
  opts: FactPackAssignClaimGateOpts,
): string | null {
  const pack = packSources(opts);
  if (!packHasQimenLock(pack)) return null;
  const timing = units.filter((u) => u.moat_class === "timing");
  if (timing.length === 0) return null;
  const bound = timing.some((u) =>
    QIMEN_HOST_GUEST_BIND_RE.test(`${u.unit_claim ?? ""}\n${u.calc_cite ?? ""}`),
  );
  if (bound) return null;
  return "assign:timing_missing_qimen_bind";
}

function packSources(opts: FactPackAssignClaimGateOpts): string {
  return [opts.chart_fact_pack, opts.eastern_calc_slice]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function normPack(s: string): string {
  // Whitespace + punctuation only — does not accept paraphrased / stitched cites.
  return s.replace(/\s+/g, "").replace(/[：:，,、；;。．.]/g, "");
}

/**
 * calc_cite must be a contiguous excerpt from fact pack / 真算料.
 * Soften punctuation only; stitched multi-field paraphrases still fail.
 */
export function citeNotInFactPack(cite: string, packBlob: string): boolean {
  const c = cite.trim();
  if (c.length < 3) return true;
  if (CITE_MEANS_ADVICE_RE.test(c)) return true;
  if (!packBlob.trim()) return false;
  const cn = normPack(c);
  const pn = normPack(packBlob);
  if (cn.length < 3) return true;
  // Exact contiguous (after punct strip) — including short lines like「用神：金」.
  if (pn.includes(cn)) return false;
  // Longer cites: allow one contiguous window ≥8 so truncation still passes;
  // stitched paraphrases usually won't have an 8-char pack window.
  if (cn.length >= 8) {
    for (let i = 0; i <= cn.length - 8; i++) {
      if (pn.includes(cn.slice(i, i + 8))) return false;
    }
  }
  return true;
}

export function isAssignStructureClaimWeak(claim: string): boolean {
  const t = claim.trim();
  if (t.length < 6) return true;
  if (t.length > MAX_CLAIM_CHARS) return true;
  if (!STRUCTURE_TOKEN_RE.test(t)) return true;
  if (ACTION_PRESCRIPTION_RE.test(t)) return true;
  if (MEANS_LAYER_TAIL_RE.test(t)) return true;
  if (INCOMPLETE_CLAIM_END_RE.test(t)) return true;
  if (TEN_GOD_HOST_ABORT_RE.test(t)) return true;
  return false;
}

/**
 * Pick one fact-pack / 真算 line that overlaps the claim's structure tokens.
 * Used when the model pasted the claim into calc_cite or wrote a non-pack cite.
 */
export function pickPackLineForClaim(
  claim: string,
  packBlob: string,
): string | null {
  const claimN = normPack(claim);
  if (claimN.length < 4 || !packBlob.trim()) return null;
  const lines = packBlob
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 4 &&
        !s.startsWith("【") &&
        !s.startsWith("规则") &&
        !s.startsWith("禁止"),
    );
  let best: { line: string; score: number } | null = null;
  for (const line of lines) {
    const ln = normPack(line);
    if (ln.length < 4) continue;
    // Never pick a line that is basically the whole claim (paste back).
    if (ln.length >= 24 && claimN === ln) continue;
    if (ln.length >= claimN.length && claimN.length >= 20) continue;
    let score = 0;
    const gz = line.match(
      /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g,
    );
    for (const g of gz ?? []) {
      if (claim.includes(g) || claimN.includes(normPack(g))) score += 3;
    }
    for (const rel of REL_OVERLAP) {
      if (line.includes(rel) && claim.includes(rel)) score += 2;
    }
    if (ln.length >= 6) {
      for (let i = 0; i <= Math.min(ln.length, 48) - 6; i++) {
        if (claimN.includes(ln.slice(i, i + 6))) {
          score += 4;
          break;
        }
      }
    }
    if (PACK_LINE_HINT_RE.test(line)) score += 1;
    if (score <= 0) continue;
    if (!best || score > best.score) best = { line: line.slice(0, 80), score };
  }
  return best?.line ?? null;
}

function tidyClaimAfterMeansStrip(raw: string): string {
  let head = raw
    .replace(/[，,、；;：:\s]{2,}/gu, "，")
    .replace(/^[，,、；;：:\s]+|[，,、；;：:\s。．.]+$/gu, "")
    .trim();
  // Drop orphan topic / intensifier stubs left mid-clause.
  head = head.replace(/[，,、；;]?合伙中$/u, "").trim();
  head = head.replace(/[，,、；;]?(?:生身)?加重$/u, "").trim();
  if (INCOMPLETE_CLAIM_END_RE.test(head)) {
    const breakAt = Math.max(
      head.lastIndexOf("，"),
      head.lastIndexOf("、"),
      head.lastIndexOf(","),
      head.lastIndexOf("；"),
    );
    if (breakAt >= 8) head = head.slice(0, breakAt).trim();
  }
  if (TEN_GOD_HOST_ABORT_RE.test(head)) {
    const breakAt = Math.max(
      head.lastIndexOf("，"),
      head.lastIndexOf("、"),
      head.lastIndexOf(","),
      head.lastIndexOf("；"),
    );
    if (breakAt >= 8) head = head.slice(0, breakAt).trim();
  }
  return head;
}

/**
 * Cut fill/life / personality-brochure segments off a structure claim.
 * Prefer in-place removal so trailing structure (e.g. 「与食神形成结构对比」) stays.
 * Falls back to cut-at-first-means. Keeps original if result would be weak.
 * Rule 11 soft-repair — does not invent new structure.
 */
export function softStripMeansLayerFromClaim(claim: string): string {
  const t = claim.trim();
  if (t.length < 10) return t;

  const inPlace = tidyClaimAfterMeansStrip(
    t
      .replace(new RegExp(MEANS_LAYER_TAIL_RE.source, "gu"), "")
      .replace(new RegExp(ACTION_PRESCRIPTION_RE.source, "gu"), ""),
  );
  if (
    inPlace.length >= 6 &&
    inPlace !== t &&
    !isAssignStructureClaimWeak(inPlace)
  ) {
    return inPlace;
  }

  const matchers = [MEANS_LAYER_TAIL_RE, ACTION_PRESCRIPTION_RE];
  let cut = -1;
  for (const re of matchers) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(t)) !== null) {
      if (m.index >= 8 && (cut < 0 || m.index < cut)) cut = m.index;
    }
  }
  if (cut < 8) return t;
  const head = tidyClaimAfterMeansStrip(t.slice(0, cut));
  if (head.length < 6) return t;
  if (isAssignStructureClaimWeak(head)) return t;
  return head;
}

/**
 * Deterministic cite + claim-tail fix (rule 11).
 * Strips fill/life tails from unit_claim; replaces off-pack cites.
 */
export function softRepairFactPackAssignCites(
  units: readonly FactPackAssignClaimUnit[],
  opts: FactPackAssignClaimGateOpts,
): { units: FactPackAssignClaimUnit[]; repaired: boolean } {
  const pack = packSources(opts);
  let repaired = false;
  const next = units.map((u) => {
    let claim = (u.unit_claim ?? "").trim();
    const stripped = softStripMeansLayerFromClaim(claim);
    if (stripped !== claim) {
      claim = stripped;
      repaired = true;
    }
    const cite = (u.calc_cite ?? "").trim();
    const equal = normPack(claim) === normPack(cite) && claim.length >= 8;
    const missing = citeNotInFactPack(cite, pack);
    if (!equal && !missing) return { ...u, unit_claim: claim, calc_cite: cite };
    const picked = pickPackLineForClaim(claim, pack);
    if (!picked || normPack(picked) === normPack(cite)) {
      return { ...u, unit_claim: claim, calc_cite: cite };
    }
    repaired = true;
    return { ...u, unit_claim: claim, calc_cite: picked };
  });
  return { units: next, repaired };
}

/**
 * First failing path reason, or null if ok.
 * Reasons are assign:* keys for Lab / retry copy.
 */
export function assessFactPackAssignClaims(
  units: readonly FactPackAssignClaimUnit[],
  opts: FactPackAssignClaimGateOpts,
): string | null {
  const pack = packSources(opts);
  const situation = (opts.situation_material ?? "").trim();
  for (const u of units) {
    const claim = (u.unit_claim ?? "").trim();
    const cite = (u.calc_cite ?? "").trim();
    if (isAssignStructureClaimWeak(claim)) {
      return `assign:claim_not_structure:${u.path}`;
    }
    if (situation && (proseEchoesSituation(claim, situation) || proseEchoesCollectedAgenda(claim, situation))) {
      return `assign:claim_situation_paste:${u.path}`;
    }
    if (normPack(claim) === normPack(cite) && claim.length >= 8) {
      return `assign:cite_equals_claim:${u.path}`;
    }
    if (citeNotInFactPack(cite, pack)) {
      return `assign:cite_not_in_pack:${u.path}`;
    }
  }
  const qimenTiming = assessP4QimenTimingBinding(units, opts);
  if (qimenTiming) return qimenTiming;
  return null;
}

/** Shape-retry user hint (1+1). Category copy — no case phrases. */
export function factPackAssignClaimRetryHint(claimFail: string): string {
  if (claimFail === "assign:timing_missing_qimen_bind") {
    return `【纠错·派工】${claimFail}。事实档已有奇门锁盘时：至少一条 moat_class=timing 的 unit_claim+calc_cite 必须绑定奇门主客/值符值使（客克主|主克客|值符|值使）。允许另一条 timing 只写大运流年运岁窗。立刻重出完整 JSON。`;
  }
  if (claimFail.startsWith("assign:claim_situation_paste:")) {
    return `【纠错·派工】${claimFail}。unit_claim 禁止复述【处境材料】/问题期望里的议题结论或生活表象；只写本盘结构（干支/十神/合冲刑害/用喜忌/运岁/奇门主客），写到结构关系为止。立刻重出完整 JSON。`;
  }
  if (claimFail.startsWith("assign:claim_not_structure:")) {
    return `【纠错·派工】${claimFail}。unit_claim 只写本盘结构（干支/十神/合冲刑害/用喜忌/运岁/奇门主客门宫），写到结构关系为止。禁止兼职/全职/话语权/合伙摩擦/技术输出/股权谈判等 fill 手段与生活结论尾巴。立刻重出完整 JSON。`;
  }
  return `【纠错·派工】${claimFail}。unit_claim 与 calc_cite 必须不同：主张=结构解释；摘录=事实档/真算料里**另一段**原样短行（可截断），禁止把主张整句贴进 calc_cite。立刻重出完整 JSON。`;
}
