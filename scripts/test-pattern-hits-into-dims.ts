/**
 * Unit: ZFP patternHits → thesis dims (classify / select / absorb / citation gate).
 * Synthetic hits only — never fixture a specific lab_id.
 * Run: pnpm exec tsx scripts/test-pattern-hits-into-dims.ts
 */
import assert from "node:assert/strict";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildChartThesisFromStructured,
  buildThesisCalcFeed,
  isAssignMenuEligibleSlug,
} from "@/lib/llm/pro/delivery/thesis";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import {
  absorbPatternHitsIntoFeed,
  classifyPatternHit,
  evaluateThesisPatternHitsCitationGate,
  selectOnTopicPatternHits,
  selectPatternHitsWithOmits,
  thesisCitesPatternHit,
  ZFP_HIT_OMIT_HINT_PREFIX,
  ZFP_PATTERN_HIT_KEY_PREFIX,
} from "@/lib/llm/pro/delivery/thesis/pattern-hits-into-dims";
import { ziweiPatternHitId } from "@/lib/ziwei/soft-zfp-labels";
import type { ZiweiPatternHit } from "@/lib/ziwei/fact-pack";

function hit(
  name: string,
  level: ZiweiPatternHit["level"] = "good",
): ZiweiPatternHit {
  return { name, level, palaces: ["命宫"] };
}

function baseStructured(): ProfileStructured {
  const pillar = (gz: string, ten_god: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god,
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: "甲",
    pattern: "正格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "乙亥", day: "甲辰", hour: "癸酉" },
    pillars_detail: {
      year: pillar("甲子", "比肩"),
      month: pillar("乙亥", "正印"),
      day: pillar("甲辰", ""),
      hour: pillar("癸酉", "正印"),
    },
    da_yun: [
      { start_age: 8, start_year: 2010, ganzhi: "丁酉" },
      { start_age: 18, start_year: 2020, ganzhi: "丙申" },
    ],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
  };
}

function testClassify() {
  assert.equal(classifyPatternHit(hit("紫微入命", "excellent")), "ming_geju");
  assert.equal(classifyPatternHit(hit("府相朝垣", "excellent")), "ming_geju");
  assert.equal(classifyPatternHit(hit("日月同宫", "good")), "ming_geju");
  assert.equal(classifyPatternHit(hit("化权入官", "good")), "career_guan");
  assert.equal(classifyPatternHit(hit("化禄入财", "good")), "wealth_cai");
  assert.equal(classifyPatternHit(hit("化科", "good")), "expression");
  assert.equal(classifyPatternHit(hit("辅弼同会", "good")), "interpersonal");
  assert.equal(classifyPatternHit(hit("羊陀夹忌", "caution")), "caution_break");
  assert.equal(classifyPatternHit(hit("火铃夹命", "caution")), "caution_break");
  console.log("ok classifyPatternHit");
}

/** Root-cause regression: detector level=caution must NOT demote natal ming_geju. */
function testClassifyCautionLevelMingGeju() {
  assert.equal(
    classifyPatternHit(hit("紫微入命", "caution")),
    "ming_geju",
    "紫微入命-class with level=caution stays ming_geju",
  );
  assert.equal(
    classifyPatternHit(hit("府相朝垣", "caution")),
    "ming_geju",
    "府相朝垣-class with level=caution stays ming_geju",
  );
  assert.equal(
    classifyPatternHit(hit("日月同宫", "caution")),
    "ming_geju",
    "日月同宫-class with level=caution stays ming_geju",
  );
  // Synthetic alternate natal name also in MING_GEJU_NAME_RE
  assert.equal(classifyPatternHit(hit("明珠出海", "caution")), "ming_geju");
  // True break name still caution_break
  assert.equal(classifyPatternHit(hit("羊陀夹忌", "caution")), "caution_break");
  assert.equal(classifyPatternHit(hit("化忌入命", "caution")), "caution_break");
  console.log("ok classify caution-level ming_geju (name-class wins)");
}

