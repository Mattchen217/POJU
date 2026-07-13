/**
 * Block 93 — five-phase physical isolation foundation (shared + opening)
 *
 *   pnpm exec tsx scripts/test-poju-block93-phase-isolation-foundation.ts
 */
import fs from "node:fs";
import path from "node:path";
import { isOpeningControlPhase } from "@/lib/poju/phases/opening/control";
import { resolveOpeningTurnReply } from "@/lib/poju/phases/opening/display";
import { createInitialAgentState, withCompleteUnderstanding } from "@/lib/poju/agent-state";
import { extractJson, parsePhaseJson } from "@/lib/poju/shared/json-tools";
import { MAX_OPENING_TRANSPORT_RESEND } from "@/lib/poju/shared/transport";

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
  console.log("\n========== POJU Block 93 · Phase isolation foundation ==========\n");

  assert("shared json-tools exists", fs.existsSync(path.join(ROOT, "lib/poju/shared/json-tools.ts")));
  assert("shared transport exists", fs.existsSync(path.join(ROOT, "lib/poju/shared/transport.ts")));
  assert("shared xhigh-job barrel", fs.existsSync(path.join(ROOT, "lib/poju/shared/xhigh-job/index.ts")));
  assert("shared prompt-prefix", fs.existsSync(path.join(ROOT, "lib/poju/shared/prompt-prefix.ts")));
  assert("phase-transport is barrel", read("lib/llm/phases/phase-transport.ts").includes('export * from "@/lib/poju/shared/json-tools"'));
  assert("phase-router exists", fs.existsSync(path.join(ROOT, "lib/poju/phase-router.ts")));

  assert("opening control", fs.existsSync(path.join(ROOT, "lib/poju/phases/opening/control.ts")));
  assert("opening display", fs.existsSync(path.join(ROOT, "lib/poju/phases/opening/display.ts")));
  assert("opening prompt", fs.existsSync(path.join(ROOT, "lib/poju/phases/opening/prompt.ts")));

  assert("opening control has no ensureBreakthroughCore", !read("lib/poju/phases/opening/control.ts").includes("ensureBreakthroughCore"));
  assert("opening display no breakthrough-core", !read("lib/poju/phases/opening/display.ts").includes("ensureBreakthroughCore"));

  assert("MAX_OPENING_TRANSPORT_RESEND shared", MAX_OPENING_TRANSPORT_RESEND === 4);
  assert("extractJson works", extractJson('xx {"a":1} yy') === '{"a":1}');
  assert("parsePhaseJson works", parsePhaseJson('{"response":"hi"}').response === "hi");

  assert("isOpeningControlPhase opening", isOpeningControlPhase("opening"));
  assert("isOpeningControlPhase gate", isOpeningControlPhase("awaiting_understanding_confirm"));
  assert("isOpeningControlPhase collecting false", !isOpeningControlPhase("collecting_context"));

  const gateAgent = withCompleteUnderstanding(createInitialAgentState({ original_question: "q" }));
  const gateReply = resolveOpeningTurnReply({
    locale: "zh",
    agent: gateAgent,
    llmResponse: "ignored",
    understandingGenerationFailed: false,
    phaseAfter: "awaiting_understanding_confirm",
    envelopeFailedStayedOpening: false,
  });
  assert("gate reply owned by opening display", Boolean(gateReply && gateReply.includes("核对")));

  const failReply = resolveOpeningTurnReply({
    locale: "zh",
    agent: gateAgent,
    llmResponse: "",
    understandingGenerationFailed: true,
    phaseAfter: "opening",
    envelopeFailedStayedOpening: false,
  });
  assert("fail reply owned by opening display", Boolean(failReply && failReply.includes("网络不太稳")));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
