/**
 * Smoke: chart-primary prealloc reuse cap + sparse degradation + diversity ratio.
 * Pool SSOT = thesis closed menu (no inventory / 神煞).
 */
import assert from "node:assert/strict";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_NAME_ZH } from "@/lib/llm/pro/delivery/thesis/types";
import {
  forceDiversifyChartAnchors,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  assertSignalDiversity,
  preallocateChartPrimaries,
  resolveSparsePrimaryReuseCap,
  normalizePrimaryReuseKey,
  validatePrimaryReuseCap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";

function dim(
  id: keyof typeof THESIS_DIMENSION_NAME_ZH,
  facts: string[],
): ChartThesis["dimensions"][number] {
  return {
    dimension_id: id,
    dimension_name_zh: THESIS_DIMENSION_NAME_ZH[id],
    depth: "full",
    classical_basis: facts.map((summary_zh, i) => ({
      key: `f${i}`,
      present: true,
      summary_zh,
    })),
    usable_claims_hint: facts,
    wuxing_relations: [],
    conclusion_zh: facts.join("。"),
  };
}

function richThesis(): ChartThesis {
  return {
    version: 1,
    structured_fingerprint: "diversity-rich",
    generated_at: "2026-09-16T00:00:00.000Z",
    judgment_core_frozen: true,
    as_of_day: "2026-09-17",
    question_category: "career",
    dimensions: [
      dim("day_master_strength", ["日主乙", "身弱", "巳寅相刑"]),
      dim("favor_avoid_tuning", ["用神：水", "喜神：木", "忌神：火"]),
      dim("interpersonal_pattern", ["时柱正官", "比肩藏而不显"]),
      dim("cycle_rhythm", ["当前大运：丁酉", "当前流年：丙午"]),
      dim("resource_pattern", ["正财藏而不显", "食神生财"]),
      dim("expression_creativity", ["年柱食神", "伤官兼藏"]),
    ],
  };
}

function thinThesis(): ChartThesis {
  return {
    version: 1,
    structured_fingerprint: "diversity-thin",
    generated_at: "2026-09-16T00:00:00.000Z",
    judgment_core_frozen: true,
    as_of_day: "2026-09-17",
    question_category: "career",
    dimensions: [
      dim("day_master_strength", ["身弱"]),
      dim("favor_avoid_tuning", ["用神：水"]),
      dim("interpersonal_pattern", ["正官"]),
      dim("cycle_rhythm", ["当前大运：丁酉"]),
      dim("resource_pattern", ["正财"]),
      dim("expression_creativity", ["食神"]),
    ],
  };
}

// --- reuse cap ---
{
  const ok = validatePrimaryReuseCap(["用神水", "大运", "用神水"], { cap: 2 });
  assert.equal(ok.ok, true);
  const bad = validatePrimaryReuseCap(["用神水", "用神水", "用神水"], { cap: 2 });
  assert.equal(bad.ok, false);
}

// --- sparse cap formula ---
{
  assert.equal(
    resolveSparsePrimaryReuseCap({ inventory_size: 10, slot_count: 12 }),
    2,
  );
  assert.equal(
    resolveSparsePrimaryReuseCap({ inventory_size: 4, slot_count: 12 }),
    3,
  );
}

// --- rich thesis menu: allocate without shadow ---
{
  const map = preallocateChartPrimaries({
    thesis: richThesis(),
    pages: ["foundation", "science_action", "metaphysics_action"],
  });
  assert.equal(map.pool_source, "thesis_menu");
  assert.equal(map.reuse_cap >= 2, true);
  const check = validatePrimaryReuseCap(map.all_primaries, { cap: map.reuse_cap });
  assert.equal(check.ok, true, check.ok ? "" : check.reason);
  assert.ok(map.all_primaries.length >= 3, "allocated some slots");
  assert.equal(map.all_primaries.includes("天乙贵人"), false);
  assert.equal(map.all_primaries.includes("金舆"), false);
}

// --- thin thesis: sparse / merge, stay in menu ---
{
  const thesis = thinThesis();
  const map = preallocateChartPrimaries({
    thesis,
    pages: ["foundation", "science_action", "metaphysics_action", "risk_guard"],
  });
  assert.equal(map.pool_source, "thesis_menu");
  const check = validatePrimaryReuseCap(map.all_primaries, { cap: map.reuse_cap });
  assert.equal(check.ok, true, check.ok ? "" : JSON.stringify(check));
  const div = assertSignalDiversity(map.all_primaries, {
    sparse_mode: true,
    reuse_cap: map.reuse_cap,
  });
  assert.equal(div.ok, true, "sparse mode skips 0.6 ratio knife");
}

// --- diversity ratio fails in normal mode when too few unique ---
{
  const fail = assertSignalDiversity(
    ["正印", "正印", "正印", "正印", "正印"],
    { sparse_mode: false, reuse_cap: 5 },
  );
  assert.equal(fail.ok, false);
}

// --- forceDiversify stays inside allowed table ---
{
  const units = [
    { chart_anchors: ["正印", "正印"] },
    { chart_anchors: ["正印", "大运"] },
    { chart_anchors: ["正印"] },
  ];
  const out = forceDiversifyChartAnchors(units, ["正印", "大运", "用神水", "假锚外"], {
    allowed_primaries: ["正印", "大运", "用神水"],
    reuse_cap: 1,
  });
  for (const u of out) {
    for (const a of u.chart_anchors) {
      assert.ok(["正印", "大运", "用神水"].includes(a), a);
    }
  }
}

// --- normalize aliases ---
{
  assert.equal(normalizePrimaryReuseKey("岁环"), "year");
  assert.equal(normalizePrimaryReuseKey("纪元"), "decade");
}

console.log("ok delivery-signal-diversity (thesis-menu pool)");
