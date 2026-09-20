/**
 * Covered agenda evidence carries user answers for synthesis/delivery.
 *   pnpm exec tsx scripts/test-poju-covered-agenda-answers.ts
 */
import assert from "node:assert/strict";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  buildCoveredAgendaEvidence,
  captureAgendaAnswer,
  rebuildAgendaCapturedAnswersFromMessages,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import { resolveAskedAgendaItem } from "@/lib/poju/agenda-focus-match";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import {
  polishAgendaItemLabel,
  shortLabelFromNeeds,
} from "@/lib/llm/deepseek/agenda-spine-coverage";

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

{
  // Truncated coverage labels + tech-dependency ask must not file onto 阶段性安排.
  const items: AgendaItem[] = [
    {
      id: "ag1",
      label: "你的对方是否接受阶段性安排？项目是否有明确的",
      critical: true,
      status: "unexplored",
      supports: "对方是否接受阶段性安排？项目是否有明确的里程碑可挂钩？",
    },
    {
      id: "ag2",
      label: "你的项目对技术的依赖程度如何？是否有其他替代",
      critical: true,
      status: "unexplored",
      supports: "项目对技术的依赖程度如何？是否有其他替代技术方案？",
    },
    {
      id: "ag3",
      label: "对方对兼职的反应",
      critical: true,
      status: "covered",
      captured_answer: "必须全职",
    },
  ];
  const focus = { id: "ag1", label: items[0]!.label };
  const tech = resolveAskedAgendaItem(
    items,
    "接下来要看另一块：他对你的技术到底有多依赖？",
    focus,
  );
  assert.equal(tech.off_focus, true);
  assert.equal(tech.target?.id, "ag2");
}

{
  const noun = shortLabelFromNeeds(
    "对方是否接受阶段性安排？项目是否有明确的里程碑可挂钩？",
    "行动假设1",
  );
  assert.equal(noun, "项目短期目标与资源到位");
  assert.equal(
    polishAgendaItemLabel("你的对方是否接受阶段性安排？项目是否有明确的"),
    "阶段性合作安排与节点",
  );
  assert.equal(
    shortLabelFromNeeds(
      "项目对技术的依赖程度如何？是否有其他替代技术方案？",
      "行动假设2",
    ),
    "项目对技术的依赖程度",
  );
  assert.equal(
    shortLabelFromNeeds("对方对兼职试水的真实接受度如何？", "fallback"),
    "对方对兼职试水的接受度",
  );
}

{
  const items: AgendaItem[] = [
    {
      id: "ag1",
      label: "你的对方是否接受阶段性安排？项目是否有明确的",
      critical: true,
      status: "covered",
      captured_answer: "技术重要但不是唯一，他可以找别人或自己慢慢搞",
    },
    {
      id: "ag2",
      label: "你的项目对技术的依赖程度如何？是否有其他替代",
      critical: true,
      status: "covered",
      captured_answer: "技术不是壁垒，他主要缺一个信得过的执行者",
    },
    {
      id: "ag3",
      label: "对方对兼职的反应",
      critical: true,
      status: "covered",
      captured_answer: "我提过，他直接拒绝了，说必须全职才能给核心位置。",
    },
  ];
  const msgs = [
    {
      role: "assistant",
      content: "你之前有没有试探过他的态度？他当时是怎么说的？",
      meta: { segment2_bridge_question: true },
    },
    {
      role: "user",
      content: "我提过，他直接拒绝了，说必须全职才能给核心位置。",
    },
    {
      role: "assistant",
      content: "接下来要看另一块：他对你的技术到底有多依赖？",
    },
    {
      role: "user",
      content: "技术重要但不是唯一，他可以找别人或自己慢慢搞",
    },
    {
      role: "assistant",
      content: "项目对技术的依赖程度，更接近下面哪种情况？",
    },
    {
      role: "user",
      content: "技术不是壁垒，他主要缺一个信得过的执行者",
    },
  ];
  const rebuilt = rebuildAgendaCapturedAnswersFromMessages(items, msgs);
  assert.match(rebuilt.find((a) => a.id === "ag3")?.captured_answer ?? "", /拒绝/);
  assert.match(rebuilt.find((a) => a.id === "ag2")?.captured_answer ?? "", /技术重要但不是唯一/);
  assert.ok(
    !(rebuilt.find((a) => a.id === "ag1")?.captured_answer ?? "").includes("技术重要"),
  );
}

console.log("test-poju-covered-agenda-answers: ok");
