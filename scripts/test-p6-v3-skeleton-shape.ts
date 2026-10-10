/**
 * Smoke: P6 v3 body coerce + category gate reject thin prose shape;
 * accept product skeleton; judgment paths nail identity/tonight/day7.
 */
import assert from "node:assert/strict";
import { coercePageSchemaLoose } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import { gateBodyCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { deepEvidenceUnitSpec } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import { formatJudgmentLockForBody } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { stampChartAnchorsFromDraft } from "@/lib/llm/pro/delivery/pipeline-v3/body-polish";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const thin = {
  page: "signals_close",
  page_title: "出门收束",
  page_subtitle: "不另开药方",
  tonight: "今晚发邀约",
  next_7_days: "盯五个信号",
  close: "带走三样",
  dimensions: [],
};
assert.equal(
  coercePageSchemaLoose("signals_close", thin),
  null,
  "thin three-prose shape must coerce-fail",
);

const day7 = (i: number) => ({
  action: `近7日动作${i}`,
  why: `为何这周${i}`,
  done_when: `勾选标准${i}`,
  chart_anchors: [] as string[],
});
const full = {
  page: "signals_close",
  page_title: "出门仪式：先松再选",
  page_subtitle: "身份切换 + 今晚一事 + 近7日勾选",
  identity_before: "被倒计时推着走的犹豫方",
  identity_after: "能主动选人的决策者",
  identity_shift: "近窗关系位承压，不先分清意愿会被外部期限推上船",
  identity_shift_anchors: ["配偶宫关系·卯未半合木局〔中性〕"],
  quote: "先空出时间，再回答愿不愿意",
  quote_use: "想立刻表态时先念这句，把手从结论上拿开",
  immediate_action: "发出本周唯一一次不带结论的独处邀约",
  tonight_done_looks_like: "时间已定在日历上，且未延伸成谈判",
  tonight_why: "先恢复自己的节奏，再谈意愿，否则只会评估不会相处",
  tonight_anchors: ["用神·金〔补给〕"],
  day7_micro_actions: [day7(1), day7(2), day7(3), day7(4)],
  takeaways: ["今晚只空时间", "近7日只记信号", "别用逃一个决定替代另一个"],
  evidence: [],
};
const coerced = coercePageSchemaLoose("signals_close", full);
assert.ok(coerced, "full skeleton must coerce");
assert.equal((coerced as { page: string }).page, "signals_close");
assert.equal(
  (coerced as { day7_micro_actions: unknown[] }).day7_micro_actions.length,
  4,
);

const thinGate = gateBodyCategoryB({
  key: "signals_close",
  page_schema: thin as never,
  surface: "substance_only",
});
assert.ok(thinGate && !thinGate.passed, "thin shape must fail category gate");
assert.equal(thinGate?.failed_rule, "gate_p6_body_skeleton_incomplete");

const fullGate = gateBodyCategoryB({
  key: "signals_close",
  page_schema: coerced,
  surface: "substance_only",
});
assert.equal(fullGate, null, "full skeleton substance gate passes");

const spec = deepEvidenceUnitSpec("signals_close");
assert.deepEqual(spec.paths, [
  "identity_shift",
  "tonight",
  "day7_micro_actions[0]",
  "day7_micro_actions[1]",
  "day7_micro_actions[2]",
  "day7_micro_actions[3]",
]);

const plan: DeepEvidencePlan = {
  page: "signals_close",
  units: spec.paths.map((path) => ({
    path,
    unit_claim: "近窗承压偏高",
    calc_cite: "Fact-pack",
    evidence: "机制链一句。再一句。",
    chart_anchors: [],
  })),
};
const lock = formatJudgmentLockForBody(plan, "signals_close");
assert.ok(lock.includes("identity_shift"), lock);
assert.ok(lock.includes("禁止压成三散文槽"), lock);
assert.ok(lock.includes("day7_micro_actions[3]"), lock);
assert.ok(!lock.includes("正文 dimensions 必须恰好"), lock);

const polishedMutated = {
  ...(coerced as Record<string, unknown>),
  identity_shift_anchors: ["被润色改掉"],
  tonight_anchors: ["被润色改掉"],
  day7_micro_actions: (
    (coerced as { day7_micro_actions: Array<Record<string, unknown>> })
      .day7_micro_actions ?? []
  ).map((row) => ({ ...row, chart_anchors: ["被润色改掉"] })),
};
const stamped = stampChartAnchorsFromDraft(
  "signals_close",
  polishedMutated as never,
  coerced,
) as {
  identity_shift_anchors?: string[];
  tonight_anchors?: string[];
  day7_micro_actions?: Array<{ chart_anchors?: string[] }>;
};
assert.deepEqual(stamped.identity_shift_anchors, [
  "配偶宫关系·卯未半合木局〔中性〕",
]);
assert.deepEqual(stamped.tonight_anchors, ["用神·金〔补给〕"]);
assert.deepEqual(stamped.day7_micro_actions?.[0]?.chart_anchors, []);

console.log("test-p6-v3-skeleton-shape: ok");
