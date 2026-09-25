/**
 * Prealloc must draw ONLY from thesis closed menu (D1).
 * Shadow 神煞/长生/历史大运/相害≠相刑/元男 must never enter all_primaries.
 *
 * Run: pnpm exec tsx scripts/test-prealloc-thesis-menu.ts
 */
import assert from "node:assert/strict";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_NAME_ZH } from "@/lib/llm/pro/delivery/thesis/types";
import { buildThesisAssignMenu, isAssignMenuEligibleSlug } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import { extractThesisFactTokens } from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import { judgmentOffChartReason } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  assertPreallocPrimariesGroundedInThesis,
  preallocateChartPrimaries,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const thesis: ChartThesis = {
  version: 1,
  structured_fingerprint: "prealloc-menu-fixture",
  generated_at: "2026-09-16T00:00:00.000Z",
  judgment_core_frozen: true,
  as_of_day: "2026-09-17",
  question_category: "career",
  dimensions: [
    {
      dimension_id: "day_master_strength",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.day_master_strength,
      depth: "full",
      strength_verdict: "身弱",
      classical_basis: [
        {
          key: "day_master",
          present: true,
          summary_zh: "日主乙；刑冲：巳寅相刑",
        },
        {
          key: "stem_he",
          present: true,
          summary_zh: "天干合：日主乙庚相合合化金",
        },
        {
          key: "pillar_gods_distribution",
          present: true,
          summary_zh: "四柱十神分布：年柱食神、月柱正印、日柱元男、时柱正官",
        },
      ],
      usable_claims_hint: ["day_master:乙", "strength_verdict:身弱"],
      wuxing_relations: [],
      conclusion_zh: "身弱；巳寅相刑；日主乙庚相合合化金",
    },
    {
      dimension_id: "favor_avoid_tuning",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.favor_avoid_tuning,
      depth: "brief",
      classical_basis: [
        {
          key: "yong_shen",
          present: true,
          summary_zh: "用神：水",
        },
      ],
      usable_claims_hint: ["wuxing:yong:水"],
      wuxing_relations: [],
      conclusion_zh: "用神水",
    },
    {
      dimension_id: "interpersonal_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.interpersonal_pattern,
      depth: "brief",
      classical_basis: [
        {
          key: "officer_gods",
          present: true,
          summary_zh: "官杀：时柱正官",
        },
      ],
      usable_claims_hint: ["ten_god:正官"],
      wuxing_relations: [],
      conclusion_zh: "正官",
    },
    {
      dimension_id: "cycle_rhythm",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.cycle_rhythm,
      depth: "full",
      classical_basis: [
        {
          key: "current_da_yun",
          present: true,
          summary_zh: "当前大运：丁酉（十神食神）",
        },
        {
          key: "current_liunian",
          present: true,
          summary_zh: "当前流年：丙午（十神伤官）",
        },
      ],
      usable_claims_hint: ["da_yun:丁酉", "liunian:丙午"],
      wuxing_relations: [],
      conclusion_zh: "丁酉×丙午",
    },
    {
      dimension_id: "resource_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.resource_pattern,
      depth: "full",
      classical_basis: [
        {
          key: "wealth_gods",
          present: true,
          summary_zh: "财星藏而不显：正财",
        },
      ],
      usable_claims_hint: ["ten_god_hidden:正财:戊"],
      wuxing_relations: [],
      conclusion_zh: "正财藏而不显",
    },
    {
      dimension_id: "expression_creativity",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.expression_creativity,
      depth: "brief",
      classical_basis: [
        {
          key: "output_gods",
          present: true,
          summary_zh: "食神/伤官：年柱食神",
        },
      ],
      usable_claims_hint: ["ten_god:食神"],
      wuxing_relations: [],
      conclusion_zh: "食神",
    },
  ],
};

