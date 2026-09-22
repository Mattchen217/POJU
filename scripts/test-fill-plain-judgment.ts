import assert from "node:assert/strict";
import { buildPageSchemaFillPrompt } from "../lib/llm/pro/delivery/page-schema/fill-prompt.ts";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize.ts";
import {
  hasFillSoftFrame,
  isFillActionPrescription,
  proseEchoesCollectedAgenda,
} from "../lib/llm/pro/delivery/page-schema/situation-echo.ts";

const core =
  "只想先兼职试水看看情况，不太敢直接把现在的稳定收入断了，也不知道我能有多大的话语权，股权也没有明确说";
const { user } = buildPageSchemaFillPrompt("foundation", {
  locale: "zh",
  core_conclusion: core,
  fill_mode: "compress",
  plain_judgment: true,
  deep_evidence_lock: "【已锁定命理批断】\n### 单元 1",
  foundation_surface_feed: "处境：兼职试水",
  question_expectation: "如何开口谈兼职",
  reality_constraints: "对方要求全职",
});
assert.doesNotMatch(user, /兼职试水/);
assert.doesNotMatch(user, /core_conclusion/);
assert.match(user, /已锁定命理批断/);

assert.equal(proseEchoesCollectedAgenda("让你有机会争取兼职试水", core), true);
assert.equal(isFillActionPrescription("因此你需要先以兼职方式试水，保住稳定收入。"), true);
assert.equal(isFillActionPrescription("这解释了为何你本能地想先兼职试水。"), true);
assert.equal(hasFillSoftFrame("你在结构上更易感到绑定与投入压力。"), true);

const agenda = `${core}\n如何开口谈兼职`;
const badSoft = {
  page: "foundation",
  page_title: "合伙纠结的底层结构卡点",
  page_subtitle: "从机制看卡点",
  why_cards: [
    {
      title: "规范压力",
      surface: "外部环境对你有更高的要求",
      essence:
        "你在结构上更易感到绑定与投入压力。这种约束会让你感到压力。你需要在这种约束与自由之间找到平衡，而不是一味逃避。",
    },
    { title: "b", surface: "x", essence: "y".repeat(70) },
    { title: "c", surface: "x", essence: "y".repeat(70) },
    { title: "d", surface: "x", essence: "y".repeat(70) },
  ],
};
const failSoft = sanitizePageJson("foundation", badSoft, {
  plainJudgmentFill: true,
  situationMaterial: agenda,
});
assert.equal(failSoft.ok, false);
if (failSoft.ok) throw new Error("expected soft-frame fail");
assert.ok(
  failSoft.reason.startsWith("fill_soft_frame:") ||
    failSoft.reason.startsWith("fill_action_prescription:") ||
    failSoft.reason.startsWith("surface_situation_paste:"),
  failSoft.reason,
);

const badPaste = {
  page: "foundation",
  page_title: "结构卡点",
  page_subtitle: "机制从批断来",
  why_cards: [
    {
      title: "安全优先",
      surface: "你容易因为担心失去稳定而不敢争取",
      essence:
        "自我保护过强会压制你获取资源的能力。这解释了为何你本能地想先兼职试水、保住稳定收入，却又难以开口谈条件，以及在话语权和股权上容易让步的倾向。",
    },
    { title: "b", surface: "x", essence: "y".repeat(70) },
    { title: "c", surface: "x", essence: "y".repeat(70) },
    { title: "d", surface: "x", essence: "y".repeat(70) },
  ],
};
const failPaste = sanitizePageJson("foundation", badPaste, {
  plainJudgmentFill: true,
  situationMaterial: agenda,
});
assert.equal(failPaste.ok, false);
if (failPaste.ok) throw new Error("expected paste/prescription fail");
assert.ok(
  failPaste.reason.startsWith("surface_situation_paste:") ||
    failPaste.reason.startsWith("fill_action_prescription:"),
  failPaste.reason,
);

console.log("ok fill-plain-judgment");
