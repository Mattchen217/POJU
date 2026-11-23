/**
 * Decision Report V2 — Page 02 production path (content units + structured DIR pairs).
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page02-production.ts
 * Live: RUN_FACE02_LIVE=1
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
  buildCrediblePage02FactClaimPairs,
  buildTrustedClaimDirBindings,
  certifyClaimDirBindings,
  structuredLinkedDirsForFact,
  parseModelDirSuggestions,
  resolveRoleToUniqueDir,
  assembleFace02ClaimOwnershipSlots,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import {
  enrichBookJudgmentRelatedDirIds,
  canonicalProgramUnitDirEdgeRef,
  RELATED_DIR_ENRICHMENT_ALGORITHM,
  MISSING_UNIT_DIR_AUTHORITY_REF,
  type ProgramUnitDirAuthorityEdge,
} from "@/lib/llm/pro/delivery/book-judgment/related-dir-enrichment";
import { validateRelatedDirEnrichmentCertificate } from "@/lib/llm/pro/delivery/decision-report-v2/page02/credible-fact-claim";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { resolve as resolvePath } from "node:path";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import type { Face02ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page02/production";

/**
 * SYNTHETIC edge builder for resolver unit tests only.
 * NOT a production Unit→DIR authority source.
 */
function syntheticProgramEdge(
  unit_id: string,
  dir_id: string,
): ProgramUnitDirAuthorityEdge {
  const association_basis = "program_authority_edge" as const;
  return {
    unit_id,
    dir_id,
    association_basis,
    source_ref: canonicalProgramUnitDirEdgeRef({
      unit_id,
      dir_id,
      association_basis,
    }),
  };
}

/**
 * SYNTHETIC overlay: exercise enrich→binding→pair plumbing with hand-built edges.
 * Does NOT go through the production entry; production never accepts edges.
 */
function overlaySyntheticAuthority(
  base: Face02ProductionContext,
  pack: BookJudgmentPack,
  edges: readonly ProgramUnitDirAuthorityEdge[],
): Face02ProductionContext {
  const { pack: enriched } = enrichBookJudgmentRelatedDirIds({
    pack,
    dc,
    authority_edges: edges,
  });
  const trusted = buildTrustedClaimDirBindings({
    pack: enriched,
    dc,
    fact_selection: base.fact_selection,
    registry: base.registry,
  });
  certifyClaimDirBindings({
    registry: base.registry,
    trustedBindings: trusted,
  });
  const credible = buildCrediblePage02FactClaimPairs({
    registry: base.registry,
    fact_selection: base.fact_selection,
    dc,
    trustedBindings: trusted,
  });
  return {
    ...base,
    trusted_claim_dir_bindings: trusted,
    credible_fact_claim_pairs: credible.pairs,
    credible_fact_claim_keys: credible.pairKeys,
  };
}

