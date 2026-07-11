/**
 * Block 76 — Segment 1/2 strict split + compliance on content only
 *
 *   pnpm exec tsx scripts/test-poju-block76-segment2-split.ts
 */
import fs from "node:fs";
import path from "node:path";
import { formatSegment1UnderstandingForPrompt, withCompleteUnderstanding, createInitialAgentState } from "@/lib/poju/agent-state";
import { isUnderstandingFieldFilled } from "@/lib/poju/agent-state";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 76 · Segment 1/2 split ==========\n");

  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  const agent = read("lib/poju/agent.ts");
  const transport = read("lib/llm/phases/phase-transport.ts");
  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  const sm = read("lib/poju/state-machine.ts");

  assert("opening no canRunConversion", !opening.includes("canRunConversion"));
  assert("opening no parseOpeningConversionPayload", !opening.includes("parseOpeningConversionPayload"));
  assert("opening no conversion_envelope_failed", !opening.includes("conversion_envelope_failed"));
  assert("opening defers segment2", opening.includes("segment2_deferred"));
  assert("opening forbids agenda in prompt", opening.includes("禁止在 opening 输出"));

  assert("agent always ensureBreakthroughCore on trigger", agent.includes("segment-2 breakthrough-core"));
  assert("agent no inlineCoreReady", !agent.includes("inlineCoreReady"));
  assert("agent no inlineEnvelopeFromOpening", !agent.includes("inlineEnvelopeFromOpening"));

  assert("state-machine triggerCore on gate", sm.includes("triggerCore = true"));
  assert("compliance uses content_preview not raw reasoning", transport.includes("content_preview"));
  assert("compliance audits response only", transport.includes("auditPhaseChatCompliance(response"));

  assert("breakthrough-core segment1 block", bt.includes("formatSegment1UnderstandingForPrompt"));
  assert("breakthrough-core xhigh reasoning free", bt.includes("reasoning（思考过程）"));
  assert("breakthrough-core content must mark", bt.includes("必须打标"));

  const seg1 = formatSegment1UnderstandingForPrompt(withCompleteUnderstanding(createInitialAgentState({ original_question: "q" })));
  assert("segment1 prompt includes concrete_event", seg1.includes("concrete_event"));

  assert("breakthrough prompt injects segment1", bt.includes("【第1段理解门产出（推演靶心 · 必须显式扣住）】"));

  assert("placeholder still not gate-filled", !isUnderstandingFieldFilled("尚未明确"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 76 checks passed.\n");
}

main();
