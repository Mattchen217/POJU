/**
 * Covered agenda evidence carries user answers for synthesis/delivery.
 *   pnpm exec tsx scripts/test-poju-covered-agenda-answers.ts
 */
import assert from "node:assert/strict";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  buildCoveredAgendaEvidence,
  captureAgendaAnswer,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";

const agenda: AgendaItem[] = [
  {
    id: "a1",
    label: "产品类型",
    critical: true,
    status: "covered",
  },
  {
    id: "a2",
    label: "每周可投入时间",
    critical: true,
    status: "partial",
  },
];

let next = captureAgendaAnswer(agenda, { id: "a1", label: "产品类型" }, "工具类效率产品");
next = captureAgendaAnswer(next, { id: "a1", label: "产品类型" }, "还没上线");
assert.equal(next[0]?.captured_answer, "工具类效率产品 / 还没上线");
assert.equal(next[1]?.captured_answer, undefined);

// Dedup identical append
next = captureAgendaAnswer(next, { id: "a1", label: "产品类型" }, "工具类效率产品");
assert.equal(next[0]?.captured_answer, "工具类效率产品 / 还没上线");

const agent = {
  ...createInitialAgentState({ original_question: "q" }),
  investigation_agenda: next.map((a) =>
    a.id === "a2" ? { ...a, status: "covered" as const, captured_answer: "每周约10小时" } : a,
  ),
};

const evidence = buildCoveredAgendaEvidence(agent);
assert.equal(evidence.length, 2);
assert.deepEqual(evidence.find((e) => e.label === "产品类型"), {
  label: "产品类型",
  answer: "工具类效率产品 / 还没上线",
});
assert.deepEqual(evidence.find((e) => e.label === "每周可投入时间"), {
  label: "每周可投入时间",
  answer: "每周约10小时",
});

console.log("test-poju-covered-agenda-answers: ok");
