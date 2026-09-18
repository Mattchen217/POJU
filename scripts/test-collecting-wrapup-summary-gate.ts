/**
 * Collecting wrap-up summary shape + agenda size SSOT notes.
 * Run: pnpm exec tsx scripts/test-collecting-wrapup-summary-gate.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectingTurnIsWrapUp,
  collectingTurnRequiresReplyOptions,
  collectingWrapUpSummaryLooksComplete,
  coerceLastItemWrapUpParsed,
  countCollectingWrapUpSections,
  responseOwnsCollectingWrapUp,
} from "../lib/llm/phases/collecting-phase-v6";
import { resolveAskedAgendaItem } from "../lib/poju/agenda-focus-match";
import { createInitialAgentState } from "../lib/poju/agent-state";
import {
  captureAgendaAnswer,
  type AgendaItem,
} from "../lib/poju/investigation-agenda";
import { clampQuestionSignals } from "../lib/poju/question-status";
import { advanceStateMachine, extractModelTurnSignals } from "../lib/poju/state-machine";

function item(label: string, status: AgendaItem["status"]): AgendaItem {
  return { id: label, label, critical: true, status, collection_goal: "g" };
}

const six = [
  item("A", "covered"),
  item("B", "covered"),
  item("C", "covered"),
  item("D", "covered"),
  item("E", "covered"),
  item("F", "unexplored"),
];

assert.equal(
  collectingTurnIsWrapUp({
    parsed: {
      question_status: "satisfied",
      agenda_updates: { completed_in_this_turn: ["F"] },
    },
    agenda: six,
  }),
  true,
);

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: {
      question_status: "satisfied",
      agenda_updates: { completed_in_this_turn: ["F"] },
    },
    response: "偶尔复盘……你有导师吗？",
    agenda: six,
  }),
  false,
  "wrap-up must not require chips",
);

const thin = "偶尔复盘说明通道在。你有没有一位导师可以聊聊？";
assert.equal(countCollectingWrapUpSections(thin), 0);
assert.equal(collectingWrapUpSummaryLooksComplete(thin, 6), false);

const full = [
  "偶尔复盘，通道在。",
  "",
  "### 财务底线",
  "问意：能撑多久。答案：一年薪会吃存款。",
  "",
  "### 原职节奏",
  "问意：能否腾出手。答案：节奏不紧。",
  "",
  "### 内部资源",
  "问意：手上有什么。答案：人脉与信誉。",
  "",
  "### 身体恢复",
  "问意：睡眠。答案：一般。",
  "",
  "### 复盘习惯",
  "问意：深度思考。答案：偶尔专门抽时间。",
].join("\n");
assert.ok(countCollectingWrapUpSections(full) >= 5);
assert.equal(collectingWrapUpSummaryLooksComplete(full, 6), true);

{
  // Lab: model wrote ### wrap-up on last item but forgot satisfied → must NOT require chips
  assert.equal(
    collectingTurnRequiresReplyOptions({
      parsed: { question_status: "retry", options: [] },
      response: full,
      agenda: six,
    }),
    false,
    "### wrap-up on last pending must not trigger missing-options resend",
  );
  assert.equal(
    collectingTurnIsWrapUp({
      parsed: { options: [] },
      agenda: six,
      response: full,
    }),
    true,
  );
  const coerced = coerceLastItemWrapUpParsed({
    parsed: { question_status: "retry", options: [] },
    response: `${full}\n\n接下来想确认一件事——你的近期是否有项目节点可作为沟通契机？对方近`,
    agenda: six,
    focusLabel: "F",
  });
  assert.equal(coerced.coerced, true);
  assert.equal(coerced.parsed.question_status, "satisfied");
  assert.deepEqual(
    (coerced.parsed.agenda_updates as { completed_in_this_turn: string[] }).completed_in_this_turn,
    ["F"],
  );
  assert.ok(!/接下来想确认一件事/.test(coerced.response));
  assert.equal(responseOwnsCollectingWrapUp(coerced.response, 6), true);
}

{
  // Production path: cursor≠ask → clamp cover_label + SM cover + capture all hit asked item
  const items = [
    { id: "eq", label: "股权与话语权的谈判空间", critical: true, status: "unexplored" as const },
    { id: "pt", label: "对方对兼职模式的真实态度", critical: true, status: "unexplored" as const },
  ];
  const focus = { id: "eq", label: items[0]!.label };
  const ask =
    "你之前跟他提过先兼职看看这个想法吗？他当时的反应是什么？";
  const asked = resolveAskedAgendaItem(items, ask, focus);
  assert.equal(asked.off_focus, true);
  assert.equal(asked.target?.id, "pt");

  const clamped = clampQuestionSignals(
    { question_status: "satisfied" as const, reply_quality: "clear" as const },
    null,
    false,
    focus.label,
    { cover_label: asked.target!.label },
  );
  assert.deepEqual(clamped.agenda_updates.completed_in_this_turn, [
    "对方对兼职模式的真实态度",
  ]);

  const agent = {
    ...createInitialAgentState({ original_question: "q", selected_profile_id: null }),
    current_phase: "collecting_context" as const,
    investigation_agenda: items,
    agenda_generated: true,
  };
  const advanced = advanceStateMachine(
    agent,
    extractModelTurnSignals(clamped),
    "提过，他表面说理解但一直在催我全职",
    { asked },
  );
  const after = advanced.next_agent.investigation_agenda ?? [];
  assert.equal(after.find((a) => a.id === "eq")?.status, "unexplored");
  assert.equal(after.find((a) => a.id === "pt")?.status, "covered");
  const filed = captureAgendaAnswer(
    after,
    { id: asked.target!.id, label: asked.target!.label },
    "提过，他表面说理解但一直在催我全职",
  );
  assert.match(filed.find((a) => a.id === "pt")?.captured_answer ?? "", /催/);
  assert.equal(filed.find((a) => a.id === "eq")?.captured_answer, undefined);
}

const coverageSrc = readFileSync(
  resolve(__dirname, "../lib/llm/deepseek/agenda-spine-coverage.ts"),
  "utf8",
);
assert.ok(coverageSrc.includes("agenda_lt_3"));
assert.ok(coverageSrc.includes("agenda_gt_6"));
assert.ok(coverageSrc.includes("if (next.length > 6)"));

const callB = readFileSync(
  resolve(__dirname, "../lib/llm/deepseek/breakthrough-core.ts"),
  "utf8",
);
assert.ok(callB.includes("目标 4–5 项") || callB.includes("优先 4–5 项"));
assert.ok(callB.includes("上限 6"));

const chain = readFileSync(
  resolve(__dirname, "../lib/llm/phases/collecting-phase-v6.ts"),
  "utf8",
);
assert.ok(chain.includes("[collecting] wrap-up summary incomplete — one corrective resend"));
assert.ok(chain.includes("收尾正文结构（硬 · 三段缺一不可）"));

const progress = readFileSync(
  resolve(__dirname, "../lib/poju/agenda-progress-label.ts"),
  "utf8",
);
assert.ok(progress.includes("agenda.length"));
assert.ok(!progress.includes("正在从 6 个角度了解你的处境（已"));

console.log("ok: collecting wrap-up summary gate + agenda size SSOT");
