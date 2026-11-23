/**
 * Decision Report V2 — Page 01 production-path integration (no deploy).
 * Run: pnpm exec tsx scripts/test-decision-report-v2-page01-production.ts
 *
 * Live model: set RUN_FACE01_LIVE=1 and OPENROUTER_API_KEY (or .env.local).
 * Otherwise prints REAL_MODEL_CALL_NOT_RUN.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assembleFace01Page02References,
  assembleGlossaryAppendixFromEvidence,
  readingOrderAfterAssembly,
  buildFace01ProductionContext,
  buildFace01PromptPair,
  validateFace01ProductionOutput,
  parseFace01JsonStrict,
  page01SliceLooksOversized,
  FACE01_PROMPT_VERSION,
  FACE01_SCHEMA_VERSION,
  isFace01V2,
  isFace01Legacy,
  projectLegacyFace01ForDisplay,
  seedEvidenceRegistryForFace01,
} from "@/lib/llm/pro/delivery/decision-report-v2";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { coercePageSchemaLoose } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

console.log("=== Decision Report V2 Page01 production path ===");

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
  context_id: "dc_face01_prod_test",
  version: 1,
  status: "final",
  content_hash: "hash_face01_prod",
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
    {
      fact_id: "fact_partner_unknown",
      statement: "Partner equity split unknown.",
      status: "unknown",
      verification_level: "none",
      source_stage: "collecting",
      source_turn_id: "t3",
      user_confirmed: false,
      fact_roles: ["option"],
      related_dir_ids: ["DIR_OFFER"],
    },
    {
      fact_id: "fact_noise_hobby",
      statement: "Likes hiking on weekends.",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t4",
      user_confirmed: true,
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
      required_fact_roles: ["job_offer", "option"],
      current_state: "known",
      partial_satisfaction: true,
      agenda_item_ids: [],
      id_lifecycle: "active",
    },
  ],
  conflicts: [
    {
      conflict_id: "c1",
      conflict_field: "equity",
      fact_ids: ["fact_partner_unknown", "fact_salary_guess"],
      statements_snapshot: [],
      source_refs: [],
      state: "open",
      resolution: null,
      user_confirmation: false,
    },
  ],
  hypotheses: [],
} as unknown as DecisionContext;

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_test",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: "2026-01-01T00:00:00Z",
  units: [
    {
      id: "u_destiny_01",
      track: "destiny",
      claim: "Current cycle favors keeping a stable cash floor while testing optionality. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["01", "02"],
      caveat: "Not a timing guarantee.",
      term_ids: ["day_master"],
      source_domain: "bazi",
      source_version: "cfp_test",
    },
    {
      id: "u_science_01",
      track: "science",
      claim: "Eight-month runway supports a staged explore-without-resign path.",
      anchors: ["runway_months"],
      serves_face: ["01", "02"],
      term_ids: [],
      source_domain: "science",
    },
    {
      id: "u_page02_only",
      track: "destiny",
      claim: "Detailed palace tension belongs on page 02. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["02"],
      term_ids: ["day_master"],
      source_domain: "bazi",
      source_version: "cfp_test",
    },
    {
      id: "u_unrelated_08",
      track: "science",
      claim: "Close ritual note for page 08 only.",
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
} as unknown as BookJudgmentPack;

// --- Production context / slice ---
const built = buildFace01ProductionContext({
  report_id: "job_face01_prod_test",
  locale: "en",
  dc,
  pack,
  chart_fact_pack: "日主甲木…",
});
assert.equal(built.ok, true, "buildFace01ProductionContext");
if (!built.ok) throw new Error(built.reason);
const ctx = built.ctx;
assert.equal(ctx.prompt_version, FACE01_PROMPT_VERSION);
assert.equal(ctx.schema_version, FACE01_SCHEMA_VERSION);
assert.ok(ctx.system.includes("决策") || ctx.system.length > 40);
assert.ok(ctx.user.includes("Page01FeedSlice") || ctx.user.includes("reality"));
assert.equal(page01SliceLooksOversized(ctx.slice).length, 0);
assert.deepEqual(ctx.available_domains, ["bazi"]);
assert.ok(ctx.domain_versions.bazi);
assert.ok(
  ctx.slice.reality_context.facts.every(
    (f) => f.selection_kind === "linked" || f.selection_kind === "candidate",
  ),
  "facts carry selection_kind",
);
const destinyEv = ctx.registry.evidence["u_destiny_01"];
assert.ok(destinyEv?.term_ids.includes("day_master"), "destiny term provenance");
assert.deepEqual(
  [...new Set(ctx.slice.evidence_registry.evidence.map((e) => e.evidence_id))].sort(),
  Object.keys(ctx.registry.evidence).sort(),
  "restricted registry matches slice",
);

// Irrelevant face-08 unit must not enter slice evidence
assert.ok(
  !ctx.slice.evidence_registry.evidence.some((e) => e.evidence_id === "u_unrelated_08"),
  "unrelated pack unit excluded",
);
// Page02 planned id retained for cites
assert.ok(
  ctx.page02PlannedEvidenceIds.includes("u_page02_only") ||
    ctx.slice.evidence_registry.evidence.some((e) => e.evidence_id === "u_page02_only") ||
    ctx.page02PlannedEvidenceIds.includes("u_destiny_01"),
  "page02 planned ids present",
);

// Status/verification not upgraded
const salary = ctx.slice.reality_context.facts.find((f) => f.fact_id === "fact_salary_guess");
assert.ok(salary);
assert.equal(salary!.status, "unverified");
assert.equal(salary!.verification, "user_estimate");

// Traceability: every evidence source_id resolvable
for (const ev of ctx.slice.evidence_registry.evidence) {
  if (ev.source_type === "reality_fact") {
    assert.ok(
      ctx.slice.reality_context.facts.some((f) => f.fact_id === ev.source_id),
      `fact ${ev.source_id}`,
    );
  }
}

// body-prompt Face01 branch uses production pair
const pair = buildV3BodyPrompt({
  key: "01",
  locale: "en",
  core_conclusion: "",
  judgment_lock: "",
  user_feed: "",
  zfpOmitted: true,
  face01_production: { system: ctx.system, user: ctx.user },
});
assert.ok(pair.user === ctx.user);
assert.ok(pair.system.includes(ctx.system.slice(0, 40)));

// --- Validation fail-closed ---
assert.equal(parseFace01JsonStrict("```json\n{}\n```"), null, "reject markdown fence");

const bad = validateFace01ProductionOutput({
  raw: { page: "01", face: "01" },
  locale: "en",
  ctx,
});
assert.equal(bad.ok, false);

const claimId =
  ctx.slice.report_analysis.key_claims[0]?.claim_id ||
  Object.keys(ctx.registry.claims)[0]!;
const evId =
  ctx.slice.evidence_registry.evidence.find((e) => e.evidence_id !== `ev_fact_${e.source_id}`)?.evidence_id ||
  ctx.page02PlannedEvidenceIds[0] ||
  ctx.slice.evidence_registry.evidence[0]!.evidence_id;
const factId = ctx.slice.reality_context.facts[0]!.fact_id;

const validRaw = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  page_title: "Decision",
  page_subtitle: "",
  core_judgment: {
    text: "Keep the job cash floor while exploring the offer in a bounded window.",
    claim_ids: [claimId],
  },
  why_this_path: [
    {
      text: "Runway and optionality both stay intact under a staged path.",
      claim_ids: [claimId],
      evidence_ids: [evId],
      target_page: "02",
      target_evidence_ids: [ctx.page02PlannedEvidenceIds[0] || evId],
    },
  ],
  recommendation_conditions: [
    {
      condition: "Personal runway remains near the confirmed window.",
      status: "satisfied",
      source_ids: [factId],
    },
    {
      condition: "Partner equity terms stay unknown and must be clarified.",
      status: "unconfirmed",
      source_ids: ["fact_partner_unknown"],
    },
  ],
  not_recommended: [
    {
      option: "Resign immediately for the offer.",
      reason: "Burns the cash floor before terms are clear.",
      cost_or_conflict: "Loss of runway buffer.",
      claim_ids: [claimId],
      evidence_ids: [evId],
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway and open equity conflict."],
    invalidation_conditions: ["Runway collapses or equity terms lock unfavorably."],
    page02_evidence_ids: [ctx.page02PlannedEvidenceIds[0] || evId],
    page08_review_refs: [],
  },
};

const good = validateFace01ProductionOutput({
  raw: validRaw,
  locale: "en",
  ctx,
});
assert.equal(good.ok, true, JSON.stringify(good));
if (!good.ok) throw new Error("expected valid");
assert.ok(isFace01V2(good.page));

// coerce path accepts Face01V2
assert.ok(coercePageSchemaLoose("01", good.page));

// --- Page02 assembly gate ---
const deferred = assembleFace01Page02References({
  page01: good.page,
  page02RealizedEvidenceIds: null,
});
assert.equal(deferred.status, "deferred_page02");

const orphan = assembleFace01Page02References({
  page01: good.page,
  page02RealizedEvidenceIds: new Set(["someone_else"]),
});
assert.equal(orphan.status, "fail");
if (orphan.status === "fail") {
  assert.equal(orphan.reason, "orphan_page02_refs");
  assert.ok(orphan.missing_ids.length > 0);
}

const realizedOk = assembleFace01Page02References({
  page01: good.page,
  page02RealizedEvidenceIds: new Set(good.page.applicability_boundary.page02_evidence_ids),
});
assert.equal(realizedOk.status, "ok");

// --- Glossary appendix ---
const gEmpty = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [],
});
assert.equal(gEmpty.include, false);
assert.deepEqual(
  readingOrderAfterAssembly({ glossary: gEmpty }),
  ["01", "02", "04", "05", "06", "08"],
);

const gOne = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [["day_master"], ["day_master"]],
});
assert.equal(gOne.include, true);
assert.deepEqual(gOne.term_ids, ["day_master"]);
assert.ok(
  readingOrderAfterAssembly({ glossary: gOne }).includes("03"),
);

// allowlist-only terms must NOT invent appendix when unused
const gAllowOnly = assembleGlossaryAppendixFromEvidence({
  locale: "en",
  evidenceTermIdLists: [[]],
});
assert.equal(gAllowOnly.include, false);

let glossaryFailClosed = false;
try {
  assembleGlossaryAppendixFromEvidence({
    locale: "en",
    evidenceTermIdLists: [["term_that_does_not_exist_zz"]],
  });
} catch {
  glossaryFailClosed = true;
}
assert.ok(glossaryFailClosed, "missing term_id fails closed");

// --- Legacy Face01 must not become empty V2 ---
const legacy = {
  page: "01" as const,
  face: "01" as const,
  main_recommendation: "Hold remotely.",
  conditions: "Cash ok.",
  not_choosing: "Do not resign cold.",
  evidence_pointer: "See 02.",
};
assert.ok(isFace01Legacy(legacy));
const projected = projectLegacyFace01ForDisplay(legacy);
assert.ok(projected);
assert.ok(projected!.core_judgment.text.includes("Hold"));

// Seed registry helper still traces
const seeded = seedEvidenceRegistryForFace01({ dc, pack, maxFacts: 16 });
assert.ok(seeded.facts.length <= 16);
assert.ok(seeded.knownFactIds.has("fact_runway"));

// Prompt pair export still callable
const directPair = buildFace01PromptPair({
  slice: ctx.slice,
  termAllowlist: [],
  jsonSchemaHint: "{}",
});
assert.ok(directPair.system && directPair.user);

console.log("production_call_chain", {
  entry: "runProductionV3Task → runLabStepV3(content_body) → runContentBodyGenerate",
  prompt: "buildFace01ProductionContext → buildFace01PromptPair → buildV3BodyPrompt(face01_production)",
  validate: "validateFace01ProductionOutput → Face01V2Schema + evidence + body",
  persist: "art.page_schema Face01V2 only after validation",
  assemble: "assembleFace01Page02References + assembleGlossaryAppendixFromEvidence",
});

// --- Optional live model ---
async function maybeLiveModel() {
  const runLive = process.env.RUN_FACE01_LIVE === "1";
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!runLive || !hasKey) {
    console.log("REAL_MODEL_CALL_NOT_RUN");
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
      key: "01",
      finalize: {} as never,
      locale: "en",
      session_id: "face01_live_test",
      report_id: "face01_live_test",
      decision_context_snapshot: dc,
      book_judgment_pack: pack,
      chart_fact_pack: "日主甲木…",
      thinking_effort: "medium",
      dispatch_attempt,
    });

  let result = await invoke(1);
  let repairUsed = false;
  if (!result.ok && isV3LabTransportSupplyFail(result.reason)) {
    console.log("live_face01_attempt1_supply_fail", { reason: result.reason });
    result = await invoke(2);
  }
  if (result.ok && result.face01_meta?.validation === "passed_after_repair") {
    repairUsed = true;
  }

  const redactedMeta = result.face01_meta
    ? {
        prompt_version: result.face01_meta.prompt_version,
        schema_version: result.ok
          ? result.face01_meta.schema_version
          : undefined,
        slice_summary: result.face01_meta.slice_summary,
        validation: result.ok ? result.face01_meta.validation : undefined,
        validation_issues: result.ok
          ? undefined
          : (result.face01_meta.validation_issues as Array<{ code?: string; detail?: string }> | undefined)
              ?.slice(0, 8)
              .map((i) => ({
                code: i.code,
                detail: String(i.detail ?? "").slice(0, 160),
              })),
      }
    : undefined;

  console.log("live_face01", {
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
    meta: redactedMeta,
    is_v2: result.ok ? isFace01V2(result.page) : false,
    repair_used: repairUsed,
    provider_meta: result.call_trace?.meta
      ? {
          model: result.call_trace.meta.actual_model,
          request_id: result.call_trace.meta.generation_id,
          finish_reason: result.call_trace.meta.finish_reason,
          tokens_used: result.call_trace.meta.tokens_used,
        }
      : undefined,
    raw_chars: result.last_raw_text?.length ?? 0,
  });
  if (!result.ok) {
    console.log(`REAL_MODEL_CALL_FAILED:${result.reason}`);
    return;
  }
  assert.ok(isFace01V2(result.page));
  assert.equal((result.page as { schema_version?: string }).schema_version, "face01-v2");
  console.log(
    repairUsed ? "REAL_MODEL_CALL_OK_AFTER_REPAIR" : "REAL_MODEL_CALL_OK",
  );
}

maybeLiveModel()
  .then(() => {
    console.log("ok decision-report-v2 page01 production");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
