/**
 * Block 75 — understanding gate rejects placeholder fills; false skips conversion
 *
 *   pnpm exec tsx scripts/test-poju-block75-placeholder-gate.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  createInitialAgentState,
  isUnderstandingComplete,
  isUnderstandingFieldFilled,
  mergeCoreDilemma,
  mergeDesiredDirection,
  UNDERSTANDING_PLACEHOLDER_RE,
} from "@/lib/poju/agent-state";

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
  console.log("\n========== POJU Block 75 · Placeholder gate ==========\n");

  const agentState = read("lib/poju/agent-state.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");

  assert("PLACEHOLDER_RE exported", agentState.includes("UNDERSTANDING_PLACEHOLDER_RE"));
  assert("placeholder rejects 尚未明确", !isUnderstandingFieldFilled("尚未明确"));
  assert("placeholder rejects 待追问", !isUnderstandingFieldFilled("待追问"));
  assert("placeholder rejects TBD", !isUnderstandingFieldFilled("tbd"));
  assert("placeholder prefix rejects", !isUnderstandingFieldFilled("尚未明确——需要追问卡点"));
  assert("substantive accepts", isUnderstandingFieldFilled("离婚8年几乎没接触异性"));
  assert("ultra-short rejects", !isUnderstandingFieldFilled("嗯"));
  assert("regex matches 尚未明确", UNDERSTANDING_PLACEHOLDER_RE.test("尚未明确"));

  const merged = {
    ...createInitialAgentState({ original_question: "q" }),
    core_dilemma: mergeCoreDilemma(null, {
      concrete_event: "离婚8年",
      stakes: "怕错过窗口",
      sticking_point: "尚未明确——需要追问",
    }),
    desired_direction: mergeDesiredDirection(null, {
      wants: "尚未明确",
      priority: "尚未明确",
    }),
  };
  assert("placeholder drafts stored in merge", merged.core_dilemma?.sticking_point?.includes("尚未明确") === true);
  assert("struct incomplete with placeholders", !isUnderstandingComplete(merged));

  assert("opening canRunConversion guard", opening.includes("canRunConversion"));
  assert("false skips conversion", opening.includes("understanding_sufficient !== false"));
  assert("false branch shows follow-up", opening.includes("skip conversion, show follow-up"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 75 checks passed.\n");
}

main();
