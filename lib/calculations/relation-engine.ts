// lib/calculations/relation-engine.ts
// S1+S2 · 共享干支关系引擎（POJU / Glyph / Match / Syncro 四产品共用）
// 复用 Match 的 branch-relations 表与判定，补【半合】【天干五合】；S2 流年×命局。

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { LiuNianGanzhi } from "@/lib/calculations/liunian";
import { getCurrentLiunian } from "@/lib/calculations/liunian";
import {
  analyzeAllBranchInteractions,
  isLiuChong,
  isLiuHai,
  isLiuHe,
  isXing,
  SAN_HE,
} from "@/lib/match/data/branch-relations";
import {
  calculateTenGod,
  type EarthlyBranch,
  type HeavenlyStem,
  type TenGod,
} from "@/lib/match/data/stems-branches";

export type RelationSource = "natal" | "dayun" | "liunian" | "cross";
export type RelationKind =
  | "chong"
  | "xing"
  | "hai"
  | "liuhe"
  | "sanhe"
  | "banhe"
  | "stem_he"
  | "ten_god_tension";

export type Palace = "self" | "spouse" | "career" | "result" | "root";

export interface RelationLabel {
  /** 闭集 slug（进 term-closed-set / 实例清单 / 守卫）。稳定、可查极性。 */
  id: string;
  /** 汉字关系名（如 "子午相冲" / "寅午半合火局" / "日主乙庚相合"）。 */
  han: string;
  kind: RelationKind;
  source: RelationSource;
  /** 参与的柱位（year/month/day/hour/dayun/liunian）。 */
  positions: string[];
  /** 命理宫位（供定向过滤：spouse=日支, career=月/时支, self=日主…）。 */
  palaces: Palace[];
  /** 极性（软翻译色）：绿=合/助, 红=冲刑害, 金=中性。 */
  polarity: "green" | "red" | "gold";
}

type Pos = "year" | "month" | "day" | "hour";
const POSITIONS: Pos[] = ["year", "month", "day", "hour"];

const POS_PALACE: Record<Pos, Palace> = {
  year: "root",
  month: "career",
  day: "spouse",
  hour: "result",
};

const WANG_ZHI: Record<string, EarthlyBranch> = {
  水局: "子",
  木局: "卯",
  火局: "午",
  金局: "酉",
};

const STEM_WU_HE: Array<[HeavenlyStem, HeavenlyStem, string]> = [
  ["甲", "己", "合化土"],
  ["乙", "庚", "合化金"],
  ["丙", "辛", "合化水"],
  ["丁", "壬", "合化木"],
  ["戊", "癸", "合化火"],
];

function stemHe(a: string, b: string): { he: boolean; element?: string } {
  for (const [x, y, element] of STEM_WU_HE) {
    if ((a === x && b === y) || (a === y && b === x)) return { he: true, element };
  }
  return { he: false };
}

function extractPillars(structured: ProfileStructured): Record<Pos, { stem: string; branch: string }> {
  const out = {} as Record<Pos, { stem: string; branch: string }>;
  for (const pos of POSITIONS) {
    const detail = structured.pillars_detail?.[pos];
    const gz = detail?.ganzhi ?? structured.four_pillars[pos] ?? "";
    out[pos] = {
      stem: detail?.stem ?? gz.charAt(0),
      branch: detail?.branch ?? gz.charAt(1),
    };
  }
  return out;
}

const sortedPair = (a: string, b: string) => [a, b].sort().join("_");

