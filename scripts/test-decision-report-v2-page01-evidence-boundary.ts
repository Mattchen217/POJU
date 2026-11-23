/**
 * Page 01 — evidence registry boundary, fact relevance, personal domains.
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page01-evidence-boundary.ts
 */

import assert from "node:assert/strict";
import {
  buildFace01ProductionContext,
  validateFace01ProductionOutput,
  seedEvidenceRegistryForFace01,
  restrictRegistryToPage01Slice,
  selectRealityFactsForPage01,
  resolveAvailablePersonalDomains,
  sliceForPage01,
  buildDecisionReportInput,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

console.log("=== Face01 evidence boundary / relevance / domains ===");

function baseDc(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    context_id: "dc_boundary",
    version: 1,
    status: "final",
    content_hash: "h1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      concrete_event: "Startup offer received",
      stakes: "Career and runway",
      desired_outcome: "Keep optionality without burning cash floor",
      decision_question: "Leave job for startup this quarter?",
      goal_priorities: ["runway", "optionality"],
      unacceptable_outcomes: ["resign cold"],
    },
    reality_facts: [
      {
        fact_id: "fact_runway",
        statement: "Personal runway is about 8 months.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        user_confirmed: true,
        fact_roles: ["hard_constraint", "validation_capacity"],
        related_dir_ids: ["DIR_RUNWAY"],
      },
      {
        fact_id: "fact_offer",
        statement: "Offer includes equity with a one-year cliff.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t2",
        user_confirmed: true,
        fact_roles: ["job_offer", "option"],
        related_dir_ids: ["DIR_OFFER"],
      },
      {
        fact_id: "fact_salary_guess",
        statement: "Maybe cash is around 120k.",
        status: "unverified",
        verification_level: "user_estimate",
        source_stage: "collecting",
        source_turn_id: "t3",
        user_confirmed: false,
        fact_roles: ["job_offer"],
        related_dir_ids: ["DIR_OFFER"],
      },
      {
        fact_id: "fact_hobby_hiking",
        statement: "Likes hiking on weekends.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t4",
        user_confirmed: true,
        // No roles / dirs — personal interest noise
      },
      {
        fact_id: "fact_pet_name",
        statement: "Cat is named Mochi.",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t5",
        user_confirmed: true,
      },
    ],
    constraints: [
      {
        constraint_id: "c_runway",
        statement: "Must keep at least 6 months runway.",
        category: "financial",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        rigidity: "hard",
        user_confirmed: true,
        related_dir_ids: ["DIR_RUNWAY"],
      },
    ],
    hypotheses: [],
    dirs: [
      {
        dir_id: "DIR_RUNWAY",
        need: "Runway floor",
        why: "Cash buffer",
        required_fact_roles: ["hard_constraint", "validation_capacity"],
        current_state: "known",
        partial_satisfaction: false,
        agenda_item_ids: [],
        id_lifecycle: "active",
      },
      {
        dir_id: "DIR_OFFER",
        need: "Offer terms",
        why: "Compare paths",
        required_fact_roles: ["job_offer", "option"],
        current_state: "known",
        partial_satisfaction: true,
        agenda_item_ids: [],
        id_lifecycle: "active",
      },
    ],
    conflicts: [
      {
        conflict_id: "cf1",
        fact_ids: ["fact_offer", "fact_salary_guess"],
        conflict_field: "comp",
        statements_snapshot: ["equity cliff", "cash guess"],
        source_refs: [],
        state: "open",
        resolution: null,
        user_confirmation: false,
      },
    ],
    ...overrides,
  } as DecisionContext;
}

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_abc",
  zfp_hash: "zfp_xyz",
  zfpOmitted: false,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_destiny_01",
      track: "destiny",
      claim: "Keep cash floor while testing optionality.",
      anchors: ["day_master"],
      serves_face: ["01", "02"],
    },
    {
      id: "u_science_01",
      track: "science",
      claim: "Eight-month runway supports staged explore.",
      anchors: ["runway"],
      serves_face: ["01", "02"],
    },
    {
      id: "u_page02_only",
      track: "destiny",
      claim: "Palace detail for page 02.",
      anchors: ["palace"],
      serves_face: ["02"],
    },
    {
      id: "u_unrelated_08",
      track: "science",
      claim: "Close ritual for page 08.",
      anchors: ["close"],
      serves_face: ["08"],
    },
  ],
  by_face: {
    "01": ["u_destiny_01", "u_science_01"],
    "02": ["u_destiny_01", "u_science_01", "u_page02_only"],
    "08": ["u_unrelated_08"],
  },
  pattern_hits_used: [],
  science_tags_used: [],
} as BookJudgmentPack;

