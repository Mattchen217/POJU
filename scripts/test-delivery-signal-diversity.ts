/**
 * Smoke: chart-primary prealloc reuse cap + sparse degradation + diversity ratio.
 */
import assert from "node:assert/strict";
import type { CategoryTokenSets } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { forceDiversifyChartAnchors } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  assertSignalDiversity,
  preallocateChartPrimaries,
  resolveSparsePrimaryReuseCap,
  validatePrimaryReuseCap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";

function emptySets(partial: Partial<Record<keyof CategoryTokenSets, readonly string[]>>): CategoryTokenSets {
  const toSet = (xs: readonly string[] | undefined) => new Set(xs ?? []);
  return {
    ten_god: toSet(partial.ten_god),
    shen_sha: toSet(partial.shen_sha),
    relation: toSet(partial.relation),
    life_stage_hidden: toSet(partial.life_stage_hidden),
    dayun: toSet(partial.dayun),
    core_structure: toSet(partial.core_structure),
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

// --- rich inventory: unique enough, cap 2 ---
{
  const sets = emptySets({
    ten_god: ["正印", "七杀", "食神", "伤官", "偏财", "正财", "比肩", "劫财"],
    dayun: ["大运", "流年", "岁运", "气候交织"],
    core_structure: ["用神水", "忌神火", "身弱", "喜神金"],
    shen_sha: ["天乙贵人", "天德", "月德"],
    relation: ["六合", "三合"],
  });
  const map = preallocateChartPrimaries({
    category_token_sets: sets,
    pages: ["foundation", "science_action", "metaphysics_action"],
  });
  assert.equal(map.sparse_mode, false, "rich pool should not be sparse");
  assert.equal(map.reuse_cap, 2);
  const check = validatePrimaryReuseCap(map.all_primaries, { cap: map.reuse_cap });
  assert.equal(check.ok, true, check.ok ? "" : check.reason);
  const div = assertSignalDiversity(map.all_primaries, {
    sparse_mode: map.sparse_mode,
    reuse_cap: map.reuse_cap,
  });
  assert.equal(div.ok, true, div.ok ? "" : div.reason);
  assert.ok(map.all_primaries.length >= 6, "allocated some slots");
}

// --- sparse inventory: dynamic cap, no out-of-pool tokens ---
{
  const pool = ["正印", "大运", "用神水"];
  const sets = emptySets({
    ten_god: ["正印"],
    dayun: ["大运"],
    core_structure: ["用神水"],
  });
  const map = preallocateChartPrimaries({
    category_token_sets: sets,
    pages: ["foundation", "science_action", "metaphysics_action", "risk_guard"],
  });
  assert.equal(map.sparse_mode, true, "thin pool → sparse");
  assert.ok(map.reuse_cap >= 2);
  const check = validatePrimaryReuseCap(map.all_primaries, { cap: map.reuse_cap });
  assert.equal(check.ok, true, check.ok ? "" : JSON.stringify(check));
  for (const p of map.all_primaries) {
    assert.ok(pool.includes(p), `must stay in pool: ${p}`);
  }
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

// --- forceDiversify stays inside prealloc table ---
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
  const primaries = out.map((u) => u.chart_anchors[0]!);
  assert.deepEqual(new Set(primaries).size, 3);
  for (const p of primaries) {
    assert.ok(["正印", "大运", "用神水"].includes(p), `out of prealloc: ${p}`);
  }
  assert.ok(!primaries.includes("假锚外"));
}

console.log("test-delivery-signal-diversity: ok");