function testSelectCareerVsRelationship() {
  const hits = [
    hit("紫微入命", "excellent"),
    hit("化权入官", "good"),
    hit("化禄入财", "good"),
    hit("辅弼同会", "good"),
    hit("羊陀夹忌", "caution"),
  ];
  const career = selectOnTopicPatternHits(hits, "career");
  assert.ok(
    career.some((h) => h.name === "紫微入命" && h.hit_class === "ming_geju"),
    "career keeps ming_geju",
  );
  assert.ok(
    career.some((h) => h.name === "化权入官" && h.hit_class === "career_guan"),
    "career keeps career_guan",
  );
  assert.ok(!career.some((h) => h.name === "化禄入财"), "career omits wealth");
  assert.ok(!career.some((h) => h.name === "辅弼同会"), "career omits interpersonal");
  assert.ok(!career.some((h) => h.name === "羊陀夹忌"), "career omits caution");

  const rel = selectOnTopicPatternHits(hits, "relationship");
  assert.ok(rel.some((h) => h.name === "紫微入命"), "relationship keeps ming_geju");
  assert.ok(rel.some((h) => h.name === "辅弼同会"), "relationship keeps interpersonal");
  assert.ok(!rel.some((h) => h.name === "化权入官"), "relationship omits career_guan");
  assert.ok(!rel.some((h) => h.name === "化禄入财"), "relationship omits wealth");
  console.log("ok selectOnTopicPatternHits career vs relationship omit");
}

function testSelectWithOmitsAuditable() {
  const hits = [
    hit("紫微入命", "caution"),
    hit("羊陀夹忌", "caution"),
    hit("化禄入财", "good"),
  ];
  const { on_topic, omitted } = selectPatternHitsWithOmits(hits, "career");
  assert.equal(on_topic.length, 1);
  assert.equal(on_topic[0]!.name, "紫微入命");
  assert.equal(on_topic[0]!.hit_class, "ming_geju");
  assert.ok(
    omitted.some((o) => o.name === "羊陀夹忌" && o.reason === "caution_break"),
  );
  assert.ok(
    omitted.some((o) => o.name === "化禄入财" && o.reason === "off_topic_category"),
  );
  const feed0 = buildThesisCalcFeed(baseStructured(), {
    question_category: "career",
    as_of: new Date(Date.UTC(2026, 5, 15)),
  });
  const feed = absorbPatternHitsIntoFeed(feed0, hits, "career");
  assert.ok(
    feed.dimensions.day_master_strength.hints.some((h) =>
      h.startsWith(ZFP_HIT_OMIT_HINT_PREFIX),
    ),
    "omits leave auditable zfp_omit:* hints",
  );
  console.log("ok selectPatternHitsWithOmits auditable omit");
}

function testAbsorbIntoFeed() {
  const structured = baseStructured();
  const feed0 = buildThesisCalcFeed(structured, {
    question_category: "career",
    as_of: new Date(Date.UTC(2026, 5, 15)),
  });
  const baziKeysBefore = new Set(
    feed0.dimensions.day_master_strength.items.map((i) => i.key),
  );
  const hits = [hit("紫微入命", "excellent"), hit("化权入官", "good")];
  const feed = absorbPatternHitsIntoFeed(feed0, hits, "career");
  const idMing = ziweiPatternHitId("紫微入命");
  const idGuan = ziweiPatternHitId("化权入官");
  const mingItem = feed.dimensions.day_master_strength.items.find(
    (i) => i.key === ZFP_PATTERN_HIT_KEY_PREFIX + idMing,
  );
  assert.ok(mingItem?.present, "ming_geju absorbed into day_master_strength");
  assert.ok(mingItem!.summary_zh.includes("紫微入命"));
  assert.ok(mingItem!.summary_zh.includes(idMing));
  const guanItem = feed.dimensions.interpersonal_pattern.items.find(
    (i) => i.key === ZFP_PATTERN_HIT_KEY_PREFIX + idGuan,
  );
  assert.ok(guanItem?.present, "career_guan absorbed into interpersonal_pattern");
  assert.ok(
    feed.dimensions.day_master_strength.hints.some((h) => h.includes(idMing)),
    "hints carry zfp_hit",
  );
  for (const k of baziKeysBefore) {
    assert.ok(
      feed.dimensions.day_master_strength.items.some((i) => i.key === k),
      "bazi item preserved: " + k,
    );
  }
  console.log("ok absorbPatternHitsIntoFeed");
}

