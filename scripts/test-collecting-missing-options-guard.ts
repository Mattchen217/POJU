/**
 * Collecting mid-turn must require reply options; wrap-up may omit.
 * Run: pnpm exec tsx scripts/test-collecting-missing-options-guard.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectingTurnRequiresReplyOptions } from "../lib/llm/phases/collecting-phase-v6";
import type { AgendaItem } from "../lib/poju/investigation-agenda";

function item(label: string, status: AgendaItem["status"]): AgendaItem {
  return {
    id: label,
    label,
    critical: true,
    status,
    collection_goal: "goal",
  };
}

const midAgenda = [
  item("财务安全底线", "covered"),
  item("原职强度与内部机会", "unexplored"),
  item("身体恢复", "unexplored"),
];

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: {
      question_status: "satisfied",
      agenda_updates: { completed_in_this_turn: ["财务安全底线"] },
      options: [],
    },
    response: "手上还握着什么能盘活的资源？",
    agenda: midAgenda,
  }),
  true,
  "mid-collection with pending must require options",
);

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: {
      suggested_phase: "awaiting_confirmation",
      options: [],
    },
    response: "核对总结如下…",
    agenda: midAgenda,
  }),
  false,
  "awaiting_confirmation may omit options",
);

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: {
      agenda_updates: {
        completed_in_this_turn: ["原职强度与内部机会", "身体恢复"],
      },
      options: [],
    },
    response: "对齐核对总结…",
    agenda: [
      item("财务安全底线", "covered"),
      item("原职强度与内部机会", "unexplored"),
      item("身体恢复", "unexplored"),
    ],
  }),
  false,
  "all covered after this turn = wrap-up; options optional",
);

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: { session_action: "terminate_refund" },
    response: "退回 PASS",
    agenda: midAgenda,
  }),
  false,
);

assert.equal(
  collectingTurnRequiresReplyOptions({
    parsed: {},
    response: "What resources do you still hold?",
    agenda: [],
  }),
  true,
  "no agenda but asking → still require options",
);

const src = readFileSync(
  resolve(__dirname, "../lib/llm/phases/collecting-phase-v6.ts"),
  "utf8",
);
assert.ok(src.includes("[collecting] missing options — one corrective resend"));
assert.ok(src.includes("窄逃逸"));
assert.ok(!src.includes("收集已充分、要收尾进确认时,可不给 options"));

console.log("ok: collecting missing-options guard");
