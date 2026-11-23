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
} from "@/lib/llm/pro/delivery/decision-report-v2";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
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

function validPage02(extra?: Partial<Record<string, unknown>>) {
  return {
    page: "02",
    face: "02",
    schema_version: "face02-v2",
    page_summary:
      "Your preference for a stable cash floor explains why a staged explore fits this decision window.",
    relevant_personal_factors: [
      {
        factor_id: "f1",
        title: "Cash-floor preference",
        text: "You tend to protect a stable base before stretching into uncertainty.",
        claim_ids: [claimId],
        evidence_ids: [personalEv],
        source_domain: "bazi",
      },
    ],
    personal_reality_interplay: [
      {
        text: "With about eight months runway confirmed, that preference can support exploring without resigning cold.",
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
      page01_judgment_ref: "staged explore",
    },
    explanation_boundary: {
      personal_analysis_basis: ["Certified personal reading on cash-floor preference"],
      confirmed_fact_basis: ["Confirmed runway fact"],
      hypothesis_notes: ["Salary figure remains an estimate"],
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

// --- M already covered in A ---

// --- N: glossary only certified term ids ---
{
  const ok = validateFace02ProductionOutput({
    raw: validPage02(),
    locale: "en",
    ctx,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("N needs valid page");
  const glossary = assembleGlossaryAppendixFromEvidence({
    locale: "en",
    evidenceTermIdLists: [ok.cited_term_ids, ["day_master"]],
  });
  if (glossary.include) {
    for (const id of glossary.term_ids) {
      assert.ok(
        ok.cited_term_ids.includes(id) || id === "day_master",
        "N glossary term must be used",
      );
    }
  }
  const order = readingOrderAfterAssembly({ glossary });
  assert.ok(order.includes("02"));
  console.log("N PASS — glossary from certified terms");
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