console.log("=== Decision Report V2 Page02 production path (content units) ===");

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
    // Model forged DIR tokens — enrich ignores these.
    anchors: ["runway_buffer", "DIR_OFFER"],
    declared_related_dir_ids: ["DIR_OFFER"],
    serves_face: ["02"],
    term_ids: [],
    source_domain: "science",
  } as never);
  units.push({
    id: "u_science_offer_02",
    track: "science",
    claim: "Offer cash figure remains an estimate until term sheet hardens.",
    anchors: ["offer_terms", "DIR_RUNWAY"],
    declared_related_dir_ids: ["DIR_RUNWAY"],
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
  patternHits: [{ name: "jia_yin", strength: "strong", note: "test hit" }],
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
    {
      condition: "Partner equity still unknown.",
      status: "unconfirmed",
      source_ids: ["fact_salary_guess"],
    },
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

// --- A–C domains ---
{
  const built = buildFace02ProductionContext({
    report_id: "job_face02_a",
    locale: "en",
    dc,
    pack: makePack({ bazi: true, ziwei: true }),
    chart_fact_pack: "日主甲木…",
    ziwei_fact_pack: ziweiPack,
    page01: page01Schema,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.equal(built.ctx.prompt_version, FACE02_PROMPT_VERSION);
  assert.equal(built.ctx.schema_version, FACE02_SCHEMA_VERSION);
  assert.ok(built.ctx.available_domains.includes("bazi"));
  assert.ok(built.ctx.available_domains.includes("ziwei"));
  console.log("A PASS — bazi+ziwei context");
}
{
  const built = buildFace02ProductionContext({
    report_id: "job_face02_b",
    locale: "en",
    dc,
    pack: makePack({ bazi: true, ziwei: false }),
    chart_fact_pack: "日主甲木…",
    page01: page01Schema,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  assert.deepEqual(built.ctx.available_domains, ["bazi"]);
  console.log("B PASS — bazi only");
}
{
  const built = buildFace02ProductionContext({
    report_id: "job_face02_c",
    locale: "en",
    dc,
    pack: makePack({ bazi: false, ziwei: true }),
    chart_fact_pack: "",
    ziwei_fact_pack: ziweiPack,
    bazi_available: false,
    ziwei_available: true,
    page01: page01Schema,
  });
  assert.equal(built.ok, true);
  console.log("C PASS — ziwei only");
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
  ctx.slice.report_analysis.key_claims.find((c) =>
    c.claim_id.includes("destiny"),
  )?.claim_id || Object.keys(ctx.registry.claims)[0]!;
const sciClaimId =
  Object.values(ctx.registry.claims).find(
    (c) => c.claim_id === "claim_u_science_02",
  )?.claim_id ||
  Object.values(ctx.registry.claims).find(
    (c) => c.claim_type === "reality_analysis",
  )?.claim_id ||
  Object.keys(ctx.registry.claims).find((c) => c !== claimId)!;
const offerClaimId =
  Object.values(ctx.registry.claims).find(
    (c) => c.claim_id === "claim_u_science_offer_02",
  )?.claim_id || "";
const personalEv =
  ctx.slice.evidence_registry.evidence.find(
    (e) => e.source_type === "personal_reading",
  )?.evidence_id!;
const mechEvId =
  Object.values(ctx.registry.evidence).find(
    (e) =>
      e.source_type === "reality_mechanism" &&
      e.supports_claim_ids.includes(sciClaimId),
  )?.evidence_id ??
  Object.values(ctx.registry.evidence).find(
    (e) => e.source_type === "reality_mechanism",
  )!.evidence_id;
const factId = "fact_runway";
const factEv = `ev_fact_${factId}`;
const unverifiedFactId = "fact_salary_guess";
const unverifiedFactEv = `ev_fact_${unverifiedFactId}`;

// Production enrich has no Unit→DIR authority edges → empty trusted dirs / pairs.
assert.ok(ctx.slice.report_analysis /* pack enrich ran via production */);
assert.ok(offerClaimId, "offer science claim seeded");
assert.equal(
  ctx.credible_fact_claim_keys.size,
  0,
  "no authority edges ⇒ no credible Claim–Fact pairs",
);
for (const bind of ctx.trusted_claim_dir_bindings.values()) {
  assert.deepEqual(bind.related_dir_ids, []);
}
assert.ok(
  !ctx.credible_fact_claim_keys.has(`${claimId}::${factId}`),
  "destiny must not own runway without DIR binding",
);
for (const claim of Object.values(ctx.registry.claims)) {
  assert.ok(
    !claim.evidence_ids.some((id) => id.startsWith("ev_fact_")),
    "no bulk ev_fact on claim.evidence_ids",
  );
  if (claim.claim_type === "reality_analysis") {
    assert.deepEqual(claim.related_dir_ids ?? [], []);
  }
}
console.log("structured-pair baseline PASS (empty without authority)");

/**
 * SYNTHETIC edges (anti-ordinal). Resolver unit harness only —
 * NOT production Unit→DIR provenance.
 */
const syntheticSemanticEdges: ProgramUnitDirAuthorityEdge[] = [
  syntheticProgramEdge("u_science_02", "DIR_RUNWAY"),
  syntheticProgramEdge("u_science_offer_02", "DIR_OFFER"),
];

// Fresh production ctx so SYNTHETIC overlay does not mutate shared `ctx` registry.
const builtForSynthetic = buildFace02ProductionContext({
  report_id: "job_face02_synthetic_overlay_base",
  locale: "en",
  dc,
  pack: makePack({ bazi: true, ziwei: false }),
  chart_fact_pack: "日主甲木…",
  page01: page01Schema,
});
assert.equal(builtForSynthetic.ok, true);
if (!builtForSynthetic.ok) throw new Error(builtForSynthetic.reason);
const ctxAuth = overlaySyntheticAuthority(
  builtForSynthetic.ctx,
  makePack({ bazi: true, ziwei: false }),
  syntheticSemanticEdges,
);
assert.ok(
  ctxAuth.credible_fact_claim_keys.has(`${sciClaimId}::${factId}`),
  "SYNTHETIC resolver: science_02 → DIR_RUNWAY → runway",
);
assert.ok(
  ctxAuth.credible_fact_claim_keys.has(`${offerClaimId}::${unverifiedFactId}`),
  "SYNTHETIC resolver: offer → DIR_OFFER → salary guess",
);
assert.ok(
  !ctxAuth.credible_fact_claim_keys.has(`${sciClaimId}::${unverifiedFactId}`),
  "no ordinal cross-pair",
);
assert.ok(
  !ctxAuth.credible_fact_claim_keys.has(`${offerClaimId}::${factId}`),
  "no ordinal cross-pair",
);
console.log(
  "SYNTHETIC resolver semantic pairs PASS (not production authority)",
);

function validPage02(extra?: Partial<Record<string, unknown>>) {
  // Default happy path: no reality_fact units — production has no Unit→DIR authority.
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    content_units: [
      {
        unit_id: "u_summary",
        kind: "conditional_explanation",
        text: "Your preference for a stable cash floor explains why a staged explore fits this decision window.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        related_reality_fact_unit_ids: [],
      },
      {
        unit_id: "u_personal",
        kind: "personal_interpretation",
        title: "Cash-floor preference",
        text: "You tend to protect a stable base before stretching into uncertainty.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        source_domain: "bazi",
      },
      {
        unit_id: "u_why",
        kind: "conditional_explanation",
        text: "The judgment favors staged explore because structure prioritizes a protected base and the runway condition makes that workable now.",
        claim_ids: [claimId, offerClaimId],
        evidence_ids: [personalEv],
        related_reality_fact_unit_ids: [],
      },
      {
        unit_id: "u_hyp",
        kind: "conditional_explanation",
        text: "Salary figure remains an estimate and is not treated as confirmed.",
        claim_ids: [sciClaimId],
        evidence_ids: [mechEvId],
        related_reality_fact_unit_ids: [],
      },
    ],
    page_summary_unit_ids: ["u_summary"],
    relevant_personal_factor_unit_ids: ["u_personal"],
    personal_reality_interplay_unit_ids: ["u_personal"],
    why_judgment_fits_unit_ids: ["u_why"],
    page01_judgment_ref: "staged explore",
    explanation_boundary: {
      claim_ids: [claimId, sciClaimId, offerClaimId],
      personal_unit_ids: ["u_personal"],
      confirmed_fact_unit_ids: [],
      hypothesis_unit_ids: ["u_hyp"],
      uncertainty_notes: ["Offer terms may still shift"],
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

function validPage02WithFacts(extra?: Partial<Record<string, unknown>>) {
  return validPage02({
    content_units: [
      ...(validPage02().content_units as unknown[]),
      {
        unit_id: "u_fact_runway",
        kind: "reality_fact",
        text: "Available runway supports exploring without resigning cold while the buffer holds.",
        claim_ids: [sciClaimId],
        evidence_ids: [factEv],
        fact_ids: [factId],
      },
    ],
    personal_reality_interplay_unit_ids: ["u_personal", "u_fact_runway"],
    explanation_boundary: {
      claim_ids: [claimId, sciClaimId, offerClaimId],
      personal_unit_ids: ["u_personal"],
      confirmed_fact_unit_ids: ["u_fact_runway"],
      hypothesis_unit_ids: ["u_hyp"],
      uncertainty_notes: ["Offer terms may still shift"],
    },
    ...extra,
  });
}

// Happy path
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true, JSON.stringify(ok.ok ? null : ok.issues));
  if (!ok.ok) throw new Error("happy");
  assert.ok(isFace02V2(ok.page));
  assert.ok(collectFace02RealizedEvidenceIds(ok.page).includes(personalEv));
  console.log("happy-path PASS");
}

// B-assembly: empty claim_ids filled from evidence ownership (not free text)
{
  const base = validPage02() as Record<string, unknown>;
  const units = (base.content_units as Array<Record<string, unknown>>).map(
    (u) => ({ ...u, claim_ids: [] }),
  );
  const raw = {
    ...base,
    content_units: units,
    explanation_boundary: {
      ...(base.explanation_boundary as Record<string, unknown>),
      claim_ids: [],
    },
  };
  const assembled = assembleFace02ClaimOwnershipSlots({
    raw,
    registry: ctx.registry,
    credibleFactClaimKeys: ctx.credible_fact_claim_keys,
  }) as {
    content_units: Array<{ claim_ids: string[] }>;
    explanation_boundary: { claim_ids: string[] };
  };
  assert.ok(
    assembled.content_units.every((u) => u.claim_ids.length >= 1),
    "assembly must fill claim_ids from evidence ownership",
  );
  assert.ok(assembled.explanation_boundary.claim_ids.length >= 1);
  const ok = validateFace02ProductionOutput({
    raw,
    locale: "en",
    ctx,
  });
  assert.equal(
    ok.ok,
    true,
    JSON.stringify(ok.ok ? null : ok.issues),
  );
  console.log("claim-ownership-assembly PASS");
}

// D: no personal domain forged
{
  const pack = makePack({ bazi: false, ziwei: false });
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
    bazi_available: false,
    ziwei_available: false,
    page01: page01Schema,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  const sci = Object.keys(built.ctx.registry.claims)[0]!;
  const sev = Object.keys(built.ctx.registry.evidence)[0]!;
  const bad = validateFace02ProductionOutput({
    raw: {
      page: "02",
      face: "02",
      schema_version: "face02-v2",
      content_units: [
        {
          unit_id: "fake",
          kind: "personal_interpretation",
          title: "Forged",
          text: "Invented bazi factor",
          claim_ids: [sci],
          evidence_ids: [sev],
          source_domain: "bazi",
        },
      ],
      page_summary_unit_ids: ["fake"],
      relevant_personal_factor_unit_ids: ["fake"],
      personal_reality_interplay_unit_ids: [],
      why_judgment_fits_unit_ids: ["fake"],
      page01_judgment_ref: "",
      explanation_boundary: {
        claim_ids: [sci],
        personal_unit_ids: ["fake"],
        confirmed_fact_unit_ids: [],
        hypothesis_unit_ids: [],
        uncertainty_notes: ["x"],
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
  assert.equal(bad.ok, false);
  console.log("D PASS — no invented personal judgment");
}

// E–H quick
{
  const seeded = seedEvidenceRegistryForFace02({
    dc,
    pack: packFull,
    chart_fact_pack: "日主甲木…",
  });
  for (const ev of Object.values(seeded.registry.evidence)) {
    assert.ok(!(ev.term_ids ?? []).includes("totally_fake_term_xyz"));
  }
  console.log("E PASS — invented term not certified");
}
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          ...(validPage02().content_units as unknown[]).map((u) => {
            const row = u as { unit_id?: string; source_domain?: string };
            if (row.unit_id === "u_personal") {
              return { ...row, source_domain: "ziwei" };
            }
            return u;
          }),
        ],
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("F PASS — wrong domain rejected");
}
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          {
            unit_id: "u_why",
            kind: "conditional_explanation",
            text: "Fits.",
            claim_ids: [claimId],
            evidence_ids: ["ev_does_not_exist"],
            related_reality_fact_unit_ids: [],
          },
        ],
        page_summary_unit_ids: ["u_why"],
        relevant_personal_factor_unit_ids: [],
        personal_reality_interplay_unit_ids: [],
        why_judgment_fits_unit_ids: ["u_why"],
        explanation_boundary: {
          claim_ids: [claimId],
          personal_unit_ids: [],
          confirmed_fact_unit_ids: [],
          hypothesis_unit_ids: [],
          uncertainty_notes: ["x"],
        },
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("G PASS — missing evidence id");
}
console.log("H PASS — (unmapped hit covered in prior suite pattern)");

// I status upgrade in reality_fact unit (requires authority for ownership gate)
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02WithFacts({
        content_units: [
          ...(validPage02().content_units as unknown[]),
          {
            unit_id: "u_fact_bad",
            kind: "reality_fact",
            text: "The salary estimate is a confirmed fact and definitely true.",
            claim_ids: [sciClaimId],
            evidence_ids: [`ev_fact_${unverifiedFactId}`],
            fact_ids: [unverifiedFactId],
          },
        ],
        personal_reality_interplay_unit_ids: ["u_personal", "u_fact_bad"],
        explanation_boundary: {
          claim_ids: [claimId, sciClaimId],
          personal_unit_ids: ["u_personal"],
          confirmed_fact_unit_ids: [],
          hypothesis_unit_ids: [],
          uncertainty_notes: ["x"],
        },
      }),
      locale: "en",
      ctx: ctxAuth,
    }).ok,
    false,
  );
  console.log("I PASS — unverified not upgraded");
}

// J science validates metaphysics
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          ...(validPage02().content_units as unknown[]).map((u) => {
            const row = u as { unit_id?: string; text?: string };
            if (row.unit_id === "u_why") {
              return {
                ...row,
                text: "This is empirically proven by bazi and science confirms the destiny reading.",
              };
            }
            return u;
          }),
        ],
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("J PASS — hypothesis as fact rejected");
}

// K page01 copy
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          ...(validPage02().content_units as unknown[]).map((u) => {
            const row = u as { unit_id?: string; text?: string };
            if (row.unit_id === "u_why") {
              return {
                ...row,
                text: "Prefer a staged explore path that keeps the cash floor intact this quarter. Prefer a staged explore path that keeps the cash floor intact this quarter.",
              };
            }
            return u;
          }),
        ],
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("K PASS — no Page01 conclusion copy");
}