/** All on-topic selected hits must land — including caution-level ming_geju-class. */
function testAbsorbAllOnTopicIncludingCautionMing() {
  const structured = baseStructured();
  const feed0 = buildThesisCalcFeed(structured, {
    question_category: "other",
    as_of: new Date(Date.UTC(2026, 5, 15)),
  });
  // Synthetic triad: two excellent + one caution-level natal (lab-shaped but not lab-id).
  const hits = [
    hit("府相朝垣", "excellent"),
    hit("日月同宫", "excellent"),
    hit("紫微入命", "caution"),
  ];
  const feed = absorbPatternHitsIntoFeed(feed0, hits, "other");
  const keys = feed.dimensions.day_master_strength.items.map((i) => i.key);
  for (const name of ["府相朝垣", "日月同宫", "紫微入命"]) {
    const id = ziweiPatternHitId(name);
    assert.ok(
      keys.includes(ZFP_PATTERN_HIT_KEY_PREFIX + id),
      `absorb missing ${name} (${id})`,
    );
  }
  const thesis = buildChartThesisFromStructured(structured, null, {
    question_category: "other",
    as_of: new Date(Date.UTC(2026, 5, 15)),
    patternHits: hits,
  });
  const gate = evaluateThesisPatternHitsCitationGate(thesis, hits, "other");
  assert.equal(gate.passed, true);
  assert.equal(gate.on_topic_n, 3);
  assert.deepEqual(gate.uncited, []);
  for (const h of selectOnTopicPatternHits(hits, "other")) {
    assert.ok(thesisCitesPatternHit(thesis, h), "cites " + h.name);
  }
  console.log("ok absorb ALL on-topic incl. caution-level ming_geju");
}

function testBuildCitesHits() {
  const structured = baseStructured();
  const hits = [hit("紫微入命", "excellent"), hit("化权入官", "good")];
  const thesis = buildChartThesisFromStructured(structured, null, {
    question_category: "career",
    as_of: new Date(Date.UTC(2026, 5, 15)),
    patternHits: hits,
  });
  const gate = evaluateThesisPatternHitsCitationGate(thesis, hits, "career");
  assert.equal(gate.passed, true, "absorbed hits are cited in classical_basis/conclusion");
  assert.ok(gate.on_topic_n >= 1);
  for (const h of selectOnTopicPatternHits(hits, "career")) {
    assert.ok(thesisCitesPatternHit(thesis, h), "cites " + h.name);
  }
  console.log("ok buildChartThesisFromStructured cites on-topic hits");
}

function testCitationGateFailWhenStripped() {
  const structured = baseStructured();
  const hits = [hit("紫微入命", "excellent")];
  const thesis = buildChartThesisFromStructured(structured, null, {
    question_category: "career",
    as_of: new Date(Date.UTC(2026, 5, 15)),
    patternHits: hits,
  });
  const stripped: ChartThesis = {
    ...thesis,
    dimensions: thesis.dimensions.map((d) => ({
      ...d,
      classical_basis: (d.classical_basis ?? []).filter(
        (it) => !String(it.key ?? "").startsWith(ZFP_PATTERN_HIT_KEY_PREFIX),
      ),
      conclusion_zh: (d.conclusion_zh ?? "")
        .split("。")
        .filter((seg) => !seg.includes("紫微入命") && !seg.includes("hit:"))
        .join("。"),
      usable_claims_hint: (d.usable_claims_hint ?? []).filter(
        (h) => !h.includes("zfp_hit:") && !h.includes("紫微入命"),
      ),
    })),
  };
  const gate = evaluateThesisPatternHitsCitationGate(stripped, hits, "career");
  assert.equal(gate.passed, false);
  assert.equal(gate.failed_rule, "thesis:pattern_hits_uncited");
  assert.ok(gate.uncited.includes("紫微入命"));
  console.log("ok citation gate FAIL when hits uncited");
}