// --- Task B: relevance ---
const sel = selectRealityFactsForPage01({ dc: baseDc(), maxFacts: 16 });
const selectedIds = sel.selected.map((r) => r.fact.fact_id);
assert.ok(selectedIds.includes("fact_runway"), "linked runway kept");
assert.ok(selectedIds.includes("fact_offer"), "linked offer kept");
assert.ok(
  !selectedIds.includes("fact_hobby_hiking") ||
    sel.selected.find((r) => r.fact.fact_id === "fact_hobby_hiking")?.kind ===
      "candidate",
  "hobby is not linked",
);
assert.equal(
  sel.selected.find((r) => r.fact.fact_id === "fact_hobby_hiking")?.kind ??
    "excluded",
  sel.selected.some((r) => r.fact.fact_id === "fact_hobby_hiking")
    ? "candidate"
    : "excluded",
);
// Confirmed hobby must not outrank linked unverified salary guess
const idxHobby = selectedIds.indexOf("fact_hobby_hiking");
const idxSalary = selectedIds.indexOf("fact_salary_guess");
if (idxHobby >= 0 && idxSalary >= 0) {
  assert.ok(idxSalary < idxHobby, "linked unverified before confirmed hobby");
}
assert.ok(selectedIds.includes("fact_salary_guess"), "linked estimate kept");
// Status/verification unchanged
const salaryRow = sel.selected.find((r) => r.fact.fact_id === "fact_salary_guess")!;
assert.equal(salaryRow.fact.status, "unverified");
assert.equal(salaryRow.fact.verification, "user_estimate");
assert.equal(salaryRow.source.status, "unverified");
assert.equal(salaryRow.source.verification_level, "user_estimate");

// With maxFacts small, linked still preferred over confirmed noise
const tight = selectRealityFactsForPage01({ dc: baseDc(), maxFacts: 3 });
const tightIds = tight.selected.map((r) => r.fact.fact_id);
assert.ok(!tightIds.includes("fact_hobby_hiking"), "hobby not in top-3 linked");
assert.ok(!tightIds.includes("fact_pet_name"), "pet not in top-3");
assert.ok(tightIds.includes("fact_runway") || tightIds.includes("fact_offer"));

console.log("ok relevance");

// --- Task C: domains ---
assert.deepEqual(
  resolveAvailablePersonalDomains({ pack, chart_fact_pack: null, ziwei_fact_pack: null })
    .available_domains,
  ["ziwei"],
  "pack zfp only → ziwei, not bazi from pack alone",
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: { ...pack, zfpOmitted: true, zfp_hash: null },
    chart_fact_pack: "日主甲木…",
  }).available_domains,
  ["bazi"],
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack: { ...pack, zfpOmitted: true, zfp_hash: null },
    chart_fact_pack: "",
  }).available_domains,
  [],
);
assert.deepEqual(
  resolveAvailablePersonalDomains({
    pack,
    chart_fact_pack: "日主甲木…",
    ziwei_fact_pack: { patternHits: [{ name: "x" }] } as never,
  }).available_domains.sort(),
  ["bazi", "ziwei"],
);
console.log("ok domains");

// --- Task A: restricted registry ---
const built = buildFace01ProductionContext({
  report_id: "r1",
  locale: "en",
  dc: baseDc(),
  pack,
  chart_fact_pack: "日主甲木…",
  ziwei_fact_pack: { patternHits: [{ name: "x" }] } as never,
});
assert.equal(built.ok, true);
if (!built.ok) throw new Error(built.reason);
const ctx = built.ctx;

// Slice evidence IDs == registry evidence IDs
const sliceEv = new Set(ctx.slice.evidence_registry.evidence.map((e) => e.evidence_id));
const regEv = new Set(Object.keys(ctx.registry.evidence));
assert.deepEqual([...sliceEv].sort(), [...regEv].sort(), "slice↔registry evidence");

const sliceClaims = new Set(ctx.slice.evidence_registry.claim_ids);
const regClaims = new Set(Object.keys(ctx.registry.claims));
assert.deepEqual([...sliceClaims].sort(), [...regClaims].sort(), "slice↔registry claims");

// knownFactIds only from slice facts
for (const id of ctx.knownFactIds) {
  if (id.startsWith("ev_fact_")) {
    assert.ok(
      ctx.slice.reality_context.facts.some((f) => `ev_fact_${f.fact_id}` === id),
    );
  } else {
    assert.ok(ctx.slice.reality_context.facts.some((f) => f.fact_id === id));
  }
}

// Seeded-but-filtered unrelated_08 must not be in restricted registry
const seeded = seedEvidenceRegistryForFace01({ dc: baseDc(), pack });
assert.ok(
  !Object.keys(seeded.registry.evidence).includes("u_unrelated_08") ||
    !ctx.registry.evidence["u_unrelated_08"],
);
assert.equal(ctx.registry.evidence["u_unrelated_08"], undefined);