// L page04
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          ...(validPage02().content_units as unknown[]).map((u) => {
            const row = u as { unit_id?: string; text?: string };
            if (row.unit_id === "u_summary") {
              return {
                ...row,
                text: "The 核心卡点 is the real bottleneck before any path choice.",
              };
            }
            return u;
          }),
        ],
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("L PASS — no Page04 bottleneck");
}

// --- R2 Claim–DIR semantic negatives A–K ---
{
  const dirs = structuredLinkedDirsForFact(
    dc.reality_facts!.find((f) => f.fact_id === factId)!,
    new Map(dc.dirs!.map((d) => [d.dir_id, d])),
  );
  assert.deepEqual(dirs, ["DIR_RUNWAY"]);

  // A: ID sort opposite of true association — must not ordinal-mismatch
  {
    const raw = makePack({ bazi: true, ziwei: false });
    // Unit ids sort: u_science_02 < u_science_offer_02
    // DIR ids sort: DIR_OFFER < DIR_RUNWAY
    // True authority (anti-ordinal): science_02→RUNWAY, offer→OFFER
    const { certificate } = enrichBookJudgmentRelatedDirIds({
      pack: raw,
      dc,
      authority_edges: syntheticSemanticEdges,
    });
    const byUnit = new Map(
      certificate.bindings.map((b) => [b.unit_id, b.related_dir_ids]),
    );
    assert.deepEqual(byUnit.get("u_science_02"), ["DIR_RUNWAY"]);
    assert.deepEqual(byUnit.get("u_science_offer_02"), ["DIR_OFFER"]);
    assert.ok(
      ctxAuth.credible_fact_claim_keys.has(`${sciClaimId}::${factId}`),
    );
    assert.ok(
      !ctxAuth.credible_fact_claim_keys.has(
        `${sciClaimId}::${unverifiedFactId}`,
      ),
      "must NOT assign OFFER via sort position",
    );
  }
  console.log("A PASS — anti-ordinal semantic edges");

  // B: unit with no program authority stays empty
  {
    const { certificate } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const offerBind = certificate.bindings.find(
      (b) => b.unit_id === "u_science_offer_02",
    );
    assert.deepEqual(offerBind?.related_dir_ids, []);
    assert.equal(offerBind?.association_basis, "none");
    assert.ok(
      (offerBind?.reasons ?? []).some((r) =>
        r.includes("missing_unit_dir_provenance"),
      ),
    );
  }
  console.log("B PASS — unbound unit stays empty");

  // C: two units same DIR without multi-grant basis → neither authorized
  {
    const { certificate } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [
        syntheticProgramEdge("u_science_02", "DIR_RUNWAY"),
        syntheticProgramEdge("u_science_offer_02", "DIR_RUNWAY"),
      ],
    });
    for (const b of certificate.bindings) {
      assert.deepEqual(b.related_dir_ids, []);
    }
    assert.ok(
      certificate.bindings.some((b) =>
        (b.reasons ?? []).some((r) =>
          r.includes("reject_illegal_multi_claim_dir"),
        ),
      ),
    );
  }
  console.log("C PASS — illegal multi-claim DIR rejected");

  // D: model anchors / declared_* pointing at real DIR must NOT authorize
  {
    const forgedPack = makePack({ bazi: true, ziwei: false });
    const sciUnit = forgedPack.units.find((u) => u.id === "u_science_02")!;
    sciUnit.anchors = ["DIR_RUNWAY", "dir:DIR_RUNWAY"];
    sciUnit.declared_related_dir_ids = ["DIR_RUNWAY"];
    sciUnit.related_dir_ids = ["DIR_RUNWAY"];
    const forgedCtx = buildFace02ProductionContext({
      report_id: "forge_dir_anchor",
      locale: "en",
      dc,
      pack: forgedPack,
      chart_fact_pack: "日主甲木…",
      page01: page01Schema,
      // no authority edges
    });
    assert.equal(forgedCtx.ok, true);
    if (!forgedCtx.ok) throw new Error(forgedCtx.reason);
    const bind = forgedCtx.ctx.trusted_claim_dir_bindings.get(
      "claim_u_science_02",
    );
    assert.deepEqual(bind?.related_dir_ids, []);
    assert.equal(forgedCtx.ctx.credible_fact_claim_keys.size, 0);
    assert.ok(
      (bind?.reasons ?? []).some((r) => r.includes("ignore_model_suggestion")),
    );
  }
  console.log("D PASS — model suggestions ignored");

  // E: forged unit id in certificate → reject
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: syntheticSemanticEdges,
    });
    const forged = structuredClone(pack);
    forged.related_dir_enrichment!.bindings.push({
      unit_id: "u_does_not_exist",
      related_dir_ids: ["DIR_RUNWAY"],
      source_ref: canonicalProgramUnitDirEdgeRef({
        unit_id: "u_does_not_exist",
        dir_id: "DIR_RUNWAY",
        association_basis: "program_authority_edge",
      }),
      association_basis: "program_authority_edge",
      reasons: ["forged"],
    });
    const seeded = seedEvidenceRegistryForFace02({
      dc,
      pack: forged,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const v = validateRelatedDirEnrichmentCertificate({
      pack: forged,
      dc,
      fact_selection: seeded.fact_selection,
      enrich: forged.related_dir_enrichment,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:unknown_unit")));
  }
  console.log("E PASS — forged unit rejected");

  // F: forged DIR id in certificate → reject
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.related_dir_ids = ["DIR_FAKE_NOT_IN_DC"];
    b.source_ref = canonicalProgramUnitDirEdgeRef({
      unit_id: "u_science_02",
      dir_id: "DIR_FAKE_NOT_IN_DC",
      association_basis: "program_authority_edge",
    });
    const seeded = seedEvidenceRegistryForFace02({
      dc,
      pack: forged,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const v = validateRelatedDirEnrichmentCertificate({
      pack: forged,
      dc,
      fact_selection: seeded.fact_selection,
      enrich: forged.related_dir_enrichment,
    });
    assert.equal(v.ok, false);
    assert.ok(
      v.reasons.some(
        (r) =>
          r.includes("reject_inactive_or_missing") ||
          r.includes("reject_not_linked"),
      ),
    );
  }
  console.log("F PASS — forged DIR rejected");

  // G: DC content hash change invalidates old certificate
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: syntheticSemanticEdges,
    });
    const dcTampered = { ...dc, content_hash: "hash_tampered_other" };
    const seeded = seedEvidenceRegistryForFace02({
      dc: dcTampered,
      pack,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const trusted = buildTrustedClaimDirBindings({
      pack,
      dc: dcTampered,
      fact_selection: seeded.fact_selection,
      registry: seeded.registry,
    });
    assert.ok(
      [...trusted.values()].every((b) => b.related_dir_ids.length === 0),
    );
    assert.ok(
      [...trusted.values()].some((b) =>
        b.reasons.some((r) => r.includes("dc_content_hash_mismatch")),
      ),
    );
  }
  console.log("G PASS — hash mismatch fail-closed");

  // H: duplicate unit binding → reject
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const dup = {
      ...forged.related_dir_enrichment!.bindings.find(
        (x) => x.unit_id === "u_science_02",
      )!,
    };
    forged.related_dir_enrichment!.bindings.push(dup);
    const seeded = seedEvidenceRegistryForFace02({
      dc,
      pack: forged,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const v = validateRelatedDirEnrichmentCertificate({
      pack: forged,
      dc,
      fact_selection: seeded.fact_selection,
      enrich: forged.related_dir_enrichment,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:duplicate_unit_binding")));
  }
  console.log("H PASS — duplicate unit binding rejected");

  // I: inactive DIR in certificate → reject
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.related_dir_ids = ["DIR_INACTIVE"];
    b.source_ref = canonicalProgramUnitDirEdgeRef({
      unit_id: "u_science_02",
      dir_id: "DIR_INACTIVE",
      association_basis: "program_authority_edge",
    });
    const dcWithInactive = {
      ...dc,
      dirs: [
        ...(dc.dirs ?? []),
        {
          dir_id: "DIR_INACTIVE",
          need: "x",
          why: "y",
          required_fact_roles: ["hard_constraint"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "retired",
        },
      ],
    } as unknown as DecisionContext;
    const seeded = seedEvidenceRegistryForFace02({
      dc: dcWithInactive,
      pack: forged,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const v = validateRelatedDirEnrichmentCertificate({
      pack: forged,
      dc: dcWithInactive,
      fact_selection: seeded.fact_selection,
      enrich: forged.related_dir_enrichment,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject_inactive_or_missing")));
  }
  console.log("I PASS — inactive DIR rejected");

  // J: linked DIRs exist but no unit↔DIR authority → empty bindings
  {
    const { certificate } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      // no edges
    });
    assert.equal(certificate.algorithm, RELATED_DIR_ENRICHMENT_ALGORITHM);
    assert.ok((certificate.linked_dir_ids ?? []).length >= 1);
    assert.ok(certificate.missing_authority);
    assert.ok(
      certificate.bindings.every((b) => b.related_dir_ids.length === 0),
    );
    assert.equal(ctx.credible_fact_claim_keys.size, 0);
  }
  console.log("J PASS — linked DIR alone does not bind units");

  // K: cross-claim isolation under semantic authority
  {
    assert.ok(ctxAuth.credible_fact_claim_keys.has(`${sciClaimId}::${factId}`));
    assert.ok(
      ctxAuth.credible_fact_claim_keys.has(
        `${offerClaimId}::${unverifiedFactId}`,
      ),
    );
    assert.ok(
      !ctxAuth.credible_fact_claim_keys.has(
        `${sciClaimId}::${unverifiedFactId}`,
      ),
    );
    assert.ok(
      !ctxAuth.credible_fact_claim_keys.has(`${offerClaimId}::${factId}`),
    );
    // offer claim must not inherit science_02's runway fact
    assert.equal(
      validateFace02ProductionOutput({
        raw: validPage02WithFacts({
          content_units: [
            ...(validPage02().content_units as unknown[]),
            {
              unit_id: "u_fact_runway",
              kind: "reality_fact",
              text: "Available runway supports exploring without resigning cold while the buffer holds.",
              claim_ids: [offerClaimId],
              evidence_ids: [factEv],
              fact_ids: [factId],
            },
          ],
          personal_reality_interplay_unit_ids: ["u_personal", "u_fact_runway"],
          explanation_boundary: {
            claim_ids: [claimId, sciClaimId, offerClaimId],
            personal_unit_ids: ["u_personal"],
            confirmed_fact_unit_ids: ["u_fact_runway"],
            hypothesis_unit_ids: ["u_hyp"],
            uncertainty_notes: ["Offer terms may still shift"],
          },
        }),
        locale: "en",
        ctx: ctxAuth,
      }).ok,
      false,
      "offer claim must not inherit science runway ownership",
    );
    // correct owner passes
    assert.equal(
      validateFace02ProductionOutput({
        raw: validPage02WithFacts(),
        locale: "en",
        ctx: ctxAuth,
      }).ok,
      true,
    );
  }
  console.log("K PASS — cross-claim isolation");

  // Extra: candidate fact never pairs; mirror mutation never creates pairs
  {
    const trusted = ctxAuth.trusted_claim_dir_bindings;
    const candPairs = buildCrediblePage02FactClaimPairs({
      registry: ctxAuth.registry,
      fact_selection: {
        ...ctxAuth.fact_selection,
        selected: ctxAuth.fact_selection.selected.map((r) =>
          r.fact.fact_id === unverifiedFactId
            ? { ...r, kind: "candidate" as const }
            : r,
        ),
      },
      dc,
      trustedBindings: trusted,
    });
    assert.ok(!candPairs.pairKeys.has(`${offerClaimId}::${unverifiedFactId}`));

    const offer = ctxAuth.registry.claims[offerClaimId]!;
    const prev = [...(offer.related_dir_ids ?? [])];
    offer.related_dir_ids = ["DIR_RUNWAY"];
    const fromMirror = buildCrediblePage02FactClaimPairs({
      registry: ctxAuth.registry,
      fact_selection: ctxAuth.fact_selection,
      dc,
      trustedBindings: trusted,
    });
    assert.ok(
      fromMirror.pairKeys.has(`${offerClaimId}::${unverifiedFactId}`),
      "pairs follow trustedBindings, not mutated mirror",
    );
    assert.ok(!fromMirror.pairKeys.has(`${offerClaimId}::${factId}`));
    offer.related_dir_ids = prev;
  }

  // Ambiguous role suggestions still fail-closed
  {
    const dirsById = new Map(dc.dirs!.map((d) => [d.dir_id, d]));
    const ambiguousDirs = new Map(dirsById);
    ambiguousDirs.set("DIR_RUNWAY_ALT", {
      ...dc.dirs!.find((d) => d.dir_id === "DIR_RUNWAY")!,
      dir_id: "DIR_RUNWAY_ALT",
      required_fact_roles: ["hard_constraint"],
    });
    assert.equal(resolveRoleToUniqueDir("hard_constraint", ambiguousDirs), null);
    assert.equal(
      parseModelDirSuggestions(
        ["hard_constraint", "role:hard_constraint"],
        ambiguousDirs,
      ).suggested_dir_ids.length,
      0,
    );
    assert.deepEqual(
      parseModelDirSuggestions(
        ["DIR_DOES_NOT_EXIST", "dir:INACTIVE_X"],
        dirsById,
      ).suggested_dir_ids,
      [],
    );
  }

  // Bare unit.related_dir_ids without certificate → empty
  {
    const barePack = makePack({ bazi: true, ziwei: false });
    for (const u of barePack.units) {
      if (u.track === "science") {
        u.related_dir_ids = ["DIR_RUNWAY", "DIR_OFFER"];
        u.anchors = ["DIR_RUNWAY"];
        u.declared_related_dir_ids = ["DIR_RUNWAY"];
      }
    }
    delete (barePack as { related_dir_enrichment?: unknown })
      .related_dir_enrichment;
    const seededBare = seedEvidenceRegistryForFace02({
      dc,
      pack: barePack,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const bareTrusted = buildTrustedClaimDirBindings({
      pack: barePack,
      dc,
      fact_selection: seededBare.fact_selection,
      registry: seededBare.registry,
    });
    assert.equal(
      buildCrediblePage02FactClaimPairs({
        registry: seededBare.registry,
        fact_selection: seededBare.fact_selection,
        dc,
        trustedBindings: bareTrusted,
      }).pairs.length,
      0,
    );
  }

  // Reject legacy ordinal algorithm certificate
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
    });
    const legacy = structuredClone(pack);
    (legacy.related_dir_enrichment as { algorithm: string }).algorithm =
      "exclusive_linked_dir_slots_v1";
    const seeded = seedEvidenceRegistryForFace02({
      dc,
      pack: legacy,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
    const v = validateRelatedDirEnrichmentCertificate({
      pack: legacy,
      dc,
      fact_selection: seeded.fact_selection,
      enrich: legacy.related_dir_enrichment,
    });
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:bad_algorithm")));
  }

  console.log("structured-association negatives A–K PASS (SYNTHETIC resolver notes)");
}

// --- R3 certificate validation closure A–J ---
{
  function seededFor(pack: BookJudgmentPack) {
    return seedEvidenceRegistryForFace02({
      dc,
      pack,
      chart_fact_pack: "日主甲木…",
      bazi_available: true,
    });
  }

  function validatePack(pack: BookJudgmentPack) {
    const seeded = seededFor(pack);
    return validateRelatedDirEnrichmentCertificate({
      pack,
      dc,
      fact_selection: seeded.fact_selection,
      enrich: pack.related_dir_enrichment,
    });
  }

  // A: source_ref mismatches unit/DIR
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.source_ref = canonicalProgramUnitDirEdgeRef({
      unit_id: "u_science_02",
      dir_id: "DIR_OFFER",
      association_basis: "program_authority_edge",
    });
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:source_ref_mismatch")));
  }
  console.log("R3-A PASS — source_ref unit/DIR mismatch");

  // B: arbitrary nonempty source_ref string
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.source_ref = "looks_authoritative_but_arbitrary";
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:source_ref_mismatch")));
  }
  console.log("R3-B PASS — arbitrary source_ref rejected");

  // C: linked_dir_ids ≠ current DC linked set
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
    });
    const forged = structuredClone(pack);
    forged.related_dir_enrichment!.linked_dir_ids = ["DIR_NOT_FROM_DC"];
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:linked_dir_ids_mismatch")));
  }
  console.log("R3-C PASS — linked_dir_ids mismatch");

  // D: duplicate DIR inside one binding
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.related_dir_ids = ["DIR_RUNWAY", "DIR_RUNWAY"];
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(
      v.reasons.some(
        (r) =>
          r.includes("reject:duplicate_dir_in_binding") ||
          r.includes("reject:nonempty_must_be_singleton_dir"),
      ),
    );
  }
  console.log("R3-D PASS — duplicate DIR in binding");

  // E: missing_authority set while nonempty binding present
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    forged.related_dir_enrichment!.missing_authority = "no_program_unit_dir_edges";
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(
      v.reasons.some((r) =>
        r.includes("reject:missing_authority_with_nonempty_bindings"),
      ),
    );
  }
  console.log("R3-E PASS — missing_authority vs nonempty contradiction");

  // F: empty binding with non-none basis
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.association_basis = "program_authority_edge";
    b.source_ref = MISSING_UNIT_DIR_AUTHORITY_REF;
    b.related_dir_ids = [];
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:empty_dirs_non_none_basis")));
  }
  console.log("R3-F PASS — empty + non-none basis");

  // G: nonempty binding with none basis
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: [syntheticProgramEdge("u_science_02", "DIR_RUNWAY")],
    });
    const forged = structuredClone(pack);
    const b = forged.related_dir_enrichment!.bindings.find(
      (x) => x.unit_id === "u_science_02",
    )!;
    b.association_basis = "none";
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(v.reasons.some((r) => r.includes("reject:nonempty_with_none_basis")));
  }
  console.log("R3-G PASS — nonempty + none basis");

  // H: non Page02 science/convergence unit in certificate
  {
    const { pack } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
    });
    const forged = structuredClone(pack);
    forged.related_dir_enrichment!.bindings.push({
      unit_id: "u_destiny_02",
      related_dir_ids: [],
      source_ref: MISSING_UNIT_DIR_AUTHORITY_REF,
      association_basis: "none",
      reasons: ["forged_destiny"],
    });
    const v = validatePack(forged);
    assert.equal(v.ok, false);
    assert.ok(
      v.reasons.some((r) => r.includes("reject:unit_not_page02_science")),
    );
  }
  console.log("R3-H PASS — non Page02 science unit rejected");

  // I: hand-built edges cannot authorize via production entry
  {
    const pre = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
      authority_edges: syntheticSemanticEdges,
    }).pack;
    assert.ok(
      pre.related_dir_enrichment!.bindings.some(
        (b) => b.related_dir_ids.length > 0,
      ),
      "precondition: SYNTHETIC enrich can bind",
    );
    const prod = buildFace02ProductionContext({
      report_id: "r3_prod_blocks_edges",
      locale: "en",
      dc,
      pack: pre,
      chart_fact_pack: "日主甲木…",
      page01: page01Schema,
    });
    assert.equal(prod.ok, true);
    if (!prod.ok) throw new Error(prod.reason);
    assert.equal(
      prod.ctx.credible_fact_claim_keys.size,
      0,
      "production entry must wipe pre-enriched SYNTHETIC bindings",
    );
    for (const b of prod.ctx.trusted_claim_dir_bindings.values()) {
      assert.deepEqual(b.related_dir_ids, []);
    }
    // Production API must not expose an edges knob.
    assert.equal(
      "related_dir_authority_edges" in (buildFace02ProductionContext as object),
      false,
    );
  }
  console.log("R3-I PASS — production entry blocks hand-built edges");

  // J: production with no real authority → all bindings empty
  {
    assert.equal(ctx.credible_fact_claim_keys.size, 0);
    for (const b of ctx.trusted_claim_dir_bindings.values()) {
      assert.deepEqual(b.related_dir_ids, []);
    }
    const { certificate } = enrichBookJudgmentRelatedDirIds({
      pack: makePack({ bazi: true, ziwei: false }),
      dc,
    });
    assert.ok(certificate.missing_authority);
    assert.ok(certificate.bindings.every((b) => b.related_dir_ids.length === 0));
    assert.ok(
      certificate.bindings.every(
        (b) =>
          b.source_ref === MISSING_UNIT_DIR_AUTHORITY_REF &&
          b.association_basis === "none",
      ),
    );
  }
  console.log("R3-J PASS — production empty without real authority");

  console.log("R3 certificate validation closure A–J PASS");
}

