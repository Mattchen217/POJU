/**
 * P2/P3 fill plain-judgment: feed strip + soft-frame / agenda / prescription gates.
 * Run: pnpm exec tsx scripts/test-fill-plain-judgment.ts
 */
import assert from "node:assert/strict";
import { buildPageSchemaFillPrompt } from "@/lib/llm/pro/delivery/page-schema/fill-prompt";
import { formatDeepEvidencePlanForCompress } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { sanitizePageJson } from "@/lib/llm/pro/delivery/page-schema/sanitize";
import {
  hasFillSoftFrame,
  isFillActionPrescription,
  proseEchoesCollectedAgenda,
} from "@/lib/llm/pro/delivery/page-schema/situation-echo";

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

{
  const { user: p3user, system: p3sys } = buildPageSchemaFillPrompt("science_action", {
    locale: "zh",
    core_conclusion: core,
    fill_mode: "compress",
    plain_judgment: true,
    deep_evidence_lock: "【已锁定命理批断】\n### 单元 1 · primary_toolkit.angles[0]",
    science_means_feed: "【P3 科学手段候选菜单】今晚起草阶段性合作提案",
    question_expectation: "如何开口谈兼职与股权",
    reality_constraints: "对方要求全职",
    primary_backup_hint: "主轨试水 / 辅轨守底线",
  });
  assert.doesNotMatch(p3user, /兼职/);
  assert.doesNotMatch(p3user, /科学手段候选菜单/);
  assert.doesNotMatch(p3user, /core_conclusion/);
  assert.doesNotMatch(p3user, /主辅对照/);
  assert.match(p3user, /已锁定命理批断/);
  assert.match(p3sys, /只译批断/);
  assert.match(p3sys, /strategy/);
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "science_action",
    units: [
      {
        path: "primary_toolkit.angles[0]",
        chart_anchors: [],
        evidence: "日主己土身强。用神水制火。寅午半合火局加重忌神火。",
        unit_claim: "身强须水制火",
        calc_cite: "寅午半合火局",
        means_candidate_ref: "科学维1",
      },
    ],
  });
  assert.match(dump, /strategy/);
  assert.match(dump, /means/);
  assert.match(dump, /禁止另起兼职/);
  assert.doesNotMatch(dump, /why_cards/);
}

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
    { title: "e", surface: "x", essence: "y".repeat(70) },
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
    { title: "e", surface: "x", essence: "y".repeat(70) },
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

{
  const badP3 = {
    page: "science_action",
    page_title: "兼职试水·步步为营",
    page_subtitle: "守住安全底线与股权落地",
    primary_toolkit: {
      role: "primary",
      title: "主轨",
      angles: [
        {
          name: "阶段性试水",
          strategy: "用阶段性试水代替全职，保住稳定收入。",
          means: ["今晚起草兼职合作提案大纲，含股权兑现节点。"],
        },
        {
          name: "b",
          strategy: "外部加压时先泄压通关。",
          means: ["降低同时加压的节奏。"],
        },
        {
          name: "c",
          strategy: "输出通路要先加固再放大。",
          means: ["先稳住输出通道再加负荷。"],
        },
      ],
    },
    backup_toolkit: {
      role: "backup",
      title: "辅轨",
      angles: [
        {
          name: "d",
          strategy: "窗口期用水性缓冲忌压。",
          means: ["用缓冲节奏对冲外部火压。"],
        },
        {
          name: "e",
          strategy: "阶段性合局可加固泄压根。",
          means: ["借阶段性合力稳住输出根。"],
        },
        {
          name: "f",
          strategy: "间接助压时要反向润化。",
          means: ["用润化动作打断助压链。"],
        },
      ],
    },
  };
  const emptyPlan = {
    page: "science_action" as const,
    units: [
      "primary_toolkit.angles[0]",
      "primary_toolkit.angles[1]",
      "primary_toolkit.angles[2]",
      "backup_toolkit.angles[0]",
      "backup_toolkit.angles[1]",
      "backup_toolkit.angles[2]",
    ].map((path) => ({
      path,
      chart_anchors: [] as string[],
      evidence: "日主身强。用神水制火。",
    })),
  };
  const failP3 = sanitizePageJson("science_action", badP3, {
    plainJudgmentFill: true,
    situationMaterial: agenda,
    deepEvidencePlan: emptyPlan,
  });
  assert.equal(failP3.ok, false);
  if (failP3.ok) throw new Error("expected P3 situation paste fail");
  assert.ok(
    failP3.reason === "page_title_situation_paste" ||
      failP3.reason.startsWith("strategy_situation_paste:") ||
      failP3.reason.startsWith("fill_action_prescription:"),
    failP3.reason,
  );

  // Mechanism vernacular that shares short stems with Lab core must NOT false-red.
  const goodP3 = {
    page: "science_action",
    page_title: "加压通关·泄秀加固",
    page_subtitle: "六条结构杠杆从批断译出",
    primary_toolkit: {
      role: "primary",
      title: "主轨",
      angles: [
        {
          name: "忌压加重须通关",
          strategy:
            "你这边承载力本就偏满，外部又叠一层加压，会把输出通路一起拖紧。通关要靠能降温的一侧，而不是硬顶。",
          means: ["先减同时加压的入口", "把泄压通路排在加码之前"],
        },
        {
          name: "根基受耗",
          strategy:
            "根基位与加压位互相耗损时，输出根会被咬住。先护根、再泄压，顺序不能反。",
          means: ["护住根基位不被连耗", "用泄压动作打断互耗"],
        },
        {
          name: "资源位忌压",
          strategy:
            "资源位本身带忌压时，贵人式助力也要先降温才能用上；输出位喜用，宜先走泄秀再放大。",
          means: ["资源入口先降温再借力", "输出位先泄秀再加负荷"],
        },
      ],
    },
    backup_toolkit: {
      role: "backup",
      title: "辅轨",
      angles: [
        {
          name: "运上用水被泄",
          strategy: "运上能降温的一侧被地支助燃拖走时，要先补生水的通路。",
          means: ["补上生水通路", "别只喊降温却不护源"],
        },
        {
          name: "合局加固输出根",
          strategy: "阶段性合局能把输出根钉稳，缓解忌压对泄秀的挤压。",
          means: ["借合局钉住输出根", "忌压高时优先护泄秀"],
        },
        {
          name: "间接助燃",
          strategy: "侧面合局若在助燃忌压，要用润化打断，而不是再加一把火。",
          means: ["打断助燃链", "用润化改方向"],
        },
      ],
    },
  };
  const passP3 = sanitizePageJson("science_action", goodP3, {
    plainJudgmentFill: true,
    situationMaterial: agenda,
    deepEvidencePlan: emptyPlan,
    fillMode: "compress",
  });
  assert.equal(passP3.ok, true, passP3.ok ? "" : passP3.reason);
}

console.log("ok fill-plain-judgment");
