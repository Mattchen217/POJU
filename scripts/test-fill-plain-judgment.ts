import assert from "node:assert/strict";
import { buildPageSchemaFillPrompt } from "../lib/llm/pro/delivery/page-schema/fill-prompt.ts";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize.ts";
import {
  isFillActionPrescription,
  proseEchoesCollectedAgenda,
} from "../lib/llm/pro/delivery/page-schema/situation-echo.ts";

const core =
  "只想先兼职试水看看情况，不太敢直接把现在的稳定收入断了，也不知道能有多大的话语权，股权也没有明确说";
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

assert.equal(
  proseEchoesCollectedAgenda("让你有机会争取兼职试水", core),
  true,
);
assert.equal(isFillActionPrescription("因此你需要先以兼职方式试水，保住稳定收入。"), true);

const agenda = `${core}\n如何开口谈兼职`;
const badPage = {
  page: "foundation",
  page_title: "兼职试水的必要性与话语权",
  page_subtitle: "从能量结构看",
  why_cards: [
    {
      title: "a",
      surface: "技术被压制",
      essence:
        "你的能量结构里创造力被压制。因此你需要先以兼职方式试水，保住现有稳定收入，并搞清楚股权如何落地。",
    },
    { title: "b", surface: "x", essence: "y".repeat(70) },
    { title: "c", surface: "x", essence: "y".repeat(70) },
    { title: "d", surface: "x", essence: "y".repeat(70) },
  ],
};
const failScript = sanitizePageJson("foundation", badPage, {
  plainJudgmentFill: true,
  situationMaterial: agenda,
});
assert.equal(failScript.ok, false);
if (failScript.ok) throw new Error("expected fail");
assert.ok(
  failScript.reason.startsWith("fill_action_prescription:") ||
    failScript.reason === "page_title_situation_paste" ||
    failScript.reason.startsWith("surface_situation_paste:"),
);

console.log("ok fill-plain-judgment");
