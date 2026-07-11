/**
 * Block 73 — empty generation must not masquerade as provider_queue / server busy
 *
 *   pnpm exec tsx scripts/test-poju-block73-empty-not-busy.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  isEmptyPhaseCompletion,
  salvageContentFromReasoning,
} from "@/lib/llm/phases/phase-transport";
import {
  getPojuEmptyGenerationMessage,
  getPojuServiceBusyMessage,
  isPojuEmptyGenerationMessage,
  isPojuInfrastructureFailureMessage,
} from "@/lib/llm/poju-service-busy-message";

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
  console.log("\n========== POJU Block 73 · Empty ≠ busy ==========\n");

  const pojuLlm = read("lib/llm/poju-llm.ts");
  assert("poju-llm rethrows ProviderQueueError", pojuLlm.includes("instanceof OpenRouterProviderQueueError"));
  assert("poju-llm incomplete fallback on other errors", pojuLlm.includes('"incomplete"'));

  const agent = read("lib/poju/agent.ts");
  assert("agent meta kind generation_incomplete", agent.includes("generation_incomplete"));

  const emptyEn = getPojuEmptyGenerationMessage("en");
  const busyEn = getPojuServiceBusyMessage("en");
  assert("empty en distinct from busy", emptyEn !== busyEn);
  assert("empty en not high demand copy", !emptyEn.includes("high demand"));
  assert("isPojuEmptyGenerationMessage detects en", isPojuEmptyGenerationMessage(emptyEn));
  assert("empty not infra failure", !isPojuInfrastructureFailureMessage(emptyEn));
  assert("busy is infra failure", isPojuInfrastructureFailureMessage(busyEn));

  const salvaged = salvageContentFromReasoning({
    content: "",
    model: "test",
    tokens_used: 100,
    reasoning: 'thinking… {"response":"hello","understanding_sufficient":false}',
  });
  assert("salvage extracts JSON from reasoning", salvaged.content.includes('"response"'));
  assert("salvage clears empty flag", !isEmptyPhaseCompletion(salvaged));

  const proseOnly = salvageContentFromReasoning({
    content: "",
    model: "test",
    tokens_used: 100,
    reasoning:
      "我先在内部推演：用户的核心困境是徒弟坐了位置，他怕经验烂掉。接下来应该问他最希望往哪个方向走。",
  });
  assert("prose reasoning not salvaged as content", isEmptyPhaseCompletion(proseOnly));

  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("no prose salvage from reasoning", !transport.includes("salvaged content from reasoning prose"));
  assert("no salvagePhaseResponseText(reasoning)", !transport.includes("salvagePhaseResponseText(reasoning)"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 73 checks passed.\n");
}

main();