export function computeChartRelations(structured: ProfileStructured): RelationLabel[] {
  const pillars = extractPillars(structured);
  const out: RelationLabel[] = [];
  const seen = new Set<string>();

  const push = (r: RelationLabel) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push(r);
  };

  for (let i = 0; i < POSITIONS.length; i++) {
    for (let j = i + 1; j < POSITIONS.length; j++) {
      const pa = POSITIONS[i];
      const pb = POSITIONS[j];
      const a = pillars[pa].branch as EarthlyBranch;
      const b = pillars[pb].branch as EarthlyBranch;
      const palaces: Palace[] = [POS_PALACE[pa], POS_PALACE[pb]];
      const positions = [pa, pb];

      if (isLiuChong(a, b)) {
        push({
          id: `chong_${sortedPair(a, b)}`,
          han: `${a}${b}相冲`,
          kind: "chong",
          source: "natal",
          positions,
          palaces,
          polarity: "red",
        });
      }
      const x = isXing(a, b);
      if (x.isXing) {
        push({
          id: `xing_${sortedPair(a, b)}`,
          han: `${a}${b}相刑`,
          kind: "xing",
          source: "natal",
          positions,
          palaces,
          polarity: "red",
        });
      }
      if (isLiuHai(a, b)) {
        push({
          id: `hai_${sortedPair(a, b)}`,
          han: `${a}${b}相害`,
          kind: "hai",
          source: "natal",
          positions,
          palaces,
          polarity: "red",
        });
      }
      const he = isLiuHe(a, b);
      if (he.isHe) {
        push({
          id: `liuhe_${sortedPair(a, b)}`,
          han: `${a}${b}六合${he.element ?? ""}`,
          kind: "liuhe",
          source: "natal",
          positions,
          palaces,
          polarity: "green",
        });
      }
      for (const { branches, element } of SAN_HE) {
        const wang = WANG_ZHI[element];
        if (branches.includes(a) && branches.includes(b) && (a === wang || b === wang)) {
          push({
            id: `banhe_${sortedPair(a, b)}_${element}`,
            han: `${a}${b}半合${element}`,
            kind: "banhe",
            source: "natal",
            positions,
            palaces,
            polarity: "green",
          });
        }
      }
    }
  }

  const branchSet = POSITIONS.map((p) => pillars[p].branch);
  for (const { branches, element } of SAN_HE) {
    if (branches.every((b) => branchSet.includes(b))) {
      push({
        id: `sanhe_${element}`,
        han: `${branches.join("")}三合${element}`,
        kind: "sanhe",
        source: "natal",
        positions: [...POSITIONS],
        palaces: ["career", "spouse"],
        polarity: "green",
      });
    }
  }

  const dm = pillars.day.stem;
  for (const pos of ["year", "month", "hour"] as Pos[]) {
    const s = pillars[pos].stem;
    const r = stemHe(dm, s);
    if (r.he) {
      push({
        id: `stemhe_${sortedPair(dm, s)}`,
        han: `日主${dm}${s}相合${r.element ?? ""}`,
        kind: "stem_he",
        source: "natal",
        positions: ["day", pos],
        palaces: ["self"],
        polarity: "gold",
      });
    }
  }

  return out;
}

/** base_analysis 底座允许集：仅 `source==="natal"` 的本命静态结构关系。 */
export function computeNatalChartRelations(structured: ProfileStructured): RelationLabel[] {
  return computeChartRelations(structured).filter((r) => r.source === "natal");
}

const POS_HAN: Record<Pos, string> = {
  year: "年",
  month: "月",
  day: "日",
  hour: "时",
};

/** 流年地支 × 四柱地支：冲 / 刑 / 害 / 六合 / 半合（不含三合齐局）。 */
export function computeLiunianRelations(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
): RelationLabel[] {
  const pillars = extractPillars(structured);
  const lb = liunian.branch as EarthlyBranch;
  const out: RelationLabel[] = [];
  const seen = new Set<string>();

  const push = (r: RelationLabel) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push(r);
  };

  for (const pos of POSITIONS) {
    const nb = pillars[pos].branch as EarthlyBranch;
    const palaces: Palace[] = [POS_PALACE[pos]];
    const positions = ["liunian", pos];
    const posHan = POS_HAN[pos];

    const idSuffix = `${sortedPair(lb, nb)}_${pos}`;

    if (isLiuChong(lb, nb)) {
      push({
        id: `liunian_chong_${idSuffix}`,
        han: `${lb}${nb}相冲(流年引动·${posHan}支)`,
        kind: "chong",
        source: "liunian",
        positions,
        palaces,
        polarity: "red",
      });
    }
    const x = isXing(lb, nb);
    if (x.isXing) {
      push({
        id: `liunian_xing_${idSuffix}`,
        han: `${lb}${nb}相刑(流年引动·${posHan}支)`,
        kind: "xing",
        source: "liunian",
        positions,
        palaces,
        polarity: "red",
      });
    }
    if (isLiuHai(lb, nb)) {
      push({
        id: `liunian_hai_${idSuffix}`,
        han: `${lb}${nb}相害(流年引动·${posHan}支)`,
        kind: "hai",
        source: "liunian",
        positions,
        palaces,
        polarity: "red",
      });
    }
    const he = isLiuHe(lb, nb);
    if (he.isHe) {
      push({
        id: `liunian_liuhe_${idSuffix}`,
        han: `${lb}${nb}六合${he.element ?? ""}(流年引动·${posHan}支)`,
        kind: "liuhe",
        source: "liunian",
        positions,
        palaces,
        polarity: "green",
      });
    }
    for (const { branches, element } of SAN_HE) {
      const wang = WANG_ZHI[element];
      if (branches.includes(lb) && branches.includes(nb) && (lb === wang || nb === wang)) {
        push({
          id: `liunian_banhe_${idSuffix}_${element}`,
          han: `${lb}${nb}半合${element}(流年引动·${posHan}支)`,
          kind: "banhe",
          source: "liunian",
          positions,
          palaces,
          polarity: "green",
        });
      }
    }
  }

  return out;
}

