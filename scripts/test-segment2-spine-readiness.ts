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
  remediateVoiceSection3Leaks,
} from "@/lib/llm/deepseek/segment2-spine-readiness";
import {
  sanitizeFirstQuestionBridgeOpener,
  validateAgendaAnchorsToFrames,
  validateFirstQuestionBridgeDiscipline,
} from "@/lib/llm/deepseek/breakthrough-core";
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
  const verdict = [
    "### 你卡在哪里",
    "你本质上就是把应该当成愿意的人。",
    "",
    "### 几个关键侧面",
    "外力在压缩决策窗口。",
    "",
    "### 此刻真正要看清的",
    "以上是初步理解，下一问会请你核对哪一句最不像你。",
  ].join("\n");
  const v = validateVoiceDiscipline(verdict);
  assert.equal(v.ok, false);
  assert.ok(v.ok === false && v.gaps.includes("voice_life_verdict"));

  const motive = [
    "### 你卡在哪里",
    "你卡住了。",
    "",
    "### 几个关键侧面",
    "拖延不是因为还爱，而是害怕面对失去。",
    "",
    "### 此刻真正要看清的",
    "结构张力已铺开，走法还缺现实对齐。",
  ].join("\n");
  const m = validateVoiceDiscipline(motive);
  assert.equal(m.ok, false);
  assert.ok(m.ok === false && m.gaps.includes("voice_motive_as_fact"));

  const hedged = [
    "### 你卡在哪里",
    "压力叠在结构上，不是意志力问题。",
    "",
    "### 几个关键侧面",
    "有一种可能是：你习惯把我想不想翻译成我该不该，这会让决策窗口更挤。",
    "",
    "### 此刻真正要看清的",
    "结构张力已铺开，以上是初步理解；下一问会请你核对哪一句最不像你。",
  ].join("\n");
  assert.equal(validateVoiceDiscipline(hedged).ok, true);

  const fate = [
    "### 你卡在哪里",
    "这段命运让你左右为难。",
    "",
    "### 几个关键侧面",
    "外力在压缩决策窗口。",
    "",
    "### 此刻真正要看清的",
    "以上是初步理解，下一问会请你核对哪一句最不像你。",
  ].join("\n");
  const f = validateVoiceDiscipline(fate);
  assert.equal(f.ok, false);
  assert.ok(f.ok === false && f.gaps.includes("voice_fate_jargon"));

  const detach = [
    "### 你卡在哪里",
    "你卡住了。",
    "",
    "### 几个关键侧面",
    "你的能量结构早已开始抽离。",
    "",
    "### 此刻真正要看清的",
    "结构张力已铺开，走法还缺现实对齐。",
  ].join("\n");
  const d = validateVoiceDiscipline(detach);
  assert.equal(d.ok, false);
  assert.ok(d.ok === false && d.gaps.includes("voice_life_verdict"));

  // Category stems (synthetic) — not case sentences from any Lab dump.
  const emotionStock = [
    "### 你卡在哪里",
    "你卡住的根源不是不爱，也不是太爱。",
    "",
    "### 几个关键侧面",
    "感情更接近一种习惯联结。",
    "",
    "### 此刻真正要看清的",
    "以上是初步理解，下一问会请你核对哪一句最不像你。",
  ].join("\n");
  const es = validateVoiceDiscipline(emotionStock);
  assert.equal(es.ok, false);
  assert.ok(es.ok === false && es.gaps.includes("voice_motive_as_fact"));

  const timelineRx = [
    "### 你卡在哪里",
    "外力在压缩决策窗口。",
    "",
    "### 几个关键侧面",
    "几股力叠在一起。",
    "",
    "### 此刻真正要看清的",
    "前三周更适合用来观察和对话，最后两周才进入真正的决策窗口。以上是初步理解，下一问会请你核对哪一句最不像你。",
  ].join("\n");
  const tr = validateVoiceDiscipline(timelineRx);
  assert.equal(tr.ok, false);
  assert.ok(tr.ok === false && tr.gaps.includes("voice_section3_timeline_rx"));
  const trFixed = remediateVoiceSection3Leaks(timelineRx, "zh");
  assert.ok(!/前三周|最后两周/.test(trFixed));
  assert.equal(validateVoiceDiscipline(trFixed).ok, true);

  const lecture = [
    "### 你卡在哪里",
    "压力叠在结构上。",
    "",
    "### 几个关键侧面",
    "有一种可能是另一条路会变成出口——你需要警惕这种可能性。",
    "",
    "### 此刻真正要看清的",
    "结构张力已铺开，以上是初步理解；下一问会请你核对哪一句最不像你。",
  ].join("\n");
  const lec = validateVoiceDiscipline(lecture);
  assert.equal(lec.ok, false);
  assert.ok(lec.ok === false && lec.gaps.includes("voice_action_prescription"));

  // Category mingli leak (synthetic stems — not a Lab dump sentence).
  const mingli = [
    "### 你卡在哪里",
    "压力叠在结构上。",
    "",
    "### 几个关键侧面",
    "基础仍在，但木在你的结构里容易变成束缚感——稳定是真实的。",
    "另有一句会坏：某某的木势说明基础仍在。",
    "",
    "### 此刻真正要看清的",
    "以上是初步理解，下一问会请你核对哪一句最不像你。",
  ].join("\n");
  // Category hits: any two-dizhi + 盘里 / X势 (stems not tied to a Lab dump).
  const mingliHit = mingli.replace("某某的木势", "子午的木势").replace(
    "基础仍在，但木",
    "在你的盘里是补给，但木",
  );
  const ml = validateVoiceDiscipline(mingliHit);
  assert.equal(ml.ok, false);
  assert.ok(ml.ok === false && ml.gaps.includes("voice_mingli_leak"));

  console.log(
    "ok voice life_verdict / motive_as_fact / fate_jargon / timeline_rx / mingli_leak gated; hedged hypothesis passes",
  );
}

