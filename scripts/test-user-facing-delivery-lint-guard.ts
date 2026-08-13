/**
 * Phase-2: delivery body expression-contract mount + user-visible lint guard.
 * Hard-fails on blacklist leaks in fixture user_visible_text (CI / regression).
 * Runtime delivery jobs stay warn-only via delivery-body-purity.
 *
 *   pnpm exec tsx scripts/test-user-facing-delivery-lint-guard.ts
 */
import assert from "node:assert/strict";
import {
  buildUserFacingExpressionContractBlock,
  EXPRESSION_CONTRACT_MAPPING_IDS,
} from "@/lib/llm/prompts/user-facing-expression-contract";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import { buildDeliveryNarrativePrompt } from "@/lib/llm/pro/delivery/narrative-prompt";
import { buildDeliveryEvidencePrompt } from "@/lib/llm/pro/delivery/evidence-prompt";
import {
  findAllDeliveryProsePollution,
  findDeliveryProsePollution,
  isDeliveryProseClean,
} from "@/lib/llm/pro/delivery/delivery-body-purity";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { createInitialAgentState } from "@/lib/poju/agent-state";

const deliveryBlock = buildUserFacingExpressionContractBlock({
  locale: "zh",
  preset: "delivery",
});
assert.ok(deliveryBlock.includes("用户可见表达契约"));
assert.ok(deliveryBlock.includes("main_body") || deliveryBlock.includes("Folded Technical"));
assert.ok(deliveryBlock.includes("technical_spine") || deliveryBlock.includes("依据"));
assert.ok(EXPRESSION_CONTRACT_MAPPING_IDS.delivery.length >= 10);
assert.ok(deliveryBlock.includes("火旺") || deliveryBlock.includes("stress-drive"));

const core = makeTestBreakthroughCore();
const agent = createInitialAgentState({
  original_question: "要不要接新加坡的 offer？",
});

const finalize = buildDeliveryFinalizePrompt({
  breakthrough_core: core,
  covered_agenda: [{ label: "恢复节奏", answer: "半夜容易醒" }],
  agent_v2: agent,
  locale: "zh",
  delivery_mode: "full",
  paths: ["foundation"],
});
assert.ok(finalize.system.includes("用户可见表达契约"));
assert.ok(finalize.system.includes("Folded Technical") || finalize.system.includes("双层职责"));
assert.ok(finalize.system.includes("main_body") || finalize.system.includes("core_conclusion"));

const narrative = buildDeliveryNarrativePrompt(
  { foundation: "你卡住，是因为容量被长期高压抽干。" },
  "zh",
);
assert.ok(narrative.system.includes("用户可见表达契约"));
assert.ok(narrative.system.includes("双层职责") || narrative.system.includes("Folded Technical"));

const evidence = buildDeliveryEvidencePrompt(
  {
    foundation: {
      bazi_basis: ["七杀", "偏印"],
      arguments: [{ body: "### 压力\n\n外界标准压得你喘不过气。" }],
    },
  },
  "zh",
);
assert.ok(evidence.system.includes("technical_spine") || evidence.system.includes("豁免"));
// Evidence may *mention* the contract by name when declaring exemption — but must not mount the mapping table.
assert.ok(!evidence.system.includes("引擎概念 → 用户可见语"));
assert.ok(!evidence.system.includes('preset: "delivery"'));

/** Black-box fixtures: must hard-fail lint. */
const MUST_CATCH: Array<{ label: string; text: string; expectSnippet: string }> = [
  { label: "丑时", text: "丑时湿土本应收敛，你却还在硬撑。", expectSnippet: "丑时" },
  { label: "火旺木焚", text: "火旺木焚所以你该先降温。", expectSnippet: "火旺木焚" },
  { label: "七杀", text: "你盘里七杀太旺，所以压力大。", expectSnippet: "七杀" },
  { label: "偏印", text: "偏印透出，适合旁路学习。", expectSnippet: "偏印" },
  { label: "用神", text: "用神是水木，先补水。", expectSnippet: "用神" },
];

for (const row of MUST_CATCH) {
  const hits = findAllDeliveryProsePollution(row.text);
  assert.ok(
    hits.some((h) => h.snippet.includes(row.expectSnippet) || row.text.includes(h.snippet)),
    `lint must catch ${row.label}: got ${JSON.stringify(hits)}`,
  );
  assert.ok(findDeliveryProsePollution(row.text) != null, `first-hit must catch ${row.label}`);
}

assert.ok(
  isDeliveryProseClean(
    "长期高压下，恢复窗口被压缩，夜间大脑像被提前强制开机——要对齐的是降温与重建节奏。",
  ),
);

console.log("test-user-facing-delivery-lint-guard: ok");