const CATEGORY_PALACES: Record<string, Palace[]> = {
  relationship: ["spouse", "self"],
  career: ["career", "result", "self"],
  wealth: ["career", "self"],
  health: ["self"],
  family: ["root", "spouse"],
};

const WEALTH_OFFICER_GODS = new Set<TenGod>(["正财", "偏财", "正官", "七杀"]);

function isDayMasterWeak(structured: ProfileStructured): boolean {
  const s = structured.strength?.trim() ?? "";
  if (!s) return false;
  return s === "weak" || s.includes("弱");
}

function chartTenGods(structured: ProfileStructured): Set<TenGod> {
  const out = new Set<TenGod>();
  for (const pos of POSITIONS) {
    const tg = structured.pillars_detail?.[pos]?.ten_god as TenGod | undefined;
    if (tg) out.add(tg);
  }
  return out;
}

function stemTenGod(structured: ProfileStructured, stem: string): TenGod {
  const dm = structured.day_master.charAt(0) as HeavenlyStem;
  return calculateTenGod(dm, stem as HeavenlyStem);
}

function relationTouchesWealthOfficerPillar(
  structured: ProfileStructured,
  r: RelationLabel,
): boolean {
  for (const pos of r.positions) {
    if (pos === "liunian" || pos === "dayun") continue;
    if (!(POSITIONS as readonly string[]).includes(pos)) continue;
    const tg = structured.pillars_detail?.[pos as Pos]?.ten_god as TenGod | undefined;
    if (tg && WEALTH_OFFICER_GODS.has(tg)) return true;
  }
  return false;
}

/** 日主偏弱 + 流年/大运十神张力（伤官见官 / 枭神夺食）。中性 han，不写凶断。 */
export function detectTenGodTensions(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
): RelationLabel[] {
  if (!isDayMasterWeak(structured)) return [];

  const gods = chartTenGods(structured);
  const out: RelationLabel[] = [];
  const seen = new Set<string>();

  const push = (r: RelationLabel) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push(r);
  };

  const lnGod = stemTenGod(structured, liunian.stem);
  if (lnGod === "伤官" && gods.has("正官")) {
    push({
      id: "shangguan_jianguan",
      han: "表达力与规范约束的外力拉扯(流年引动)",
      kind: "ten_god_tension",
      source: "liunian",
      positions: ["liunian"],
      palaces: ["career", "self"],
      polarity: "red",
    });
  }
  if (lnGod === "偏印" && gods.has("食神")) {
    push({
      id: "xiaoshen_duoshi",
      han: "内省本能对表达节奏的挤占张力(流年引动)",
      kind: "ten_god_tension",
      source: "liunian",
      positions: ["liunian"],
      palaces: ["career", "self"],
      polarity: "red",
    });
  }

  const dayunStem = structured.da_yun?.[0]?.ganzhi?.charAt(0);
  if (dayunStem) {
    const dyGod = stemTenGod(structured, dayunStem);
    if (dyGod === "伤官" && gods.has("正官")) {
      push({
        id: "shangguan_jianguan",
        han: "表达力与规范约束的外力拉扯(大运引动)",
        kind: "ten_god_tension",
        source: "dayun",
        positions: ["dayun"],
        palaces: ["career", "self"],
        polarity: "red",
      });
    }
    if (dyGod === "偏印" && gods.has("食神")) {
      push({
        id: "xiaoshen_duoshi",
        han: "内省本能对表达节奏的挤占张力(大运引动)",
        kind: "ten_god_tension",
        source: "dayun",
        positions: ["dayun"],
        palaces: ["career", "self"],
        polarity: "red",
      });
    }
  }

  return out;
}

