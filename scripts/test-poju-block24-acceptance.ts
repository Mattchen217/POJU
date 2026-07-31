/**
 * Block 24 — opening gate from history + self-intro boundary + bare t: sanitizer
 * Run: pnpm exec tsx scripts/test-poju-block24-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { countSubstantiveOpeningTurns } from "@/lib/poju/agent";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  extractModelTurnSignals,
  OPENING_MIN_SUBSTANTIVE_TURNS,
} from "@/lib/poju/state-machine";
import { stripBareTermMarkers, stripBrokenMarkers } from "@/lib/llm/sanitize/term-marking";
import type { POJUMessage } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function msg(role: POJUMessage["role"], content: string): POJUMessage {
  return { role, content, timestamp: new Date().toISOString() };
}

function main(): void {
  console.log("\n========== POJU Block 24 Acceptance ==========\n");

  console.log("=== Fix 1 · history-based opening turns ===\n");
  const agentTs = read("lib/poju/agent.ts");
  const sm = read("lib/poju/state-machine.ts");
  assert("countSubstantiveOpeningTurns exported", agentTs.includes("export function countSubstantiveOpeningTurns"));
  assert("poju-gate diagnostic log", agentTs.includes("[poju-gate]"));
  assert("substantive_opening_turns signal", sm.includes("substantive_opening_turns"));
  assert("state machine uses turns signal not persisted counter", !sm.includes("opening_substantive_turns"));

  const history = [msg("user", "你好"), msg("user", "离婚8年想再婚"), msg("user", "最近两年几乎没接触过异性")];
  assert("greeting excluded from count", countSubstantiveOpeningTurns(history) === 2);

  const agent = createInitialAgentState({ original_question: "" });
  const signals = (turns: number) =>
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: turns,
    });

  assert(
    "turns=1 stays opening",
    advanceStateMachine({ ...agent, has_base_analysis: true }, signals(1), "离婚8年想再婚").next_state ===
      "opening",
  );
  assert(
    "turns=2 enters collecting",
    advanceStateMachine({ ...agent, has_base_analysis: true }, signals(2), "最近两年几乎没接触过异性")
      .next_state === "collecting_context",
  );
  assert("MIN turns still 2", OPENING_MIN_SUBSTANTIVE_TURNS === 2);

  console.log("\n=== Fix 2 · self-intro boundary in prompt ===\n");
  const base = read("lib/llm/prompts/poju-base.ts");
  assert("自报家门 boundary section", base.includes("自报家门的边界"));
  assert("no repeat 我是 Pivot", base.includes("绝不以\"我是 Pivot\"开头"));

  console.log("\n=== Fix 3 · opening no repeat deep insight ===\n");
  assert("opening lightweight insight rule", base.includes("不重复上一轮已说过的框架"));

  console.log("\n=== Fix 4 · bare t: sanitizer ===\n");
  const marking = read("lib/llm/sanitize/term-marking.ts");
  assert("stripBareTermMarkers exported", marking.includes("export function stripBareTermMarkers"));
  assert("slug prefix rule in output format", base.includes("不加 shen_sha:"));

  const leaked = "这两个词恰恰是 t:shen_sha:gua_su|独立倾向|寡宿 在作祟";
  const cleaned = stripBrokenMarkers(leaked);
  assert("bare t: stripped to visible word", cleaned.includes("独立倾向") && !cleaned.includes("t:shen_sha"));
  assert("stripBareTermMarkers alone", stripBareTermMarkers("t:gua_su|独立倾向|寡宿") === "独立倾向");

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 24 acceptance checks passed.\n");
}

main();
