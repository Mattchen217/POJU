/**
 * Smoke: deterministic ThesisCalcFeed + judgment core.
 * Run: pnpm exec tsx scripts/test-thesis-calc-feed.ts
 */
import assert from "node:assert/strict";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  applyAgendaDepth,
  buildChartThesisFromStructured,
  buildJudgmentCoreFromFeed,
  buildThesisCalcFeed,
  fingerprintThesisStructured,
  THESIS_ABSENT_SUMMARY_ZH,
} from "@/lib/llm/pro/delivery/thesis";

function baseStructured(overrides?: {
  tenGods?: Partial<Record<"year" | "month" | "day" | "hour", string>>;
}): ProfileStructured {
  const ten = {
    year: "比肩",
    month: "正印",
    day: "日主",
    hour: "正印",
    ...overrides?.tenGods,
  };
  const pillar = (gz: string, ten_god: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god,
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: "甲",
    pattern: "正格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "乙亥", day: "甲辰", hour: "癸酉" },
    pillars_detail: {
      year: pillar("甲子", ten.year),
      month: pillar("乙亥", ten.month),
      day: pillar("甲辰", ten.day === "日主" ? "" : ten.day),
      hour: pillar("癸酉", ten.hour),
    },
    da_yun: [
      { start_age: 8, start_year: 2010, ganzhi: "丁酉" },
      { start_age: 18, start_year: 2020, ganzhi: "丙申" },
    ],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
  };
}

console.log("\n=== thesis calc feed smoke ===\n");

{
  // No wealth / output gods → empty resource + expression; 合局 absent marker present.
  const structured = baseStructured({
    tenGods: { year: "比肩", month: "正印", day: "", hour: "七杀" },
  });
  const feed = buildThesisCalcFeed(structured, { nowYear: 2024 });
  assert.equal(feed.dimensions.resource_pattern.empty, true, "resource empty without wealth");
  assert.equal(feed.dimensions.expression_creativity.empty, true, "expression empty without 食伤");
  assert.equal(feed.dimensions.day_master_strength.strength_verdict, "身弱");

  const heJu = feed.dimensions.day_master_strength.items.find((i) => i.key === "branch_he_ju");
  assert.ok(heJu);
  if (!heJu!.present) {
    assert.equal(heJu!.summary_zh, THESIS_ABSENT_SUMMARY_ZH);
  } else {
    assert.ok(heJu!.summary_zh.includes("合"), "present 合局 must name the real relation");
  }

  const core = buildJudgmentCoreFromFeed(feed);
  assert.equal(core.judgment_core_frozen, true);
  assert.equal(core.dimensions[0]?.dimension_id, "day_master_strength");

  const resource = core.dimensions.find((d) => d.dimension_id === "resource_pattern");
  assert.ok(resource);
  assert.ok(
    Array.isArray(resource!.classical_basis) &&
      resource!.classical_basis.some((i) => i.summary_zh === THESIS_ABSENT_SUMMARY_ZH),
    "classical_basis contains 未见相关特征",
  );

  const favor = core.dimensions.find((d) => d.dimension_id === "favor_avoid_tuning");
  assert.ok(Array.isArray(favor?.classical_basis));
  assert.ok(
    favor!.classical_basis.some(
      (i) => i.key === "strength_verdict_premise" && i.summary_zh.includes("身弱"),
    ),
    "favor_avoid cites strength_verdict",
  );
  console.log("ok empty wealth/output + absent 合局 + strength premise");
}

{
  const structured = baseStructured({
    tenGods: { year: "比肩", month: "食神", day: "正财", hour: "正印" },
  });
  const feed = buildThesisCalcFeed(structured, { nowYear: 2024 });
  assert.equal(feed.dimensions.resource_pattern.empty, false, "resource not empty with 正财");
  assert.equal(feed.dimensions.expression_creativity.empty, false, "expression not empty with 食神");
  assert.ok(
    feed.dimensions.resource_pattern.items.some((i) => i.present && i.summary_zh.includes("正财")),
  );
  assert.ok(
    feed.dimensions.expression_creativity.items.some(
      (i) => i.present && i.summary_zh.includes("食神"),
    ),
  );
  console.log("ok 正财 + 食神 not empty");
}