export function filterRelationsByCategory(
  rels: RelationLabel[],
  category: string | null | undefined,
  structured?: ProfileStructured | null,
): RelationLabel[] {
  const wanted = CATEGORY_PALACES[category ?? ""] ?? null;
  if (!wanted) return rels;
  return rels.filter((r) => {
    if (r.kind === "ten_god_tension") {
      return category === "career";
    }
    if (r.palaces.some((p) => wanted.includes(p))) return true;
    if (category === "relationship" && structured && relationTouchesWealthOfficerPillar(structured, r)) {
      return true;
    }
    return false;
  });
}

/** 流年 + 十神张力，按 question_category 定向过滤（不含本命，供 v6 user 侧「流年/定向」段）。 */
export function computeDirectedDynamicRelations(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
  questionCategory: string | null | undefined,
): RelationLabel[] {
  const dynamic = [
    ...computeLiunianRelations(structured, liunian),
    ...detectTenGodTensions(structured, liunian),
  ];
  return filterRelationsByCategory(dynamic, questionCategory, structured);
}

/** 本命 + 流年 + 十神张力，按 question_category 定向过滤。 */
export function computeDirectedRelations(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
  questionCategory: string | null | undefined,
): RelationLabel[] {
  const all = [
    ...computeChartRelations(structured),
    ...computeLiunianRelations(structured, liunian),
    ...detectTenGodTensions(structured, liunian),
  ];
  return filterRelationsByCategory(all, questionCategory, structured);
}

const POS_HAN_CROSS: Record<Pos, string> = {
  year: "年",
  month: "月",
  day: "日",
  hour: "时",
};

function profileBranches(structured: ProfileStructured): Record<Pos, EarthlyBranch> {
  const pillars = extractPillars(structured);
  return {
    year: pillars.year.branch as EarthlyBranch,
    month: pillars.month.branch as EarthlyBranch,
    day: pillars.day.branch as EarthlyBranch,
    hour: pillars.hour.branch as EarthlyBranch,
  };
}

/** Match 双盘：A 四柱支 × B 四柱支（复用 Match analyzeAllBranchInteractions → RelationLabel）。 */
export function computeCrossProfileBranchRelations(
  structuredA: ProfileStructured,
  structuredB: ProfileStructured,
): RelationLabel[] {
  const interactions = analyzeAllBranchInteractions(
    profileBranches(structuredA),
    profileBranches(structuredB),
  );
  const out: RelationLabel[] = [];
  const seen = new Set<string>();

  const push = (r: RelationLabel) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push(r);
  };

  for (const ix of interactions) {
    const pair = [ix.a_branch, ix.b_branch].sort().join("_");
    const posSuffix = `a_${ix.a_position}_b_${ix.b_position}`;
    const palaces: Palace[] = [POS_PALACE[ix.a_position], POS_PALACE[ix.b_position]];
    const posHanA = POS_HAN_CROSS[ix.a_position];
    const posHanB = POS_HAN_CROSS[ix.b_position];

    if (ix.liu_he) {
      push({
        id: `cross_liuhe_${pair}_${posSuffix}`,
        han: `${ix.a_branch}${ix.b_branch}六合${ix.liu_he_element ?? ""}(A·${posHanA}支×B·${posHanB}支)`,
        kind: "liuhe",
        source: "cross",
        positions: [`a_${ix.a_position}`, `b_${ix.b_position}`],
        palaces,
        polarity: "green",
      });
    }
    if (ix.liu_chong) {
      push({
        id: `cross_chong_${pair}_${posSuffix}`,
        han: `${ix.a_branch}${ix.b_branch}相冲(A·${posHanA}支×B·${posHanB}支)`,
        kind: "chong",
        source: "cross",
        positions: [`a_${ix.a_position}`, `b_${ix.b_position}`],
        palaces,
        polarity: "red",
      });
    }
    if (ix.xing) {
      push({
        id: `cross_xing_${pair}_${posSuffix}`,
        han: `${ix.a_branch}${ix.b_branch}相刑(A·${posHanA}支×B·${posHanB}支)`,
        kind: "xing",
        source: "cross",
        positions: [`a_${ix.a_position}`, `b_${ix.b_position}`],
        palaces,
        polarity: "red",
      });
    }
    if (ix.liu_hai) {
      push({
        id: `cross_hai_${pair}_${posSuffix}`,
        han: `${ix.a_branch}${ix.b_branch}相害(A·${posHanA}支×B·${posHanB}支)`,
        kind: "hai",
        source: "cross",
        positions: [`a_${ix.a_position}`, `b_${ix.b_position}`],
        palaces,
        polarity: "red",
      });
    }
  }

  return out;
}

