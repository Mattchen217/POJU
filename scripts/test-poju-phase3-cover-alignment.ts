/**
 * Phase-3 cover alignment: clamp + label match + second cant-provide.
 *   pnpm exec tsx scripts/test-poju-phase3-cover-alignment.ts
 */
import assert from "node:assert/strict";
import { agendaReportMatchesFocus, normalizeAgendaRef } from "@/lib/poju/agenda-focus-match";
import {
  clampQuestionSignals,
  countPriorCantProvideAnswers,
  ensureCollectingCatchPrefix,
  looksLikeCantProvideAnswer,
  shouldForceSatisfiedAfterSecondCantProvide,
  userPickedProvidedOption,
} from "@/lib/poju/question-status";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";

assert.equal(normalizeAgendaRef(" 产品类型 "), "产品类型");
assert.equal(
  agendaReportMatchesFocus(["产品类型"], { id: "a1", label: "产品类型" }),
  true,
);
assert.equal(
  agendaReportMatchesFocus(["关于产品类型的确认"], { id: "a1", label: "产品类型" }),
  true,
);
assert.equal(
  agendaReportMatchesFocus(["a1"], { id: "a1", label: "产品类型" }),
  true,
);
assert.equal(
  agendaReportMatchesFocus(["完全无关"], { id: "a1", label: "产品类型" }),
  false,
);

assert.equal(looksLikeCantProvideAnswer("这个目前还没到那一步"), true);
assert.equal(looksLikeCantProvideAnswer("工具类产品"), false);

const aqs = {
  question_key: "a1",
  focus_label: "产品类型",
  collection_goal: null,
  round_on_this_item: 2,
  escalation_stage: 1,
  history_on_this_item: [
    { asked: "q", replied: "这个还不适用", status: "retry" as const },
  ],
};
assert.equal(countPriorCantProvideAnswers(aqs), 1);
assert.equal(shouldForceSatisfiedAfterSecondCantProvide(aqs, "还是答不了"), true);
assert.equal(shouldForceSatisfiedAfterSecondCantProvide(aqs, "工具类"), false);

const clamped = clampQuestionSignals(
  {
    question_status: "satisfied" as const,
    reply_quality: "vague" as const,
    agenda_updates: { completed_in_this_turn: [] },
  },
  null,
  false,
  "产品类型",
);
assert.equal(clamped.question_status, "satisfied");
assert.equal(clamped.reply_quality, "clear");
assert.deepEqual(clamped.agenda_updates?.completed_in_this_turn, ["产品类型"]);

const clampedRetry = clampQuestionSignals(
  {
    question_status: "retry" as const,
    agenda_updates: { completed_in_this_turn: ["产品类型"] },
  },
  null,
  false,
  "产品类型",
);
assert.deepEqual(clampedRetry.agenda_updates?.completed_in_this_turn, []);

const clampedCant = clampQuestionSignals(
  { question_status: "retry" as const },
  aqs,
  false,
  "产品类型",
  { userMessage: "还是答不了，不适用" },
);
assert.equal(clampedCant.question_status, "satisfied");
assert.deepEqual(clampedCant.agenda_updates?.completed_in_this_turn, ["产品类型"]);

const agent = {
  ...createInitialAgentState({ original_question: "q", selected_profile_id: null }),
  current_phase: "collecting_context" as const,
  investigation_agenda: [
    {
      id: "a1",
      label: "产品类型",
      critical: true,
      status: "partial" as const,
      unqualified_streak: 0,
    },
  ],
  agenda_generated: true,
  active_question_state: aqs,
};

const covered = advanceStateMachine(
  agent,
  extractModelTurnSignals({
    question_status: "satisfied",
    reply_quality: "clear",
    agenda_updates: { completed_in_this_turn: ["关于产品类型"] },
  }),
  "一个工具或效率类产品",
);
assert.equal(covered.next_agent.investigation_agenda?.[0]?.status, "covered");

const catchOut = ensureCollectingCatchPrefix(
  "你选择一个人做产品，这条路本身是对的。但我想再确认类型？",
  "一个工具或效率类产品，帮人解决具体问题",
  { pickedOption: true, locale: "zh" },
);
assert.ok(!catchOut.includes("你刚才说的是「"));
assert.ok(catchOut.startsWith("你选择一个人做产品"));

const strippedEcho = ensureCollectingCatchPrefix(
  "你刚才说的是「聊过一点」——记下了。\n\n他能理解你累，这是个很重要的基础。",
  "聊过一点",
  { pickedOption: true, locale: "zh" },
);
assert.ok(!strippedEcho.includes("记下了"));
assert.ok(strippedEcho.startsWith("他能理解你累"));

const session = {
  messages: [
    {
      role: "assistant" as const,
      content: "ask",
      timestamp: "1",
      options: ["一个工具或效率类产品，帮人解决具体问题", "内容类", "服务类"],
      meta: { options_consumed: true, offered_options: ["一个工具或效率类产品，帮人解决具体问题", "内容类", "服务类"] },
    },
    {
      role: "user" as const,
      content: "一个工具或效率类产品，帮人解决具体问题",
      timestamp: "2",
    },
  ],
} as POJUSessionState;
assert.equal(
  userPickedProvidedOption(session, "一个工具或效率类产品，帮人解决具体问题"),
  true,
);

console.log("test-poju-phase3-cover-alignment: ok");