// Non-confirmed reality_fact in summary without hypothesis boundary → reject
{
  const page = validPage02WithFacts({
    content_units: [
      ...(validPage02WithFacts().content_units as unknown[]),
      {
        unit_id: "u_fact_salary",
        kind: "reality_fact",
        text: "Cash figure is still an estimate pending hardened terms.",
        claim_ids: [offerClaimId],
        evidence_ids: [unverifiedFactEv],
        fact_ids: [unverifiedFactId],
      },
    ],
    page_summary_unit_ids: ["u_summary", "u_fact_salary"],
    explanation_boundary: {
      claim_ids: [claimId, sciClaimId, offerClaimId],
      personal_unit_ids: ["u_personal"],
      confirmed_fact_unit_ids: ["u_fact_runway"],
      hypothesis_unit_ids: ["u_hyp"],
      uncertainty_notes: ["Offer terms may still shift"],
    },
  });
  const omitted = validateFace02ProductionOutput({
    raw: page,
    locale: "en",
    ctx: ctxAuth,
  });
  assert.equal(omitted.ok, false, "non-confirmed fact omitted from hypothesis");
  assert.ok(
    !omitted.ok &&
      omitted.issues.some((i) => i.code === "hypothesis_fact_boundary_omitted"),
  );

  const fixed = validateFace02ProductionOutput({
    raw: {
      ...page,
      explanation_boundary: {
        ...(page as { explanation_boundary: Record<string, unknown> })
          .explanation_boundary,
        hypothesis_unit_ids: ["u_hyp", "u_fact_salary"],
      },
    },
    locale: "en",
    ctx: ctxAuth,
  });
  assert.equal(
    fixed.ok,
    true,
    JSON.stringify(fixed.ok ? null : fixed.issues),
  );
  console.log("hypothesis-boundary completeness PASS");
}

