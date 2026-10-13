/**
 * Match → Pivot dyad short summary.
 * Run: pnpm exec tsx scripts/test-dyad-compat-summary.ts
 */

import assert from "node:assert/strict";
import {
  buildDyadCompatSummary,
  buildDyadGateTurn,
  dyadCollectedPatch,
  dyadSkipPatch,
  formatDyadCompatForPrompt,
  heuristicDyadSpecificOther,
  matchDyadGateAction,
  resolveDyadSpecificOther,
  shouldOfferDyadGate,
} from "../lib/poju/dyad-compat";

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

const skip = dyadSkipPatch();
assert.equal(skip.dyad_offer_status, "skipped");
assert.equal(skip.partner_bazi, "absent");

const collected = dyadCollectedPatch({
  partner_profile_id: "partner-1",
  summary,
});
assert.equal(collected.dyad_offer_status, "collected");
assert.equal(collected.partner_profile_id, "partner-1");
assert.equal(collected.dyad_compat_summary.partner_bazi, "present");

assert.equal(
  heuristicDyadSpecificOther(
    "我和女友在一起4年，她H-1B宽限期快到了，她希望结婚留在纽约。",
  ),
  true,
);
assert.equal(heuristicDyadSpecificOther("我想找什么样的合作伙伴比较合适？"), false);
assert.equal(resolveDyadSpecificOther({ modelFlag: true }), true);
assert.equal(resolveDyadSpecificOther({ modelFlag: false, userText: "我和女友要不要结婚" }), false);

const gate = buildDyadGateTurn("zh");
assert.ok(gate.response.includes("二元"));
assert.equal(gate.options.length, 2);
assert.equal(matchDyadGateAction(gate.options[0]!, "zh"), "collect_partner_bazi");
assert.equal(matchDyadGateAction(gate.options[1]!, "zh"), "skip_partner_bazi");

console.log("ok dyad-compat-summary", {
  synergy_type: summary.synergy_type,
  resonance_index: summary.resonance_index,
  strengths: summary.strength_keys.length,
  challenges: summary.challenge_keys.length,
  gate_actions: gate.options,
});
