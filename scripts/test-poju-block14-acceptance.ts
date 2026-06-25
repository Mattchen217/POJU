/**
 * Block 14+15 — audit alert-only, deterministic opening gate, state ledger, no structure prescriptions
 * Run: pnpm exec tsx scripts/test-poju-block14-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { resolvePhaseResponse } from "@/lib/llm/phases/phase-transport";
import {
  isGreetingOrEmptyQuestion,
  isSubstantiveBreakthroughQuestion,
} from "@/lib/poju/breakthrough-question-gate";
import { buildStateLedger } from "@/lib/llm/phases/state-ledger";

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

  console.log("\n=== A2 · deterministic opening gate ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening imports isGreetingOrEmptyQuestion", opening.includes("isGreetingOrEmptyQuestion"));
  assert("opening uses finalSufficient", opening.includes("finalSufficient"));
  assert("opening deterministic gate overrides LLM", opening.includes("const understanding = { sufficient: finalSufficient"));
  assert("greeting blocked", isGreetingOrEmptyQuestion("你好"));
  assert("substantive allowed", isSubstantiveBreakthroughQuestion("卡了三年想转行但不敢"));
  assert("inverse consistent", isSubstantiveBreakthroughQuestion("你好") === !isGreetingOrEmptyQuestion("你好"));

  console.log("\n=== A3 · output red lines in static system ===\n");
  const oriental = read("lib/llm/phases/oriental-prompt-context.ts");
  assert("buildOutputRedLinesBlock exists", oriental.includes("buildOutputRedLinesBlock"));
  assert("red lines in system prompt", oriental.includes("buildOutputRedLinesBlock()"));
  assert("五行尽情展示", oriental.includes("尽情展示"));

  console.log("\n=== B1 · state ledger ===\n");
  const ledger = buildStateLedger(null, "理解门", "锚定困境", "锚得住→collecting");
  assert("ledger has phase label", ledger.includes("【你现在在】理解门"));
  assert("ledger has primary task", ledger.includes("【本轮首要任务】锚定困境"));
  assert("ledger no response format", !ledger.includes("response 必须"));

  console.log("\n=== B2/B3 · no structure prescriptions ===\n");
  assert("collecting no 三件事", !collecting.includes("每一轮你做三件事"));
  assert("collecting no 每轮分量", !collecting.includes("每轮的分量"));
  assert("collecting has state ledger", collecting.includes("buildStateLedger"));
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
