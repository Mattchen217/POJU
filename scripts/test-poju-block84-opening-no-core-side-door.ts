/**
 * Block 84 — Opening hard-rejects breakthrough_core / agenda side door
 *
 *   pnpm exec tsx scripts/test-poju-block84-opening-no-core-side-door.ts
 */
import fs from "node:fs";
import path from "node:path";

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
  console.log("\n========== POJU Block 84 · Opening no core side door ==========\n");

  const agent = read("lib/poju/agent.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");

  assert("opening v6 returns null breakthrough_core", opening.includes("breakthrough_core: null"));
  assert("opening v6 returns null investigation_agenda", opening.includes("investigation_agenda: null"));
  assert("opening prompt forbids segment-2 fields", opening.includes("禁止在 opening 输出"));

  assert("agent has isOpeningTurn guard", agent.includes("isOpeningTurn"));
  assert(
    "opening ignores llm breakthrough_core",
    agent.includes("isOpeningTurn\n      ? (base.breakthrough_core ?? null)") ||
      agent.includes("isOpeningTurn\r\n      ? (base.breakthrough_core ?? null)"),
  );
  assert(
    "opening skips agenda generation from llm",
    agent.includes("!isOpeningTurn && !agenda_generated"),
  );
  assert(
    "opening skips breakthrough_core_updates merge",
    agent.includes("!isOpeningTurn &&\n    merged.breakthrough_core") ||
      agent.includes("!isOpeningTurn &&\r\n    merged.breakthrough_core"),
  );
  assert(
    "removed opening conversion envelope log",
    !agent.includes("breakthrough_core from opening conversion envelope"),
  );
  assert("wire strip on opening turn", agent.includes("openingTurn ? null : (llmResponse.breakthrough_core ?? null)"));
  assert(
    "segment-2 clears stale core before fetch",
    agent.includes("breakthrough_core: null,\n        investigation_agenda: []") ||
      agent.includes("breakthrough_core: null,\r\n        investigation_agenda: []"),
  );
  assert("segment-2 independent xhigh log", agent.includes("segment-2 breakthrough-core (post-gate, independent xhigh)"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 84 checks passed.\n");
}

main();