// --- 元男 is structural placeholder, not menu-eligible ---
assert.equal(isAssignMenuEligibleSlug("元男"), false);
assert.equal(isAssignMenuEligibleSlug("巳寅相刑"), true);
assert.equal(isAssignMenuEligibleSlug("金舆"), true); // eligible shape, but must NOT be in thesis corpus
assert.equal(isAssignMenuEligibleSlug("格局"), false, "方案A#7 格局壳禁入菜单");
assert.equal(isAssignMenuEligibleSlug("六合"), false, "方案A#7 裸六合禁入菜单");
assert.equal(isAssignMenuEligibleSlug("辰酉六合"), true);

const menu = buildThesisAssignMenu(thesis);
const menuSlugs = new Set(menu.map((m) => m.slug));
assert.ok(menuSlugs.has("巳寅相刑") || [...menuSlugs].some((s) => s.includes("巳寅相刑")), `menu=${[...menuSlugs]}`);
assert.ok(
  [...menuSlugs].some((s) => s.includes("乙庚相合") || s.includes("日主乙庚相合")),
  `stem_he missing from menu: ${[...menuSlugs]}`,
);
assert.equal(menuSlugs.has("元男"), false, "元男 must not enter menu");
assert.equal(menuSlugs.has("金舆"), false);
assert.equal(menuSlugs.has("沐浴"), false);
assert.equal(menuSlugs.has("辛丑"), false);
assert.equal(menuSlugs.has("巳寅相害"), false);
assert.equal(menuSlugs.has("格局"), false, "格局壳不得入菜单");
assert.equal(menuSlugs.has("六合"), false, "裸六合不得入菜单");
// 方案 A #7：裸纳音柱不得进非 cycle 菜单槽（乙巳 日柱等）
assert.equal(menuSlugs.has("乙巳"), false, "natal bare pillar must not enter non-cycle menu");
assert.equal(menuSlugs.has("丁巳"), false, "natal bare pillar must not enter non-cycle menu");

{
  const toks = extractThesisFactTokens("岁运引动辰酉六合；另见巳寅相刑");
  assert.ok(
    toks.includes("辰酉六合") || toks.some((t) => t.includes("辰酉") && t.includes("六合")),
    String(toks),
  );
  assert.ok(
    !toks.includes("六合"),
    `bare 六合 must be dropped when longer exists: ${String(toks)}`,
  );
}

const map = preallocateChartPrimaries({
  thesis,
  pages: ["foundation", "science_action", "metaphysics_action", "risk_guard", "signals_close"],
});
assert.equal(map.pool_source, "thesis_menu");
assert.ok(map.deep_slots_allocated > 0, "allocated some");
assert.ok(map.unique_strong_primaries > 0);

const SHADOW = [
  "金舆",
  "天德贵人",
  "德秀贵人",
  "羊刃",
  "天德",
  "沐浴",
  "帝旺",
  "冠带",
  "长生",
  "临官",
  "辛丑",
  "巳寅相害",
  "元男",
];
for (const bad of SHADOW) {
  assert.equal(
    map.all_primaries.includes(bad),
    false,
    `shadow leaked: ${bad} in ${map.all_primaries.join(",")}`,
  );
}

const grounded = assertPreallocPrimariesGroundedInThesis(map, thesis);
assert.equal(grounded.ok, true, grounded.ok ? "" : JSON.stringify(grounded));

// Relation kind must be exact — 相害 must not slip in via fuzzy name
assert.equal(
  map.all_primaries.some((p) => p.includes("相害")),
  false,
  "no 相害 when thesis only has 相刑",
);

// Empty thesis → empty pool (no inventory fallback)
{
  const empty = preallocateChartPrimaries({ thesis: null });
  assert.equal(empty.pool_source, "empty");
  assert.equal(empty.deep_slots_allocated, 0);
  assert.deepEqual(empty.all_primaries, []);
  assert.ok(empty.qimen_cast_at, "empty pool still locks qimen pan");
  assert.ok(empty.chart_fact_pack?.includes("【奇门锁盘·交付起局】"));
}

