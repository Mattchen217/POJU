/**
 * Term ID provenance integrity — model declaration vs program certification.
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page01-provenance.ts
 */

import assert from "node:assert/strict";
import {
  buildFace01ProductionContext,
  assembleGlossaryAppendixFromEvidence,
  resolveUnitTermProvenance,
  resolveAvailablePersonalDomains,
  resolveHitIdToTermIds,
  selectRealityFactsForPage01,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

console.log("=== Face01 provenance integrity ===");

const dc = {
  context_id: "dc_prov",
  version: 1,
  status: "frozen",
  content_hash: "h",
  definition: {
    decision_question: "Quit for startup?",
    desired_outcome: "Keep runway",
  },
  dirs: [
    {
      dir_id: "dir_main",
      id_lifecycle: "active",
      required_fact_roles: ["cash_runway"],
    },
  ],
  constraints: [],
  reality_facts: [
    {
      fact_id: "fact_runway",
      statement: "8 months runway",
      status: "confirmed",
      verification_level: "user_asserted",
      roles: ["cash_runway"],
      related_dir_ids: ["dir_main"],
    },
    {
      fact_id: "fact_hobby",
      statement: "Likes hiking",
      status: "confirmed",
      verification_level: "user_asserted",
      roles: [],
      related_dir_ids: [],
    },
    {
      fact_id: "fact_salary",
      statement: "Maybe 120k",
      status: "unverified",
      verification_level: "user_estimate",
      roles: ["cash_runway"],
      related_dir_ids: ["dir_main"],
    },
  ],
  conflicts: [],
  hypotheses: [],
} as unknown as DecisionContext;

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
  zfpOmitted: false,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_bazi",
      track: "destiny",
      claim: "Cash floor preference. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["01"],
      term_ids: ["day_master"],
      source_domain: "bazi",
      source_version: "cfp_v1",
    },
    {
      id: "u_ziwei",
      track: "destiny",
      claim: "Palace tension. hit:jia_yin:mid",
      anchors: ["hit:jia_yin:mid"],
      serves_face: ["01", "02"],
      // Model may declare "pattern" — must NOT certify without accurate hit map.
      term_ids: ["pattern"],
      declared_term_ids: ["pattern"],
      source_domain: "ziwei",
      source_version: "zfp_v1",
    },
    {
      id: "u_sci",
      track: "science",
      claim: "Staged explore reduces irreversible cost.",
      anchors: ["switching_cost"],
      serves_face: ["01"],
      term_ids: [],
      source_domain: "science",
    },
  ],
  by_face: {
    "01": ["u_bazi", "u_ziwei", "u_sci"],
    "02": ["u_ziwei"],
  },
  pattern_hits_used: ["hit:jia_yin:mid"],
  science_tags_used: [],
} as BookJudgmentPack;

// --- Domain availability ---
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack,
    chart_fact_pack: null,
    ziwei_fact_pack: { patternHits: [{ name: "甲寅格" }] } as never,
  }).available_domains,
  ["ziwei"],
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: { ...pack, zfpOmitted: true, zfp_hash: null },
    chart_fact_pack: "dayMaster:甲",
  }).available_domains,
  ["bazi"],
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: null,
    chart_fact_pack: null,
    ziwei_fact_pack: null,
  }).available_domains,
  [],
);
const both = resolveAvailablePersonalDomains({
  pack,
  chart_fact_pack: "dayMaster:甲 yongJi:木",
  ziwei_fact_pack: { patternHits: [{ name: "甲寅格" }] } as never,
});
assert.deepEqual(both.available_domains.sort(), ["bazi", "ziwei"]);
assert.ok(both.domain_versions.bazi);
assert.ok(both.domain_versions.ziwei);

