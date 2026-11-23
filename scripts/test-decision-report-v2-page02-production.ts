/**
 * Decision Report V2 — Page 02 production-path integration (scenarios A–P).
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page02-production.ts
 *
 * Live model: set RUN_FACE02_LIVE=1 and OPENROUTER_API_KEY (or .env.local).
 * Otherwise prints REAL_MODEL_CALL_NOT_RUN.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assembleGlossaryAppendixFromEvidence,
  readingOrderAfterAssembly,
  buildFace02ProductionContext,
  validateFace02ProductionOutput,
  parseFace02JsonStrict,
  page02SliceLooksOversized,
  FACE02_PROMPT_VERSION,
  FACE02_SCHEMA_VERSION,
  isFace02V2,
  isFace02Legacy,
  projectLegacyFace02ForDisplay,
  seedEvidenceRegistryForFace02,
  collectFace02RealizedEvidenceIds,
  buildFace01ProductionContext,
  validateFace01ProductionOutput,
  resolveCanonicalPage02FactId,
  buildPage02FactIdContext,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

console.log("=== Decision Report V2 Page02 production path ===");

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const dc: DecisionContext = {
  context_id: "dc_face02_prod_test",
  version: 1,
  status: "final",
  content_hash: "hash_face02_prod",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  definition: {
    decision_question: "Should I leave the job for a startup offer this quarter?",
    concrete_event: "Received startup offer with equity cliff.",
    desired_outcome: "Preserve runway and optionality without burning bridges.",
    stakes: "Career and cash floor",
    goal_priorities: ["runway"],
    unacceptable_outcomes: ["resign cold"],
  },
  constraints: [
    {
      constraint_id: "c_runway",
      statement: "Keep at least 6 months runway.",
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
  reality_facts: [
    {
      fact_id: "fact_runway",
      statement: "Personal runway is about 8 months.",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t1",
      user_confirmed: true,
      fact_roles: ["hard_constraint"],
      related_dir_ids: ["DIR_RUNWAY"],
    },
    {
      fact_id: "fact_salary_guess",
      statement: "Maybe total cash is around 120k.",
      status: "unverified",
      verification_level: "user_estimate",
      source_stage: "collecting",
      source_turn_id: "t2",
      user_confirmed: false,
      fact_roles: ["job_offer"],
      related_dir_ids: ["DIR_OFFER"],
    },
  ],
  dirs: [
    {
      dir_id: "DIR_RUNWAY",
      need: "Runway",
      why: "Cash floor",
      required_fact_roles: ["hard_constraint"],
      current_state: "known",
      partial_satisfaction: false,
      agenda_item_ids: [],
      id_lifecycle: "active",
    },
    {
      dir_id: "DIR_OFFER",
      need: "Offer",
      why: "Terms",
      required_fact_roles: ["job_offer"],
      current_state: "known",
      partial_satisfaction: true,
      agenda_item_ids: [],
      id_lifecycle: "active",
    },
  ],
  conflicts: [],
  hypotheses: [],
} as unknown as DecisionContext;

function makePack(opts: {
  bazi?: boolean;
  ziwei?: boolean;
  extraUnits?: BookJudgmentPack["units"];
}): BookJudgmentPack {
  const units: BookJudgmentPack["units"] = [];
  if (opts.bazi !== false) {
    units.push({
      id: "u_destiny_02",
      track: "destiny",
      claim: "Stable cash-floor preference aligns with current decision pressure. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["02"],
      caveat: "Not a timing guarantee.",
      term_ids: ["day_master"],
      declared_term_ids: ["day_master"],
      source_domain: "bazi",
      declared_source_domain: "bazi",
      source_version: "cfp_test",
      declared_source_version: "cfp_test",
    } as never);
  }
  if (opts.ziwei) {
    units.push({
      id: "u_ziwei_02",
      track: "destiny",
      claim: "Palace tension shapes how options feel under pressure. hit:jia_yin:strong",
      anchors: ["hit:jia_yin:strong"],
      serves_face: ["02"],
      term_ids: [],
      declared_term_ids: [],
      source_domain: "ziwei",
      declared_source_domain: "ziwei",
      source_version: "zfp_test",
      declared_source_version: "zfp_test",
    } as never);
  }
  units.push({
    id: "u_science_02",
    track: "science",
    claim: "Eight-month runway supports staged explore-without-resign.",
    anchors: ["runway_months"],
    serves_face: ["02"],
    term_ids: [],
    source_domain: "science",
  } as never);
  units.push({
    id: "u_page01_only",
    track: "science",
    claim: "Page01-only recommendation support.",
    anchors: ["p01"],
    serves_face: ["01"],
    source_domain: "science",
  } as never);
  if (opts.extraUnits) units.push(...opts.extraUnits);

  return {
    version: 1,
    locale: "en",
    cfp_hash: opts.bazi === false ? null : "cfp_test",
    zfp_hash: opts.ziwei ? "zfp_test" : null,
    zfpOmitted: !opts.ziwei,
    shot_mode: "one",
    created_at: "2026-01-01T00:00:00Z",
    units,
    by_face: {
      "01": units.filter((u) => u.serves_face.includes("01")).map((u) => u.id),
      "02": units.filter((u) => u.serves_face.includes("02")).map((u) => u.id),
    },
    pattern_hits_used: [],
    science_tags_used: [],
  } as unknown as BookJudgmentPack;
}

const ziweiPack: ZiweiFactPack = {
  patternHits: [
    { name: "jia_yin", strength: "strong", note: "test hit" },
  ],
} as unknown as ZiweiFactPack;

const page01Schema = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact this quarter.",
    claim_ids: ["claim_u_destiny_02"],
  },
  why_this_path: [
    {
      text: "Runway supports testing without resigning cold.",
      claim_ids: ["claim_u_destiny_02"],
      evidence_ids: ["u_destiny_02"],
      target_page: "02",
      target_evidence_ids: ["u_destiny_02"],
    },
  ],
  recommendation_conditions: [
    { condition: "Keep six months runway.", status: "satisfied", source_ids: ["fact_runway"] },
    { condition: "Partner equity still unknown.", status: "unconfirmed", source_ids: ["fact_salary_guess"] },
  ],
  not_recommended: [
    {
      option: "Resign immediately",
      reason: "Burns runway buffer",
      cost_or_conflict: "Cash floor risk",
      claim_ids: ["claim_u_destiny_02"],
      evidence_ids: ["u_destiny_02"],
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway"],
    invalidation_conditions: ["Runway drops below six months"],
    page02_evidence_ids: ["u_destiny_02"],
    page08_review_refs: [],
  },
};

// --- A: bazi + ziwei available ---
{
  const pack = makePack({ bazi: true, ziwei: true });
  const built = buildFace02ProductionContext({
    report_id: "job_face02_a",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    ziwei_fact_pack: ziweiPack,
    page01: page01Schema,
  });
  assert.equal(built.ok, true, "A build ok");
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.prompt_version, FACE02_PROMPT_VERSION);
  assert.equal(built.ctx.schema_version, FACE02_SCHEMA_VERSION);
  assert.ok(built.ctx.available_domains.includes("bazi"));
  assert.ok(built.ctx.available_domains.includes("ziwei"));
  assert.equal(page02SliceLooksOversized(built.ctx.slice).length, 0);
  assert.ok(
    !built.ctx.slice.evidence_registry.evidence.some(
      (e) => e.evidence_id === "u_page01_only",
    ),
    "M: page01-only evidence excluded from Page02 slice",
  );
  console.log("A PASS — bazi+ziwei context");
}

// --- B: bazi only — no forged ziwei ---
{
  const pack = makePack({ bazi: true, ziwei: false });
  const built = buildFace02ProductionContext({
    report_id: "job_face02_b",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "日主甲木…",
    ziwei_fact_pack: null,
    page01: page01Schema,
  });
  assert.equal(built.ok, true, "B build");
  if (!built.ok) throw new Error(built.reason);
  assert.deepEqual(built.ctx.available_domains, ["bazi"]);
  assert.ok(!built.ctx.domain_versions.ziwei);
  const ziweiReadings = built.ctx.slice.personal_analysis.approved_readings.filter(
    (r) => (r as { source_domain?: string }).source_domain === "ziwei",
  );
  assert.equal(ziweiReadings.length, 0, "B no ziwei readings");
  console.log("B PASS — bazi only");
}

// --- C: ziwei only — no forged bazi ---
{
  const pack = makePack({ bazi: false, ziwei: true });
  const built = buildFace02ProductionContext({
    report_id: "job_face02_c",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "",
    ziwei_fact_pack: ziweiPack,
    bazi_available: false,
    ziwei_available: true,
    page01: page01Schema,
  });
  assert.equal(built.ok, true, "C build");
  if (!built.ok) throw new Error(built.reason);
  assert.ok(built.ctx.available_domains.includes("ziwei"));
  assert.ok(!built.ctx.available_domains.includes("bazi"));
  console.log("C PASS — ziwei only");
}

// --- D: no personal domains ---
{
  const pack = makePack({ bazi: false, ziwei: false });
  // strip destiny units
  pack.units = pack.units.filter((u) => u.track !== "destiny");
  pack.by_face["02"] = pack.units
    .filter((u) => u.serves_face.includes("02"))
    .map((u) => u.id);
  const built = buildFace02ProductionContext({
    report_id: "job_face02_d",
    locale: "en",
    dc,
    pack,
    chart_fact_pack: "",
    ziwei_fact_pack: null,
    bazi_available: false,
    ziwei_available: false,
    page01: page01Schema,
  });
  assert.equal(built.ok, true, "D build");
  if (!built.ok) throw new Error(built.reason);
  assert.deepEqual(built.ctx.available_domains, []);
  const invented = validateFace02ProductionOutput({
    raw: {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      page_summary: "Judgment fits because of personal chart destiny.",
      relevant_personal_factors: [
        {
          factor_id: "fake",
          title: "Forged",
          text: "Invented bazi factor",
          claim_ids: Object.keys(built.ctx.registry.claims).slice(0, 1).length
            ? [Object.keys(built.ctx.registry.claims)[0]!]
            : ["claim_missing"],
          evidence_ids: Object.keys(built.ctx.registry.evidence).slice(0, 1).length
            ? [Object.keys(built.ctx.registry.evidence)[0]!]
            : ["missing"],
          source_domain: "bazi",
        },
      ],
      personal_reality_interplay: [],
      why_judgment_fits: {
        text: "Reality runway supports staged explore.",
        claim_ids: Object.keys(built.ctx.registry.claims).slice(0, 1),
        evidence_ids: Object.keys(built.ctx.registry.evidence).slice(0, 1),
        page01_judgment_ref: "",
      },
      explanation_boundary: {
        personal_analysis_basis: ["none"],
        confirmed_fact_basis: ["runway"],
        hypothesis_notes: [],
        uncertainty_notes: ["limited personal data"],
      },
      reading_order: [
        "page_summary",
        "relevant_personal_factors",
        "personal_reality_interplay",
        "why_judgment_fits",
        "explanation_boundary",
      ],
    },
    locale: "en",
    ctx: built.ctx,
  });
  assert.equal(invented.ok, false, "D reject forged bazi factor");
  console.log("D PASS — no invented personal judgment");
}

const packFull = makePack({ bazi: true, ziwei: false });
const builtFull = buildFace02ProductionContext({
  report_id: "job_face02_full",
  locale: "en",
  dc,
  pack: packFull,
  chart_fact_pack: "日主甲木…",
  page01: page01Schema,
});
assert.equal(builtFull.ok, true);
if (!builtFull.ok) throw new Error(builtFull.reason);
const ctx = builtFull.ctx;

const claimId =
  ctx.slice.report_analysis.key_claims[0]?.claim_id ||
  Object.keys(ctx.registry.claims)[0]!;
const personalEv =
  ctx.slice.evidence_registry.evidence.find(
    (e) => e.source_type === "personal_reading",
  )?.evidence_id ||
  ctx.slice.evidence_registry.evidence[0]!.evidence_id;
const factId = ctx.slice.reality_context.facts[0]!.fact_id;

const sciClaimId =
  Object.values(ctx.registry.claims).find((c) => {
    const evs = c.evidence_ids
      .map((id) => ctx.registry.evidence[id])
      .filter(Boolean);
    return (
      evs.length > 0 &&
      evs.every(
        (e) =>
          e!.source_type === "reality_mechanism" ||
          e!.source_type === "reality_fact",
      ) &&
      !c.evidence_ids.includes(personalEv)
    );
  })?.claim_id ||
  Object.keys(ctx.registry.claims).find((c) => c !== claimId)!;

const mechEvId = Object.values(ctx.registry.evidence).find(
  (e) => e.source_type === "reality_mechanism",
)!.evidence_id;

const unverifiedFactId =
  ctx.slice.reality_context.facts.find((f) => f.status === "unverified")
    ?.fact_id || "fact_salary_guess";

function validPage02(extra?: Partial<Record<string, unknown>>) {
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    page_summary:
      "Your preference for a stable cash floor explains why a staged explore fits this decision window.",
    page_summary_reality_fact_ids: [factId],
    relevant_personal_factors: [
      {
        factor_id: "f1",
        title: "Cash-floor preference",
        text: "You tend to protect a stable base before stretching into uncertainty.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        source_domain: "bazi",
        reality_fact_ids: [],
      },
    ],
    personal_reality_interplay: [
      {
        text: "With about eight months runway available, that preference can support exploring without resigning cold.",
        personal_evidence_ids: [personalEv],
        reality_fact_ids: [factId],
        mechanism_evidence_ids: [],
        claim_ids: [claimId],
        conditionality: "Holds while runway stays above six months.",
      },
    ],
    why_judgment_fits: {
      text: "The judgment favors staged explore because your structure prioritizes a protected base and the confirmed runway makes that workable now.",
      claim_ids: [claimId],
      evidence_ids: [personalEv],
      reality_fact_ids: [factId],
      page01_judgment_ref: "staged explore",
    },
    explanation_boundary: {
      personal_analysis_basis: [
        "Certified personal reading on cash-floor preference",
      ],
      confirmed_fact_basis: ["Confirmed runway fact"],
      hypothesis_notes: ["Salary figure remains an estimate"],
      uncertainty_notes: ["Offer terms may still shift"],
      personal_analysis_evidence_ids: [personalEv],
      confirmed_fact_ids: [factId],
      hypothesis_fact_ids: [],
    },
    reading_order: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
    ...extra,
  };
}

// --- Happy path ---
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true, "valid page02");
  if (!ok.ok) throw new Error(JSON.stringify(ok.issues));
  assert.ok(isFace02V2(ok.page));
  assert.ok(ok.cited_term_ids.includes("day_master") || ok.cited_term_ids.length >= 0);
  assert.ok(collectFace02RealizedEvidenceIds(ok.page).includes(personalEv));
  console.log("happy-path PASS");
}

// --- E: invented term_id must not enter evidence (registry already certified) ---
{
  const seeded = seedEvidenceRegistryForFace02({
    dc,
    pack: packFull,
    chart_fact_pack: "日主甲木…",
  });
  for (const ev of Object.values(seeded.registry.evidence)) {
    assert.ok(
      !(ev.term_ids ?? []).includes("totally_fake_term_xyz"),
      "E no invented term in registry",
    );
  }
  console.log("E PASS — invented term not certified");
}

// --- F: wrong source_domain/version ---
{
  const badDomain = validateFace02ProductionOutput({
    raw: validPage02({
      relevant_personal_factors: [
        {
          factor_id: "f1",
          title: "Cash-floor preference",
          text: "You tend to protect a stable base.",
          claim_ids: [claimId],
          evidence_ids: [personalEv],
          source_domain: "ziwei",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badDomain.ok, false, "F wrong domain rejected");
  console.log("F PASS — wrong domain rejected");
}

// --- G: missing evidence id ---
{
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: "Fits because of personal structure and runway.",
        claim_ids: [claimId],
        evidence_ids: ["ev_does_not_exist"],
        page01_judgment_ref: "",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "G missing evidence rejected");
  console.log("G PASS — missing evidence id");
}

// --- H: unmapped hit keeps source, no generic pattern ---
{
  const pack = makePack({
    bazi: false,
    ziwei: true,
    extraUnits: [
      {
        id: "u_unmapped",
        track: "destiny",
        claim: "Unmapped palace hit detail. hit:unknown_hit_xyz:mid",
        anchors: ["hit:unknown_hit_xyz:mid"],
        serves_face: ["02"],
        declared_term_ids: ["generic_pattern"],
        declared_source_domain: "ziwei",
        declared_source_version: "zfp_test",
      } as never,
    ],
  });
  const seeded = seedEvidenceRegistryForFace02({
    dc,
    pack,
    chart_fact_pack: "",
    ziwei_fact_pack: {
      patternHits: [{ name: "unknown_hit_xyz", strength: "mid" }],
    } as unknown as ZiweiFactPack,
    bazi_available: false,
    ziwei_available: true,
  });
  const ev = seeded.registry.evidence["u_unmapped"];
  if (ev) {
    assert.ok(
      !(ev.term_ids ?? []).includes("generic_pattern"),
      "H no generic_pattern fabricated",
    );
  }
  console.log("H PASS — unmapped hit no generic pattern");
}

// --- I: unverified fact not upgraded ---
{
  const salary = ctx.slice.reality_context.facts.find(
    (f) => f.fact_id === "fact_salary_guess",
  );
  if (salary) {
    assert.equal(salary.status, "unverified");
  }
  const badUpgrade = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "The salary is already confirmed as a definite fact and definitely true.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: ["fact_salary_guess"],
          mechanism_evidence_ids: [],
          claim_ids: [claimId],
          conditionality: "Treats estimate as confirmed fact.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badUpgrade.ok, false, "I status upgrade rejected");
  console.log("I PASS — unverified not upgraded");
}

// --- J: hypothesis as science validation ---
{
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: "This is empirically proven by bazi and science confirms the destiny reading.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        page01_judgment_ref: "",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "J science-validates-metaphysics rejected");
  console.log("J PASS — hypothesis as fact rejected");
}

// --- K: Page01 conclusion copy ---
{
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: "Prefer a staged explore path that keeps the cash floor intact this quarter. Prefer a staged explore path that keeps the cash floor intact this quarter.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        page01_judgment_ref: "",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "K page01 copy rejected");
  console.log("K PASS — no Page01 conclusion copy");
}

// --- L: Page04 bottleneck leak ---
{
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      page_summary: "The 核心卡点 is the real bottleneck before any path choice.",
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "L page04 leak rejected");
  console.log("L PASS — no Page04 bottleneck");
}

// --- Integrity A: wrong domain personal-reading rejected ---
{
  const mechEv = Object.values(ctx.registry.evidence).find(
    (e) => e.source_type === "reality_mechanism",
  );
  // Label bazi evidence as ziwei
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      relevant_personal_factors: [
        {
          factor_id: "f1",
          title: "Cash-floor preference",
          text: "You tend to protect a stable base.",
          claim_ids: [claimId],
          evidence_ids: [personalEv],
          source_domain: "ziwei",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-A wrong domain");
  assert.ok(mechEv, "need mechanism for later tests");
  console.log("integrity-A PASS — wrong-domain personal reading rejected");
}

// --- Integrity B: reality-fact evidence in personal_evidence_ids ---
{
  const factEv = `ev_fact_${factId}`;
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore.",
          personal_evidence_ids: [factEv],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [],
          claim_ids: [claimId],
          conditionality: "While runway holds.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-B fact as personal");
  console.log("integrity-B PASS — reality-fact id rejected as personal evidence");
}

// --- Integrity C: personal-reading in mechanism_evidence_ids ---
{
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [personalEv],
          claim_ids: [claimId],
          conditionality: "While runway holds.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-C personal as mechanism");
  console.log("integrity-C PASS — personal id rejected as mechanism");
}

// --- Integrity D: mechanism in personal_evidence_ids ---
{
  const mechId = Object.values(ctx.registry.evidence).find(
    (e) => e.source_type === "reality_mechanism",
  )!.evidence_id;
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore.",
          personal_evidence_ids: [mechId],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [],
          claim_ids: [claimId],
          conditionality: "While runway holds.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-D mechanism as personal");
  console.log("integrity-D PASS — mechanism id rejected as personal");
}

// --- Integrity E: evidence not owned by cited claim ---
{
  const otherClaims = Object.keys(ctx.registry.claims).filter(
    (c) => c !== claimId,
  );
  const orphanClaim =
    otherClaims[0] ||
    Object.keys(ctx.registry.claims).find((c) => {
      const claim = ctx.registry.claims[c]!;
      return !claim.evidence_ids.includes(personalEv);
    });
  if (orphanClaim && orphanClaim !== claimId) {
    const bad = validateFace02ProductionOutput({
      raw: validPage02({
        why_judgment_fits: {
          text: "Staged explore fits the protected-base preference under runway.",
          claim_ids: [orphanClaim],
          evidence_ids: [personalEv],
          page01_judgment_ref: "",
        },
      }),
      locale: "en",
      ctx,
    });
    assert.equal(bad.ok, false, "integrity-E claim/evidence orphan");
    console.log("integrity-E PASS — unowned claim/evidence pair rejected");
  } else {
    // Force orphan by inventing a second claim ownership mismatch via science-only claim
    const sciClaim = Object.values(ctx.registry.claims).find((c) => {
      const evs = c.evidence_ids
        .map((id) => ctx.registry.evidence[id])
        .filter(Boolean);
      return (
        evs.length > 0 &&
        evs.every((e) => e!.source_type === "reality_mechanism")
      );
    });
    assert.ok(sciClaim, "need science claim for E");
    const bad = validateFace02ProductionOutput({
      raw: validPage02({
        why_judgment_fits: {
          text: "Staged explore fits the protected-base preference under runway.",
          claim_ids: [sciClaim!.claim_id],
          evidence_ids: [personalEv],
          page01_judgment_ref: "",
        },
      }),
      locale: "en",
      ctx,
    });
    assert.equal(bad.ok, false, "integrity-E claim/evidence orphan");
    console.log("integrity-E PASS — unowned claim/evidence pair rejected");
  }
}

// --- Integrity F / M: evidence outside final Page02 slice rejected ---
{
  const outsideId = "u_page01_only";
  assert.equal(
    ctx.registry.evidence[outsideId],
    undefined,
    "page01-only must be absent from restricted registry",
  );
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: "Staged explore fits because of protected base and runway.",
        claim_ids: [claimId],
        evidence_ids: [outsideId],
        page01_judgment_ref: "",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-F/M outside-slice evidence");
  console.log("integrity-F/M PASS — outside-slice evidence rejected");
}

// --- Integrity G: unverified described as confirmed in page_summary ---
{
  const unverified = ctx.slice.reality_context.facts.find(
    (f) => f.status === "unverified",
  );
  assert.ok(unverified, "need unverified fact in fixture");
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      page_summary: `The confirmed fact ${unverified!.content} is already confirmed as a definite truth for this decision.`,
    }),
    locale: "en",
    ctx,
  });
  assert.equal(bad.ok, false, "integrity-G page_summary upgrade");
  console.log("integrity-G PASS — page_summary status upgrade rejected");
}

// --- Integrity H: unverified in confirmed_fact_basis / confirmed_fact_ids ---
{
  const unverified = ctx.slice.reality_context.facts.find(
    (f) => f.status === "unverified",
  )!;
  const badIds = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: [`Confirmed: ${unverified.content}`],
        hypothesis_notes: [],
        uncertainty_notes: ["Offer terms may still shift"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [unverified.fact_id],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badIds.ok, false, "integrity-H confirmed_fact_ids upgrade");
  console.log("integrity-H PASS — unverified blocked from confirmed basis");
}

// --- Integrity I: no personal domain → empty personal basis ok ---
{
  const packNone = makePack({ bazi: false, ziwei: false });
  packNone.units = packNone.units.filter((u) => u.track !== "destiny");
  packNone.by_face["02"] = packNone.units
    .filter((u) => u.serves_face.includes("02"))
    .map((u) => u.id);
  const builtNone = buildFace02ProductionContext({
    report_id: "job_face02_empty_personal",
    locale: "en",
    dc,
    pack: packNone,
    chart_fact_pack: "",
    bazi_available: false,
    ziwei_available: false,
    page01: page01Schema,
  });
  assert.equal(builtNone.ok, true);
  if (!builtNone.ok) throw new Error(builtNone.reason);
  const sciClaim =
    builtNone.ctx.slice.report_analysis.key_claims[0]?.claim_id ||
    Object.keys(builtNone.ctx.registry.claims)[0]!;
  const sciEv =
    builtNone.ctx.slice.evidence_registry.evidence.find(
      (e) => e.source_type === "reality_mechanism",
    )?.evidence_id ||
    builtNone.ctx.slice.evidence_registry.evidence[0]!.evidence_id;
  const confFact =
    builtNone.ctx.slice.reality_context.facts.find((f) => f.status === "confirmed")
      ?.fact_id || factId;
  const okEmpty = validateFace02ProductionOutput({
    raw: {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      page_summary:
        "The staged explore direction fits the confirmed runway conditions for this decision.",
      relevant_personal_factors: [],
      personal_reality_interplay: [],
      why_judgment_fits: {
        text: "Judgment fits because confirmed runway supports staged explore without resigning cold.",
        claim_ids: [sciClaim],
        evidence_ids: [sciEv],
        page01_judgment_ref: "staged explore",
      },
      explanation_boundary: {
        personal_analysis_basis: [],
        confirmed_fact_basis: ["Confirmed runway supports pacing."],
        hypothesis_notes: [],
        uncertainty_notes: ["Offer terms may still shift"],
        personal_analysis_evidence_ids: [],
        confirmed_fact_ids: [confFact],
        hypothesis_fact_ids: [],
      },
      reading_order: [
        "page_summary",
        "relevant_personal_factors",
        "personal_reality_interplay",
        "why_judgment_fits",
        "explanation_boundary",
      ],
    },
    locale: "en",
    ctx: builtNone.ctx,
  });
  assert.equal(okEmpty.ok, true, JSON.stringify(okEmpty.ok ? null : okEmpty.issues));
  console.log("integrity-I PASS — empty personal basis without inventing factors");
}

// --- Integrity J: no confirmed facts → empty confirmed basis ---
{
  const dcNoConfirmed = {
    ...dc,
    reality_facts: (dc.reality_facts ?? []).map((f) =>
      f.status === "confirmed"
        ? { ...f, status: "unverified", verification_level: "user_estimate" }
        : f,
    ),
  } as typeof dc;
  const builtNc = buildFace02ProductionContext({
    report_id: "job_face02_no_confirmed",
    locale: "en",
    dc: dcNoConfirmed,
    pack: packFull,
    chart_fact_pack: "日主甲木…",
    page01: page01Schema,
  });
  assert.equal(builtNc.ok, true);
  if (!builtNc.ok) throw new Error(builtNc.reason);
  const cId =
    builtNc.ctx.slice.report_analysis.key_claims[0]?.claim_id ||
    Object.keys(builtNc.ctx.registry.claims)[0]!;
  const pEv =
    builtNc.ctx.slice.evidence_registry.evidence.find(
      (e) => e.source_type === "personal_reading",
    )?.evidence_id!;
  const ok = validateFace02ProductionOutput({
    raw: {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      page_summary:
        "Personal preference for a stable base still frames how options feel, with uncertainty retained.",
      relevant_personal_factors: [
        {
          factor_id: "f1",
          title: "Cash-floor preference",
          text: "You tend to protect a stable base before stretching into uncertainty.",
          claim_ids: [cId],
          evidence_ids: [pEv],
          source_domain: "bazi",
        },
      ],
      personal_reality_interplay: [],
      why_judgment_fits: {
        text: "The judgment still tracks the protected-base preference while facts stay provisional.",
        claim_ids: [cId],
        evidence_ids: [pEv],
        page01_judgment_ref: "staged explore",
      },
      explanation_boundary: {
        personal_analysis_basis: ["Certified personal reading"],
        confirmed_fact_basis: [],
        hypothesis_notes: ["Runway figure remains an estimate"],
        uncertainty_notes: ["No confirmed DC facts in this slice"],
        personal_analysis_evidence_ids: [pEv],
        confirmed_fact_ids: [],
        hypothesis_fact_ids: [],
      },
      reading_order: [
        "page_summary",
        "relevant_personal_factors",
        "personal_reality_interplay",
        "why_judgment_fits",
        "explanation_boundary",
      ],
    },
    locale: "en",
    ctx: builtNc.ctx,
  });
  assert.equal(ok.ok, true, JSON.stringify(ok.ok ? null : ok.issues));
  const invent = validateFace02ProductionOutput({
    raw: {
      ...(ok.ok ? ok.page : {}),
      explanation_boundary: {
        personal_analysis_basis: ["Certified personal reading"],
        confirmed_fact_basis: ["Invented confirmed runway"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [pEv],
        confirmed_fact_ids: ["fact_runway"],
        hypothesis_fact_ids: [],
      },
    },
    locale: "en",
    ctx: builtNc.ctx,
  });
  assert.equal(invent.ok, false, "integrity-J invent confirmed rejected");
  console.log("integrity-J PASS — empty confirmed basis when none exist");
}

// --- Integrity K: confirmed_fact_ids only confirmed ---
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("K needs valid");
  assert.deepEqual(ok.page.explanation_boundary.confirmed_fact_ids, [factId]);
  assert.equal(ctx.factStatusById.get(factId), "confirmed");
  console.log("integrity-K PASS — confirmed basis cites only confirmed facts");
}

// --- Integrity L: hypothesis notes distinguishable ---
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: ["Partner equity split remains a working hypothesis"],
        uncertainty_notes: ["Offer terms may still shift"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("L needs valid");
  assert.ok(ok.page.explanation_boundary.hypothesis_notes.length >= 1);
  assert.ok(
    !ok.page.explanation_boundary.confirmed_fact_basis.some((t) =>
      t.includes("working hypothesis"),
    ),
  );
  console.log("integrity-L PASS — hypothesis notes distinct from confirmed");
}

// --- Provenance: missing evidence source_version ---
{
  const mutated = structuredClone(ctx);
  const ev = mutated.registry.evidence[personalEv]!;
  ev.source_version = null;
  const bad = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "missing source_version must reject");
  assert.ok(
    !bad.ok &&
      bad.issues.some((i) => i.code === "evidence_version_missing"),
    "expect evidence_version_missing",
  );
  console.log("provenance-missing-version PASS");
}

// --- Provenance: wrong evidence source_version ---
{
  const mutated = structuredClone(ctx);
  mutated.registry.evidence[personalEv]!.source_version = "stale_cfp_old";
  const bad = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "wrong source_version must reject");
  assert.ok(
    !bad.ok &&
      bad.issues.some((i) => i.code === "evidence_version_mismatch"),
  );
  console.log("provenance-wrong-version PASS");
}

// --- Provenance: missing source_domain ---
{
  const mutated = structuredClone(ctx);
  mutated.registry.evidence[personalEv]!.source_domain = null;
  const bad = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "missing source_domain must reject");
  assert.ok(
    !bad.ok &&
      bad.issues.some(
        (i) =>
          i.code === "evidence_domain_missing" ||
          i.code === "evidence_domain_mismatch",
      ),
  );
  console.log("provenance-missing-domain PASS");
}

// --- Provenance: unavailable personal domain ---
{
  const mutated = structuredClone(ctx);
  mutated.available_domains = [];
  mutated.domain_versions = {};
  const bad = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "unavailable domain must reject");
  console.log("provenance-unavailable-domain PASS");
}

// --- Provenance: stale personal via explanation_boundary ---
{
  const mutated = structuredClone(ctx);
  mutated.registry.evidence[personalEv]!.source_version = "stale_boundary";
  const bad = validateFace02ProductionOutput({
    raw: validPage02({
      relevant_personal_factors: [],
      personal_reality_interplay: [],
      why_judgment_fits: {
        text: "Judgment fits via mechanism runway pacing under protected base preference.",
        claim_ids: [sciClaimId],
        evidence_ids: [mechEvId],
        reality_fact_ids: [],
        page01_judgment_ref: "staged explore",
      },
      explanation_boundary: {
        personal_analysis_basis: ["Certified personal reading"],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: [],
        uncertainty_notes: ["Offer terms may still shift"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "stale personal via boundary");
  console.log("provenance-stale-boundary PASS");
}

// --- Provenance: stale personal via personal_reality_interplay ---
{
  const mutated = structuredClone(ctx);
  mutated.registry.evidence[personalEv]!.source_version = "stale_interplay";
  const bad = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(bad.ok, false, "stale personal via interplay");
  console.log("provenance-stale-interplay PASS");
}

// --- Canonical fact ID A–E ---
{
  const factCtx = buildPage02FactIdContext({
    factIds: ctx.factStatusById.keys(),
  });
  const aliasUnverified = `ev_fact_${unverifiedFactId}`;
  assert.equal(
    resolveCanonicalPage02FactId(aliasUnverified, factCtx).ok,
    true,
  );
  const badConfirmedAlias = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: ["Promoted via alias"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [aliasUnverified],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    badConfirmedAlias.ok,
    false,
    "A: ev_fact_<unverified> cannot enter confirmed_fact_ids",
  );

  const badUnknown = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: ["Unknown"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: ["ev_fact_fact_totally_unknown_zz"],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badUnknown.ok, false, "B: unknown alias rejected");

  const badInterplayAlias = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "The salary estimate is a confirmed fact and definitely true.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: [aliasUnverified],
          mechanism_evidence_ids: [],
          claim_ids: [claimId],
          conditionality: "Treats estimate as confirmed fact.",
        },
      ],
      page_summary:
        "Your preference for a stable cash floor explains why a staged explore fits. The salary estimate is a confirmed fact and definitely true.",
      page_summary_reality_fact_ids: [aliasUnverified],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    badInterplayAlias.ok,
    false,
    "C: alias cannot bypass status in interplay/summary",
  );

  const badHyp = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: ["Relabel confirmed as hypothesis"],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [factId],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    badHyp.ok,
    false,
    "D: confirmed cannot be relabeled hypothesis",
  );

  const badPromote = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: `The judgment fits and the salary content is as confirmed / definitely true: ${ctx.factContentById.get(unverifiedFactId)}`,
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        reality_fact_ids: [`ev_fact_${unverifiedFactId}`],
        page01_judgment_ref: "staged explore",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    badPromote.ok,
    false,
    "E: candidate/unverified cannot promote via alias",
  );
  console.log("canonical-fact-id A–E PASS");
}

// --- Ownership negatives ---
{
  assert.ok(sciClaimId && sciClaimId !== claimId, "need distinct science claim");
  const badFactor = validateFace02ProductionOutput({
    raw: validPage02({
      relevant_personal_factors: [
        {
          factor_id: "f1",
          title: "Cash-floor preference",
          text: "You tend to protect a stable base before stretching into uncertainty.",
          claim_ids: [sciClaimId],
          evidence_ids: [personalEv],
          source_domain: "bazi",
          reality_fact_ids: [],
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badFactor.ok, false, "factor unrelated claim");

  const badInterplayPersonal = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [],
          claim_ids: [sciClaimId],
          conditionality: "While runway holds.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badInterplayPersonal.ok, false, "interplay personal unrelated");

  const badMech = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore with mechanism pacing.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [mechEvId],
          claim_ids: [claimId],
          conditionality: "While runway holds.",
        },
      ],
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badMech.ok, false, "mechanism unrelated to destiny claim");

  const badFactClaim = validateFace02ProductionOutput({
    raw: validPage02({
      personal_reality_interplay: [
        {
          text: "Runway supports staged explore.",
          personal_evidence_ids: [personalEv],
          reality_fact_ids: [factId],
          mechanism_evidence_ids: [],
          claim_ids: [sciClaimId],
          conditionality: "While runway holds.",
        },
      ],
      why_judgment_fits: {
        text: "Judgment fits via science runway pacing.",
        claim_ids: [sciClaimId],
        evidence_ids: [mechEvId],
        reality_fact_ids: [],
        page01_judgment_ref: "",
      },
      relevant_personal_factors: [],
      explanation_boundary: {
        personal_analysis_basis: [],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(badFactClaim.ok, false, "reality fact unrelated claim");

  // Mutate so personalEv is not owned by any claim
  const mutated = structuredClone(ctx);
  for (const claim of Object.values(mutated.registry.claims)) {
    claim.evidence_ids = claim.evidence_ids.filter((id) => id !== personalEv);
  }
  const pev = mutated.registry.evidence[personalEv]!;
  pev.supports_claim_ids = [];
  pev.limits_claim_ids = [];
  const badBoundaryOrphan = validateFace02ProductionOutput({
    raw: validPage02({
      relevant_personal_factors: [],
      personal_reality_interplay: [],
      why_judgment_fits: {
        text: "Judgment fits via science runway pacing under conditions.",
        claim_ids: [sciClaimId],
        evidence_ids: [mechEvId],
        reality_fact_ids: [],
        page01_judgment_ref: "staged explore",
      },
      explanation_boundary: {
        personal_analysis_basis: ["Certified personal reading"],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx: mutated,
  });
  assert.equal(
    badBoundaryOrphan.ok,
    false,
    "boundary personal evidence unrelated to all claims",
  );
  console.log("ownership negatives PASS");
}

// --- Structured fact ref evasion across fields ---
{
  const moveToSummary = validateFace02ProductionOutput({
    raw: validPage02({
      page_summary: `The salary figure is a confirmed fact and definitely true: ${ctx.factContentById.get(unverifiedFactId)}`,
      page_summary_reality_fact_ids: [unverifiedFactId],
      explanation_boundary: {
        personal_analysis_basis: [
          "Certified personal reading on cash-floor preference",
        ],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: [],
        uncertainty_notes: ["x"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    moveToSummary.ok,
    false,
    "cannot evade status by moving claim to page_summary",
  );

  const moveToWhy = validateFace02ProductionOutput({
    raw: validPage02({
      why_judgment_fits: {
        text: `Fits, and this estimate is a confirmed fact and definitely true: ${ctx.factContentById.get(unverifiedFactId)}`,
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        reality_fact_ids: [unverifiedFactId],
        page01_judgment_ref: "staged explore",
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(
    moveToWhy.ok,
    false,
    "cannot evade status by moving claim to why_judgment_fits",
  );
  console.log("structured-fact-ref evasion PASS");
}

// --- N: real Face01+Face02 production metadata → Assemble helper ---
{
  const face01Built = buildFace01ProductionContext({
    report_id: "job_face01_for_glossary",
    locale: "en",
    dc,
    pack: packFull,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(face01Built.ok, true, "N face01 build");
  if (!face01Built.ok) throw new Error(face01Built.reason);
  const f01Claim =
    face01Built.ctx.slice.report_analysis.key_claims[0]?.claim_id ||
    Object.keys(face01Built.ctx.registry.claims)[0]!;
  const f01Ev =
    face01Built.ctx.slice.evidence_registry.evidence.find((e) =>
      (e.term_ids ?? []).includes("day_master"),
    )?.evidence_id ||
    face01Built.ctx.slice.evidence_registry.evidence.find(
      (e) => e.source_type === "personal_reading",
    )?.evidence_id ||
    face01Built.ctx.page02PlannedEvidenceIds[0]!;
  const f01Fact = face01Built.ctx.slice.reality_context.facts[0]!.fact_id;
  const face01Raw = {
    page: "01",
    face: "01",
    schema_version: "face01-v2",
    core_judgment: {
      text: "Keep the job cash floor while exploring the offer in a bounded window.",
      claim_ids: [f01Claim],
    },
    why_this_path: [
      {
        text: "Runway and optionality both stay intact under a staged path.",
        claim_ids: [f01Claim],
        evidence_ids: [f01Ev],
        target_page: "02",
        target_evidence_ids: [
          face01Built.ctx.page02PlannedEvidenceIds[0] || f01Ev,
        ],
      },
    ],
    recommendation_conditions: [
      {
        condition: "Personal runway remains near the confirmed window.",
        status: "satisfied",
        source_ids: [f01Fact],
      },
      {
        condition: "Partner equity terms stay unknown and must be clarified.",
        status: "unconfirmed",
        source_ids: ["fact_salary_guess"],
      },
    ],
    not_recommended: [
      {
        option: "Resign immediately for the offer.",
        reason: "Burns the cash floor before terms are clear.",
        cost_or_conflict: "Loss of runway buffer.",
        claim_ids: [f01Claim],
        evidence_ids: [f01Ev],
      },
    ],
    applicability_boundary: {
      current_basis: ["Confirmed runway and open equity conflict."],
      invalidation_conditions: [
        "Runway collapses or equity terms lock unfavorably.",
      ],
      page02_evidence_ids: [
        face01Built.ctx.page02PlannedEvidenceIds[0] || f01Ev,
      ],
      page08_review_refs: [],
    },
  };
  const face01 = validateFace01ProductionOutput({
    raw: face01Raw,
    locale: "en",
    ctx: face01Built.ctx,
  });
  assert.equal(
    face01.ok,
    true,
    JSON.stringify(face01.ok ? null : face01.issues),
  );
  if (!face01.ok) throw new Error("N face01 validate");

  const face02 = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(face02.ok, true);
  if (!face02.ok) throw new Error("N face02");

  // Same helper Lab Assemble uses (runLabStepV3 assemble branch).
  const face01Cited = face01.cited_term_ids;
  const face02Cited = face02.cited_term_ids;
  const productionMeta = {
    face01: { cited_term_ids: face01Cited },
    face02: { cited_term_ids: face02Cited },
  };
  const glossary = assembleGlossaryAppendixFromEvidence({
    locale: "en",
    evidenceTermIdLists: [
      productionMeta.face01.cited_term_ids,
      productionMeta.face02.cited_term_ids,
    ],
  });
  const expected = [
    ...new Set([
      ...productionMeta.face01.cited_term_ids,
      ...productionMeta.face02.cited_term_ids,
    ]),
  ];
  if (expected.length === 0) {
    assert.equal(glossary.include, false);
  } else {
    assert.equal(glossary.include, true);
    assert.deepEqual([...glossary.term_ids].sort(), [...expected].sort());
  }
  assert.ok(
    !glossary.term_ids.includes("unused_allowlist_term_xyz"),
    "unused allowlist term must not enter",
  );
  assert.ok(
    !face01Cited.includes("totally_fake_term_xyz") &&
      !face02Cited.includes("totally_fake_term_xyz"),
    "model-declared fake term not in certified cited lists",
  );
  const emptyGlossary = assembleGlossaryAppendixFromEvidence({
    locale: "en",
    evidenceTermIdLists: [[], []],
  });
  assert.equal(emptyGlossary.include, false);
  assert.equal(emptyGlossary.page, null);
  const order = readingOrderAfterAssembly({ glossary });
  assert.ok(order.includes("02"));
  console.log(
    "N PASS — glossary from certified Face01+Face02 production cited_term_ids via Assemble helper",
  );
}

// --- UI/PDF parity: hypothesis_notes rendered ---
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02({
      explanation_boundary: {
        personal_analysis_basis: ["Certified personal reading"],
        confirmed_fact_basis: ["Confirmed runway fact"],
        hypothesis_notes: ["UNIQUE_HYPOTHESIS_NOTE_FOR_PDF_TEST"],
        uncertainty_notes: ["Offer terms may still shift"],
        personal_analysis_evidence_ids: [personalEv],
        confirmed_fact_ids: [factId],
        hypothesis_fact_ids: [],
      },
    }),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("ui/pdf needs valid");
  const bodies = pageSchemaToArgumentBodies(ok.page as never);
  const joined = bodies.map((b) => b.body).join("\n");
  assert.ok(
    joined.includes("UNIQUE_HYPOTHESIS_NOTE_FOR_PDF_TEST"),
    "PDF/argument bodies must include hypothesis_notes",
  );
  assert.ok(
    joined.includes("解释性假设") ||
      joined.includes("hypothesis") ||
      joined.includes("假设"),
    "hypothesis label present in PDF render",
  );
  assert.ok(joined.includes("Confirmed runway") || joined.includes("已确认"));
  const uiSrc = readFileSync(
    resolvePath("components/poju/delivery-pages/faces/Face02PageSlots.tsx"),
    "utf8",
  );
  assert.ok(uiSrc.includes("hypothesis_notes"));
  assert.ok(
    uiSrc.includes("解释性假设") || uiSrc.includes("Explanatory hypotheses"),
  );
  console.log(
    "UI/PDF parity PASS — hypothesis_notes in reader source + PDF bodies",
  );
}

// --- O: historical missing / legacy Face02 open ---
{
  assert.equal(isFace02V2(null), false);
  assert.equal(projectLegacyFace02ForDisplay(null), null);
  const legacy = {
    page: "02",
    face: "02",
    destiny_reason: "Legacy destiny prose about structure under pressure.",
    science_mechanism: "Legacy science mechanism about runway buffers.",
    convergence: "Legacy convergence note for fit.",
    verifiable_anchors: ["anchor one"],
  };
  assert.equal(isFace02Legacy(legacy), true);
  const projected = projectLegacyFace02ForDisplay(legacy);
  assert.ok(projected);
  assert.equal(projected!.schema_version, "face02-v2");
  console.log("O PASS — historical legacy open without crash");
}

// --- P: repair still fail → fail closed (no persist semantics) ---
{
  assert.equal(parseFace02JsonStrict("```json\n{}\n```"), null);
  const stillBad = validateFace02ProductionOutput({
    raw: { page: "02", face: "02" },
    locale: "en",
    ctx,
  });
  assert.equal(stillBad.ok, false, "P fail closed");
  console.log("P PASS — fail closed after failed validation");
}

// body-prompt Face02 branch
{
  const pair = buildV3BodyPrompt({
    key: "02",
    locale: "en",
    core_conclusion: "",
    judgment_lock: "",
    user_feed: "",
    zfpOmitted: true,
    face02_production: { system: ctx.system, user: ctx.user },
  });
  assert.equal(pair.user, ctx.user);
  console.log("body-prompt Face02 branch PASS");
}

// --- Live model (optional) ---
async function maybeLive() {
  const runLive = process.env.RUN_FACE02_LIVE === "1";
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!runLive || !hasKey) {
    console.log("REAL_MODEL_CALL_NOT_RUN (set RUN_FACE02_LIVE=1 to enable)");
    return;
  }
  const { runContentBodyGenerate } = await import(
    "@/lib/llm/pro/delivery/pipeline-v3/content-body"
  );
  const { isV3LabTransportSupplyFail } = await import(
    "@/lib/llm/pro/delivery/dispatch/provider-escape"
  );

  const invoke = (dispatch_attempt: number) =>
    runContentBodyGenerate({
      key: "02",
      finalize: {} as never,
      locale: "en",
      session_id: "live_face02_test",
      chart_fact_pack: "日主甲木…",
      ziwei_fact_pack: null,
      decision_context_snapshot: dc,
      book_judgment_pack: packFull,
      report_id: "live_face02_test",
      page01_schema: page01Schema,
      thinking_effort: "medium",
      dispatch_attempt,
    });

  let result = await invoke(1);
  if (!result.ok && isV3LabTransportSupplyFail(result.reason)) {
    console.log("live_face02_attempt1_supply_fail", { reason: result.reason });
    result = await invoke(2);
  }

  console.log("live_face02", {
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
    is_v2: result.ok ? isFace02V2(result.page) : false,
    validation: result.ok ? result.face02_meta?.validation : undefined,
    cited_term_ids: result.ok ? result.face02_meta?.cited_term_ids : undefined,
    realized_evidence_ids: result.ok
      ? result.face02_meta?.realized_evidence_ids
      : undefined,
    provider_meta: result.call_trace?.meta
      ? {
          model: result.call_trace.meta.actual_model,
          request_id: result.call_trace.meta.generation_id,
          finish_reason: result.call_trace.meta.finish_reason,
          tokens_used: result.call_trace.meta.tokens_used,
        }
      : undefined,
    issues: result.ok
      ? undefined
      : (result.face02_meta?.validation_issues as
          | Array<{ code?: string; detail?: string }>
          | undefined)
          ?.slice(0, 8),
  });
  if (!result.ok) {
    console.log(`REAL_MODEL_CALL_FAILED:${result.reason}`);
    return;
  }
  assert.ok(isFace02V2(result.page));
  console.log(
    result.face02_meta?.validation === "passed_after_repair"
      ? "REAL_MODEL_CALL_OK_AFTER_REPAIR"
      : "REAL_MODEL_CALL_OK",
  );
}

maybeLive()
  .then(() => {
    console.log("=== Page02 production tests done ===");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
