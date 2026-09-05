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
  countCollectingWrapUpSections,
} from "../lib/llm/phases/collecting-phase-v6";
import type { AgendaItem } from "../lib/poju/investigation-agenda";

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
