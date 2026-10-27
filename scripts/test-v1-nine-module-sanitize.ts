/**
 * Wave 1–2 smoke: 03–06 sanitize cases + dual-evidence gate.
 * Run: pnpm exec tsx scripts/test-v1-nine-module-sanitize.ts
 */
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import {
  gateDualEvidenceParts,
  composeDualEvidence,
} from "../lib/llm/pro/delivery/page-schema/dual-evidence";
import { fillShapeSkeletonForKey } from "../lib/llm/pro/delivery/page-schema/fill-shape-skeleton";
import { fillDutyForKey } from "../lib/llm/pro/delivery/page-prompts";
import { scienceDisciplinesForSegment } from "../lib/poju/report-blueprint";
import { V1_DELIVERY_SEGMENT_KEYS } from "../lib/llm/pro/delivery/segment-key-alias";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const thickEssence =
  "在本题压力下你容易先压住冲突再爆发，因为内在价值排序把「稳住场面」放在「当面澄清」之前，形成反复犹豫的维持机制。";

const patterns = sanitizePageJson("personal_decision_patterns", {
  page_title: "本题下的犹豫模式",
  page_subtitle: "事实与假设分层",
  why_cards: [
    {
      title: "压冲突",
      surface: "当面该说的话拖到事后才说。",
      essence: thickEssence,
      chart_anchors: ["印星"],
    },
  ],
});
assert(patterns.ok === true, `patterns sanitize: ${JSON.stringify(patterns)}`);

const bottleneck = sanitizePageJson("bottleneck_analysis", {
  page_title: "卡点清单",
  page_subtitle: "优先解除哪一个",
  why_cards: [
    {
      title: "信息缺口",
      surface: "关键数字未确认仍在空转。",
      essence: thickEssence,
      chart_anchors: ["官杀"],
    },
  ],
});
assert(bottleneck.ok === true, `bottleneck sanitize: ${JSON.stringify(bottleneck)}`);

const options = sanitizePageJson("strategic_options", {
  page_title: "三条路径",
  page_subtitle: "收益成本可逆",
  options: [
    {
      name: "维持现状",
      summary: "先稳住现金流再验证。",
      upside: "风险低。",
      cost: "机会成本上升。",
      risk: "窗口错过。",
      reversibility: "随时可再评估。",
      chart_anchors: ["印星"],
    },
    {
      name: "小试验",
      summary: "两周低成本验证需求。",
      upside: "拿到真实反馈。",
      cost: "精力占用。",
      risk: "样本偏差。",
      reversibility: "可停可扩。",
      chart_anchors: ["食神"],
    },
  ],
});
assert(options.ok === true, `options sanitize: ${JSON.stringify(options)}`);

const strategyOk = sanitizePageJson("recommended_strategy", {
  page_title: "先验证再扩投入",
  page_subtitle: "主辅与退出边界",
  core_judgment: "先验证再扩大投入。",
  primary: {
    name: "验证优先",
    why: "对本盘结构与现实约束同时成立。",
    when: "现金流可撑验证窗。",
    exit: "两周无真实反馈则停。",
    chart_anchors: ["印星"],
  },
  backup: {
    name: "守成",
    why: "主路失效时先保底。",
    when: "验证窗压力过大。",
    exit: "硬约束触顶则重评。",
    chart_anchors: ["比劫"],
  },
});
assert(strategyOk.ok === true, `strategy sanitize: ${JSON.stringify(strategyOk)}`);

const strategyNoExit = sanitizePageJson("recommended_strategy", {
  page_title: "先验证路径",
  page_subtitle: "缺退出应打回",
  core_judgment: "先验证。",
  primary: { name: "验证", why: "为何是你现在", chart_anchors: ["印星"] },
  backup: { name: "守成", why: "保底", chart_anchors: ["比劫"] },
});
assert(
  strategyNoExit.ok === false &&
    "reason" in strategyNoExit &&
    strategyNoExit.reason === "strategy_missing_exit",
  "strategy without exit must fail",
);

for (const k of V1_DELIVERY_SEGMENT_KEYS) {
  assert(fillShapeSkeletonForKey(k) != null, `skeleton missing for ${k}`);
}

assert(
  fillDutyForKey("personal_decision_patterns", "模式").includes("个人决策模式"),
  "patterns duty not aliased to foundation",
);
assert(
  !fillDutyForKey("bottleneck_analysis", "障碍").includes("只译批断"),
  "bottleneck must not use p2 plain-judgment alias",
);
assert(
  scienceDisciplinesForSegment("situation_analysis").length >= 1,
  "science disciplines injected from blueprint",
);

const dualOk = gateDualEvidenceParts(
  composeDualEvidence(
    "⟦w:印星⟧ 对本案结构形成牵制，删掉后主张谁都适用。",
    "本案决策窗口下损失厌恶会让你推迟验证实验。",
  ),
);
assert(dualOk.ok === true, `dual ok: ${JSON.stringify(dualOk)}`);

const dualMissingB = gateDualEvidenceParts(
  composeDualEvidence("⟦w:印星⟧ 对本案结构形成牵制，删掉后主张谁都适用。", ""),
);
assert(
  dualMissingB.ok === false &&
    "reason" in dualMissingB &&
    dualMissingB.reason === "dual_missing_science",
  "missing science must fail",
);

const dualFusion = gateDualEvidenceParts(
  composeDualEvidence(
    "⟦w:印星⟧ 对本案结构形成牵制，删掉后主张谁都适用。",
    "科学验证了八字所以本案必须验证优先。",
  ),
);
assert(
  dualFusion.ok === false &&
    "reason" in dualFusion &&
    dualFusion.reason === "dual_pseudo_fusion",
  "pseudo fusion must fail",
);

console.log("test-v1-nine-module-sanitize: ok");
