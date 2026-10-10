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
import { stampP6WatchSignals } from "@/lib/llm/pro/delivery/p6-watch-signals";
import {
  buildCloseAssignPathHints,
  buildCloseRitualFeedBlock,
  stripMonthBandDayPrefix,
} from "@/lib/llm/pro/delivery/close-ritual-feed";
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
  watch_signals: [
    "独处邀约发出后，身体是松还是更紧？",
    "短对话后，恐惧有没有从「必须立刻结论」退半步？",
    "连续两晚不硬扛，判断力是否更稳？",
  ],
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
assert.equal(
  (coerced as { watch_signals: unknown[] }).watch_signals.length,
  3,
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

const thinWatch = {
  ...(coerced as Record<string, unknown>),
  watch_signals: ["只有一条"],
};
const filledWatch = stampP6WatchSignals(thinWatch as never, [
  "种子甲：独处后是否更松？",
  "种子乙：短对话后恐惧有没有退？",
  "种子丙：不硬扛两晚判断是否更稳？",
]) as { watch_signals: string[] };
assert.ok(filledWatch.watch_signals.length >= 3);
assert.equal(filledWatch.watch_signals[0], "只有一条");

assert.ok(
  !/前三周/.test(
    stripMonthBandDayPrefix("基于前三周的实验、反思和对话，你必须做出选择"),
  ),
);
const energyFeed = buildCloseRitualFeedBlock(
  null,
  null,
  [
    {
      label: "‘金’时刻的日常习惯",
      answer: "我以前有，但这几个月压力太大，已经很久没做了",
    },
    {
      label: "行动实验的可行性",
      answer:
        "这周恢复两次跑步，周二和周四早上，哪怕只跑二十分钟。然后安排一次。",
    },
    {
      label: "近7天的时间节奏",
      answer: "还不确定，但这周我会主动找一个空档",
    },
  ],
  {},
);
assert.ok(energyFeed.includes("精力近阶"), energyFeed);
assert.ok(energyFeed.includes("恢复两次跑步"), energyFeed);
assert.ok(!energyFeed.includes("切辅→「辅轨」"), energyFeed);
const energyHints = buildCloseAssignPathHints(
  {
    rhythm_frame: {
      phase1_observe: "剥离实验与恐惧书写",
      phase2_adjust: "只谈恐惧的对话",
      phase3_consolidate: "写一页意愿答案纸",
    },
  } as never,
  null,
  [],
  ["精力近阶 · 这周恢复两次跑步"],
);
const d7_0 = energyHints.find((h) => h.path === "day7_micro_actions[0]");
const d7_1 = energyHints.find((h) => h.path === "day7_micro_actions[1]");
const d7_3 = energyHints.find((h) => h.path === "day7_micro_actions[3]");
assert.ok(d7_0?.prefer_cite?.includes("跑步"), d7_0?.prefer_cite);
assert.ok(
  d7_1?.prefer_cite && /对话|恐惧/.test(d7_1.prefer_cite),
  `day7[1] should stay adjust/rhythm, got: ${d7_1?.prefer_cite ?? "(missing)"}`,
);
assert.ok(
  d7_3?.prefer_cite && !/切辅→/.test(d7_3.prefer_cite),
  `day7[3] cite should be close-stem, got: ${d7_3?.prefer_cite ?? "(missing)"}`,
);
assert.equal(d7_3?.prefer_candidate_ref, "收束近阶");

console.log("test-p6-v3-skeleton-shape: ok");
