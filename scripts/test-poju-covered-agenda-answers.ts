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
import { resolveAskedAgendaItem } from "@/lib/poju/agenda-focus-match";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";

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

{
  const items: AgendaItem[] = [
    { id: "r", label: "项目实际资源到位情况", critical: true, status: "unexplored" },
    { id: "c", label: "你对自己技术交付的信心", critical: false, status: "unexplored" },
    { id: "t", label: "你近期的可投入时间", critical: false, status: "unexplored" },
    { id: "p", label: "对方对兼职模式的态度", critical: true, status: "unexplored" },
    { id: "e", label: "股权分配空间与技术决策权", critical: true, status: "unexplored" },
  ];
  const focus = { id: "r", label: items[0]!.label };
  const partTime = resolveAskedAgendaItem(
    items,
    "刚才的分析里提到兼职试水。你跟他提过兼职的想法吗？他的反应是什么？",
    focus,
  );
  assert.equal(partTime.off_focus, true);
  assert.equal(partTime.target?.id, "p");
  assert.equal(partTime.cover, true);
  assert.equal(partTime.capture, true);

  const equity = resolveAskedAgendaItem(
    items,
    "他跟你提过股权分配的具体方案吗，哪怕是口头上的？",
    focus,
  );
  assert.equal(equity.target?.id, "e", equity.target?.label);

  const onFocus = resolveAskedAgendaItem(
    items,
    "资源主要在他那边，但你看到的真金白银到位了多少？",
    focus,
  );
  assert.equal(onFocus.off_focus, false);
  assert.equal(onFocus.target?.id, "r");

  const agent = {
    ...createInitialAgentState({ original_question: "合伙", selected_profile_id: null }),
    current_phase: "collecting_context" as const,
    investigation_agenda: items,
    agenda_generated: true,
  };
  const advanced = advanceStateMachine(
    agent,
    extractModelTurnSignals({
      question_status: "satisfied",
      reply_quality: "clear",
      agenda_updates: { completed_in_this_turn: ["项目实际资源到位情况"] },
    }),
    "还没正式提，但试探过，他好像不太接受兼职",
    { asked: partTime },
  );
  const after = advanced.next_agent.investigation_agenda ?? [];
  assert.equal(after.find((a) => a.id === "r")?.status, "unexplored");
  assert.equal(after.find((a) => a.id === "p")?.status, "covered");
  const filed = captureAgendaAnswer(
    after,
    { id: partTime.target!.id, label: partTime.target!.label },
    "还没正式提，但试探过，他好像不太接受兼职",
  );
  assert.match(filed.find((a) => a.id === "p")?.captured_answer ?? "", /兼职/);
  assert.equal(filed.find((a) => a.id === "r")?.captured_answer, undefined);
}

console.log("test-poju-covered-agenda-answers: ok");
