/**
 * Fact-pack assign (P3–P6): category gates for unit_claim + calc_cite.
 * Foundation uses inventory pick_ids instead — do not route it here.
 *
 * Iron laws 14–15: categories only; fail → fix prompt; no case blacklists.
 */

import { proseEchoesCollectedAgenda, proseEchoesSituation } from "./situation-echo";

const STRUCTURE_TOKEN_RE =
  /[甲乙丙丁戊己庚辛壬癸]|[子丑寅卯辰巳午未申酉戌亥]|日主|用神|喜神|忌神|身强|身弱|月令|年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月|正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|食伤|藏干|透干|相冲|相刑|相害|半合|六合|三合|贵人|将星|华盖|禄神/;

/**
 * Negotiation / delivery prescriptions — not a chart structure claim.
 * Category only: action-frame shells + common execution verbs after 须证明.
 */
const ACTION_PRESCRIPTION_RE =
  /(?:本维|本卡)须证明[：:].{0,48}(?:提出|建立|借助|争取|开口|谈判|协议|书面|试用|转全职|股权|律师|话语权|画饼|试水|兼职|不可替代|条件谈判|柔性)|(?:兼职试水|全职过去|股权节点|找律师|书面协议|口头画饼|今晚可完成)/;

const MAX_CLAIM_CHARS = 72;

export type FactPackAssignClaimUnit = {
  path: string;
  unit_claim: string;
  calc_cite: string;
};

export type FactPackAssignClaimGateOpts = {
  chart_fact_pack?: string | null;
  eastern_calc_slice?: string | null;
  situation_material?: string | null;
};

function packSources(opts: FactPackAssignClaimGateOpts): string {
  return [opts.chart_fact_pack, opts.eastern_calc_slice]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function normPack(s: string): string {
  return s.replace(/\s+/g, "");
}

/** calc_cite must be a short excerpt that appears in fact pack / 真算料. */
export function citeNotInFactPack(cite: string, packBlob: string): boolean {
  const c = cite.trim();
  if (c.length < 4) return true;
  if (!packBlob.trim()) return false;
  const cn = normPack(c);
  const pn = normPack(packBlob);
  if (pn.includes(cn)) return false;
  // Allow short consecutive window (≥6) from cite inside pack.
  if (cn.length >= 6) {
    for (let i = 0; i <= cn.length - 6; i++) {
      if (pn.includes(cn.slice(i, i + 6))) return false;
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
  return false;
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
  return null;
}
