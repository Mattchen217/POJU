/**
 * Legal relations on this chart. The model picks ids.
 * Claims and cites are written here, from the sheng/ke table and the relation engine.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  computeDayunRelations,
  computeLiunianRelations,
  computeLiuyueRelations,
  computeNatalChartRelations,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import { resolveLuckCycles } from "@/lib/calculations/resolve-luck-cycles";
import { relationLabel } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  BRANCHES,
  calculateTenGod,
  type EarthlyBranch,
  type HeavenlyStem,
} from "@/lib/match/data/stems-branches";

const PILLAR_ZH = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" } as const;
const BRANCH_POS = { year: "年支", month: "月支", day: "日支", hour: "时支" } as const;
const STEM_POS = { year: "年干", month: "月干", hour: "时干" } as const;

const SHENG: Record<string, string> = { 印: "比", 比: "食", 食: "财", 财: "官", 官: "印" };
const KE: Record<string, string> = { 比: "财", 食: "官", 财: "印", 印: "食", 官: "比" };

type GodClass = "印" | "比" | "食" | "财" | "官";

export type FoundationRelation = {
  id: string;
  claim: string;
  cite: string;
};

type Draft = { claim: string; cite: string; sortKey: string };

type Actor = {
  key: string;
  group: "stem" | "qi";
  phrase: string;
  cite: string;
  godClass: GodClass;
};

function tenClass(name: string): GodClass | null {
  if (name === "正印" || name === "偏印") return "印";
  if (name === "比肩" || name === "劫财") return "比";
  if (name === "食神" || name === "伤官") return "食";
  if (name === "正财" || name === "偏财") return "财";
  if (name === "正官" || name === "七杀") return "官";
  return null;
}

function stemOf(raw: string): HeavenlyStem | null {
  const ch = raw.trim().charAt(0);
  if ("甲乙丙丁戊己庚辛壬癸".includes(ch)) return ch as HeavenlyStem;
  return null;
}

function asBranch(raw: string): EarthlyBranch | null {
  const ch = raw.trim().charAt(0);
  if (ch in BRANCHES) return ch as EarthlyBranch;
  return null;
}

function branchClaim(rel: RelationLabel, label: string): string {
  if (rel.source !== "natal") return label;
  const locs = rel.positions
    .map((pos) => BRANCH_POS[pos as keyof typeof BRANCH_POS] ?? "")
    .filter(Boolean);
  if (locs.length === 2) return `${locs[0]}与${locs[1]}，${label}`;
  return `本盘${label}`;
}

function edge(left: GodClass, right: GodClass): "生" | "克" | null {
  if (SHENG[left] === right) return "生";
  if (KE[left] === right) return "克";
  return null;
}

export function buildFoundationRelationInventory(
  structured: ProfileStructured,
  opts?: { as_of?: Date; timezone?: string },
): FoundationRelation[] {
  const dayStem = stemOf(structured.pillars_detail?.day.stem || structured.day_master);
  if (!dayStem) return [];
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  const add = (draft: Draft) => {
    if (!draft.claim || seen.has(draft.claim)) return;
    seen.add(draft.claim);
    drafts.push(draft);
  };

  const pushBranch = (rel: RelationLabel) => {
    const label = relationLabel(rel.han);
    if (!label) return;
    add({ claim: branchClaim(rel, label), cite: label, sortKey: `0|${label}` });
  };

  try {
    for (const rel of computeNatalChartRelations(structured)) pushBranch(rel);
  } catch {
    // Natal relations are optional when the pillar record is incomplete.
  }

  let cycles: ReturnType<typeof resolveLuckCycles> | null = null;
  try {
    cycles = resolveLuckCycles(structured, opts?.as_of ?? new Date(), opts?.timezone ?? "UTC");
  } catch {
    cycles = null;
  }
  if (cycles?.dayun) {
    for (const rel of computeDayunRelations(structured, cycles.dayun)) pushBranch(rel);
  }
  if (cycles?.liunian) {
    for (const rel of computeLiunianRelations(structured, cycles.liunian)) pushBranch(rel);
  }
  if (cycles?.liuyue) {
    for (const rel of computeLiuyueRelations(structured, cycles.liuyue)) pushBranch(rel);
  }

  const actors: Actor[] = [
    {
      key: "day",
      group: "stem",
      phrase: "日主",
      cite: `日主：${dayStem}`,
      godClass: "比",
    },
  ];

  const pillars = structured.pillars_detail;
  if (pillars) {
    for (const pos of ["year", "month", "hour"] as const) {
      const pillar = pillars[pos];
      const stem = stemOf(pillar.stem);
      if (!stem) continue;
      const god = (pillar.ten_god === "元男" || pillar.ten_god === "元女" || pillar.ten_god === "日主自身"
        ? ""
        : pillar.ten_god) || calculateTenGod(dayStem, stem);
      const godClass = tenClass(god);
      if (!godClass || god === "日主" || god === "日主自身") continue;
      actors.push({
        key: `stem:${pos}:${stem}`,
        group: "stem",
        phrase: `${STEM_POS[pos]}${stem}${god}`,
        cite: `${PILLAR_ZH[pos]} ${pillar.ganzhi} 天干${stem}`,
        godClass,
      });
    }
    for (const pos of ["year", "month", "day", "hour"] as const) {
      const branch = asBranch(pillars[pos].branch);
      if (!branch) continue;
      const qi = BRANCHES[branch].hidden_stems[0];
      if (!qi) continue;
      const god = calculateTenGod(dayStem, qi);
      const godClass = tenClass(god);
      if (!godClass) continue;
      actors.push({
        key: `qi:${pos}:${qi}`,
        group: "qi",
        phrase: `${BRANCH_POS[pos]}本气${qi}${god}`,
        cite: `${PILLAR_ZH[pos]} ${pillars[pos].ganzhi} 天干${pillars[pos].stem}`,
        godClass,
      });
    }
  }

  const luckActors = (
    cycle: "大运" | "流年" | "流月",
    ganzhi: string | undefined,
  ) => {
    if (!ganzhi || ganzhi.length < 2) return;
    const stem = stemOf(ganzhi);
    const branch = asBranch(ganzhi.charAt(1));
    if (!stem || !branch) return;
    const cite = `当前${cycle}：${ganzhi}`;
    const stemGod = calculateTenGod(dayStem, stem);
    const stemClass = tenClass(stemGod);
    if (stemClass) {
      actors.push({
        key: `stem:${cycle}:${stem}`,
        group: "stem",
        phrase: `${cycle}天干${stem}${stemGod}`,
        cite,
        godClass: stemClass,
      });
    }
    const qi = BRANCHES[branch].hidden_stems[0];
    if (!qi) return;
    const qiGod = calculateTenGod(dayStem, qi);
    const qiClass = tenClass(qiGod);
    if (!qiClass) return;
    actors.push({
      key: `qi:${cycle}:${qi}`,
      group: "qi",
      phrase: `${cycle}本气${qi}${qiGod}`,
      cite,
      godClass: qiClass,
    });
  };
  luckActors("大运", cycles?.dayun?.ganzhi);
  luckActors("流年", cycles?.liunian?.ganzhi);
  luckActors("流月", cycles?.liuyue?.ganzhi);

  for (let i = 0; i < actors.length; i++) {
    for (let j = 0; j < actors.length; j++) {
      if (i === j) continue;
      const left = actors[i];
      const right = actors[j];
      if (!left || !right) continue;
      if (left.group === "qi" && right.group === "qi") continue;
      const verb = edge(left.godClass, right.godClass);
      if (!verb) continue;
      const word = verb === "生" ? "生扶" : "克制";
      add({
        claim: `${left.phrase}${word}${right.phrase}`,
        cite: left.cite,
        sortKey: `1|${left.key}|${word}|${right.key}`,
      });
    }
  }

  drafts.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "zh"));
  return drafts.map((draft, index) => ({
    id: `r${String(index + 1).padStart(2, "0")}`,
    claim: draft.claim,
    cite: draft.cite,
  }));
}

export function readFoundationPickIds(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const ids = (raw as { pick_ids?: unknown }).pick_ids;
  if (!Array.isArray(ids)) return null;
  const out: string[] = [];
  for (const item of ids) {
    if (typeof item !== "string" || !item.trim()) return null;
    out.push(item.trim());
  }
  return out;
}

export function bindFoundationRelationPicks(
  inventory: readonly FoundationRelation[],
  pickIds: readonly string[],
  paths: readonly string[],
):
  | { ok: true; picks: Array<{ path: string; id: string; claim: string; cite: string }> }
  | {
      ok: false;
      reason: string;
      picks: Array<{ path: string; id: string; claim: string; cite: string }>;
    } {
  const byId = new Map(inventory.map((row) => [row.id, row]));
  const draft = pickIds.map((id, index) => {
    const row = byId.get(id);
    return {
      path: paths[index] ?? `why_cards[${index}]`,
      id,
      claim: row?.claim ?? id,
      cite: row?.cite ?? "",
    };
  });
  if (pickIds.length !== paths.length) {
    return { ok: false, reason: "assign:pick_shape", picks: draft };
  }
  const seen = new Set<string>();
  for (const id of pickIds) {
    if (seen.has(id)) return { ok: false, reason: `assign:pick_duplicate:${id}`, picks: draft };
    seen.add(id);
    if (!byId.has(id)) return { ok: false, reason: `assign:pick_unknown:${id}`, picks: draft };
  }
  return { ok: true, picks: draft };
}
