/**
 * §5 acceptance smokes for 命盘总纲与依据渲染规范 (automatable subset).
 * Run: pnpm exec tsx scripts/test-chart-thesis-acceptance.ts
 */
import assert from "node:assert/strict";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  assertEvidenceRemnantClean,
  findEvidenceRemnant,
} from "@/lib/llm/pro/delivery/evidence-remnant-gate";
import {
  buildChartThesisFromStructured,
  buildThesisCalcFeed,
  fingerprintThesisStructured,
  extendThesisDimension,
} from "@/lib/llm/pro/delivery/thesis";
import { THESIS_ABSENT_SUMMARY_ZH } from "@/lib/llm/pro/delivery/thesis/types";
import {
  LIUZHAN_INFERENCE_FIXTURE,
  inferencesAreNearDuplicate,
  validateNecessarySignalsContract,
} from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";
import {
  clampEvidenceUnitCount,
  PAGE_EVIDENCE_UNIT_SOFT_CAP,
  pageEvidenceUnitBounds,
} from "@/lib/llm/pro/delivery/page-schema/evidence-unit-soft-cap";

function baseStructured(over: Partial<ProfileStructured> = {}): ProfileStructured {
  return {
    day_master: "丁",
    pattern: "建禄",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "strong",
    four_pillars: { year: "甲子", month: "丙午", day: "丁未", hour: "庚戌" },
    pillars_detail: {
      year: { ten_god: "偏印" },
      month: { ten_god: "劫财" },
      day: { ten_god: "日主" },
      hour: { ten_god: "偏财" },
    } as ProfileStructured["pillars_detail"],
    da_yun: [{ ganzhi: "戊申", start_age: 1, start_year: 1990 }],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
    ...over,
  };
}

{
  // L383 remnant 0
  const l383 =
    "由此先带动这一层变化由此先带动这一层变化【火】【水:水】";
  assert.ok(findEvidenceRemnant(l383));
  assert.equal(assertEvidenceRemnantClean(l383).ok, false);
  const clean = "岁环压力上升，储备被透支，宜先守节奏。";
  assert.equal(assertEvidenceRemnantClean(clean).ok, true);
}

{
  // Empty wealth / expression → 未见相关特征
  const empty = baseStructured({
    pillars_detail: {
      year: { ten_god: "比肩" },
      month: { ten_god: "劫财" },
      day: { ten_god: "日主" },
      hour: { ten_god: "比肩" },
    } as ProfileStructured["pillars_detail"],
  });
  const feed = buildThesisCalcFeed(empty);
  assert.equal(feed.dimensions.resource_pattern.empty, true);
  assert.equal(feed.dimensions.expression_creativity.empty, true);
  const thesis = buildChartThesisFromStructured(empty, "要不要换城市");
  const resource = thesis.dimensions.find((d) => d.dimension_id === "resource_pattern");
  assert.ok(resource);
  const basisBlob = JSON.stringify(resource!.classical_basis);
  assert.ok(
    basisBlob.includes(THESIS_ABSENT_SUMMARY_ZH) ||
      resource!.conclusion_zh.includes("不明显"),
  );
}

{
  // Same chart, different agendas → judgment core (strength_verdict) identical
  const s = baseStructured();
  const fp = fingerprintThesisStructured(s);
  const a = buildChartThesisFromStructured(s, "要不要辞职创业攒安全垫");
  const b = buildChartThesisFromStructured(s, "要不要换城市生活");
  assert.equal(a.structured_fingerprint, fp);
  assert.equal(b.structured_fingerprint, fp);
  const va = a.dimensions.find((d) => d.dimension_id === "day_master_strength")
    ?.strength_verdict;
  const vb = b.dimensions.find((d) => d.dimension_id === "day_master_strength")
    ?.strength_verdict;
  assert.equal(va, vb);
  const fa = a.dimensions.find((d) => d.dimension_id === "favor_avoid_tuning");
  const fb = b.dimensions.find((d) => d.dimension_id === "favor_avoid_tuning");
  assert.deepEqual(fa?.classical_basis, fb?.classical_basis);
  assert.deepEqual(fa?.wuxing_relations, fb?.wuxing_relations);
}

{
  // 流展 inference fixture near-dup
  const f = LIUZHAN_INFERENCE_FIXTURE;
  assert.equal(
    inferencesAreNearDuplicate(f.inference_l357, f.inference_l396),
    true,
  );
  assert.equal(
    inferencesAreNearDuplicate(f.inference_distinct_a, f.inference_distinct_b),
    false,
  );
  const prior = [
    {
      slug: f.slug,
      role: "输出",
      dimension_id: f.dimension_id,
      inference_zh: f.inference_l311,
      page: "science_action",
      path: "a",
    },
    {
      slug: f.slug,
      role: "底蕴",
      dimension_id: f.dimension_id,
      inference_zh: f.inference_l357,
      page: "metaphysics_action",
      path: "b",
    },
  ];
  const failReason = validateNecessarySignalsContract({
    unit_claim: "产品化交付能力",
    necessary_signals: [
      {
        slug: f.slug,
        dimension_id: f.dimension_id,
        inference_zh: f.inference_l396,
        role: "解释输出",
        why_needed: "去掉此信号，无法解释为何能标准化交付",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: prior,
  });
  assert.equal(
    failReason,
    `inference_cross_dup:${f.dimension_id}`,
  );
}

{
  // extend thesis refines hints, respects cap
  const s = baseStructured();
  const thesis = buildChartThesisFromStructured(s, null);
  const ext = extendThesisDimension({
    thesis,
    structured: s,
    gap_claim_zh: "安全垫焦虑",
    prefer_dimension_id: "resource_pattern",
  });
  assert.equal(ext.ok, true);
  if (ext.ok) {
    const dim = ext.thesis.dimensions.find((d) => d.dimension_id === "resource_pattern");
    assert.ok(dim?.usable_claims_hint.some((h) => h.includes("安全垫")));
  }
}

{
  // Unit soft cap / dynamic bounds
  assert.ok(PAGE_EVIDENCE_UNIT_SOFT_CAP >= 6);
  const b = pageEvidenceUnitBounds("foundation");
  assert.ok(b.max <= PAGE_EVIDENCE_UNIT_SOFT_CAP);
  assert.equal(clampEvidenceUnitCount("foundation", 99), b.max);
  assert.equal(clampEvidenceUnitCount("foundation", 1), b.min);
}

console.log("test-chart-thesis-acceptance: ok");