// --- No NLP invent ---
const bare = resolveUnitTermProvenance({
  unit: {
    id: "x",
    track: "destiny",
    serves_face: ["01"],
    claim: "用神木旺，日主偏弱",
    anchors: ["古典旁白"],
    term_ids: [],
  },
  pack,
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.deepEqual(bare.term_ids, [], "no invent from classical prose");
assert.equal(bare.source_domain, "unavailable");

// --- G: structured cite present, model silent → program derives ---
const cited = resolveUnitTermProvenance({
  unit: {
    id: "u_bazi",
    track: "destiny",
    claim: "Cash floor. cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: [],
  },
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.ok(cited.term_ids.includes("day_master"), "G: derive without model declare");
assert.equal(cited.source_domain, "bazi");
assert.equal(cited.source_version, "cfp_v1");

// ========== Reverse tests A–K ==========
console.log("--- reverse A–K ---");

// A: legal SSOT term but no CFP/ZFP cite → reject
const a = resolveUnitTermProvenance({
  unit: {
    id: "a",
    track: "destiny",
    claim: "I like cash floor.",
    anchors: ["cash"],
    serves_face: ["01"],
    term_ids: ["day_master"],
  },
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.deepEqual(a.term_ids, [], "A: no cite → no certify");
assert.ok(
  a.rejected.some(
    (r) =>
      r.kind === "declared_term" &&
      r.value === "day_master" &&
      r.reason.includes("ssot_alone_insufficient"),
  ),
  "A: reject reason",
);

// B: legal term but domain unavailable
const b = resolveUnitTermProvenance({
  unit: {
    id: "b",
    track: "destiny",
    claim: "cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: ["day_master"],
  },
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: false,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.deepEqual(b.term_ids, [], "B: bazi unavailable");
assert.equal(b.source_domain, "unavailable");
assert.ok(b.rejected.some((r) => r.reason === "bazi_domain_unavailable"));

// C: wrong declared source_domain overridden
const c = resolveUnitTermProvenance({
  unit: {
    id: "c",
    track: "destiny",
    claim: "cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: [],
    source_domain: "ziwei", // wrong
  },
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.equal(c.source_domain, "bazi", "C: program domain wins");
assert.ok(
  c.rejected.some(
    (r) => r.kind === "declared_domain" && r.value === "ziwei",
  ),
  "C: wrong domain rejected",
);

// D: wrong declared source_version → real hash wins
const d = resolveUnitTermProvenance({
  unit: {
    id: "d",
    track: "destiny",
    claim: "cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: [],
    source_version: "model_forged_v9",
  },
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: true,
  ziwei_available: false,
  cfp_hash: "cfp_real_hash",
  zfp_hash: null,
});
assert.equal(d.source_version, "cfp_real_hash", "D: real hash");
assert.ok(
  d.rejected.some(
    (r) =>
      r.kind === "declared_version" && r.value === "model_forged_v9",
  ),
  "D: forged version rejected",
);

// E: hit not in pattern_hits_used
const e = resolveUnitTermProvenance({
  unit: {
    id: "e",
    track: "destiny",
    claim: "hit:jia_yin:mid",
    anchors: ["hit:jia_yin:mid"],
    serves_face: ["01"],
    term_ids: ["pattern"],
  },
  pack: { ...pack, pattern_hits_used: ["hit:other_hit:mid"] },
  bazi_available: false,
  ziwei_available: true,
  cfp_hash: null,
  zfp_hash: "zfp_v1",
});
assert.deepEqual(e.term_ids, [], "E: hit not in pack");
assert.equal(e.source_domain, "unavailable");
assert.ok(e.rejected.some((r) => r.reason === "hit_not_in_pattern_hits_used"));

// F: bazi term but CFP key absent from chart
const f = resolveUnitTermProvenance({
  unit: {
    id: "f",
    track: "destiny",
    claim: "cfp:dayMaster",
    anchors: ["cfp:dayMaster"],
    serves_face: ["01"],
    term_ids: ["day_master"],
  },
  pack,
  availableCfpKeys: new Set(), // dayMaster not in chart
  bazi_available: true,
  ziwei_available: false,
  cfp_hash: "cfp_v1",
  zfp_hash: null,
});
assert.deepEqual(f.term_ids, [], "F: cfp key missing from chart");
assert.ok(f.rejected.some((r) => r.reason === "cfp_key_not_in_chart_fact_pack"));

// H: hit without accurate SSOT map → no generic pattern
assert.deepEqual(resolveHitIdToTermIds("jia_yin"), [], "H: no map for jia_yin");
const h = resolveUnitTermProvenance({
  unit: {
    id: "h",
    track: "destiny",
    claim: "hit:jia_yin:mid",
    anchors: ["hit:jia_yin:mid"],
    serves_face: ["01"],
    term_ids: ["pattern"],
  },
  pack,
  bazi_available: false,
  ziwei_available: true,
  cfp_hash: null,
  zfp_hash: "zfp_v1",
});
assert.deepEqual(h.term_ids, [], "H: no generic pattern term");
assert.equal(h.source_domain, "ziwei", "H: domain still ziwei from hit");
assert.equal(h.source_version, "zfp_v1");
assert.ok(
  h.records.some(
    (r) =>
      r.certification === "hit_unmapped" &&
      r.term_id === null &&
      r.hit_level === "mid",
  ),
  "H: unmapped hit record kept",
);
assert.ok(
  h.rejected.some(
    (r) => r.value === "pattern" && r.reason.includes("ssot_alone_insufficient"),
  ),
  "H: model pattern rejected",
);

// I: legacy pack missing provenance fields
const i = resolveUnitTermProvenance({
  unit: {
    id: "i",
    track: "destiny",
    claim: "legacy claim without cites",
    anchors: ["legacy"],
    serves_face: ["01"],
    // no term_ids / source_domain / source_version
  } as BookJudgmentUnit,
  pack,
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.deepEqual(i.term_ids, [], "I: legacy empty stays empty");
assert.equal(i.source_domain, "unavailable", "I: no forged domain");
assert.equal(i.source_version, null, "I: no forged version");

// --- Production context ---
const built = buildFace01ProductionContext({
  report_id: "r_prov",
  locale: "en",
  dc,
  pack,
  chart_fact_pack: 'dayMaster: "甲"\nyongJi: 木',
  ziwei_fact_pack: { patternHits: [{ name: "甲寅格" }] } as never,
});
assert.equal(built.ok, true, built.ok ? "" : built.reason);
if (!built.ok) throw new Error(built.reason);
const ctx = built.ctx;

const runway = ctx.slice.reality_context.facts.find((f) => f.fact_id === "fact_runway");
const hobby = ctx.slice.reality_context.facts.find((f) => f.fact_id === "fact_hobby");
const salary = ctx.slice.reality_context.facts.find((f) => f.fact_id === "fact_salary");
assert.ok(runway);
assert.equal(runway!.selection_kind, "linked");
assert.equal(runway!.status, "confirmed");
if (hobby) {
  assert.equal(hobby.selection_kind, "candidate");
  assert.equal(hobby.status, "confirmed");
}
assert.ok(salary);
assert.equal(salary!.selection_kind, "linked");
assert.equal(salary!.status, "unverified");

for (const aRow of ctx.slice.personal_analysis.relevant_anchors) {
  assert.ok(
    aRow.source_domain === "bazi" ||
      aRow.source_domain === "ziwei" ||
      aRow.source_domain === "science" ||
      aRow.source_domain === "convergence",
    `domain=${aRow.source_domain}`,
  );
  assert.notEqual(aRow.source_domain, "bazi_ziwei");
}

// J: evidence.term_ids == program-certified
const baziEv = ctx.registry.evidence["u_bazi"];
assert.ok(baziEv);
assert.deepEqual(baziEv!.term_ids, ["day_master"], "J: bazi certified");
const ziweiEv = ctx.registry.evidence["u_ziwei"];
assert.ok(ziweiEv, "ziwei unit still enters via hit domain");
assert.deepEqual(ziweiEv!.term_ids, [], "J: no forged pattern on ziwei");

// K: glossary only from certified evidence term_ids
const g = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [baziEv!.term_ids, ziweiEv!.term_ids],
});
assert.equal(g.include, true);
assert.deepEqual(g.term_ids, ["day_master"], "K: glossary certified only");
assert.ok(!g.term_ids.includes("pattern"), "K: no pattern");

const gEmpty = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [[]],
});
assert.equal(gEmpty.include, false);

// Bazi-only: ziwei destiny unit must not appear
const baziOnly = buildFace01ProductionContext({
  report_id: "r_bazi",
  locale: "en",
  dc,
  pack,
  chart_fact_pack: "dayMaster:甲",
  ziwei_available: false,
  bazi_available: true,
});
assert.equal(baziOnly.ok, true);
if (baziOnly.ok) {
  assert.equal(baziOnly.ctx.registry.evidence["u_ziwei"], undefined);
  assert.ok(baziOnly.ctx.registry.evidence["u_bazi"]);
  assert.deepEqual(baziOnly.ctx.available_domains, ["bazi"]);
  assert.ok(baziOnly.ctx.domain_versions.bazi);
  assert.equal(baziOnly.ctx.domain_versions.ziwei, undefined);
}

const sel = selectRealityFactsForPage01({ dc, maxFacts: 8 });
assert.notEqual(
  sel.selected.find((r) => r.fact.fact_id === "fact_hobby")?.kind,
  "linked",
);

console.log("ok decision-report-v2 page01 provenance");
