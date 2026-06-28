/**
 * Block 27 — lock original_question to core problem statement + deep calc timeout/brevity
 * Run: pnpm exec tsx scripts/test-poju-block27-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { extractOpeningProblem } from "@/lib/poju/agent";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
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
  console.log("\n========== POJU Block 27 Acceptance ==========\n");

  console.log("=== Fix 1 · extractOpeningProblem + locked original_question ===\n");
  const agentTs = read("lib/poju/agent.ts");
  const sm = read("lib/poju/state-machine.ts");
  assert("extractOpeningProblem exported", agentTs.includes("export function extractOpeningProblem"));
  assert("opening_problem_statement signal wired", agentTs.includes("opening_problem_statement: openingProblem"));
  assert("state machine uses opening_problem_statement", sm.includes("opening_problem_statement?.trim()"));
  assert("trigger prefers agent original_question", /agent_v2\.original_question\?\.trim\(\)/.test(agentTs));

  const history = [
    msg("user", "你好"),
    msg("user", "我离婚8年了"),
    msg("user", "我想知道什么时候能再婚"),
    msg("user", "没有遇到什么人，主要是事业上没有起色"),
    msg("user", "好的，你问吧"),
  ];
  const problem = extractOpeningProblem(history);
  assert("problem includes divorce + remarriage", problem.includes("离婚") && problem.includes("再婚"));
  assert("problem excludes career clarification", !problem.includes("事业"));
  assert("problem excludes filler", !problem.includes("你问吧"));

  const agent = createInitialAgentState({ original_question: "" });
  const advance = advanceStateMachine(
    { ...agent, has_base_analysis: true },
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: 3,
      opening_problem_statement: problem,
    }),
    "好的，你问吧",
  );
  assert("collecting transition on filler turn", advance.next_state === "collecting_context");
  assert(
    "original_question locked to marriage core",
    advance.next_agent.original_question?.includes("再婚") &&
      !advance.next_agent.original_question?.includes("事业"),
  );

  const richLong =
    "我离婚8年了，一直一个人带孩子，最近开始认真想再婚，但不知道时机是否合适，也担心再遇人不淑，你能帮我看看什么时候比较适合开始认真考虑再婚吗？我想听你说说具体从哪一步开始。";
  assert(
    "rich single message still works",
    advanceStateMachine(
      { ...agent, has_base_analysis: true },
      extractModelTurnSignals({
        understanding_sufficient: true,
        base_analysis_ready: true,
        substantive_opening_turns: 1,
        opening_problem_statement: extractOpeningProblem([msg("user", richLong)]),
      }),
      richLong,
    ).next_state === "collecting_context",
  );

  console.log("\n=== Fix 2 · timeout + brevity prompt ===\n");
  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("soft timeout >= 180s", /softTimeoutMs = 2[4-9]0_000/.test(bt));
  assert("brevity section in DEEP_RECKONING", bt.includes("篇幅节制"));
  assert("structural_basis one sentence rule", bt.includes("一句话点命盘锚点"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 27 acceptance checks passed.\n");
}

main();
