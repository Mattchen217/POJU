/**
 * Layer A — tally used chart_anchors by inventory category for fill user prompts.
 * Pure string match; zero LLM. Dynamic — never put in static system prefix.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { collectPageAnchorUnits } from "./anchor-quality";
import type { DeliveryPageData } from "./types";

export type AnchorCategoryId =
  | "ten_god"
  | "shen_sha"
  | "relation"
  | "life_stage_hidden"
  | "dayun"
  | "core_structure";

export const ANCHOR_CATEGORY_LABEL_ZH: Record<AnchorCategoryId, string> = {
  ten_god: "十神类",
  shen_sha: "神煞类",
  relation: "关系类",
  life_stage_hidden: "藏干/十二长生",
  dayun: "大运类",
  core_structure: "核心结构(用神喜忌强弱)",
};

/** Categories where "prefer underused" guidance applies (not core_structure). */
export const ANCHOR_DIVERSITY_CATEGORIES: readonly AnchorCategoryId[] = [
  "ten_god",
  "shen_sha",
  "relation",
  "life_stage_hidden",
  "dayun",
] as const;

export type CategoryTokenSets = Record<AnchorCategoryId, ReadonlySet<string>>;

export type CategoryUsageTally = {
  byCategory: Record<
    AnchorCategoryId,
    { count: number; items: Array<{ token: string; hits: number }> }
  >;
  priorAnchors: string[];
  inventoryTokens: string[];
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function pushUnique(set: Set<string>, ...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const t = (v ?? "").trim();
    if (t) set.add(t);
  }
}

/** Build inventory token sets from ProfileStructured (when available). */
export function buildCategoryTokenSetsFromStructured(
  structured: ProfileStructured | null | undefined,
): CategoryTokenSets {
  const ten_god = new Set<string>();
  const shen_sha = new Set<string>();
  const relation = new Set<string>();
  const life_stage_hidden = new Set<string>();
  const dayun = new Set<string>();
  const core_structure = new Set<string>();

  if (structured) {
    if (structured.pillars_detail) {
      for (const key of ["year", "month", "day", "hour"] as const) {
        const p = structured.pillars_detail[key];
        pushUnique(ten_god, p.ten_god);
        for (const s of p.shen_sha ?? []) pushUnique(shen_sha, s);
        pushUnique(life_stage_hidden, p.life_stage_han);
        for (const h of p.hidden_stems ?? []) pushUnique(life_stage_hidden, h);
      }
    }
    for (const d of structured.da_yun ?? []) {
      pushUnique(dayun, d.ganzhi, `${d.ganzhi}(${d.start_age}岁起)`, "大运");
    }
    const strengthHan =
      structured.strength === "strong"
        ? "身强"
        : structured.strength === "weak"
          ? "身弱"
          : "平衡";
    pushUnique(
      core_structure,
      structured.yong_shen,
      ...(structured.xi_shen ?? []),
      ...(structured.ji_shen ?? []),
      strengthHan,
      structured.pattern,
      "用神",
      "喜神",
      "忌神",
      "身弱",
      "身强",
    );
    try {
      for (const r of computeNatalChartRelations(structured)) {
        pushUnique(relation, r.han);
      }
    } catch {
      // relation engine optional — fall back to heuristics only
    }
  }

  // Heuristic seeds so classification still works without structured
  for (const t of [
    "比肩",
    "劫财",
    "食神",
    "伤官",
    "偏财",
    "正财",
    "七杀",
    "正官",
    "偏印",
    "正印",
    "官杀",
    "元女",
  ]) {
    ten_god.add(t);
  }
  for (const t of [
    "寡宿",
    "将星",
    "月德",
    "月德贵人",
    "月德合",
    "天乙贵人",
    "德秀贵人",
    "文昌",
    "桃花",
  ]) {
    shen_sha.add(t);
  }
  for (const t of [
    "相冲",
    "相合",
    "六合",
    "三合",
    "半合",
    "相害",
    "相刑",
    "午未六合",
    "子未相害",
    "子辰半合",
    "流年",
  ]) {
    relation.add(t);
  }
  for (const t of ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养", "藏干"]) {
    life_stage_hidden.add(t);
  }
  for (const t of ["大运", "甲子", "乙丑", "气候交织"]) {
    dayun.add(t);
  }
  for (const t of ["用神", "喜神", "忌神", "身弱", "身强", "用神水", "忌神火土"]) {
    core_structure.add(t);
  }

  return {
    ten_god,
    shen_sha,
    relation,
    life_stage_hidden,
    dayun,
    core_structure,
  };
}

function tokenMatchesSet(token: string, set: ReadonlySet<string>): boolean {
  const n = normalize(token);
  if (!n) return false;
  for (const item of set) {
    const m = normalize(item);
    if (!m) continue;
    if (n === m || n.includes(m) || m.includes(n)) return true;
  }
  return false;
}

