/**
 * Segment2 must show Call A `response`, never internal situation_conclusion.
 *
 *   pnpm exec tsx scripts/test-segment2-response-not-spine.ts
 */
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import {
  buildSegment2AnalysisReply,
  formatSegment2ReplyForUser,
} from "@/lib/poju/phases/segment2/display";
import { salvageBreakthroughFields } from "@/lib/llm/deepseek/breakthrough-core";

const failures: string[] = [];
function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

console.log("\n=== segment2 response vs spine ===\n");

const spine =
  "几年没收入，深层是能量结构上，当前大运戊戌，土旺耗身，财星（土）为忌，食神生财，身弱不担财。";
const dialogue =
  "这几年你一直扛着项目往前走，没有收入。从能量结构来看，你像一棵需要水分的树，过去几年消耗大于补给。";

const withBoth = makeTestBreakthroughCore({
  situation_conclusion: spine,
  response: dialogue,
});
assert(
  "prefers response over spine",
  formatSegment2ReplyForUser(withBoth, "zh") === dialogue,
);
assert(
  "reply has no 财星",
  !buildSegment2AnalysisReply(
    { ...createInitialAgentState({ original_question: "q" }), breakthrough_core: withBoth },
    "zh",
    { includeFirstQuestion: false },
  ).includes("财星"),
);

const spineOnly = makeTestBreakthroughCore({
  situation_conclusion: spine,
  response: "",
});
// makeTestBreakthroughCore fills default response if empty — override after
spineOnly.response = undefined;
assert(
  "no response → empty (not spine)",
  formatSegment2ReplyForUser(spineOnly, "zh") === "",
);
const safe = buildSegment2AnalysisReply(
  { ...createInitialAgentState({ original_question: "q" }), breakthrough_core: spineOnly },
  "zh",
  { includeFirstQuestion: false },
);
assert("placeholder when response missing", safe.includes("卡点") || safe.includes("stuck"));
assert("placeholder has no 财星", !safe.includes("财星"));

const salvaged = salvageBreakthroughFields(
  JSON.stringify({
    situation_conclusion: spine,
    response: dialogue,
    modern_action_frames: [
      {
        direction: "A",
        why_fits: "w",
        structural_basis: "s",
        needs_validation: "n",
      },
      {
        direction: "B",
        why_fits: "w",
        structural_basis: "s",
        needs_validation: "n",
      },
    ],
    investigation_agenda: [
      { id: "1", label: "q1", status: "unexplored", critical: true },
      { id: "2", label: "q2", status: "unexplored", critical: false },
      { id: "3", label: "q3", status: "unexplored", critical: false },
    ],
  }),
);
assert("salvage keeps response", salvaged?.response === dialogue);

console.log("\n========================================\n");
if (failures.length) {
  console.error("FAILED:", failures.join(", "));
  process.exit(1);
}
console.log("All checks passed.\n");
