/**
 * P4 fill chunk helpers + menu pillar naming.
 * Run: pnpm exec tsx scripts/test-p4-fill-chunk.ts
 */
import assert from "node:assert/strict";
import {
  buildP4FillChunks,
  formatP4FillChunkUserHint,
  P4_FILL_CHUNK_SIZE,
  shouldChunkP4CompressFill,
  sliceDeepEvidencePlanForFillChunk,
} from "../lib/llm/pro/delivery/page-schema/fill-p4-chunk";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import { castDeliveryQimenFactPack } from "../lib/llm/pro/delivery/page-schema/qimen-fact-pack";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { BreakthroughCore } from "../lib/poju/agent-state";

const plan: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: Array.from({ length: 6 }, (_, i) => ({
    path: `dimensions[${i}]`,
    chart_anchors: [] as string[],
    evidence: `批断${i}`,
    moat_class: (["timing", "polarity", "archetype", "polarity", "timing", "archetype"] as const)[
      i
    ]!,
    unit_claim: `主张${i}`,
    calc_cite: `摘录${i}`,
  })),
};

assert.equal(shouldChunkP4CompressFill("metaphysics_action", "compress", plan), true);
assert.equal(shouldChunkP4CompressFill("metaphysics_action", "full", plan), false);
assert.equal(shouldChunkP4CompressFill("science_action", "compress", plan), false);

const chunks = buildP4FillChunks(plan);
assert.equal(chunks.length, Math.ceil(6 / P4_FILL_CHUNK_SIZE));
assert.equal(chunks[0]!.length, P4_FILL_CHUNK_SIZE);
assert.equal(chunks[0]![0]!.path, "dimensions[0]");

const sliced = sliceDeepEvidencePlanForFillChunk(plan, chunks[0]!);
assert.equal(sliced.units.length, 2);
assert.equal(sliced.page, "metaphysics_action");

const hint = formatP4FillChunkUserHint({
  index: 0,
  total: 3,
  include_page_chrome: true,
  parent_unit_count: 6,
  paths: ["dimensions[0]", "dimensions[1]"],
});
assert.ok(hint.includes("分枪"));
assert.ok(hint.includes("敌虚实"));

const qimen = castDeliveryQimenFactPack({
  castAt: new Date("2026-09-25T15:30:00.000Z"),
});
const core = {
  metaphysics_pack: {
    yong_shen: { primary_yong_shen: "water", ji_shen: ["fire"] },
  },
  energy_retune_frame: {
    timing_ripeness: "未熟",
    structural_basis: "大运",
    direction_fit: "",
    daily_retune: "",
    complementary: "",
  },
  multi_dimension_reckoning: [
    { dimension: "十神", judgment: "食神透干", chart_basis: "食神" },
  ],
} as unknown as BreakthroughCore;
const { block } = buildMetaphysicsMoatFeedBlock(core, null, { qimen });
assert.ok(block.includes("【维名分工"));
assert.ok(block.includes("【局势看透"));
assert.ok(block.includes("恰好 1 含「行为仪轨」") || block.includes("唯一「行为仪轨」"));
assert.ok(block.includes("【禁正例照抄"));
assert.equal(/means\d\s*:|深呼吸三轮|背靠实墙的清静场/.test(block), false);
assert.ok(!/温凉饮一口/.test(block.match(/极性候选1[\s\S]*?(?=极性候选2)/)?.[0] ?? "温凉饮一口"));

console.log("test-p4-fill-chunk: ok", { chunks: chunks.length });