/** Classify one anchor string into the first matching category (priority order). */
export function classifyAnchorToken(
  token: string,
  sets: CategoryTokenSets,
): AnchorCategoryId | null {
  const order: AnchorCategoryId[] = [
    "relation",
    "shen_sha",
    "ten_god",
    "dayun",
    "life_stage_hidden",
    "core_structure",
  ];
  for (const cat of order) {
    if (tokenMatchesSet(token, sets[cat])) return cat;
  }
  // Fallback heuristics for compound evidence tokens
  if (/大运|甲子|乙丑|气候交织/.test(token)) return "dayun";
  if (/合|冲|刑|害|半合|三合|流年/.test(token)) return "relation";
  if (/绝|养|冠带|长生|藏干/.test(token)) return "life_stage_hidden";
  if (/用神|忌神|喜神|身弱|身强/.test(token)) return "core_structure";
  if (/官|杀|印|财|食|伤|比|劫/.test(token)) return "ten_god";
  if (/宿|贵人|将星|桃花|文昌|德/.test(token)) return "shen_sha";
  return null;
}

export function flattenAnchorsFromPageSchema(
  pageKey: string,
  page: DeliveryPageData | Record<string, unknown>,
): string[] {
  const units = collectPageAnchorUnits(pageKey, page as Record<string, unknown>);
  const out: string[] = [];
  for (const u of units) {
    for (const a of u.anchors) {
      if (a.trim()) out.push(a.trim());
    }
  }
  return out;
}

export function tallyAnchorCategoryUsage(
  usedAnchors: readonly string[],
  sets?: CategoryTokenSets | null,
): CategoryUsageTally {
  const categorySets = sets ?? buildCategoryTokenSetsFromStructured(null);
  const empty = (): CategoryUsageTally["byCategory"][AnchorCategoryId] => ({
    count: 0,
    items: [],
  });
  const byCategory: CategoryUsageTally["byCategory"] = {
    ten_god: empty(),
    shen_sha: empty(),
    relation: empty(),
    life_stage_hidden: empty(),
    dayun: empty(),
    core_structure: empty(),
  };

  const hitMap = new Map<string, { cat: AnchorCategoryId; hits: number }>();
  for (const raw of usedAnchors) {
    const token = raw.trim();
    if (!token) continue;
    const cat = classifyAnchorToken(token, categorySets);
    if (!cat) continue;
    const key = `${cat}::${token}`;
    const prev = hitMap.get(key);
    if (prev) prev.hits += 1;
    else hitMap.set(key, { cat, hits: 1 });
  }

  for (const [key, { cat, hits }] of hitMap) {
    const token = key.slice(key.indexOf("::") + 2);
    byCategory[cat].count += hits;
    byCategory[cat].items.push({ token, hits });
  }
  for (const cat of Object.keys(byCategory) as AnchorCategoryId[]) {
    byCategory[cat].items.sort((a, b) => b.hits - a.hits);
  }

  const inventoryTokens = [
    ...categorySets.ten_god,
    ...categorySets.shen_sha,
    ...categorySets.relation,
    ...categorySets.life_stage_hidden,
    ...categorySets.dayun,
    ...categorySets.core_structure,
  ];

  return {
    byCategory,
    priorAnchors: [...new Set(usedAnchors.map((a) => a.trim()).filter(Boolean))],
    inventoryTokens: [...new Set(inventoryTokens)],
  };
}

/** Format tally for fill user message (zh). */
export function formatAnchorCategoryUsageForPrompt(tally: CategoryUsageTally): string {
  if (tally.priorAnchors.length === 0) {
    return [
      "【本报告已用锚点类目分布 · 供你参考,避免扎堆】",
      "尚无上游页产出 chart_anchors。本页仍从真算闭集中选最短承重链；勿预支万金油词。",
      "本页仍遵守「不凑数、不砍必要锚」。",
    ].join("\n");
  }

  const lines: string[] = ["【本报告已用锚点类目分布 · 供你参考,避免扎堆】"];
  for (const cat of ANCHOR_DIVERSITY_CATEGORIES) {
    const row = tally.byCategory[cat];
    const label = ANCHOR_CATEGORY_LABEL_ZH[cat];
    if (row.count === 0) {
      lines.push(`· ${label}：已用 0 次 ← 本页若有贴切项,优先评估这里`);
      continue;
    }
    const topFmt = row.items
      .slice(0, 6)
      .map((i) => `${i.token}${i.hits}`)
      .join("/");
    lines.push(`· ${label}：已用 ${row.count} 次(${topFmt})`);
  }
  const core = tally.byCategory.core_structure;
  if (core.count > 0) {
    const topFmt = core.items
      .slice(0, 4)
      .map((i) => `${i.token}${i.hits}`)
      .join("/");
    lines.push(
      `· ${ANCHOR_CATEGORY_LABEL_ZH.core_structure}：已用 ${core.count} 次(${topFmt}) — 可复用承重,勿当作唯一万金油`,
    );
  }
  lines.push(
    "本页仍遵守「不凑数、不砍必要锚」——以上仅供你判断是否有更贴切但还没被注意到的锚点,不是强制配额。",
  );
  return lines.join("\n");
}

/** Try pull ProfileStructured from final-delivery base_analysis blob. */
export function tryStructuredFromBaseAnalysis(base: unknown): ProfileStructured | null {
  if (!base || typeof base !== "object") return null;
  const o = base as Record<string, unknown>;
  const candidates = [o.structured, o.profile_structured, o];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const s = c as Record<string, unknown>;
    if (
      typeof s.yong_shen === "string" ||
      Array.isArray(s.da_yun) ||
      (s.pillars_detail && typeof s.pillars_detail === "object")
    ) {
      return c as ProfileStructured;
    }
  }
  return null;
}
