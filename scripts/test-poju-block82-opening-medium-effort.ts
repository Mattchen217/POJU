/**
 * Block 82 — opening medium effort + unusable JSON retry / no filler question
 *
 *   pnpm exec tsx scripts/test-poju-block82-opening-medium-effort.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  getPhaseEmptyGenerationFallback,
  isPhaseOpeningPayloadUsable,
  parsePhaseJson,
  resolvePhaseResponse,
} from "@/lib/llm/phases/phase-transport";
import { getPojuEmptyGenerationMessage } from "@/lib/llm/poju-service-busy-message";

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
  console.log("\n========== POJU Block 82 · Opening medium + JSON retry ==========\n");

  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  const transport = read("lib/poju/shared/transport.ts");
  const jsonTools = read("lib/poju/shared/json-tools.ts");
  const agent = read("lib/poju/agent.ts");

  assert("opening effort medium", opening.includes('thinking_effort: "medium"'));
  assert("opening no high effort", !opening.includes('thinking_effort: "high"'));
  assert("opening transport resend in phase-transport", transport.includes("MAX_OPENING_TRANSPORT_RESEND"));
  assert("opening understanding_generation_failed flag", opening.includes("understanding_generation_failed"));
  assert("opening no duplicate v6 transport retry", !opening.includes("controlled retry once"));
  assert("isPhaseOpeningPayloadUsable exported", jsonTools.includes("export function isPhaseOpeningPayloadUsable"));
  assert("parse failure uses empty gen path", transport.includes("useEmptyGeneration"));

  const clean = parsePhaseJson(
    '{"understanding_sufficient":false,"core_dilemma":{"concrete_event":"a","stakes":"b","sticking_point":"c"},"desired_direction":{"wants":"d","priority":"e"},"response":"你好？"}',
  );
  assert("clean parse usable", isPhaseOpeningPayloadUsable(clean, "你好？"));

  const broken =
    "「想要」：「走」 relationship_conclusion_established: true agenda_checklist: [] understanding_gate: blocked";
  const salvaged = parsePhaseJson(broken);
  assert("garbage parse failed", salvaged._parse_failed === true);
  assert("garbage not usable", !isPhaseOpeningPayloadUsable(salvaged, ""));

  const resolved = resolvePhaseResponse(broken, { locale: "zh", phase_name: "opening" });
  assert("broken JSON empty-gen not busy", resolved.response === getPhaseEmptyGenerationFallback("zh"));
  assert("no 能再多说一点 in resolve", !resolved.response.includes("能再多说一点"));

  assert("appendForwardMove skips placeholders", agent.includes("isPojuFailurePlaceholderMessage(finalContent)"));

  const emptyZh = getPojuEmptyGenerationMessage("zh");
  assert("empty zh copy", emptyZh.includes("没有完整生成"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 82 checks passed.\n");
}

main();