/** Match 审计允许集：A/B 本命 + 流年/定向 + 今年双人动态。 */
export function computeMatchRelationAuditAllowlist(
  structuredA: ProfileStructured,
  structuredB: ProfileStructured,
  questionCategory: string | null | undefined = "relationship",
): RelationLabel[] {
  const liunian = getCurrentLiunian();
  const seen = new Set<string>();
  const out: RelationLabel[] = [];
  for (const r of [
    ...computeChartRelations(structuredA),
    ...computeChartRelations(structuredB),
    ...computeDirectedDynamicRelations(structuredA, liunian, questionCategory),
    ...computeDirectedDynamicRelations(structuredB, liunian, questionCategory),
    ...computeCrossProfileBranchRelations(structuredA, structuredB),
  ]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function buildMatchRelationInventoryBlock(
  structuredA: ProfileStructured,
  structuredB: ProfileStructured,
  questionCategory: string | null | undefined = "relationship",
): string {
  const liunian = getCurrentLiunian();
  const cross = computeCrossProfileBranchRelations(structuredA, structuredB);
  const dynA = computeDirectedDynamicRelations(structuredA, liunian, questionCategory);
  const dynB = computeDirectedDynamicRelations(structuredB, liunian, questionCategory);
  return [
    "## Match 动态关系闭集（仅可引用下列，禁止自推刑冲合害）",
    `- A 本命: ${computeChartRelations(structuredA).map((r) => r.han).join("、") || "（无）"}`,
    `- B 本命: ${computeChartRelations(structuredB).map((r) => r.han).join("、") || "（无）"}`,
    `- A 流年/定向: ${dynA.map((r) => r.han).join("、") || "（无）"}`,
    `- B 流年/定向: ${dynB.map((r) => r.han).join("、") || "（无）"}`,
    `- 双人今年动态: ${cross.map((r) => r.han).join("、") || "（无）"}`,
    "- 全文关系相关金字 ≤3；算全不写全；关系词须软翻译+中性化",
  ].join("\n");
}

/** 审计允许集：本命闭集 + 定向过滤后的流年/十神张力。 */
export function computeRelationAuditAllowlist(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
  questionCategory: string | null | undefined,
): RelationLabel[] {
  const seen = new Set<string>();
  const out: RelationLabel[] = [];
  for (const r of [
    ...computeChartRelations(structured),
    ...computeDirectedDynamicRelations(structured, liunian, questionCategory),
  ]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/** v6 下游 user 侧：流年/定向动态关系闭集块（本命已在实例清单，此处仅流年+张力）。 */
export function buildDirectedDynamicRelationInventoryBlock(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
  questionCategory: string | null | undefined,
): string {
  const filtered = computeDirectedDynamicRelations(structured, liunian, questionCategory);
  const cat = questionCategory?.trim() || "—";
  if (!filtered.length) {
    return [
      `## 本盘动态关系实例（流年/定向 · question_category=${cat} · 过滤后为空）`,
      "- 禁止写流年引动/十神张力/伤官见官/枭神夺食等未在本盘本命关系清单中的关系词",
    ].join("\n");
  }
  return [
    `## 本盘动态关系实例（流年/定向 · question_category=${cat} · 仅可引用下列）`,
    `- ${filtered.map((r) => r.han).join("、")}`,
    "- 禁止写未列出的流年引动/十神张力/伤官见官/枭神夺食等关系词",
  ].join("\n");
}

/** 交付下游 user 侧：定向动态关系闭集块（保 system 前缀缓存不变）。 */
export function buildDirectedRelationInventoryBlock(
  structured: ProfileStructured,
  liunian: LiuNianGanzhi,
  questionCategory: string | null | undefined,
): string {
  const filtered = computeDirectedRelations(structured, liunian, questionCategory);
  const cat = questionCategory?.trim() || "—";
  if (!filtered.length) {
    return [
      `## 本次问题定向动态关系（question_category=${cat} · 过滤后为空）`,
      "- 禁止写流年引动/十神张力/非本类宫位关系词（刑冲合害/伤官见官/枭神夺食等）",
    ].join("\n");
  }
  return [
    `## 本次问题定向动态关系（question_category=${cat} · 仅可引用下列）`,
    `- ${filtered.map((r) => r.han).join("、")}`,
    "- 禁止写未列出的流年引动/十神张力/刑冲合害等关系词",
  ].join("\n");
}

export { getCurrentLiunian, type LiuNianGanzhi } from "@/lib/calculations/liunian";
