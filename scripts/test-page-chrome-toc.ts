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
assert.equal(isTagOnlyOrEmptyPageTitle("metaphysics_action", "东方谋略"), true);
assert.equal(isTagOnlyOrEmptyPageTitle("metaphysics_action", "Eastern Stratagem"), true);
assert.equal(
  isTagOnlyOrEmptyPageTitle("metaphysics_action", "阶段窗口里的侧向破局"),
  false,
);

/** Dense enough to pass P4 density before chrome title gate runs. */
const baseDim = {
  name: "时机调频 · 守成窗口",
  strategy:
    "当前运岁窗口未熟，心力只维持最低必要激活。每天固定一段独处降噪作补给窗，只调自己的节奏与恢复。急躁上涌时先用短时专注表达把燥热泄掉，身心回稳后再考虑是否加码推进。",
  means: [
    {
      text: "未熟窗口先收缩自身投入带宽——心力只维持最低必要激活，不因外界催促破窗加码；冷静且条件成熟时再切换。",
      type: "timing",
    },
    {
      text: "关键决定前先进入冷静弹性补给态——独处降噪、放慢呼吸，等内在回来再面对催促场。",
      type: "polarity",
    },
  ],
  chart_anchors: ["壬寅", "丙午", "用神"],
};

for (const tagTitle of ["东方谋略", "自我调频"] as const) {
  const bad = sanitizePageJson("metaphysics_action", {
    page: "metaphysics_action",
    page_title: tagTitle,
    page_subtitle: "副题有了",
    question_anchor: "合伙",
    desired_outcome: "守节奏",
    dimensions: [
      baseDim,
      { ...baseDim, name: "极性调频 · 冷静弹性" },
      { ...baseDim, name: "角色调频 · 借势站位" },
    ],
    leverage: [],
    avoid: [],
  });
  assert.equal(bad.ok, false, `tag title ${tagTitle} must fail`);
  if (!bad.ok) assert.equal(bad.reason, "missing_page_title", tagTitle);
}

{
  const badSub = sanitizePageJson("metaphysics_action", {
    page: "metaphysics_action",
    page_title: "阶段窗口里的侧向破局",
    page_subtitle: "",
    question_anchor: "合伙",
    desired_outcome: "守节奏",
    dimensions: [
      baseDim,
      { ...baseDim, name: "极性调频 · 冷静弹性" },
      { ...baseDim, name: "角色调频 · 借势站位" },
    ],
    leverage: [],
    avoid: [],
  });
  assert.equal(badSub.ok, false);
  if (!badSub.ok) assert.equal(badSub.reason, "missing_page_subtitle");
}

console.log("test-page-chrome-toc: ok");