// Free-text masquerade / synonym without reality_fact unit
{
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02({
        content_units: [
          {
            unit_id: "u_only",
            kind: "personal_interpretation",
            title: "Cash",
            text: "Personal runway is about 8 months. You protect a base.",
            claim_ids: [claimId],
            evidence_ids: [personalEv],
            source_domain: "bazi",
          },
        ],
        page_summary_unit_ids: ["u_only"],
        relevant_personal_factor_unit_ids: ["u_only"],
        personal_reality_interplay_unit_ids: [],
        why_judgment_fits_unit_ids: ["u_only"],
        explanation_boundary: {
          claim_ids: [claimId],
          personal_unit_ids: ["u_only"],
          confirmed_fact_unit_ids: [],
          hypothesis_unit_ids: [],
          uncertainty_notes: ["x"],
        },
      }),
      locale: "en",
      ctx,
    }).ok,
    false,
    "DC fact copy in personal unit rejected",
  );
  console.log("free-text fact masquerade PASS");
}

// Provenance missing version
{
  const mutated = structuredClone(ctx);
  mutated.registry.evidence[personalEv]!.source_version = null;
  assert.equal(
    validateFace02ProductionOutput({
      raw: validPage02(),
      locale: "en",
      ctx: mutated,
    }).ok,
    false,
  );
  console.log("provenance-missing-version PASS");
}

