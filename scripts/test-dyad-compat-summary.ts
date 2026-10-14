/**
 * Match → Pivot dyad short summary.
 * Run: pnpm exec tsx scripts/test-dyad-compat-summary.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildDyadCompatSummary,
  buildDyadContinueModelUserCue,
  buildDyadGateTurn,
  dyadCollectedPatch,
  dyadSkipPatch,
  formatCompanionRelationBoundary,
  formatDyadCompatForPrompt,
  hasSessionDyadSignal,
  heuristicDyadSpecificOther,
  matchDyadGateAction,
  resolveDyadRelationStructureFeed,
  resolveDyadSpecificOther,
  shouldOfferDyadGate,
  shouldPresentDyadGate,
  shouldResumeUnderstandingConfirmAfterDyad,
} from "../lib/poju/dyad-compat";
import { buildDyadMatrixPack } from "../lib/poju/dyad-matrix-pack";
import {
  assertPivotChartPathLocked,
  buildPivotChartPathLock,
  isDyadGateUnresolved,
  resolvePivotChartPath,
} from "../lib/poju/pivot-chart-path";
import { EASTERN_OS_PERSONA } from "../lib/llm/prompts/eastern-os-persona";
import { DYAD_PATH_SYSTEM_PREFIX } from "../lib/llm/prompts/pivot-path-dyad";
import { SOLO_PATH_SYSTEM_PREFIX } from "../lib/llm/prompts/pivot-path-solo";
import { pageFeedFlags } from "../lib/llm/pro/delivery/pipeline-v3/page-feed-policy";

const profileA = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: "丁",
        year_branch: "巳",
        month_stem: "癸",
        month_branch: "丑",
        day_stem: "乙",
        day_branch: "子",
        hour_stem: "戊",
        hour_branch: "寅",
      },
      gender: "M" as const,
      yong_shen: { primary_element: "水" },
      wuxing_distribution: { 木: 2, 火: 1, 土: 2, 金: 0, 水: 2 },
      da_yun: { current: { stem: "辛", branch: "亥", is_favorable: true } },
    },
  },
};

const profileB = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: "戊",
        year_branch: "午",
        month_stem: "甲",
        month_branch: "寅",
        day_stem: "庚",
        day_branch: "丑",
        hour_stem: "丁",
        hour_branch: "亥",
      },
      gender: "F" as const,
      yong_shen: { primary_element: "木" },
      wuxing_distribution: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      da_yun: { current: { stem: "丁", branch: "巳", is_favorable: true } },
    },
  },
};

const summary = buildDyadCompatSummary({
  profileA,
  profileB,
  computed_at: "2026-10-13T00:00:00.000Z",
});

assert.equal(summary.partner_bazi, "present");
assert.ok(typeof summary.synergy_type === "string" && summary.synergy_type.length > 0);
assert.ok(Number.isFinite(summary.resonance_index));
assert.ok(summary.a_label.includes("乙"));
assert.ok(summary.b_label.includes("庚"));
assert.ok(Array.isArray(summary.strength_keys));
assert.ok(Array.isArray(summary.challenge_keys));
assert.ok(summary.strength_keys.length <= 4);
assert.ok(summary.challenge_keys.length <= 4);

const presentPrompt = formatDyadCompatForPrompt(summary);
assert.match(presentPrompt, /partner_bazi=present/);
assert.match(presentPrompt, /synergy_type=/);
assert.doesNotMatch(presentPrompt, /Match 长报告|章节墙/);

const absentPrompt = formatDyadCompatForPrompt(null, { partner_bazi: "absent" });
assert.match(absentPrompt, /partner_bazi=absent/);
assert.match(absentPrompt, /禁止臆造对方命理/);

assert.equal(shouldOfferDyadGate("none"), true);
assert.equal(shouldOfferDyadGate("skipped"), false);
assert.equal(shouldOfferDyadGate("collected"), false);

// S1-D-2 / Case C: gate still presents when understanding would already be sufficient.
assert.equal(
  shouldPresentDyadGate({
    openingTurn: true,
    understandingGenerationFailed: false,
    scopeSignal: "in_scope",
    dyadOfferStatus: "none",
    dyadHit: true,
  }),
  true,
  "Case C: dyad chips must offer even if understanding_sufficient would be true",
);
assert.equal(
  shouldPresentDyadGate({
    openingTurn: true,
    scopeSignal: "out_of_scope",
    dyadHit: true,
  }),
  false,
);
assert.equal(
  shouldPresentDyadGate({
    openingTurn: true,
    dyadOfferStatus: "skipped",
    dyadHit: true,
  }),
  false,
);
assert.equal(
  shouldPresentDyadGate({
    openingTurn: false,
    dyadHit: true,
  }),
  false,
);

const skip = dyadSkipPatch();
assert.equal(skip.dyad_offer_status, "skipped");
assert.equal(skip.partner_bazi, "absent");
assert.equal(skip.pivot_chart_path, "solo");
assert.ok(skip.charts_locked_at);

const matrix_pack = buildDyadMatrixPack({
  profileA,
  profileB,
  computed_at: "2026-10-13T00:00:00.000Z",
});
assert.equal(matrix_pack.schema_version, 1);
assert.ok(matrix_pack.prompt_dump.length > 0);

const collected = dyadCollectedPatch({
  partner_profile_id: "partner-1",
  summary,
  matrix_pack,
});
assert.equal(collected.dyad_offer_status, "collected");
assert.equal(collected.partner_profile_id, "partner-1");
assert.equal(collected.dyad_compat_summary.partner_bazi, "present");
assert.equal(collected.pivot_chart_path, "dyad");
assert.equal(collected.dyad_matrix_pack.schema_version, 1);

assert.equal(resolvePivotChartPath(collected), "dyad");
assert.equal(resolvePivotChartPath(skip), "solo");
assert.equal(isDyadGateUnresolved("offered"), true);
assert.equal(isDyadGateUnresolved("collected"), false);
const lock = buildPivotChartPathLock(collected);
assert.equal(lock.pivot_chart_path, "dyad");
assert.equal(assertPivotChartPathLocked(collected), "dyad");

assert.ok(EASTERN_OS_PERSONA.includes("Eastern OS"));
assert.doesNotMatch(EASTERN_OS_PERSONA, /\bPivot\b/);
assert.ok(SOLO_PATH_SYSTEM_PREFIX.includes("Eastern OS"));
assert.ok(DYAD_PATH_SYSTEM_PREFIX.includes("Eastern OS"));
assert.ok(DYAD_PATH_SYSTEM_PREFIX.includes("三人及以上") || EASTERN_OS_PERSONA.includes("三人及以上"));

assert.equal(
  pageFeedFlags("direct_answer", "judgment", { pivot_chart_path: "solo" })
    .dyad_relation_structure,
  false,
);
assert.equal(
  pageFeedFlags("direct_answer", "judgment", { pivot_chart_path: "dyad" })
    .dyad_relation_structure,
  true,
);
assert.equal(
  pageFeedFlags("foundation", "judgment", { pivot_chart_path: "dyad" })
    .dyad_relation_structure,
  true,
);

assert.equal(
  heuristicDyadSpecificOther(
    "我和女友在一起4年，她H-1B宽限期快到了，她希望结婚留在纽约。",
  ),
  true,
);
assert.equal(heuristicDyadSpecificOther("我想找什么样的合作伙伴比较合适？"), false);
assert.equal(heuristicDyadSpecificOther("Partnership fundraising with my co-founder Miles — I need a clear split and runway plan. Skip his birth chart for now."), true, "Case C EN co-founder + partnership");
assert.equal(heuristicDyadSpecificOther("My co-founder Miles and I are fundraising equity splits this quarter"), true);
assert.equal(
  heuristicDyadSpecificOther("co-founder Miles, skip chart"),
  true,
  "Case C short: co-founder + skip chart without equity/partnership words",
);
assert.equal(
  heuristicDyadSpecificOther("My co founder Miles — skip his chart"),
  true,
  "Case C: spaced 'co founder' + skip",
);
assert.equal(
  heuristicDyadSpecificOther(
    "My co-founder Miles and I are stuck on whether to raise a seed round. He wants to expand aggressively; I want to get to break-even first. Over the next 90 days I need a cadence both of us can sign — not a win/lose fight. Help me figure out how *I* should break this. For now I will skip entering his birth chart.",
  ),
  true,
  "Case C Lab full prompt: co-founder + seed round + skip entering his birth chart",
);


assert.equal(resolveDyadSpecificOther({ modelFlag: true }), true);
assert.equal(
  resolveDyadSpecificOther({
    modelFlag: false,
    userText: "我想找什么样的合作伙伴比较合适？",
  }),
  false,
  "generic partner-shopping: model false + heuristic false",
);
assert.equal(
  resolveDyadSpecificOther({
    modelFlag: false,
    userText:
      "Partnership fundraising with my co-founder Miles — I need a clear split and runway plan. Skip his birth chart for now.",
  }),
  true,
  "Case C: model false must not veto co-founder + partnership heuristic",
);
assert.equal(
  resolveDyadSpecificOther({
    modelFlag: false,
    userText: "我和女友要不要结婚，对方八字先不填",
  }),
  true,
  "Case C ZH: model false must not veto named dyad + stake",
);
assert.equal(
  resolveDyadSpecificOther({
    modelFlag: false,
    userText: "skip chart",
    assistText: "Partnership with my co-founder Miles — need a split.",
  }),
  true,
  "Case C: assistText (prior user / original_question) must count",
);

const gate = buildDyadGateTurn("zh");
assert.ok(gate.response.includes("二元"));
assert.equal(gate.options.length, 2);
assert.equal(matchDyadGateAction(gate.options[0]!, "zh"), "collect_partner_bazi");
assert.equal(matchDyadGateAction(gate.options[1]!, "zh"), "skip_partner_bazi");

const continueCue = buildDyadContinueModelUserCue({
  partner_bazi: "present",
  pivot_chart_path: "dyad",
  locale: "zh",
});
assert.match(continueCue, /path=dyad/);
assert.match(continueCue, /partner_bazi=present/);
assert.match(continueCue, /二元门已结案/);

assert.equal(hasSessionDyadSignal({ partner_bazi: "absent" }), true);
assert.equal(hasSessionDyadSignal({}), false);
assert.ok(formatCompanionRelationBoundary({ partner_bazi: "absent", locale: "zh" }).includes("无对方盘"));
assert.ok(
  formatCompanionRelationBoundary({
    partner_bazi: "present",
    dyad_compat_summary: summary,
    locale: "zh",
  }).includes("结构锚"),
);
assert.ok(resolveDyadRelationStructureFeed({ partner_bazi: "absent" }).includes("partner_bazi=absent"));
assert.ok(
  resolveDyadRelationStructureFeed({
    partner_bazi: "present",
    dyad_compat_summary: summary,
  }).includes("partner_bazi=present"),
);
const deliveryDyadFeed = resolveDyadRelationStructureFeed({
  partner_bazi: "present",
  dyad_compat_summary: summary,
  pivot_chart_path: "dyad",
  dyad_matrix_pack: matrix_pack,
});
assert.ok(deliveryDyadFeed.includes("dyad_matrix_pack"));
assert.ok(deliveryDyadFeed.includes("compact"), "delivery feed must use compact matrix");
assert.doesNotMatch(deliveryDyadFeed, /### matrix_json/);
assert.ok(
  formatCompanionRelationBoundary({
    partner_bazi: "present",
    dyad_compat_summary: summary,
    pivot_chart_path: "dyad",
    dyad_matrix_pack: matrix_pack,
    locale: "zh",
  }).includes("单人流日"),
);

// Call A / B / Synthesis clients must POST dyad fields (static contract).
const controlSrc = readFileSync(
  fileURLToPath(new URL("../lib/poju/phases/segment2/control.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  controlSrc.includes("dyad_compat_summary: input.session.dyad_compat_summary"),
  "segment2 control must pass session dyad into Call A/B/Synthesis",
);
assert.ok(
  (controlSrc.match(/dyad_compat_summary: input\.session\.dyad_compat_summary/g) ?? []).length >= 3,
  "Call A + agenda + synthesis should each pass dyad",
);
assert.ok(
  controlSrc.includes("pivot_chart_path: input.session.pivot_chart_path"),
  "segment2 control must pass pivot_chart_path",
);
assert.ok(
  controlSrc.includes("dyad_matrix_pack: input.session.dyad_matrix_pack"),
  "segment2 control must pass dyad_matrix_pack",
);
assert.ok(
  controlSrc.includes("buildPivotChartPathLock") &&
    controlSrc.includes("isDyadGateUnresolved"),
  "Segment2 start must lock path and resolve offered gate",
);

const agentSrc = readFileSync(
  fileURLToPath(new URL("../lib/poju/agent.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  agentSrc.includes("shouldPresentDyadGate"),
  "agent must present dyad gate via shouldPresentDyadGate (S1-D-2)",
);
assert.ok(
  !/understanding_sufficient\s*!==\s*true[\s\S]{0,120}shouldPresentDyadGate|understanding_sufficient\s*!==\s*true[\s\S]{0,120}buildDyadGateTurn/.test(agentSrc),
  "dyad gate must not be blocked by understanding_sufficient===true",
);
assert.ok(
  agentSrc.includes('current_phase: "opening"') &&
    agentSrc.includes("awaiting_understanding_confirm"),
  "dyad gate must hold phase at opening when understanding confirm would fire",
);

assert.ok(
  agentSrc.includes("understanding_confirm_held_for_dyad"),
  "agent must persist held-for-dyad flag when rolling confirm back to opening",
);
assert.ok(
  agentSrc.includes("shouldResumeUnderstandingConfirmAfterDyad"),
  "agent must resume understanding confirm after dyad skip/collect",
);


// Case C Stage1: dyad skip must resume held understanding confirm (not stay stuck in opening).
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: true,
    dyadOfferStatus: "skipped",
    phase: "opening",
    understandingComplete: true,
  }),
  true,
  "skip + held + complete → resume understanding confirm",
);
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: true,
    dyadOfferStatus: "collected",
    phase: "opening",
    understandingComplete: true,
  }),
  true,
  "collect + held + complete → resume understanding confirm",
);
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: true,
    dyadOfferStatus: "offered",
    phase: "opening",
    understandingComplete: true,
  }),
  false,
  "still offered → do not resume yet",
);
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: false,
    dyadOfferStatus: "skipped",
    phase: "opening",
    understandingComplete: true,
  }),
  false,
  "no hold flag (model still gathering when chips shown) → stay opening",
);
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: true,
    dyadOfferStatus: "skipped",
    phase: "opening",
    understandingComplete: false,
  }),
  false,
  "incomplete understanding → stay opening after skip",
);
assert.equal(
  shouldResumeUnderstandingConfirmAfterDyad({
    held: true,
    dyadOfferStatus: "skipped",
    phase: "awaiting_understanding_confirm",
    understandingComplete: true,
  }),
  false,
  "already on confirm → no-op",
);

console.log("ok dyad-compat-summary", {
  synergy_type: summary.synergy_type,
  resonance_index: summary.resonance_index,
  strengths: summary.strength_keys.length,
  challenges: summary.challenge_keys.length,
  gate_actions: gate.options,
});
