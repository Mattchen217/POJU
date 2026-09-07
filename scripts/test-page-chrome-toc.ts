/**
 * Smoke: page chrome gate — empty / tag-only title + empty subtitle fail sanitize.
 * Run: pnpm exec tsx scripts/test-page-chrome-toc.ts
 */
import assert from "node:assert/strict";
import { isTagOnlyOrEmptyPageTitle } from "../lib/llm/pro/delivery/delivery-schema";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";

assert.equal(isTagOnlyOrEmptyPageTitle("metaphysics_action", ""), true);
assert.equal(isTagOnlyOrEmptyPageTitle("metaphysics_action", "自我调频"), true);
assert.equal(isTagOnlyOrEmptyPageTitle("metaphysics_action", "Self Retune"), true);
assert.equal(
  isTagOnlyOrEmptyPageTitle("metaphysics_action", "阶段窗口里的侧向破局"),
  false,
);

const baseDim = {
  name: "精力管理 · 认知恢复与损耗隔离",
  strategy: "用忌极性决定靠近补给、远离耗散；对本案股权与退出窗口，先稳住再谈进取。",
  means: [
    { text: "靠近补给型协作，远离耗散型硬顶", type: "polarity" },
    { text: "角色上借势协同而非单干硬闯", type: "archetype" },
  ],
  chart_anchors: ["用神", "正印"],
};

{
  const bad = sanitizePageJson("metaphysics_action", {
    page: "metaphysics_action",
    page_title: "自我调频",
    page_subtitle: "副题有了",
    question_anchor: "股权与退出",
    desired_outcome: "稳住再进取",
    dimensions: [baseDim, { ...baseDim, name: "战略周期 · 阶段节奏" }, { ...baseDim, name: "组织杠杆" }],
    leverage: [],
    avoid: [],
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "missing_page_title");
}

{
  const badSub = sanitizePageJson("metaphysics_action", {
    page: "metaphysics_action",
    page_title: "阶段窗口里的侧向破局",
    page_subtitle: "",
    question_anchor: "股权与退出",
    desired_outcome: "稳住再进取",
    dimensions: [baseDim, { ...baseDim, name: "战略周期 · 阶段节奏" }, { ...baseDim, name: "组织杠杆" }],
    leverage: [],
    avoid: [],
  });
  assert.equal(badSub.ok, false);
  if (!badSub.ok) assert.equal(badSub.reason, "missing_page_subtitle");
}

console.log("test-page-chrome-toc: ok");
