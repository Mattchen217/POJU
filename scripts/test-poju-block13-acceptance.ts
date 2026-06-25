/**
 * Block 13 — salvage control fields + opening hook rules + diag logs
 * Run: pnpm exec tsx scripts/test-poju-block13-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  guardParseFailedFields,
  parsePhaseJson,
} from "@/lib/llm/phases/phase-transport";

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
  console.log("\n========== POJU Block 13 Acceptance ==========\n");

  console.log("=== Fix 1 · salvage control fields ===\n");
  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("salvage grabs sufficient", transport.includes('"sufficient"'));
  assert("salvage grabs suggested_phase", transport.includes('"suggested_phase"'));
  assert("guard preserves understanding", transport.includes("parsed.understanding ??"));

  const broken =
    '{"response":"我离婚8年了…","understanding":{"sufficient":true,"missing":""},"suggested_phase":"collecting_context"';
  const salvaged = parsePhaseJson(broken);
  assert("salvaged sufficient true", (salvaged.understanding as { sufficient?: boolean })?.sufficient === true);
  assert("salvaged suggested collecting", salvaged.suggested_phase === "collecting_context");
  const guarded = guardParseFailedFields(salvaged);
  assert("guard keeps sufficient after salvage", (guarded.understanding as { sufficient?: boolean })?.sufficient === true);
  assert("guard keeps suggested after salvage", guarded.suggested_phase === "collecting_context");

  const opening = read("lib/llm/phases/opening-phase.ts");

  console.log("\n=== Fix 2/3 · opening (Block 14+ superseded prompt hooks) ===\n");
  assert("opening deterministic gate", opening.includes("isGreetingOrEmptyQuestion"));
  assert("opening finalSufficient", opening.includes("finalSufficient"));
  assert("opening phase-transition diag", opening.includes('[poju-diag] phase-transition'));

  console.log("\n=== Fix 4 · diag logs ===\n");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("breakthrough-core diag", orch.includes('[poju-diag] breakthrough-core trigger'));
  assert("phase-transition diag in opening", opening.includes('[poju-diag] phase-transition'));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 13 acceptance checks passed.\n");
}

main();
