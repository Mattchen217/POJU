/**
 * Decision Report V2 — Batch 0 + Page 01 contract tests.
 * Run: pnpm exec tsx scripts/test-decision-report-v2-batch0-page01.ts
 *
 * REAL_MODEL_CALL_NOT_RUN — this suite does not invoke OpenRouter.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFactVerificationLegal,
  assertPage02EvidenceTargetsExist,
  emptyEvidenceRegistry,
  registerClaim,
  registerEvidence,
  rejectUnknownOrDeclinedAsConfirmed,
} from "@/lib/llm/pro/delivery/decision-report-v2/evidence-registry";
import {
  scanBodyTextCompliance,
  scanEvidenceExplanationCompliance,
  scanEvidenceTermIds,
  validateFace01BodyCompliance,
} from "@/lib/llm/pro/delivery/decision-report-v2/body-compliance";
import {
  buildGlossaryAppendix,
  collectUsedTermIdsFromEvidence,
} from "@/lib/llm/pro/delivery/decision-report-v2/glossary-appendix";
import {
  decisionReportV2InternalOrder,
  isGlossaryAppendixPage,
  isLegacyChartAppendixPage,
  userFacingPageNumber,
} from "@/lib/llm/pro/delivery/decision-report-v2/reading-order";
import {
  buildDecisionReportInput,
  page01SliceLooksOversized,
  realityFactsFromDecisionContext,
  sliceForPage01,
} from "@/lib/llm/pro/delivery/decision-report-v2/page01/slice";
import {
  assembleValidateFace01Page02Links,
  coreJudgmentSentenceCount,
  validateFace01Output,
} from "@/lib/llm/pro/delivery/decision-report-v2/page01/validate";
import {
  isFace01Legacy,
  projectLegacyFace01ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page01/legacy-adapter";
import { Face01Schema, Face03Schema } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import { PAGE_UNION_ALLOWLISTS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { deliveryProsePageNumber } from "@/lib/poju/delivery-shelf-slots";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  ApprovedReading,
  DecisionReportRealityFact,
  ReportClaim,
  ReportEvidence,
} from "@/lib/llm/pro/delivery/decision-report-v2/types";

console.log("=== Decision Report V2 Batch0+Page01 ===");

// --- A. Data sources ---
const facts: DecisionReportRealityFact[] = [
  {
    fact_id: "fact_cash_ok",
    content: "Runway is about 8 months.",
    status: "confirmed",
    verification: "user_asserted",
  },
  {
    fact_id: "fact_estimate_salary",
    content: "Maybe salary around 120k.",
    status: "unverified",
    verification: "user_estimate",
  },
  {
    fact_id: "fact_unknown_partner",
    content: "Partner equity unknown.",
    status: "unknown",
    verification: "none",
  },
];

assert.equal(
  assertFactVerificationLegal(facts[1]!) == null,
  true,
  "user_estimate may exist",
);
assert.ok(
  rejectUnknownOrDeclinedAsConfirmed({
    ...facts[2]!,
    verification: "independently_verified",
  }),
  "unknown cannot be independently_verified",
);
assert.equal(
  facts[1]!.verification === "independently_verified",
  false,
  "estimate not independently_verified",
);

const readings: ApprovedReading[] = [
  {
    reading_id: "reading_pace",
    anchor_ids: ["anchor_day_master"],
    term_ids: ["day_master"],
    interpretation: "You recover better with staged commitments.",
    scope: "career_move",
    confidence_status: "approved",
  },
];

const registry = emptyEvidenceRegistry();
const claimCore: ReportClaim = {
  claim_id: "claim_core_01",
  page_id: "01",
  segment_id: "A",
  body_text: "Keep the day job while piloting the venture part-time.",
  claim_type: "recommendation",
  evidence_ids: ["ev_02_pace", "ev_fact_cash"],
  evidence_requirement: "required",
};
assert.equal(registerClaim(registry, claimCore), null);

const evReading: ReportEvidence = {
  evidence_id: "ev_02_pace",
  source_type: "personal_reading",
  source_id: "reading_pace",
  term_ids: ["day_master"],
  explanation: "Approved reading supports staged commitment.",
  supports_claim_ids: ["claim_core_01"],
  limits_claim_ids: [],
};
const readingMap = new Map(readings.map((r) => [r.reading_id, r]));
const factMap = new Map(facts.map((f) => [f.fact_id, f]));
assert.equal(
  registerEvidence(registry, evReading, { facts: factMap, readings: readingMap }),
  null,
);

const evFact: ReportEvidence = {
  evidence_id: "ev_fact_cash",
  source_type: "reality_fact",
  source_id: "fact_cash_ok",
  term_ids: [],
  explanation: "Confirmed runway supports a pilot.",
  supports_claim_ids: ["claim_core_01"],
  limits_claim_ids: [],
  verification_status: "user_asserted",
};
assert.equal(
  registerEvidence(registry, evFact, { facts: factMap, readings: readingMap }),
  null,
);

assert.ok(
  registerEvidence(
    registry,
    { ...evFact, evidence_id: "ev_bad_fact", source_id: "fact_missing" },
    { facts: factMap, readings: readingMap },
  ),
  "missing fact_id rejected",
);
assert.ok(
  registerEvidence(
    registry,
    {
      ...evReading,
      evidence_id: "ev_bad_reading",
      source_id: "reading_missing",
    },
    { facts: factMap, readings: readingMap },
  ),
  "missing reading_id rejected",
);

// Minimal DC stub
const dc = {
  realityFacts: [
    {
      fact_id: "fact_cash_ok",
      statement: "Runway is about 8 months.",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t1",
      user_confirmed: true,
    },
    {
      fact_id: "fact_estimate_salary",
      statement: "Maybe salary around 120k.",
      status: "unverified",
      verification_level: "user_estimate",
      source_stage: "collecting",
      source_turn_id: "t2",
      user_confirmed: false,
    },
  ],
  constraints: [],
  conflicts: [],
  hypotheses: [],
  definition: {
    decision_question: "Should I resign to start a venture now?",
    desired_outcome: "Lower risk while testing demand.",
  },
} as unknown as DecisionContext;

const mapped = realityFactsFromDecisionContext(dc);
assert.equal(mapped[0]?.status, "confirmed");
assert.equal(mapped[1]?.verification, "user_estimate");

const report = buildDecisionReportInput({
  report_id: "rep_test_01",
  locale: "en",
  dc,
  personal_analysis: {
    profile_version: "v1",
    available_domains: ["bazi"],
    relevant_anchors: [
      {
        anchor_id: "anchor_day_master",
        source_domain: "bazi",
        source_reference: "day_master",
        term_id: "day_master",
        internal_anchor: { slug: "day_master" },
        approved_interpretation: "Staged load fits better.",
        availability_status: "available",
      },
      {
        anchor_id: "anchor_irrelevant",
        source_domain: "ziwei",
        source_reference: "unused",
        internal_anchor: {},
        approved_interpretation: "Unrelated palace note.",
        availability_status: "available",
      },
    ],
    approved_readings: readings,
  },
  report_analysis: {
    decision_synthesis: { preferred: "pilot" },
    candidate_paths: [{ id: "pilot" }, { id: "resign" }],
    key_claims: [claimCore],
    unresolved_issues: [],
  },
});

const slice = sliceForPage01({
  report,
  registry,
  relevantFactIds: new Set(["fact_cash_ok", "fact_estimate_salary"]),
  relevantReadingIds: new Set(["reading_pace"]),
});
assert.ok(
  slice.personal_analysis.approved_readings.every(
    (r) => r.reading_id === "reading_pace",
  ),
);
assert.ok(
  !slice.personal_analysis.relevant_anchors.some(
    (a) => a.anchor_id === "anchor_irrelevant",
  ),
  "irrelevant personal anchor filtered",
);
assert.deepEqual(page01SliceLooksOversized(slice), []);

// --- B. Claim / Evidence ---
assert.ok(claimCore.claim_id);
const face01Raw = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  page_title: "Decision now",
  page_subtitle: "",
  core_judgment: {
    text: "Keep your job and pilot the venture part-time for one quarter.",
    claim_ids: ["claim_core_01"],
  },
  why_this_path: [
    {
      text: "Cash runway supports a low-risk pilot.",
      claim_ids: ["claim_core_01"],
      evidence_ids: ["ev_fact_cash"],
      target_page: "02",
      target_evidence_ids: ["ev_02_pace"],
    },
  ],
  recommendation_conditions: [
    {
      condition: "Runway stays above six months.",
      status: "satisfied",
      source_ids: ["fact_cash_ok"],
    },
    {
      condition: "Partner equity terms are still unknown.",
      status: "unconfirmed",
      source_ids: ["fact_unknown_partner"],
    },
  ],
  not_recommended: [
    {
      option: "Resign immediately into a full-time startup bet.",
      reason: "It burns runway before demand is proven.",
      cost_or_conflict: "High irreversible cash and option cost.",
      claim_ids: ["claim_core_01"],
      evidence_ids: ["ev_fact_cash"],
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway and staged personal pacing."],
    invalidation_conditions: ["Runway drops below four months."],
    page02_evidence_ids: ["ev_02_pace"],
    page08_review_refs: [],
  },
};

const v = validateFace01Output({
  raw: face01Raw,
  locale: "en",
  registry,
  knownFactIds: new Set(facts.map((f) => f.fact_id)),
  requirePage02Targets: true,
});
assert.equal(v.ok, true, JSON.stringify(v));

assert.ok(
  assertPage02EvidenceTargetsExist(registry, ["ev_missing_02"]).length,
  "orphan page02 ref fails",
);

const hypEv: ReportEvidence = {
  evidence_id: "ev_hyp",
  source_type: "explicit_hypothesis",
  source_id: "hyp_demand",
  term_ids: [],
  explanation: "Demand may be strong — still a hypothesis.",
  supports_claim_ids: [],
  limits_claim_ids: ["claim_core_01"],
};
assert.equal(
  registerEvidence(registry, hypEv, { facts: factMap, readings: readingMap }),
  null,
);
assert.notEqual(hypEv.source_type, "reality_fact");

// --- C. Body compliance ---
assert.ok(
  scanBodyTextCompliance("你的日主偏弱，需要用神。", "zh").length,
  "traditional jargon fails",
);
assert.ok(
  scanBodyTextCompliance("先稳住本元再扩大投入。", "zh").some(
    (i) => i.code === "body_soft_label",
  ),
  "soft label 本元 fails in body",
);
assert.ok(
  scanBodyTextCompliance("See ⟦t:day_master⟧ please.", "en").some(
    (i) => i.code === "body_internal_marker",
  ),
);
assert.equal(
  scanEvidenceTermIds(["day_master"]).length,
  0,
  "valid term id ok",
);
assert.ok(scanEvidenceTermIds(["not_a_real_term"]).length);
assert.ok(
  scanEvidenceExplanationCompliance("依据：日主偏弱。", "zh").length,
  "traditional in evidence fails",
);
assert.equal(
  validateFace01BodyCompliance(
    {
      core_judgment: {
        text: "Keep the job and pilot part-time this quarter.",
      },
    },
    "en",
  ).ok,
  true,
);

// --- D. Page content shape ---
assert.ok(Face01Schema.safeParse(face01Raw).success);
assert.ok(coreJudgmentSentenceCount(face01Raw.core_judgment.text) <= 3);
assert.ok(face01Raw.why_this_path.length <= 3);
assert.ok(face01Raw.recommendation_conditions.length >= 2);
assert.ok(face01Raw.not_recommended.length <= 2);
assert.ok(face01Raw.applicability_boundary.current_basis.length >= 1);
assert.equal(
  face01Raw.recommendation_conditions[1]?.status,
  "unconfirmed",
);

const assembleIssues = assembleValidateFace01Page02Links(
  face01Raw as never,
  registry,
);
assert.equal(assembleIssues.length, 0);

// Glossary appendix from used terms only
const used = collectUsedTermIdsFromEvidence([["day_master"], ["day_master"]]);
assert.deepEqual(used, ["day_master"]);
const glossary = buildGlossaryAppendix({ locale: "en", usedTermIds: used });
assert.ok(glossary);
assert.ok(Face03Schema.safeParse(glossary).success);
assert.ok(isGlossaryAppendixPage(glossary));
assert.equal(
  buildGlossaryAppendix({ locale: "en", usedTermIds: [] }),
  null,
  "no empty glossary forced",
);

// --- E. Compat / reading order ---
assert.equal(DECISION_PAGE_SCHEMAS["03"].title, "本报告使用的术语");
assert.deepEqual(PAGE_UNION_ALLOWLISTS["03"].cfp, []);
assert.deepEqual(PAGE_UNION_ALLOWLISTS["03"].zfp, []);

const order = decisionReportV2InternalOrder({ includePage07: false });
assert.deepEqual(order, ["01", "02", "04", "05", "06", "08", "03"]);
assert.equal(userFacingPageNumber("01", order), 1);
assert.equal(userFacingPageNumber("04", order), 3);
assert.equal(userFacingPageNumber("03", order), 7);
assert.equal(
  deliveryProsePageNumber("01", ["cover", "toc", ...order]),
  1,
);

assert.ok(
  isLegacyChartAppendixPage({
    page: "03",
    bazi_slice: "旧盘面",
  }),
);

const legacy = {
  page: "01" as const,
  face: "01" as const,
  main_recommendation: "Hold remotely.",
  conditions: "Cash ok.",
  not_choosing: "Do not resign cold.",
  evidence_pointer: "See 02.",
};
assert.ok(isFace01Legacy(legacy));
assert.ok(projectLegacyFace01ForDisplay(legacy));

// BaselinePortraitBook remains an independent deliverable (file still present).
assert.ok(
  existsSync(resolve("components/poju/BaselinePortraitBook.tsx")),
  "BaselinePortraitBook stays independent",
);
assert.ok(
  existsSync(resolve("components/poju/PojuEnergyMatrix.tsx")),
  "PojuEnergyMatrix stays in baseline portrait, not report",
);

console.log("REAL_MODEL_CALL_NOT_RUN");
console.log("ok decision-report-v2 batch0 page01");
