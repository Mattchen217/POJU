/**
 * Block 14+15 — audit alert-only, model opening gate, JSON state snapshot, no structure prescriptions
 * Run: pnpm exec tsx scripts/test-poju-block14-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { resolvePhaseResponse } from "@/lib/llm/phases/phase-transport";
import { buildStateSnapshot } from "@/lib/poju/state-machine";

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
  console.log("\n========== POJU Block 14+15 Acceptance ==========\n");

  console.log("=== A1 · audit alert-only ===\n");
  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("resolvePhaseResponse uses logPhaseComplianceAlert", transport.includes("logPhaseComplianceAlert"));
  assert("resolvePhaseResponse never voids on compliance", !transport.includes("compliance_failed: true"));
  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("collecting has no compliance_failed fallback", !collecting.includes("resolved.compliance_failed"));

  const auditResult = resolvePhaseResponse(
    '{"response":"你的十神偏印很重，五行金水相生…"}',
    { locale: "zh", phase_name: "collecting_context", use_fallback: false },
  );
  assert("bazi terms not voided", auditResult.response.trim().length > 0);
  assert("compliance_failed always false", auditResult.compliance_failed === false);

  console.log("\n=== A2 · model-driven opening gate (Block 19) ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening no regex gate", !opening.includes("isGreetingOrEmptyQuestion"));
  assert("opening parses understanding_sufficient", opening.includes("parsed.understanding_sufficient"));

  console.log("\n=== A3 · output red lines in static system ===\n");
  const oriental = read("lib/llm/phases/oriental-prompt-context.ts");
  assert("buildOutputRedLinesBlock exists", oriental.includes("buildOutputRedLinesBlock"));
  assert("red lines in system prompt", oriental.includes("buildOutputRedLinesBlock()"));
  assert("五行尽情展示", oriental.includes("尽情展示"));

  console.log("\n=== B1 · JSON state snapshot ===\n");
  const snap = buildStateSnapshot({
    current_phase: "opening",
    original_question: "",
    breakthrough_core: null,
    investigation_agenda: [],
  } as never);
  assert("snapshot has state_ledger", Boolean(snap.state_ledger));
  assert("snapshot current_state opening", snap.state_ledger.current_state === "opening");

  console.log("\n=== B2/B3 · no structure prescriptions ===\n");
  assert("collecting no 三件事", !collecting.includes("每一轮你做三件事"));
  assert("collecting no 每轮分量", !collecting.includes("每轮的分量"));
  assert("collecting no text ledger", !collecting.includes("buildStateLedger"));
  assert("confirmation no numbered response", !read("lib/llm/phases/confirmation-phase.ts").includes("response 要做到"));
  assert("tracking no numbered 你要做到", !read("lib/llm/phases/tracking-phase.ts").includes("## 你要做到"));
  assert("opening no 2-4 sentence hook", !opening.includes("2–4 句"));
  assert("opening no 3-5 greeting rule", !opening.includes("3–5 句"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 14+15 acceptance checks passed.\n");
}

main();