/** Partial cite must FAIL — gate iterates every on-topic selected hit. */
function testCitationGateFailPartialCite() {
  const structured = baseStructured();
  const hits = [
    hit("府相朝垣", "excellent"),
    hit("日月同宫", "excellent"),
    hit("紫微入命", "caution"),
  ];
  const thesis = buildChartThesisFromStructured(structured, null, {
    question_category: "other",
    as_of: new Date(Date.UTC(2026, 5, 15)),
    patternHits: hits,
  });
  // Keep first two cites; strip only 紫微入命 — classic under-count miss.
  const idStrip = ziweiPatternHitId("紫微入命");
  const partial: ChartThesis = {
    ...thesis,
    dimensions: thesis.dimensions.map((d) => ({
      ...d,
      classical_basis: (d.classical_basis ?? []).filter(
        (it) => !String(it.key ?? "").includes(idStrip) && !String(it.summary_zh ?? "").includes("紫微入命"),
      ),
      conclusion_zh: (d.conclusion_zh ?? "")
        .split("。")
        .filter((seg) => !seg.includes("紫微入命") && !seg.includes(idStrip))
        .join("。"),
      usable_claims_hint: (d.usable_claims_hint ?? []).filter(
        (h) => !h.includes(idStrip) && !h.includes("紫微入命"),
      ),
    })),
  };
  const gate = evaluateThesisPatternHitsCitationGate(partial, hits, "other");
  assert.equal(gate.passed, false, "partial cite must FAIL");
  assert.equal(gate.failed_rule, "thesis:pattern_hits_uncited");
  assert.equal(gate.on_topic_n, 3);
  assert.ok(gate.uncited.includes("紫微入命"));
  assert.ok(!gate.uncited.includes("府相朝垣"));
  assert.ok(!gate.uncited.includes("日月同宫"));
  console.log("ok citation gate FAIL on partial cite");
}

function testOmitWhenNoHitsOrOffTopic() {
  const structured = baseStructured();
  const thesisEmpty = buildChartThesisFromStructured(structured, null, {
    question_category: "career",
    as_of: new Date(Date.UTC(2026, 5, 15)),
    patternHits: [],
  });
  assert.equal(
    evaluateThesisPatternHitsCitationGate(thesisEmpty, [], "career").passed,
    true,
  );
  const wealthOnly = [hit("化禄入财", "good")];
  const selected = selectOnTopicPatternHits(wealthOnly, "relationship");
  assert.equal(selected.length, 0, "relationship omits wealth_cai entirely");
  const gate = evaluateThesisPatternHitsCitationGate(
    thesisEmpty,
    wealthOnly,
    "relationship",
  );
  assert.equal(gate.passed, true, "off-topic-only hits → gate omit/pass");
  assert.ok(
    gate.omitted.some(
      (o) => o.name === "化禄入财" && o.reason === "off_topic_category",
    ),
  );
  console.log("ok omit when no ZFP / off-topic");
}

function testAssignMenuExcludesZfpPrefix() {
  assert.equal(isAssignMenuEligibleSlug("zfp_pattern_hit:deadbeefcafe"), false);
  assert.equal(isAssignMenuEligibleSlug("zfp_hit:deadbeefcafe"), false);
  assert.equal(isAssignMenuEligibleSlug("officer_gods"), true);
  console.log("ok assign-menu excludes zfp_pattern_hit: / zfp_hit:");
}

testClassify();
testClassifyCautionLevelMingGeju();
testSelectCareerVsRelationship();
testSelectWithOmitsAuditable();
testAbsorbIntoFeed();
testAbsorbAllOnTopicIncludingCautionMing();
testBuildCitesHits();
testCitationGateFailWhenStripped();
testCitationGateFailPartialCite();
testOmitWhenNoHitsOrOffTopic();
testAssignMenuExcludesZfpPrefix();
console.log("\nall pattern-hits-into-dims checks passed\n");
