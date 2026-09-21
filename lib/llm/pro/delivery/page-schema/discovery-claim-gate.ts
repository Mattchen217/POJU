/**
 * P2 discovery gates. Category rules for any chart and any question.
 * No sample sentences and no per-chart phrase list.
 */

const STRUCTURAL_RE =
  /[甲乙丙丁戊己庚辛壬癸]|[子丑寅卯辰巳午未申酉戌亥]|日主|用神|喜神|忌神|身强|身弱|中和|得令|得地|月令|年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月|格局|藏干|透干|透出|正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|官杀|食伤|比劫|财库|三合|六合|半合|相冲|相刑|相害|贵人|华盖|禄神|命局|命盘|当令|当权|生扶|克制|受制|生克|调候|帮身|泄秀|印旺|印弱/;

const TEN_GOD_SRC =
  "正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|食伤|官杀|比劫";
const TEN_GOD_RE = new RegExp(TEN_GOD_SRC, "g");
const LOC_RE = /年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月/g;
const GANZHI_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
const REL_RE = /克制|相冲|相刑|相害|六合|三合|半合|生扶|受制|克|生/g;

/** Interpretive palace names. Allowed only when this chart's fact pack already states them. */
const PALACE_NAMES = [
  "配偶宫",
  "夫妻宫",
  "父母宫",
  "子女宫",
  "官禄宫",
  "迁移宫",
  "疾厄宫",
  "财帛宫",
  "兄弟宫",
  "命宫",
  "身宫",
  "胎元",
  "田宅宫",
  "奴仆宫",
  "福德宫",
] as const;

const LIFE_CLAUSE_MIN = 8;

export type DiscoveryClaimUnit = {
  path: string;
  unit_claim: string;
  calc_cite: string;
};

function norm(s: string): string {
  return s.replace(/[\s　]/g, "");
}

function splitClauses(text: string): string[] {
  return text
    .split(/[，。；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normRel(raw: string): string {
  if (raw === "克制" || raw === "受制" || raw === "克") return "克";
  if (raw === "生扶" || raw === "生") return "生";
  if (raw === "半合" || raw === "六合" || raw === "三合") return "合";
  if (raw === "相冲") return "冲";
  if (raw === "相刑") return "刑";
  if (raw === "相害") return "害";
  return raw;
}

type RelationSig = {
  locs: Set<string>;
  gods: Set<string>;
  rels: Set<string>;
  gz: Set<string>;
};

function matches(re: RegExp, text: string): string[] {
  re.lastIndex = 0;
  return text.match(re) ?? [];
}

function relationSig(text: string): RelationSig {
  return {
    locs: new Set(matches(LOC_RE, text)),
    gods: new Set(matches(TEN_GOD_RE, text)),
    rels: new Set(matches(REL_RE, text).map(normRel)),
    gz: new Set(matches(GANZHI_RE, text)),
  };
}

function setsOverlap(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => b.has(x));
}

/** Same verb on the same stars, and not pinned to two different pillars or cycles. */
function sameRelation(a: RelationSig, b: RelationSig): boolean {
  const rels = setsOverlap(a.rels, b.rels);
  if (rels.length === 0) return false;
  const gods = setsOverlap(a.gods, b.gods);
  const gz = setsOverlap(a.gz, b.gz);
  const anchored = gods.length >= 2 || gz.length >= 1;
  if (!anchored) return false;
  if (a.locs.size > 0 && b.locs.size > 0 && setsOverlap(a.locs, b.locs).length === 0) {
    return false;
  }
  if (a.gz.size > 0 && b.gz.size > 0 && gz.length === 0 && gods.length < 2) {
    return false;
  }
  return true;
}

function luckPillars(pack: string): string[] {
  const out: string[] = [];
  const re =
    /当前(?:大运|流年|流月)：\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g;
  for (const hit of pack.matchAll(re)) {
    const gz = hit[1];
    if (gz && !out.includes(gz)) out.push(gz);
  }
  return out;
}

function gluesTenGodOntoLuck(text: string, pack: string): string | null {
  for (const gz of luckPillars(pack)) {
    const re = new RegExp(
      `(?:大运|流年|流月)${gz}\\s*(?:（(?:十神)?)?(?:${TEN_GOD_SRC})`,
    );
    if (re.test(text)) return gz;
  }
  return null;
}

function palaceMissingFromPack(text: string, pack: string): string | null {
  for (const name of PALACE_NAMES) {
    if (text.includes(name) && !pack.includes(name)) return name;
  }
  return null;
}

/**
 * First failure, or null. Fact-pack foundation discovery only.
 * Cite must be a contiguous pack excerpt. Claim stops at structure.
 */
export function foundationDiscoveryFailReason(
  units: readonly DiscoveryClaimUnit[],
  factPack: string,
): string | null {
  const packN = norm(factPack);
  const sigs: Array<{ path: string; sig: RelationSig }> = [];
  for (const u of units) {
    const claim = u.unit_claim.trim();
    const cite = u.calc_cite.trim();
    if (norm(claim) && norm(claim) === norm(cite)) {
      return `assign:cite_equals_claim:${u.path}`;
    }
    const citeN = norm(cite);
    if (citeN.length < 4 || !packN.includes(citeN)) {
      return `assign:cite_not_in_pack:${u.path}`;
    }
    const glued = gluesTenGodOntoLuck(claim, factPack);
    if (glued) return `assign:luck_ten_god_collapse:${u.path}:${glued}`;
    const palace = palaceMissingFromPack(`${claim}\n${cite}`, factPack);
    if (palace) return `assign:palace_not_in_pack:${u.path}:${palace}`;
    for (const clause of splitClauses(claim)) {
      if (clause.length < LIFE_CLAUSE_MIN) continue;
      if (!STRUCTURAL_RE.test(clause)) return `assign:claim_life_tail:${u.path}`;
    }
    sigs.push({ path: u.path, sig: relationSig(claim) });
  }
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const left = sigs[i];
      const right = sigs[j];
      if (!left || !right) continue;
      if (sameRelation(left.sig, right.sig)) {
        return `assign:claim_same_relation:${left.path}:${right.path}`;
      }
    }
  }
  return null;
}
