/**
 * Segment 2 spine readiness gate — smoke tests.
 * Run: pnpm test:segment2-spine-readiness
 */

import assert from "node:assert/strict";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import {
  splitNeedsValidationFacets,
  validateBreakthroughCoreSpine,
  validateSegment2CallAReadiness,
  validateVoiceDiscipline,
} from "@/lib/llm/deepseek/segment2-spine-readiness";
import { validateAgendaAnchorsToFrames } from "@/lib/llm/deepseek/breakthrough-core";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import {
  ensureAgendaSpineCoverage,
  validateAgendaSpineCoverage,
} from "@/lib/llm/deepseek/agenda-spine-coverage";

const readyCore = makeTestBreakthroughCore({
  energy_structure: "本质属水，需流动滋养。",
  response: [
    "### 你卡在哪里",
    "压力叠在结构上，不是意志力问题。",
    "",
    "### 几个关键侧面",
    "职场与关系两股力在拉扯。",
    "",
    "### 此刻真正要看清的",
    "结构已看清，走法还缺现实对齐。",
  ].join("\n"),
});

{
  assert.equal(validateBreakthroughCoreSpine(readyCore).ok, true);
  assert.equal(validateSegment2CallAReadiness(readyCore).ok, true);
  console.log("ok ready spine passes");
}

{
  const facets = splitNeedsValidationFacets(
    "咨询是否已有市场验证？储蓄能撑多久？反对的核心点是什么？",
  );
  assert.equal(facets.length, 3);
  console.log("ok split needs_validation facets");
}

{
  const badVoice =
    "### 你卡在哪里\n中间路线是最聪明的做法。\n\n### 几个关键侧面\n...\n\n### 此刻真正要看清的\n...";
  const check = validateVoiceDiscipline(badVoice);
  assert.equal(check.ok, false);
  assert.ok(check.ok === false && check.gaps.includes("voice_route_recommendation"));
  console.log("ok voice route recommendation blocked");
}

{
  const core = makeTestBreakthroughCore();
  const duplicateAgenda: AgendaItem[] = [
    {
      id: "a1",
      label: "假设一A",
      critical: true,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: 1,
      supports: core.modern_action_frames[0]!.direction,
      serves_page: "science_action",
      serves_path: "primary",
      role: "fill",
    },
    {
      id: "a2",
      label: "假设一B",
      critical: true,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: 1,
      supports: core.modern_action_frames[0]!.direction,
      serves_page: "science_action",
      serves_path: "primary",
      role: "fill",
    },
  ];
  const anchored = validateAgendaAnchorsToFrames(duplicateAgenda, core);
  assert.equal(anchored.ok, true);
  if (anchored.ok) {
    const indices = anchored.agenda
      .filter((a) => a.frame_kind === "modern_action")
      .map((a) => a.frame_index);
    assert.notEqual(indices[0], indices[1]);
  }
  console.log("ok duplicate frame_index spread across action frames");
}

{
  /** Latest sample-like Call B output (5 items, frame3 + financial facet missing). */
  const core = makeTestBreakthroughCore({
    key_crossroads: {
      real_fork: "继续忍受 / 完全离职 / 中间路线",
      path_costs: "维持消耗健康；离职经济与家人压力",
      decision_traits: "身弱谨慎",
      structural_basis: "官杀重压",
      needs_validation: "咨询是否已有市场验证？储蓄能撑多久？反对的核心点是什么？",
    },
    modern_action_frames: [
      {
        direction: "在职影子咨询试水",
        why_fits: "偏印化杀",
        structural_basis: "子水用神",
        needs_validation: "是否已有潜在客户？",
        status: "hypothesis",
      },
      {
        direction: "协商灵活工作安排",
        why_fits: "月德回旋",
        structural_basis: "月德贵人",
        needs_validation: "公司文化是否允许灵活安排？",
        status: "hypothesis",
      },
      {
        direction: "建立个人品牌基础",
        why_fits: "德秀才华",
        structural_basis: "德秀贵人",
        needs_validation: "是否愿意公开分享专业见解？",
        status: "hypothesis",
      },
    ],
  });
  const sampleAgenda: AgendaItem[] = [
    {
      id: "agenda_1",
      label: "专业招牌",
      critical: true,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: 1,
      supports: "在职影子咨询试水",
      serves_page: "science_action",
      serves_path: "primary",
      role: "fill",
    },
    {
      id: "agenda_2",
      label: "下班后清醒时间",
      critical: true,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: 1,
      supports: "在职影子咨询试水",
      serves_page: "science_action",
      serves_path: "primary",
      role: "fill",
    },
    {
      id: "agenda_3",
      label: "男朋友反对的根",
      critical: true,
      status: "unexplored",
      frame_kind: "modern_action",
      supports: "结构化沟通",
      serves_page: "risk_guard",
      serves_path: "both",
      role: "calibrate",
    },
    {
      id: "agenda_4",
      label: "反复踩的坑",
      critical: false,
      status: "unexplored",
      frame_kind: "energy_retune",
      supports: "调频",
      serves_page: "metaphysics_action",
      serves_path: "both",
      role: "personalize",
    },
    {
      id: "agenda_5",
      label: "接下来一周安排",
      critical: false,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: "节奏",
      serves_page: "signals_close",
      serves_path: "both",
      role: "fill",
    },
  ];
  const ctx = {
    original_question: "大厂8年想离职做独立咨询，男友和家人反对",
    question_category: "career" as const,
  };
  const before = validateAgendaSpineCoverage(sampleAgenda, core, ctx);
  assert.equal(before.ok, false);
  const anchored = validateAgendaAnchorsToFrames(sampleAgenda, core);
  assert.equal(anchored.ok, true);
  const ensured = ensureAgendaSpineCoverage(anchored.ok ? anchored.agenda : sampleAgenda, core, ctx);
  const after = validateAgendaSpineCoverage(ensured, core, ctx);
  assert.equal(after.ok, true);
  assert.ok(ensured.some((a) => a.frame_index === 3));
  console.log("ok sample-like agenda patched to full coverage");
}

console.log("\nAll segment2 spine readiness tests passed.");
