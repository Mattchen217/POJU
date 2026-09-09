/**
 * Smoke: necessary_signals contract, claim split, 流展 cross-page role gate,
 * thesis inference_zh cross-dim gate (L311/L357/L396).
 */
import assert from "node:assert/strict";
import {
  LIUZHAN_CROSS_PAGE_FIXTURE,
  LIUZHAN_INFERENCE_FIXTURE,
  inferencesAreNearDuplicate,
  longestCommonHanSubstring,
  parseNecessarySignals,
  rolesAreNearDuplicate,
  isWhyNeededFluff,
  softRepairNecessarySignals,
  splitUnitClaim,
  validateNecessarySignalsContract,
} from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";
import { slimSharedAuxAnchors } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";

// why_needed fluff / specificity
assert.equal(isWhyNeededFluff("这个信号很重要"), true);
assert.equal(isWhyNeededFluff("对结论有支撑作用"), true);
assert.equal(
  isWhyNeededFluff(
    "去掉此信号，无法解释为什么缓冲总显得单薄，其余信号无法单独覆盖",
  ),
  false,
);

// 流展 cross-page fixture must trip near-duplicate (LCS / mid-band)
{
  assert.ok(
    rolesAreNearDuplicate(
      LIUZHAN_CROSS_PAGE_FIXTURE.role_p3,
      LIUZHAN_CROSS_PAGE_FIXTURE.role_p4,
    ),
    `liuzhan should near-dup; LCS=${longestCommonHanSubstring(
      LIUZHAN_CROSS_PAGE_FIXTURE.role_p3,
      LIUZHAN_CROSS_PAGE_FIXTURE.role_p4,
    )}`,
  );
  const fail = validateNecessarySignalsContract({
    unit_claim: "破局支点",
    necessary_signals: [
      {
        slug: LIUZHAN_CROSS_PAGE_FIXTURE.slug,
        role: LIUZHAN_CROSS_PAGE_FIXTURE.role_p4,
        why_needed: "去掉此信号，无法解释创造力支点如何转化为破局动作",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: [
      {
        slug: LIUZHAN_CROSS_PAGE_FIXTURE.slug,
        role: LIUZHAN_CROSS_PAGE_FIXTURE.role_p3,
        page: "science_action",
      },
    ],
  });
  assert.equal(fail, "role_cross_dup:流展");
}

// LIUZHAN_INFERENCE_FIXTURE — overlapping L311/L357/L396 must fail
{
  assert.ok(
    inferencesAreNearDuplicate(
      LIUZHAN_INFERENCE_FIXTURE.inference_l357,
      LIUZHAN_INFERENCE_FIXTURE.inference_l396,
    ),
    "l357/l396 share 输出能力 — must near-dup",
  );
  const fail = validateNecessarySignalsContract({
    unit_claim: "破局支点在技艺转化",
    necessary_signals: [
      {
        slug: LIUZHAN_INFERENCE_FIXTURE.slug,
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l396,
        role: "本页输出能力支点",
        why_needed: "去掉此信号，无法解释开创性输出如何落到破局动作",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: [
      {
        slug: LIUZHAN_INFERENCE_FIXTURE.slug,
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l311,
        role: "产品化输出",
        page: "science_action",
      },
      {
        slug: "流展辅",
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l357,
        role: "技术从容输出",
        page: "metaphysics_action",
      },
    ],
  });
  assert.equal(
    fail,
    `inference_cross_dup:${LIUZHAN_INFERENCE_FIXTURE.dimension_id}`,
  );
}

// softRepair MUST NOT rewrite inference_zh to dodge inference_cross_dup
{
  const repaired = softRepairNecessarySignals({
    unit_claim: "破局支点在技艺转化",
    necessary_signals: [
      {
        slug: LIUZHAN_INFERENCE_FIXTURE.slug,
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l396,
        role: "本页输出能力支点",
        why_needed: "去掉此信号，无法解释开创性输出如何落到破局动作",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: [
      {
        slug: "他词",
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l357,
        role: "技术从容输出",
        page: "science_action",
      },
    ],
  });
  assert.equal(
    repaired.necessary_signals[0]?.inference_zh,
    LIUZHAN_INFERENCE_FIXTURE.inference_l396,
    "softRepair must leave inference_zh untouched",
  );
  assert.ok(
    !repaired.repairs.some((x) => x.includes("inference")),
    "softRepair must not attempt inference paraphrase repairs",
  );
  assert.equal(
    validateNecessarySignalsContract({
      unit_claim: "破局支点在技艺转化",
      necessary_signals: repaired.necessary_signals,
      removal_test: repaired.removal_test,
      prior_signal_roles: [
        {
          slug: "他词",
          dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
          inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_l357,
          role: "技术从容输出",
          page: "science_action",
        },
      ],
    }),
    `inference_cross_dup:${LIUZHAN_INFERENCE_FIXTURE.dimension_id}`,
  );
}

// Three truly different inference_zh for same dimension — pass
{
  const ok = validateNecessarySignalsContract({
    unit_claim: "角色定位与投入上限",
    necessary_signals: [
      {
        slug: LIUZHAN_INFERENCE_FIXTURE.slug,
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_distinct_c,
        role: "解释为何须先控投入上限再扩产",
        why_needed: "去掉此信号，无法解释精力抽干与扩产节奏的冲突",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: [
      {
        slug: "流展",
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_distinct_a,
        role: "产品标准化交付",
        page: "science_action",
      },
      {
        slug: "伤官",
        dimension_id: LIUZHAN_INFERENCE_FIXTURE.dimension_id,
        inference_zh: LIUZHAN_INFERENCE_FIXTURE.inference_distinct_b,
        role: "合作话语权",
        page: "metaphysics_action",
      },
    ],
  });
  assert.equal(ok, null);
}

// dimension_id without inference_zh → fail
{
  const fail = validateNecessarySignalsContract({
    unit_claim: "资源分流",
    necessary_signals: [
      {
        slug: "竞合",
        dimension_id: "resource_pattern",
        role: "解释资源分流",
        why_needed: "去掉此信号，无法解释为何缓冲总偏薄",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
  });
  assert.equal(fail, "inference_zh_missing:竞合");
}

// chart_primary_slug alias → slug
{
  const parsed = parseNecessarySignals([
    {
      chart_primary_slug: "岁环",
      dimension_id: "cycle_rhythm",
      inference_zh: "当前岁环放大紧迫窗口",
      role: "解释时间紧迫",
      why_needed: "去掉此信号，无法解释为何此刻求助",
    },
  ]);
  assert.equal(parsed[0]?.slug, "岁环");
  assert.equal(parsed[0]?.dimension_id, "cycle_rhythm");
}

// positive minimal pair
{
  const ok = validateNecessarySignalsContract({
    unit_claim: "财务安全垫的脆弱感",
    necessary_signals: [
      {
        slug: "竞合",
        role: "解释为什么积蓄总是攒不厚——资源在同辈关系中被持续分流",
        why_needed:
          "去掉此信号，无法解释为什么明明收入不低、缓冲却总显得单薄，其余信号无法单独覆盖这个具体现象",
      },
      {
        slug: "岁环",
        role: "解释为什么是现在这个时间点感到紧迫——当前时间气候放大敏感度",
        why_needed:
          "去掉此信号，结论会显得是长期但不紧迫的问题，无法解释用户此刻主动求助的迫切性",
      },
    ],
    removal_test: {
      passed: true,
      notes: "成因与时机互补",
    },
  });
  assert.equal(ok, null);
}

// claim split
{
  const [a, b] = splitUnitClaim("资源被分流；此刻窗口放大紧迫感");
  assert.ok(a.length >= 4);
  assert.ok(b.length >= 4);
  assert.notEqual(a, b);
}

// slimSharedAuxAnchors substitutes from pool
{
  const units = [
    { chart_anchors: ["正印", "食神"] },
    { chart_anchors: ["食神", "正印"] },
  ];
  const slim = slimSharedAuxAnchors(units, ["大运", "用神水"]);
  assert.equal(slim[0]!.chart_anchors[0], "正印");
  assert.equal(slim[1]!.chart_anchors[0], "食神");
  // second unit's aux 正印 collides with first primary → substitute
  assert.ok(
    slim[1]!.chart_anchors.length === 1 ||
      !["正印", "食神"].includes(slim[1]!.chart_anchors[1]!),
  );
  if (slim[1]!.chart_anchors.length > 1) {
    assert.ok(["大运", "用神水"].includes(slim[1]!.chart_anchors[1]!));
  }
}

// softRepair: fluff why_needed + missing removal → pass without LLM
{
  const repaired = softRepairNecessarySignals({
    unit_claim: "须稳住职场高压",
    necessary_signals: [
      {
        slug: "用神",
        role: "主承重：缓冲高压",
        why_needed: "这个信号很重要",
      },
    ],
    removal_test: null,
  });
  assert.ok(repaired.repairs.some((x) => x.startsWith("why_needed")));
  assert.ok(repaired.repairs.includes("removal_missing"));
  assert.equal(
    validateNecessarySignalsContract({
      unit_claim: "须稳住职场高压",
      necessary_signals: repaired.necessary_signals,
      removal_test: repaired.removal_test,
    }),
    null,
  );
}

// softRepair: cross-page 流展 role copy → rewrite then pass
{
  const repaired = softRepairNecessarySignals({
    unit_claim: "破局支点在技艺转化",
    necessary_signals: [
      {
        slug: LIUZHAN_CROSS_PAGE_FIXTURE.slug,
        role: LIUZHAN_CROSS_PAGE_FIXTURE.role_p4,
        why_needed: "去掉此信号，无法解释破局支点为何落在技艺转化这一环",
      },
    ],
    removal_test: { passed: true, notes: "ok" },
    prior_signal_roles: [
      {
        slug: LIUZHAN_CROSS_PAGE_FIXTURE.slug,
        role: LIUZHAN_CROSS_PAGE_FIXTURE.role_p3,
        page: "science_action",
      },
    ],
  });
  assert.ok(repaired.repairs.some((x) => x.startsWith("role_cross")));
  assert.equal(
    validateNecessarySignalsContract({
      unit_claim: "破局支点在技艺转化",
      necessary_signals: repaired.necessary_signals,
      removal_test: repaired.removal_test,
      prior_signal_roles: [
        {
          slug: LIUZHAN_CROSS_PAGE_FIXTURE.slug,
          role: LIUZHAN_CROSS_PAGE_FIXTURE.role_p3,
          page: "science_action",
        },
      ],
    }),
    null,
  );
}

console.log("test-assign-necessary-signals: ok");