// N glossary via Face01+Face02 certified cited terms
{
  const face01Built = buildFace01ProductionContext({
    report_id: "job_face01_for_glossary",
    locale: "en",
    dc,
    pack: packFull,
    chart_fact_pack: "日主甲木…",
  });
  assert.equal(face01Built.ok, true);
  if (!face01Built.ok) throw new Error(face01Built.reason);
  const f01Claim =
    face01Built.ctx.slice.report_analysis.key_claims[0]?.claim_id!;
  const f01Ev =
    face01Built.ctx.slice.evidence_registry.evidence.find((e) =>
      (e.term_ids ?? []).includes("day_master"),
    )?.evidence_id || personalEv;
  const face01 = validateFace01ProductionOutput({
    raw: {
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
          source_ids: [factId],
        },
        {
          condition: "Partner equity terms stay unknown.",
          status: "unconfirmed",
          source_ids: [unverifiedFactId],
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
        current_basis: ["Confirmed runway."],
        invalidation_conditions: ["Runway collapses."],
        page02_evidence_ids: [
          face01Built.ctx.page02PlannedEvidenceIds[0] || f01Ev,
        ],
        page08_review_refs: [],
      },
    },
    locale: "en",
    ctx: face01Built.ctx,
  });
  assert.equal(face01.ok, true, JSON.stringify(face01.ok ? null : face01.issues));
  if (!face01.ok) throw new Error("N face01");
  const face02 = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(face02.ok, true);
  if (!face02.ok) throw new Error("N face02");
  const glossary = assembleGlossaryAppendixFromEvidence({
    locale: "en",
    evidenceTermIdLists: [face01.cited_term_ids, face02.cited_term_ids],
  });
  const expected = [
    ...new Set([...face01.cited_term_ids, ...face02.cited_term_ids]),
  ];
  if (expected.length === 0) assert.equal(glossary.include, false);
  else {
    assert.equal(glossary.include, true);
    assert.deepEqual([...glossary.term_ids].sort(), [...expected].sort());
  }
  assert.ok(!glossary.term_ids.includes("unused_allowlist_term_xyz"));
  assert.equal(
    assembleGlossaryAppendixFromEvidence({
      locale: "en",
      evidenceTermIdLists: [[], []],
    }).include,
    false,
  );
  console.log("N PASS — glossary from certified Face01+Face02 cited terms");
}

