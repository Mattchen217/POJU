/**
 * Term ID provenance + linked/candidate fact metadata + domain versions.
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page01-provenance.ts
 */

import assert from "node:assert/strict";
import {
  buildFace01ProductionContext,
  assembleGlossaryAppendixFromEvidence,
  resolveUnitTermProvenance,
  resolveAvailablePersonalDomains,
  selectRealityFactsForPage01,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

console.log("=== Face01 provenance / selection_kind / domains ===");

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
      term_ids: ["pattern"],
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
assert.notEqual(both.domain_versions.bazi, undefined);
assert.notEqual(both.domain_versions.ziwei, undefined);

// --- Term provenance: no NLP invent ---
const bare = resolveUnitTermProvenance({
  unit: {
    id: "x",
    track: "destiny",
    serves_face: ["01"],
    claim: "用神木旺，日主偏弱", // classical prose — must NOT invent term_ids
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

const cited = resolveUnitTermProvenance({
  unit: pack.units[0]!,
  pack,
  availableCfpKeys: new Set(["dayMaster"]),
  bazi_available: true,
  ziwei_available: true,
  cfp_hash: "cfp_v1",
  zfp_hash: "zfp_v1",
});
assert.ok(cited.term_ids.includes("day_master"));
assert.equal(cited.source_domain, "bazi");
assert.equal(cited.source_version, "cfp_v1");

// --- Production context wires selection_kind + terms ---
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
assert.equal(salary!.verification, "user_estimate");

// Destiny anchors must not be bazi_ziwei mush
for (const a of ctx.slice.personal_analysis.relevant_anchors) {
  assert.ok(
    a.source_domain === "bazi" ||
      a.source_domain === "ziwei" ||
      a.source_domain === "science" ||
      a.source_domain === "convergence",
    `domain=${a.source_domain}`,
  );
  assert.notEqual(a.source_domain, "bazi_ziwei");
}

const baziEv = ctx.registry.evidence["u_bazi"];
assert.ok(baziEv);
assert.ok(baziEv!.term_ids.includes("day_master"));
const ziweiEv = ctx.registry.evidence["u_ziwei"];
assert.ok(ziweiEv);
assert.ok(ziweiEv!.term_ids.includes("pattern"));

// Glossary only from used evidence term_ids
const g = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [baziEv!.term_ids, ziweiEv!.term_ids],
});
assert.equal(g.include, true);
assert.ok(g.term_ids.includes("day_master"));
assert.ok(g.term_ids.includes("pattern"));
assert.equal(g.term_ids.filter((t) => t === "day_master").length, 1);

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

// Relevance: confirmed hobby is not linked
const sel = selectRealityFactsForPage01({ dc, maxFacts: 8 });
assert.notEqual(
  sel.selected.find((r) => r.fact.fact_id === "fact_hobby")?.kind,
  "linked",
);

console.log("ok decision-report-v2 page01 provenance");
