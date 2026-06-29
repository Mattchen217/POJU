/**
 * Collecting transition — first focus question safety net.
 * Run: pnpm exec tsx scripts/test-poju-collecting-focus-reply.ts
 */
import {
  appendFirstFocusQuestion,
  hasQuestionCue,
} from "@/lib/poju/collecting-focus-reply";
import type { POJUAgentState } from "@/lib/poju/agent-state";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const agent = {
  investigation_agenda: [
    { id: "a1", label: "再婚的核心驱动力：怕孤独还是求陪伴？", critical: true, status: "pending" },
  ],
} as unknown as POJUAgentState;

assert("hasQuestionCue trailing ?", hasQuestionCue("你怎么看？"));
assert("hasQuestionCue none", !hasQuestionCue("我们一步步拆开它。"));

const appended = appendFirstFocusQuestion("关系里你卡住的，是底气。", agent, "zh");
assert("appends focus question", appended.includes("再婚的核心驱动力"));
assert("appends question mark", appended.includes("？"));

console.log("\n");
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All collecting-focus-reply checks passed.\n");