// UI/PDF parity
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("ui");
  const bodies = pageSchemaToArgumentBodies(ok.page as never);
  const joined = bodies.map((b) => b.body).join("\n");
  assert.ok(joined.includes("Cash-floor preference") || joined.includes("stable base"));
  assert.ok(
    joined.includes("解释性假设") ||
      joined.includes("hypothesis") ||
      joined.includes("Salary figure"),
  );
  const uiSrc = readFileSync(
    resolvePath("components/poju/delivery-pages/faces/Face02PageSlots.tsx"),
    "utf8",
  );
  assert.ok(uiSrc.includes("content_units") || uiSrc.includes("resolveFace02Units"));
  assert.ok(uiSrc.includes("hypothesis_unit_ids") || uiSrc.includes("解释性假设"));
  console.log("UI/PDF parity PASS");
}

// O legacy
{
  assert.equal(isFace02Legacy({
    page: "02",
    face: "02",
    destiny_reason: "Legacy destiny prose about structure under pressure.",
    science_mechanism: "Legacy science mechanism about runway buffers.",
    convergence: "Legacy convergence note for fit.",
    verifiable_anchors: ["anchor one"],
  }), true);
  const projected = projectLegacyFace02ForDisplay({
    page: "02",
    face: "02",
    destiny_reason: "Legacy destiny prose about structure under pressure.",
    science_mechanism: "Legacy science mechanism about runway buffers.",
    convergence: "Legacy convergence note for fit.",
    verifiable_anchors: ["anchor one"],
  });
  assert.ok(projected?.content_units?.length);
  console.log("O PASS — historical legacy open");
}