// Real structured chart: 丁巳 壬寅 乙巳 庚辰 → stem_he present in thesis feed
{
  const structured = {
    day_master: "乙",
    yong_shen: "water",
    xi_shen: ["metal"],
    ji_shen: ["fire", "earth"],
    strength: "weak",
    pattern: "日主 乙，四柱 丁巳 壬寅 乙巳 庚辰。",
    four_pillars: {
      year: "丁巳",
      month: "壬寅",
      day: "乙巳",
      hour: "庚辰",
    },
    pillars_detail: {
      year: {
        ganzhi: "丁巳",
        stem: "丁",
        branch: "巳",
        ten_god: "食神",
        hidden_stems: ["丙", "戊", "庚"],
        shen_sha: ["将星", "血刃", "德秀贵人"],
      },
      month: {
        ganzhi: "壬寅",
        stem: "壬",
        branch: "寅",
        ten_god: "正印",
        hidden_stems: ["甲", "丙", "戊"],
      },
      day: {
        ganzhi: "乙巳",
        stem: "乙",
        branch: "巳",
        ten_god: "元男",
        hidden_stems: ["丙", "戊", "庚"],
      },
      hour: {
        ganzhi: "庚辰",
        stem: "庚",
        branch: "辰",
        ten_god: "正官",
        hidden_stems: ["戊", "乙", "癸"],
      },
    },
  } as unknown as ProfileStructured;

  const live = buildChartThesisFromStructured(structured, null, {
    question_category: "career",
    as_of: new Date("2026-09-17T12:00:00.000Z"),
  });
  const dm = live.dimensions.find((d) => d.dimension_id === "day_master_strength");
  const rawBasis = dm?.classical_basis;
  const basis: Array<{ key?: string; present?: boolean; summary_zh?: string }> =
    Array.isArray(rawBasis) ? rawBasis : [];
  const stemItem = basis.find((i) => i.key === "stem_he");
  assert.ok(stemItem?.present, "乙×庚 must yield stem_he present");
  assert.ok(
    stemItem?.summary_zh?.includes("乙庚相合") ||
      stemItem?.summary_zh?.includes("日主乙庚相合"),
    stemItem?.summary_zh,
  );

  const liveMap = preallocateChartPrimaries({ thesis: live, structured });
  assert.equal(liveMap.pool_source, "chart_fact_pack");
  const pack = liveMap.chart_fact_pack ?? "";
  assert.ok(pack.includes("乙"), "day master stem must stay in the fact pack");
  assert.ok(pack.includes("日主"), pack);
  assert.ok(pack.includes("丁巳") && pack.includes("庚辰"), pack);
  assert.ok(pack.includes("用神水"), pack);
  assert.ok(pack.includes("喜金") && pack.includes("忌火土"), pack);
  assert.ok(pack.includes("将星"), pack);
  assert.ok(pack.includes("德秀贵人"), pack);
  assert.ok(pack.includes("【奇门锁盘·交付起局】"), "qimen lock section required");
  assert.ok(liveMap.qimen_cast_at, "qimen_cast_at locked");
  assert.ok(liveMap.qimen?.ju_name?.includes("局"), liveMap.qimen?.ju_name);
  assert.equal(pack.includes("血刃"), false, pack);
  assert.equal(pack.includes("太阳太阴"), false, pack);
  assert.equal(pack.includes("元男"), false, pack);
  assert.equal(Object.keys(liveMap.by_page).length, 0, "do not copy a slug menu onto cards");
  const gate = {
    ganzhi: liveMap.chart_fact_ganzhi ?? [],
    shen_sha: liveMap.chart_fact_shen_sha ?? [],
  };
  assert.equal(
    judgmentOffChartReason("日主乙，用神。身强得令。", gate),
    null,
  );
  assert.equal(
    judgmentOffChartReason("年柱⟦w:德秀贵人⟧。将星在年。", gate),
    null,
  );
  assert.match(
    judgmentOffChartReason("旁盘⟦w:金舆⟧。", gate) ?? "",
    /^off_chart_shen_sha:金舆/,
  );
  assert.match(
    judgmentOffChartReason("柱上有⟦w:血刃⟧。", gate) ?? "",
    /^fear_term:血刃/,
  );
}

console.log("ok prealloc-thesis-menu", {
  menu: menu.length,
  allocated: map.deep_slots_allocated,
  unique: map.unique_strong_primaries,
  sparse: map.sparse_mode,
  sample: map.all_primaries.slice(0, 8),
});