{
  const leakyClose = [
    "### 你卡在哪里",
    "压力叠在结构上。",
    "",
    "### 几个关键侧面",
    "职场与关系两股力在拉扯。",
    "",
    "### 此刻真正要看清的",
    "结构已经看清。具体怎么走还要看你的实际情况——比如你的经济储备、市场定位，以及和家人的沟通空间。",
  ].join("\n");
  const leakCheck = validateVoiceDiscipline(leakyClose);
  assert.equal(leakCheck.ok, false);
  assert.ok(
    leakCheck.ok === false && leakCheck.gaps.includes("voice_section3_collection_leak"),
  );
  const fixed = remediateVoiceSection3Leaks(leakyClose, "zh");
  assert.ok(!/经济储备|市场定位/.test(fixed));
  assert.ok(fixed.includes("实际情况"));
  console.log("ok voice section3 collection leak remediated");
}

{
  const leakyNoBili = [
    "### 你卡在哪里",
    "过载。",
    "",
    "### 几个关键侧面",
    "两股力。",
    "",
    "### 此刻真正要看清的",
    "结构已经看清楚了，但走法还需要和你的实际情况对齐——你的安全垫有多厚、你的咨询方向有多清晰、你身边那些反对的声音背后究竟藏着什么。这些不是靠推算能回答的。",
  ].join("\n");
  const check = validateVoiceDiscipline(leakyNoBili);
  assert.equal(check.ok, false);
  assert.ok(check.ok === false && check.gaps.includes("voice_section3_collection_leak"));
  const fixed = remediateVoiceSection3Leaks(leakyNoBili, "zh");
  assert.ok(!/安全垫有多厚|咨询方向有多清晰|反对的声音/.test(fixed));
  console.log("ok voice section3 checklist without 比如 remediated");
}

{
  const echo =
    "你刚才说想跳出来做独立咨询，但害怕放弃稳定收入。在给你具体的走法之前，我想先确认：你现在手头的经济储备大概能撑多久？";
  const cleaned = sanitizeFirstQuestionBridgeOpener(echo, "zh");
  assert.ok(!/^你刚才说/.test(cleaned));
  assert.ok(cleaned.includes("经济储备"));
  assert.equal(validateFirstQuestionBridgeDiscipline(cleaned, "zh").ok, true);

  const bridgeOk =
    "刚才的分析里提到，走法需要和你的实际情况对齐。我们先从最实际的一点开始：你目前的财务安全垫有多厚？";
  assert.equal(sanitizeFirstQuestionBridgeOpener(bridgeOk, "zh"), bridgeOk);
  assert.equal(validateFirstQuestionBridgeDiscipline(bridgeOk, "zh").ok, true);
  console.log("ok first_question keeps analysis bridge, strips user echo");
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
