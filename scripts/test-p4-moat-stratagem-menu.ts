/**
 * P4 Step2 / Phase B — 东方谋略约束帧（禁正例 · 方向+真算）。
 * Run: pnpm exec tsx scripts/test-p4-moat-stratagem-menu.ts
 */

import assert from "node:assert/strict";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import {
  buildQimenAdversarialMicroScript,
  castDeliveryQimenFactPack,
} from "../lib/llm/pro/delivery/page-schema/qimen-fact-pack";
import { inferP4MoatEligibleTypes } from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import type { BreakthroughCore } from "../lib/poju/agent-state";

const lockAt = new Date("2026-09-25T15:30:00.000Z");
const qimen = castDeliveryQimenFactPack({ castAt: lockAt });

const core = {
  metaphysics_pack: {
    yong_shen: {
      primary_yong_shen: "water",
      ji_shen: ["fire", "earth"],
    },
  },
  energy_retune_frame: {
    timing_ripeness: "未熟",
    structural_basis: "大运壬寅气候交织",
    direction_fit: "",
    daily_retune: "",
    complementary: "",
  },
  multi_dimension_reckoning: [
    {
      dimension: "十神格局",
      judgment: "食神透干偏显",
      chart_basis: "时柱辛未食神",
    },
  ],
} as unknown as BreakthroughCore;

const { block, eligible } = buildMetaphysicsMoatFeedBlock(core, null, {
  original_question: "前同事拉我进项目，想兼职试水",
  desired_outcome: "先兼职保住稳定",
  qimen,
});

assert.ok(block.includes("暗锦囊") || block.includes("约束帧"), block);
assert.ok(block.includes("【敌·我·时·空 · 局势结构】"), block);
assert.ok(block.includes("敌：") && block.includes("我："), block);
assert.equal(
  /宜退避防损|先护己气|先立信息静默|再决定是否露锋/.test(block),
  false,
  "lock/moat must not bake prescription sentences",
);

// 禁正例：不得再塞整句可抄 means 范文
assert.equal(
  /means\d\s*:/.test(block),
  false,
  "feed must not contain means1:/means2: copy drafts",
);
assert.equal(
  /完整动作草稿|（可抄）|整句抄写/.test(block),
  false,
  "feed must not invite verbatim copy",
);
assert.equal(
  /深呼吸三轮|温凉饮一口|背靠实墙的清静场|走到通风开阔处站立片刻/.test(block),
  false,
  "old ritual exemplar sentences must be gone",
);
assert.ok(block.includes("约束帧"), "constraint-frame language");
assert.ok(block.includes("自写"), "self-write instruction");

assert.ok(block.includes("【奇门锁盘"), block);
assert.ok(block.includes(qimen.ju_name), block);
assert.ok(block.includes("值使"), block);
assert.ok(eligible.includes("timing"), String(eligible));
assert.ok(eligible.includes("polarity"), String(eligible));
assert.ok(eligible.includes("archetype"), String(eligible));
assert.ok(block.includes("时机候选"), block);
assert.ok(block.includes("极性候选"), block);
assert.ok(block.includes("角色候选"), block);
assert.ok(
  /时方|结界|气场|落座/.test(block),
  "allow-axis language present",
);
assert.ok(!/合同|股权|Excel|律师/.test(block.split("禁")[0] ?? ""), "P3 tools not as means drafts");

const script = buildQimenAdversarialMicroScript(qimen);
assert.ok(script.includes("【敌·我·时·空 · 局势结构】"), script);
assert.ok(qimen.text.includes("【敌·我·时·空 · 局势结构】"), "fact-pack text embeds structure script");
assert.equal(
  /宜退避|信息静默|再决定是否露锋|背靠实墙|通风开阔处|丧事/.test(script),
  false,
  "micro-script must be tension facts, not prescription or death-event gloss",
);

const inferred = inferP4MoatEligibleTypes(block);
assert.ok(inferred.has("timing"), "qimen+timing_ripeness → timing eligible");
assert.ok(inferred.has("polarity"), "yong → polarity");
assert.ok(
  inferP4MoatEligibleTypes("用神: 水\n忌神: 火、土").has("polarity"),
  "Chinese 用神/忌神 lines alone must unlock polarity",
);

console.log("test-p4-moat-stratagem-menu: ok", {
  eligible,
  ju: qimen.ju_name,
  door: qimen.zhi_shi_door,
  host_guest: qimen.host_guest,
});
