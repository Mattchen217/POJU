/**
 * Collecting: don't re-ask covered agenda; peek next focus after cover.
 *
 *   pnpm exec tsx scripts/test-collecting-covered-reask.ts
 */
import assert from "node:assert/strict";
import {
  formatAgendaForPrompt,
  peekNextAgendaFocusAfterCover,
  responseReasksCoveredAgendaItem,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";

const agenda: AgendaItem[] = [
  {
    id: "a1",
    label: "你的工作性质，允许你设定下班后的能量边界吗",
    critical: true,
    status: "covered",
    captured_answer: "很难，老板或客户会随时找人，不敢不回",
  },
  {
    id: "a2",
    label: "你近期的日常安排里,有没有一段完全不受打扰的时间",
    critical: false,
    status: "unexplored",
  },
  {
    id: "a3",
    label: "你妻子最近的状态,她是否也处在疲惫和疏离中",
    critical: true,
    status: "unexplored",
  },
];

const reaskWork =
  "不敢不回——这四个字把边界钉死了。接下来要看另一块：你的工作性质，允许你设定下班后的能量边界吗？比如，能不能做到晚上七点后不回工作消息？";
const askWife =
  "深夜刷手机是代偿不是恢复。接下来要看家庭这一侧。你妻子最近的状态，你感觉她是不是也处在疲惫和疏离中？";

assert.equal(
  responseReasksCoveredAgendaItem(reaskWork, agenda, agenda[1]!),
  true,
  "re-asking covered work boundary",
);
assert.equal(
  responseReasksCoveredAgendaItem(askWife, agenda, agenda[2]!),
  false,
  "asking live wife focus is ok",
);

const next = peekNextAgendaFocusAfterCover(agenda, agenda[1]!);
assert.equal(next?.id, "a3");

const prompt = formatAgendaForPrompt(agenda);
assert.ok(prompt.includes("已答"), "covered answers appear in prompt");
assert.ok(prompt.includes("不敢不回"), "captured answer clipped into prompt");

console.log("All collecting covered-reask checks passed.");
