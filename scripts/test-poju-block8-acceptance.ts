/**
 * Block 8 hotfix acceptance — 504 / understanding gate / JSON salvage / client timeout
 * Run: pnpm exec tsx scripts/test-poju-block8-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { extractJson, parsePhaseJson } from "@/lib/llm/phases/phase-transport";

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
  console.log("\n========== POJU Block 8 Acceptance ==========\n");

  console.log("=== Fix 1 · breakthrough-core 504 ===\n");
  const btRoute = read("app/api/poju/breakthrough-core/route.ts");
  assert("breakthrough maxDuration 300", /export const maxDuration = 300/.test(btRoute));
  assert("breakthrough max_tokens 6000", /max_tokens:\s*6000/.test(btRoute));
  assert("breakthrough no max_tokens 12000", !/max_tokens:\s*12000/.test(btRoute));
  const fdRoute = read("app/api/poju/final-delivery/route.ts");
  assert("final-delivery maxDuration 300", /export const maxDuration = 300/.test(fdRoute));

  console.log("\n=== Fix 2 · understanding fail-closed ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening default sufficient false", opening.includes(": { sufficient: false, missing: \"\" }"));

  console.log("\n=== Fix 3 · JSON extractJson ===\n");
  const wrapped = 'Here is the result:\n```json\n{"response":"你好","understanding":{"sufficient":false,"missing":"x"}}\n```\nThanks.';
  const parsed = parsePhaseJson(wrapped);
  assert("extractJson parses fenced JSON", parsed.response === "你好");
  assert("extractJson keeps understanding", (parsed.understanding as { sufficient?: boolean })?.sufficient === false);
  const prose = 'Sure.\n{"response":"ok","suggested_phase":null}\nDone.';
  assert("extractJson slices object from prose", parsePhaseJson(prose).response === "ok");
  assert("extractJson exported", typeof extractJson === "function");

  console.log("\n=== Fix 4 · client soft timeout + retry hint ===\n");
  const btClient = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("requestBreakthroughCore AbortController 90s", btClient.includes("90_000") && btClient.includes("AbortController"));
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("orchestrator retry hint zh", orch.includes("深测算暂时没完成，再发一句继续即可"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 8 acceptance checks passed.\n");
}

main();
