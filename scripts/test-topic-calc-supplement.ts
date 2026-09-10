/**
 * Smoke: TopicCalcSupplement — category invariance + neutral rhythm copy.
 */
import assert from "node:assert/strict";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import {
  assertRhythmSummaryNeutral,
  buildTopicCalcSupplement,
  coerceNeutralRhythmSummary,
  elementalStanceVsYong,
  findDirectionalWordingInRhythmSummary,
  TOPIC_CALC_AUTHORITY,
} from "../lib/calculations/topic-calc-supplement";

function makeStructured(): ProfileStructured {
  return {
    day_master: "甲",
    pattern: "正格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
    pillars_detail: {
      year: {
        ganzhi: "甲子",
        stem: "甲",
        branch: "子",
        ten_god: "比肩",
        shen_sha: [],
        life_stage_han: "沐浴",
        hidden_stems: ["癸"],
      },
      month: {
        ganzhi: "丙寅",
        stem: "丙",
        branch: "寅",
        ten_god: "食神",
        shen_sha: [],
        life_stage_han: "长生",
        hidden_stems: ["甲", "丙", "戊"],
      },
      day: {
        ganzhi: "戊午",
        stem: "戊",
        branch: "午",
        ten_god: "偏财",
        shen_sha: [],
        life_stage_han: "帝旺",
        hidden_stems: ["丁", "己"],
      },
      hour: {
        ganzhi: "癸亥",
        stem: "癸",
        branch: "亥",
        ten_god: "正印",
        shen_sha: [],
        life_stage_han: "病",
        hidden_stems: ["壬", "甲"],
      },
    },
    da_yun: [
      { ganzhi: "丁卯", start_age: 8, start_year: 1998 },
      { ganzhi: "戊辰", start_age: 18, start_year: 2008 },
      { ganzhi: "己巳", start_age: 28, start_year: 2018 },
      { ganzhi: "庚午", start_age: 38, start_year: 2028 },
      { ganzhi: "辛未", start_age: 48, start_year: 2038 },
    ],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
  };
}

const asOf = new Date("2026-06-15T12:00:00.000Z");
const structured = makeStructured();

const career = buildTopicCalcSupplement({
  structured,
  question_category: "career",
  as_of: asOf,
  timezone: "UTC",
});
const wealth = buildTopicCalcSupplement({
  structured,
  question_category: "wealth",
  as_of: asOf,
  timezone: "UTC",
});
const relationship = buildTopicCalcSupplement({
  structured,
  question_category: "relationship",
  as_of: asOf,
  timezone: "UTC",
});

assert.ok(career.cycles.current_liunian?.ganzhi, "liunian present");
assert.equal(
  career.cycles.current_liunian?.ganzhi,
  wealth.cycles.current_liunian?.ganzhi,
  "category must not change liunian",
);
assert.equal(
  career.cycles.current_dayun?.ganzhi,
  wealth.cycles.current_dayun?.ganzhi,
  "category must not change dayun",
);

const cycleSig = (pack: typeof career) =>
  JSON.stringify({
    cycles: pack.cycles,
    relations: pack.cycle_relations.map((r) => r.id).sort(),
    rhythm: pack.rhythm_signals
      .map((s) => ({ id: s.id, kind: s.kind, summary_zh: s.summary_zh }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    yong: pack.yongshen_activation,
  });

assert.equal(
  cycleSig(career),
  cycleSig(wealth),
  "cycles + cycle_relations + rhythm_signals + yongshen must be category-invariant",
);
assert.equal(
  cycleSig(career),
  cycleSig(relationship),
  "same invariance vs relationship category",
);

assert.notEqual(
  JSON.stringify(career.topic_slice.primary_palaces),
  JSON.stringify(wealth.topic_slice.primary_palaces),
  "topic_slice palaces differ by category",
);

for (const pack of [career, wealth, relationship]) {
  for (const sig of pack.rhythm_signals) {
    assertRhythmSummaryNeutral(sig.summary_zh);
    assert.equal(findDirectionalWordingInRhythmSummary(sig.summary_zh).length, 0);
  }
}

assert.equal(
  coerceNeutralRhythmSummary({
    han: "流年午与日支子相冲，情况不利",
    kind: "chong",
    positions: ["liunian", "day"],
  }),
  "chong·liunian+day",
);

assert.equal(
  career.cycle_relations.length,
  career.rhythm_signals.length,
  "cycle_relations ↔ rhythm_signals must be 1:1",
);
for (const r of career.cycle_relations) {
  assert.equal(r.summary_zh.includes("流日"), false, `no 流日 in ${r.summary_zh}`);
  const twin = career.rhythm_signals.find((s) => s.id === `rhythm:${r.id}`);
  assert.ok(twin, `rhythm twin for ${r.id}`);
  assert.equal(twin!.summary_zh, r.summary_zh);
}

assert.equal(career.thesis_feed_hooks.current_liunian, true);
assert.equal(career.thesis_feed_hooks.dayun_liunian_stack, true);
assert.equal("near_term_bias" in (career as object), false);
assert.equal("timing_windows" in (career as object), false);
assert.equal(JSON.stringify(career).includes("流日引动"), false);
assert.equal(elementalStanceVsYong("壬", "水"), "support");
assert.equal(TOPIC_CALC_AUTHORITY.rhythm_verdict_owner, "thesis.cycle_rhythm");

console.log("test-topic-calc-supplement: ok", {
  liunian: career.cycles.current_liunian?.ganzhi,
  dayun: career.cycles.current_dayun?.ganzhi,
  n_relations: career.cycle_relations.length,
  n_rhythm: career.rhythm_signals.length,
  liuyue_tagged: career.cycle_relations.filter((r) => r.source === "liuyue_x_natal").length,
  sample_rhythm: career.rhythm_signals.slice(0, 3).map((s) => s.summary_zh),
});