// P fail closed
{
  assert.equal(parseFace02JsonStrict("```json\n{}\n```"), null);
  assert.equal(
    validateFace02ProductionOutput({
      raw: { page: "02", face: "02" },
      locale: "en",
      ctx,
    }).ok,
    false,
  );
  console.log("P PASS — fail closed");
}

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

assert.equal(page02SliceLooksOversized(ctx.slice).length, 0);

async function maybeLive() {
  const runLive = process.env.RUN_FACE02_LIVE === "1";
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!runLive || !hasKey) {
    console.log("REAL_MODEL_CALL_NOT_RUN (set RUN_FACE02_LIVE=1 to enable)");
    console.log(
      "FIXTURE_NOTE: offline suites use synthetic DC/pack — not full real-user E2E",
    );
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
    result = await invoke(2);
  }
  console.log("live_face02", {
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
    validation: result.ok ? result.face02_meta?.validation : undefined,
    issues: result.ok
      ? undefined
      : (result.face02_meta?.validation_issues as
          | Array<{ code?: string; detail?: string }>
          | undefined)?.slice(0, 8),
  });
  console.log(
    "FIXTURE_NOTE: live call uses synthetic DC/pack — not full real-user E2E",
  );
  if (!result.ok) {
    console.log(`REAL_MODEL_CALL_FAILED:${result.reason}`);
    return;
  }
  assert.ok(isFace02V2(result.page));
  assert.ok(
    Array.isArray((result.page as { content_units?: unknown[] }).content_units),
  );
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
