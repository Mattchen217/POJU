/**
 * Phase-1 mount: expression contract on VOICE → Call B → collecting.
 * Phase-2 delivery body: see test-user-facing-delivery-lint-guard.ts
 *   pnpm exec tsx scripts/test-user-facing-expression-contract-mount.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildUserFacingExpressionContractBlock,
  EXPRESSION_CONTRACT_MAPPING_IDS,
} from "@/lib/llm/prompts/user-facing-expression-contract";
import { buildBreakthroughCoreVoicePrompt } from "@/lib/llm/deepseek/segment2-a-parallel";
import { buildAgendaBridgePrompt } from "@/lib/llm/deepseek/breakthrough-core";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";

const voiceBlock = buildUserFacingExpressionContractBlock({ locale: "en", preset: "voice" });
assert.ok(voiceBlock.includes("用户可见表达契约"));
assert.ok(voiceBlock.includes("火旺") || voiceBlock.includes("stress-drive"));
assert.ok(EXPRESSION_CONTRACT_MAPPING_IDS.voice.length > 0);

const agendaBlock = buildUserFacingExpressionContractBlock({ locale: "zh", preset: "agenda" });
assert.ok(agendaBlock.includes("受控映射"));
assert.ok(agendaBlock.includes("丑时") || agendaBlock.includes("半夜"));

const collectingBlock = buildUserFacingExpressionContractBlock({
  locale: "en",
  preset: "collecting",
});
assert.ok(collectingBlock.includes("用户可见表达契约"));
assert.ok(!collectingBlock.includes("引擎概念 → 用户可见语"));

const core = makeTestBreakthroughCore();
const voicePrompt = buildBreakthroughCoreVoicePrompt({
  merged_core: core,
  original_question: "Should I take the Singapore offer?",
  locale: "en",
});
assert.ok(voicePrompt.system.includes("用户可见表达契约"));
assert.ok(voicePrompt.system.includes("mid-sleep") || voicePrompt.system.includes("stress-drive"));

const agendaPrompt = buildAgendaBridgePrompt({
  breakthrough_core: core,
  original_question: "Should I take the Singapore offer?",
  locale: "en",
  segment1_understanding: "- wants: rest first",
});
assert.ok(agendaPrompt.system.includes("用户可见表达契约"));
assert.ok(
  agendaPrompt.system.includes("agenda label") || agendaPrompt.system.includes("first_question"),
);

const collectingSrc = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/phases/collecting-phase-v6.ts"),
  "utf8",
);
assert.ok(collectingSrc.includes("buildUserFacingExpressionContractBlock"));
assert.ok(collectingSrc.includes('preset: "collecting"'));

console.log("test-user-facing-expression-contract-mount: ok");
