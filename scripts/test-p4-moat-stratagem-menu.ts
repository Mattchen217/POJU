/**
 * P4 Step2 / Phase B — 东方谋略 moat menu（局势·意象·仪轨 + 敌我时空微剧本）。
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

assert.ok(block.includes("【P4 东方谋略手段候选菜单"), block.slice(0, 80));
assert.ok(block.includes("局势交锋") || block.includes("暗锦囊"), block);
assert.ok(block.includes("仪轨白名单"), block);
assert.ok(block.includes("【敌·我·时·空 · 局势微剧本】"), block);
assert.ok(block.includes("敌：") && block.includes("我："), block);
assert.ok(
  /伏击|静默|破局|借势|气口|锋芒|时空差/.test(block),
  "bingfa imagery whitelist in feed",
);
const meansBodies = [...block.matchAll(/means\d:\s*([^\n]+)/g)].map((m) => m[1] ?? "");
assert.ok(meansBodies.length >= 4, `expected means drafts, got ${meansBodies.length}`);
for (const m of meansBodies) {
  assert.equal(/投入带宽|补给态|过度激活|破窗加码/.test(m), false, m);
}
assert.ok(
  meansBodies.some((m) =>
    /时空差|信息静默|背靠实墙|空间动线|露锋|借势破局/.test(m),
  ),
  "spicy ritual/field means expected",
);
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
  /静坐|温凉|缓冲|静默|背靠|时空差/.test(block),
  "whitelist ritual language present",
);
assert.ok(!/合同|股权|Excel|律师/.test(block.split("禁")[0] ?? ""), "P3 tools not as means drafts");

const script = buildQimenAdversarialMicroScript(qimen);
assert.ok(script.includes("【敌·我·时·空"), script);
assert.ok(qimen.text.includes("【敌·我·时·空"), "fact-pack text embeds micro-script");

const inferred = inferP4MoatEligibleTypes(block);
assert.ok(inferred.has("timing"), "qimen+timing_ripeness → timing eligible");
assert.ok(inferred.has("polarity"), "yong → polarity");

console.log("test-p4-moat-stratagem-menu: ok", {
  eligible,
  ju: qimen.ju_name,
  door: qimen.zhi_shi_door,
  host_guest: qimen.host_guest,
});
