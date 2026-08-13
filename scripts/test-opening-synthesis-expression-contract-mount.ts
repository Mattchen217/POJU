/**
 * Phase-3 mounts: opening + synthesis expression contract.
 *   pnpm exec tsx scripts/test-opening-synthesis-expression-contract-mount.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildUserFacingExpressionContractBlock,
  EXPRESSION_CONTRACT_MAPPING_IDS,
} from "@/lib/llm/prompts/user-facing-expression-contract";
import { buildSynthesisPrompt } from "@/lib/llm/deepseek/synthesis-task";
import type { SynthesisJobInput } from "@/lib/poju/xhigh-job-types";

const openingBlock = buildUserFacingExpressionContractBlock({
  locale: "zh",
  preset: "opening",
});
assert.ok(openingBlock.includes("用户可见表达契约"));
assert.ok(openingBlock.includes("response") || openingBlock.includes("options"));
assert.equal(EXPRESSION_CONTRACT_MAPPING_IDS.opening.length, 0);
assert.ok(!openingBlock.includes("引擎概念 → 用户可见语"));

const synthesisBlock = buildUserFacingExpressionContractBlock({
  locale: "en",
  preset: "synthesis",
});
assert.ok(synthesisBlock.includes("用户可见表达契约"));
assert.ok(synthesisBlock.includes("direction") || synthesisBlock.includes("why_fits"));
assert.ok(EXPRESSION_CONTRACT_MAPPING_IDS.synthesis.length > 0);
assert.ok(
  synthesisBlock.includes("capacity") ||
    synthesisBlock.includes("容量") ||
    synthesisBlock.includes("stress") ||
    synthesisBlock.includes("restore"),
);

const openingSrc = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/phases/opening-phase-v6.ts"),
  "utf8",
);
assert.ok(openingSrc.includes("buildUserFacingExpressionContractBlock"));
assert.ok(openingSrc.includes('preset: "opening"'));

const job: SynthesisJobInput = {
  kind: "synthesis",
  multi_dimension_reckoning: [],
  desired_outcome: "先稳住收入",
  original_question: "要不要换工作？",
  question_category: "career",
  covered_agenda: [{ label: "时间带宽", answer: "每周可加班有限" }],
  structured_inventory: "",
};

const syn = buildSynthesisPrompt({ job_input: job, locale: "zh" });
assert.ok(syn.system.includes("用户可见表达契约"));
assert.ok(syn.system.includes("可见句") || syn.system.includes("why_fits"));
assert.ok(syn.system.includes("禁止") && syn.system.includes("十神格局"));

const identity = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/poju-base.ts"),
  "utf8",
);
assert.ok(!identity.includes("buildUserFacingExpressionContractBlock"));
assert.ok(!identity.includes("vernacular-mapping-ssot"));

const v6Identity = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/poju-base-v6.ts"),
  "utf8",
);
assert.ok(!v6Identity.includes("buildUserFacingExpressionContractBlock"));

console.log("test-opening-synthesis-expression-contract-mount: ok");
