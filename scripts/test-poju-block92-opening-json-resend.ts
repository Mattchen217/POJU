/**
 * Block 92 — opening bad JSON discard + resend (max 4) + retry button
 *
 *   pnpm exec tsx scripts/test-poju-block92-opening-json-resend.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  isOpeningTransportResendNeeded,
  MAX_OPENING_TRANSPORT_RESEND,
  parsePhaseResult,
} from "@/lib/llm/phases/phase-transport";
import { appendForwardMove, openingUnderstandingGenerationFailedMessage } from "@/lib/poju/collecting-focus-reply";
import { createInitialAgentState } from "@/lib/poju/agent-state";

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
  console.log("\n========== POJU Block 92 · Opening JSON resend ==========\n");

  const transport = read("lib/poju/shared/transport.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  const collecting = read("lib/poju/collecting-focus-reply.ts");
  const agent = read("lib/poju/agent.ts");
  const ui = read("components/poju/POJUChatUI.tsx");

  assert("MAX_OPENING_TRANSPORT_RESEND is 4", MAX_OPENING_TRANSPORT_RESEND === 4);
  assert("transport opening resend loop", transport.includes("opening resend"));
  assert("isOpeningTransportResendNeeded exported", transport.includes("export function isOpeningTransportResendNeeded"));

  assert("opening-v6 no empty-generation fallback", !opening.includes("getPhaseEmptyGenerationFallback"));
  assert("opening-v6 understanding_generation_failed flag", opening.includes("understanding_generation_failed"));
  assert("opening-v6 no duplicate transport retry", !opening.includes("controlled retry once"));

  assert("no 能再多说一点 fallback", !collecting.includes("能再多说一点"));
  assert("opening failure message", openingUnderstandingGenerationFailedMessage("zh").includes("网络不太稳"));

  assert("agent handleRetryOpeningUnderstanding", agent.includes("handleRetryOpeningUnderstanding"));
  assert("opening control owns retry", read("lib/poju/phases/opening/control.ts").includes("export async function handleRetryOpeningUnderstanding"));
  assert("agent understanding_generation_failed meta", agent.includes("understanding_generation_failed: true"));
  assert("opening display owns fail copy", read("lib/poju/phases/opening/display.ts").includes("openingUnderstandingGenerationFailedMessage"));
  assert("phase-router exports opening handlers", read("lib/poju/phase-router.ts").includes("handleRetryOpeningUnderstanding"));

  assert("RegenerateOpeningAction in UI", ui.includes("RegenerateOpeningAction"));
  assert("handleRetryOpeningUnderstandingClick", ui.includes("handleRetryOpeningUnderstandingClick"));
  assert("UI imports phase-router", ui.includes("@/lib/poju/phase-router"));

  assert("empty needs resend", isOpeningTransportResendNeeded(""));
  assert("broken json needs resend", isOpeningTransportResendNeeded('{"response":"","core_dilemma":{'));
  const salvaged = isOpeningTransportResendNeeded(
    '{"response":"你好","core_dilemma":{"concrete_event":"分手","stakes":"失去信任","sticking_point":"沟通断裂"},"desired_direction":{"wants":"复合","priority":"先谈清楚"}}',
  );
  assert("good json no resend", !salvaged);

  const noAgenda = appendForwardMove("你把边界画出来了。", createInitialAgentState({ original_question: "q" }), "zh");
  assert("appendForwardMove no generic fallback", !noAgenda.includes("能再多说一点"));
  assert("appendForwardMove keeps insight", noAgenda.includes("边界"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