{
  // Pillars with no natal 合局 (sanhe/banhe/liuhe) — must write 未见相关特征.
  const pillar = (gz: string, ten_god: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god,
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  const structured: ProfileStructured = {
    ...baseStructured({ tenGods: { year: "比肩", month: "正印", day: "", hour: "正印" } }),
    four_pillars: { year: "甲寅", month: "乙卯", day: "甲辰", hour: "乙巳" },
    pillars_detail: {
      year: pillar("甲寅", "比肩"),
      month: pillar("乙卯", "正印"),
      day: pillar("甲辰", ""),
      hour: pillar("乙巳", "正印"),
    },
  };
  const feed = buildThesisCalcFeed(structured, { nowYear: 2024 });
  const heJu = feed.dimensions.day_master_strength.items.find((i) => i.key === "branch_he_ju");
  assert.ok(heJu);
  assert.equal(heJu!.present, false);
  assert.equal(heJu!.summary_zh, THESIS_ABSENT_SUMMARY_ZH);
  console.log("ok no-合局 writes 未见相关特征");
}

{
  const a = baseStructured();
  const b = baseStructured();
  assert.equal(fingerprintThesisStructured(a), fingerprintThesisStructured(b));
  assert.equal(
    buildThesisCalcFeed(a, { nowYear: 2024 }).fingerprint,
    buildThesisCalcFeed(b, { nowYear: 2024 }).fingerprint,
  );
  console.log("ok same fingerprint for same structured");
}

{
  const structured = baseStructured({
    tenGods: { year: "比肩", month: "食神", day: "正财", hour: "七杀" },
  });
  const feed = buildThesisCalcFeed(structured, { nowYear: 2024 });
  const core = buildJudgmentCoreFromFeed(feed);
  const dm = core.dimensions.find((d) => d.dimension_id === "day_master_strength");
  const before = dm?.strength_verdict;
  assert.ok(before);

  const after = applyAgendaDepth(core, "要不要辞职创业赚钱");
  const dmAfter = after.dimensions.find((d) => d.dimension_id === "day_master_strength");
  assert.equal(dmAfter?.strength_verdict, before, "agenda must not change strength_verdict");
  assert.deepEqual(
    dmAfter?.classical_basis,
    dm?.classical_basis,
    "agenda must not change classical_basis",
  );
  assert.deepEqual(
    dmAfter?.wuxing_relations,
    dm?.wuxing_relations,
    "agenda must not change wuxing_relations",
  );

  const resource = after.dimensions.find((d) => d.dimension_id === "resource_pattern");
  assert.equal(resource?.depth, "full");
  const cycle = after.dimensions.find((d) => d.dimension_id === "cycle_rhythm");
  assert.equal(cycle?.depth, "full");

  const composed = buildChartThesisFromStructured(structured, "创作表达方向", { nowYear: 2024 });
  const expr = composed.dimensions.find((d) => d.dimension_id === "expression_creativity");
  assert.equal(expr?.depth, "full");

  const family = applyAgendaDepth(core, "换城市生活节奏与家人相处");
  const interpersonal = family.dimensions.find((d) => d.dimension_id === "interpersonal_pattern");
  // Empty interpersonal stays brief; non-empty would be full via 家人 keyword.
  assert.ok(interpersonal);
  const cycleFam = family.dimensions.find((d) => d.dimension_id === "cycle_rhythm");
  assert.equal(cycleFam?.depth, "full", "家人议题 should target cycle_rhythm");
  console.log("ok applyAgendaDepth preserves verdict; compose works");
}

{
  // TopicCalcSupplement wiring: cycle_rhythm must see liunian; no 流日; category-invariant facts.
  const structured = baseStructured({
    tenGods: { year: "比肩", month: "食神", day: "正财", hour: "七杀" },
  });
  const career = buildThesisCalcFeed(structured, {
    nowYear: 2026,
    question_category: "career",
  });
  const wealth = buildThesisCalcFeed(structured, {
    nowYear: 2026,
    question_category: "wealth",
  });

  const ln = career.dimensions.cycle_rhythm.items.find((i) => i.key === "current_liunian");
  assert.ok(ln?.present, "current_liunian must be present via supplement");
  assert.equal(ln!.summary_zh.includes("流日"), false);

  const stack = career.dimensions.cycle_rhythm.items.find(
    (i) => i.key === "dayun_liunian_stack",
  );
  assert.ok(stack?.present, "dayun_liunian_stack must be present");

  const signals = career.dimensions.cycle_rhythm.items.find(
    (i) => i.key === "cycle_tension_signals",
  );
  assert.ok(signals);
  if (signals!.present) {
    assert.equal(signals!.summary_zh.includes("流日"), false);
    assert.equal(/宜|不利|有利/.test(signals!.summary_zh), false);
  }

  const favorStance = career.dimensions.favor_avoid_tuning.items.find(
    (i) => i.key === "dayun_element_stance",
  );
  assert.ok(favorStance?.present, "favor_avoid eats yongshen_activation");

  const dmItems = (feed: typeof career) =>
    JSON.stringify(
      feed.dimensions.day_master_strength.items.map((i) => [i.key, i.summary_zh]),
    );
  assert.equal(
    dmItems(career),
    dmItems(wealth),
    "day_master_strength facts must ignore question_category",
  );

  const favorFactKeys = (feed: typeof career) =>
    JSON.stringify(
      feed.dimensions.favor_avoid_tuning.items
        .filter((i) =>
          [
            "yong_shen",
            "xi_shen",
            "ji_shen",
            "dayun_element_stance",
            "liunian_element_stance",
            "element_stances_conflict",
          ].includes(i.key),
        )
        .map((i) => [i.key, i.summary_zh]),
    );
  assert.equal(
    favorFactKeys(career),
    favorFactKeys(wealth),
    "favor_avoid natal+element facts must ignore question_category",
  );

  console.log("ok supplement wiring: liunian + stance + category-invariant facts");
}

console.log("\nall thesis calc feed checks passed\n");