// Artificially prove dual-standard would fail: take an id only in full seeded
// by temporarily seeding with a face-08 unit already in pack — filtered out.
assert.equal(
  ctx.slice.evidence_registry.evidence.some((e) => e.evidence_id === "u_unrelated_08"),
  false,
);

const claimId = Object.keys(ctx.registry.claims)[0]!;
const evId = Object.keys(ctx.registry.evidence).find((id) =>
  ctx.registry.evidence[id]?.source_type !== "reality_fact",
) || Object.keys(ctx.registry.evidence)[0]!;
const factId = ctx.slice.reality_context.facts[0]!.fact_id;
const page02Id =
  ctx.page02PlannedEvidenceIds[0] ||
  Object.keys(ctx.registry.evidence).find((id) => id.startsWith("u_")) ||
  evId;

function validPage(extra?: {
  evidence_ids?: string[];
  claim_ids?: string[];
  target?: string[];
}) {
  return {
    page: "01",
    face: "01",
    schema_version: "face01-v2",
    core_judgment: {
      text: "Keep the job cash floor while exploring the offer in a bounded window.",
      claim_ids: extra?.claim_ids ?? [claimId],
    },
    why_this_path: [
      {
        text: "Runway and optionality both stay intact under a staged path.",
        claim_ids: extra?.claim_ids ?? [claimId],
        evidence_ids: extra?.evidence_ids ?? [evId],
        target_page: "02",
        target_evidence_ids: extra?.target ?? [page02Id],
      },
    ],
    recommendation_conditions: [
      {
        condition: "Runway remains near the confirmed window.",
        status: "satisfied",
        source_ids: [factId],
      },
      {
        condition: "Offer equity terms stay incomplete.",
        status: "unconfirmed",
        source_ids: [factId],
      },
    ],
    not_recommended: [
      {
        option: "Resign immediately.",
        reason: "Burns the cash floor.",
        cost_or_conflict: "Loss of runway buffer.",
        claim_ids: extra?.claim_ids ?? [claimId],
        evidence_ids: extra?.evidence_ids ?? [evId],
      },
    ],
    applicability_boundary: {
      current_basis: ["Confirmed runway and open offer conflict."],
      invalidation_conditions: ["Runway collapses."],
      page02_evidence_ids: extra?.target ?? [page02Id],
      page08_review_refs: [],
    },
  };
}

const ok = validateFace01ProductionOutput({
  raw: validPage(),
  locale: "en",
  ctx,
});
assert.equal(ok.ok, true, JSON.stringify(ok));

// Filtered evidence_id must fail
const badEv = validateFace01ProductionOutput({
  raw: validPage({ evidence_ids: ["u_unrelated_08"] }),
  locale: "en",
  ctx,
});
assert.equal(badEv.ok, false, "filtered evidence_id must fail");

// Filtered / unknown claim_id must fail
const badClaim = validateFace01ProductionOutput({
  raw: validPage({ claim_ids: ["claim_u_unrelated_08"] }),
  locale: "en",
  ctx,
});
assert.equal(badClaim.ok, false, "unknown claim_id must fail");

// Fact id never provided to model must fail
{
  const page = validPage();
  page.recommendation_conditions[0]!.source_ids = ["fact_never_in_slice"];
  const badFact = validateFace01ProductionOutput({
    raw: page,
    locale: "en",
    ctx,
  });
  assert.equal(badFact.ok, false, "unknown fact_id must fail");
}

// restrictRegistry helper: inject phantom then restrict
const report = buildDecisionReportInput({
  report_id: "r2",
  locale: "en",
  dc: baseDc(),
  personal_analysis: {
    profile_version: "x",
    available_domains: ["bazi"],
    relevant_anchors: seeded.anchors,
    approved_readings: seeded.readings,
  },
  report_analysis: {
    decision_synthesis: {},
    candidate_paths: [],
    key_claims: seeded.key_claims,
    unresolved_issues: [],
  },
});
const wideSlice = sliceForPage01({
  report,
  registry: seeded.registry,
  relevantFactIds: new Set(seeded.facts.map((f) => f.fact_id)),
  relevantReadingIds: new Set(seeded.readings.map((r) => r.reading_id)),
});
wideSlice.evidence_registry.evidence = wideSlice.evidence_registry.evidence.filter(
  (e) => e.evidence_id !== "u_page02_only",
);
const restricted = restrictRegistryToPage01Slice({
  seeded,
  slice: wideSlice,
});
assert.equal(restricted.registry.evidence["u_page02_only"], undefined);
assert.ok(
  !restricted.page02PlannedEvidenceIds.includes("u_page02_only") ||
    restricted.registry.evidence["u_page02_only"] != null,
);

console.log("ok registry boundary");
console.log("ok decision-report-v2 page01 evidence-boundary");
