/**
 * S9 - Production N/A Authority Sources
 */
import assert from "node:assert/strict";
import { createDefaultControlPlane } from "../lib/poju/decision-context/control-plane";
import {
  ACTIVE_TOPIC_APPLICABILITY_VERSION,
  TOPIC_PACK_NA_CONDITION_CODE,
  loadTopicApplicability,
} from "../lib/poju/decision-context/catalog";
import { validateExplicitNaEvidence } from "../lib/poju/decision-context/explicit-na-validate";
import type { ExplicitNaEvidence } from "../lib/poju/decision-context/types";
import { buildFreezeNaValidationFromSession } from "../lib/poju/decision-context/freeze-to-delivery";
import { readLiveCfpSourceState } from "../lib/poju/decision-context/live-cfp-source";
import {
  PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
  buildProductionNaValidationContextFromSession,
  reaggregateDirsOnSession,
} from "../lib/poju/decision-context/na-validation-from-session";
import { selectNextIntakeAskForSession } from "../lib/poju/decision-context/production-intake-ask";
import { applyV2FromFinalToSession } from "../lib/poju/decision-context/production-versioning";
import { applyTopicApplicabilityEvalToSession } from "../lib/poju/decision-context/topic-applicability-write";
import type { AuthoritativeTopicEvalRecord } from "../lib/poju/decision-context/topic-eval-authority";
import type { DecisionContext, DIR } from "../lib/poju/decision-context/types";
import type { POJUSessionState } from "../lib/poju/types";
import type { StoredProfileData } from "../lib/db/poju-db";

const NOW = "2026-11-08T15:00:00.000Z";
const EXPIRY = "2026-12-08T15:00:00.000Z";
const CAREER_RULE = "topic_rule.career.v1";
const CAREER_DIR = "DIR-JOB-OFFER";
let passed = 0;
async function check(label: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log("  PASS  " + label);
}
function baseDir(dirId: string): DIR {
  return {
    dir_id: dirId,
    need: dirId,
    why: "test",
    required_fact_roles: ["r1"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    may_affect_p5_ranking: false,
    id_lifecycle: "active",
  };
}
function draftDc(ctxId: string, dirs: DIR[], extra: Partial<DecisionContext> = {}): DecisionContext {
  return {
    context_id: ctxId,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "e",
      stakes: "s",
      desired_outcome: null,
      decision_question: "q",
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    reality_facts: [],
    constraints: [],
    hypotheses: [],
    dirs,
    conflicts: [],
    content_hash: null,
    created_at: NOW,
    updated_at: NOW,
    ...extra,
  };
}
function sessionOf(sessId: string, dc: DecisionContext, extra: Partial<POJUSessionState> = {}): POJUSessionState {
  return {
    session_id: sessId,
    decision_context: dc,
    decision_context_versions: [],
    confirmation_events: [],
    na_declaration_actions: [],
    messages: [],
    control_plane: createDefaultControlPlane("collecting_context"),
    has_profile: false,
    profile_skipped: false,
    ...extra,
  } as POJUSessionState;
}
function careerEval(evalId: string, overrides: Partial<AuthoritativeTopicEvalRecord> = {}): AuthoritativeTopicEvalRecord {
  return {
    eval_id: evalId,
    rule_id: CAREER_RULE,
    topic_code: "career",
    target_dir_id: CAREER_DIR,
    catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    not_applicable: true,
    evaluated_at: NOW,
    expires_at: EXPIRY,
    record_status: "current",
    ...overrides,
  };
}
function topicEvidence(evalId: string): ExplicitNaEvidence {
  return {
    evidence_id: "ev_" + evalId,
    target: "dir",
    dir_id: CAREER_DIR,
    na_condition_code: TOPIC_PACK_NA_CONDITION_CODE,
    evidence_type: "system_na_marker",
    system_basis: { kind: "topic_not_applicable", topic_code: "career", rule_id: CAREER_RULE },
    written_by: "code",
    revoked: false,
  };
}
function reasonOf(
  e: ExplicitNaEvidence,
  ctx: Awaited<ReturnType<typeof buildProductionNaValidationContextFromSession>>,
) {
  const r = validateExplicitNaEvidence(e, ctx);
  return r.ok ? "ok" : r.reason_code;
}
function okStructured() {
  return {
    day_master: "Jia",
    strength: "strong" as const,
    pattern: "",
    yong_shen: "wood",
    xi_shen: [] as string[],
    ji_shen: [] as string[],
    four_pillars: { year: "JiaZi", month: "YiChou", day: "BingYin", hour: "DingMao" },
  };
}

async function main() {
  console.log("S9 production N/A authority sources");
  const load = loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION);
  assert.equal(load.ok, true);
  if (!load.ok) throw new Error("topic catalog load failed");

  await check("S9-01 ACTIVE Topic Rule + valid Session Eval", async () => {
    const evalRow = careerEval("te_s901");
    const dc = draftDc("dc_s901", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s901", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(reasonOf(topicEvidence("te_s901"), ctx), "ok");
    const freezeCtx = await buildFreezeNaValidationFromSession(session, dc, { now: NOW });
    assert.equal(reasonOf(topicEvidence("te_s901"), freezeCtx), "ok");
  });

  await check("S9-02 Topic Rule missing", async () => {
    const dc = draftDc("dc_s902", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s902", dc, { topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const ev: ExplicitNaEvidence = {
      evidence_id: "na_topic_te_s902",
      target: "dir",
      dir_id: CAREER_DIR,
      na_condition_code: "topic_pack_not_applicable",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "topic_not_applicable",
        topic_code: "career",
        rule_id: "topic_rule.not_registered.v1",
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(ev, ctx), "topic_rule_missing");
  });

  await check("S9-03 Session Eval missing", async () => {
    const dc = draftDc("dc_s903", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s903", dc, { topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(reasonOf(topicEvidence("missing"), ctx), "topic_evaluation_incomplete");
  });

  await check("S9-04 Topic Catalog version mismatch", async () => {
    const evalRow = careerEval("te_s904", { catalog_version: "0-old" });
    const dc = draftDc("dc_s904", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s904", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(reasonOf(topicEvidence("te_s904"), ctx), "topic_catalog_version_stale");
  });

  await check("S9-05 Topic Eval revoked or expired", async () => {
    const revoked = careerEval("te_s905r", { record_status: "revoked" });
    const expired = careerEval("te_s905e", { expires_at: "2020-01-01T00:00:00.000Z" });
    const dc = draftDc("dc_s905", [baseDir(CAREER_DIR)]);
    const sRev = sessionOf("s_s905r", dc, {
      topic_applicability_evals: [revoked],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    const sExp = sessionOf("s_s905e", dc, {
      topic_applicability_evals: [expired],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    assert.equal(
      reasonOf(topicEvidence("te_s905r"), await buildProductionNaValidationContextFromSession(sRev, { nowIso: NOW })),
      "topic_evaluation_revoked",
    );
    assert.equal(
      reasonOf(topicEvidence("te_s905e"), await buildProductionNaValidationContextFromSession(sExp, { nowIso: NOW })),
      "topic_authority_expired",
    );
  });

  await check("S9-06 Client forged Topic Rules ignored", async () => {
    const evalRow = careerEval("te_s906");
    const dc = draftDc("dc_s906", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s906", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    const clean = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const forged = await buildProductionNaValidationContextFromSession(session, {
      nowIso: NOW,
      topicRules: [],
    } as { nowIso: string });
    assert.equal((forged.topicRules as unknown[]).length, (clean.topicRules as unknown[]).length);
    assert.equal(reasonOf(topicEvidence("te_s906"), forged), "ok");
  });

  await check("S9-07 CFP profile ok -> source_ok", async () => {
    const profile = {
      birth_info: {} as StoredProfileData["birth_info"],
      user_profile: {} as StoredProfileData["user_profile"],
      base_analysis: { structured: okStructured(), generated_at: NOW, model: "test", content: {}, tokens_used: 0 },
    } as StoredProfileData;
    const dc = draftDc("dc_s907", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s907", dc, { has_profile: true, selected_stored_profile_id: "prof_s907" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfile: async () => profile,
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.state, "source_ok");
  });

  await check("S9-08 skip + no profile -> source_absent_not_supplied", async () => {
    const dc = draftDc("dc_s908", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s908", dc, {
      profile_skipped: true,
      has_profile: false,
      selected_stored_profile_id: null,
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.cfpSourceState, "source_absent_not_supplied");
  });

  await check("S9-09 profile calc failed", async () => {
    const dc = draftDc("dc_s909", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s909", dc, { has_profile: true, selected_stored_profile_id: "prof_s909" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfile: async () =>
        ({
          birth_info: {} as never,
          user_profile: {} as never,
          base_analysis: { generated_at: NOW, model: "t", content: {}, tokens_used: 0 },
        }) as StoredProfileData,
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.state, "source_calc_failed");
  });

  await check("S9-10 provenance missing", async () => {
    const profile = {
      birth_info: {} as StoredProfileData["birth_info"],
      user_profile: {} as StoredProfileData["user_profile"],
      base_analysis: { structured: okStructured(), generated_at: NOW, model: "t", content: {}, tokens_used: 0 },
      content_hash: "",
    } as StoredProfileData & { content_hash: string };
    const dc = draftDc("dc_s910", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s910", dc, { has_profile: true, selected_stored_profile_id: "prof_s910" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfile: async () => profile,
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.state, "source_provenance_missing");
  });

  await check("S9-11 identity mismatch", async () => {
    const dc = draftDc("dc_s911", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s911", dc, {
      has_profile: true,
      profile_skipped: true,
      selected_stored_profile_id: "prof_x",
    });
    const read = await readLiveCfpSourceState(session, { nowIso: NOW });
    assert.equal(read.ok, false);
    if (!read.ok) assert.equal(read.reason_code, "cfp_identity_mismatch");
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.cfpSourceState, undefined);
  });

  await check("S9-12 reader unavailable no DDR-03 N/A", async () => {
    const dc = draftDc("dc_s912", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s912", dc, { has_profile: true, selected_stored_profile_id: "prof_s912" });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.cfpSourceState, undefined);
    const ddrEv: ExplicitNaEvidence = {
      evidence_id: "ddr_s912",
      target: "ddr",
      ddr_id: "DDR-03-CHART-APPENDIX",
      na_condition_code: "chart_not_supplied",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "empty_dir_source_absence",
        ddr_id: "DDR-03-CHART-APPENDIX",
        source_code: "cfp.chart_fact_pack",
        source_state: "source_absent_not_supplied",
        eval_id: "x",
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(ddrEv, ctx), "ddr03_cfp_not_absent");
  });

  await check("S9-13/14/15 catalogConditionEvals fail-closed", async () => {
    assert.ok(PRODUCTION_NA_VALIDATION_SOURCE_GAPS[0]!.startsWith("catalogConditionEvals"));
    const dc = draftDc("dc_s913", [baseDir("DIR-DEF-UNACCEPTABLE")]);
    const session = sessionOf("s_s913", dc);
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.catalogConditionEvals, undefined);
    const ev: ExplicitNaEvidence = {
      evidence_id: "ce_s913",
      target: "dir",
      dir_id: "DIR-DEF-UNACCEPTABLE",
      na_condition_code: "explicit_no_hard_red_lines",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "catalog_na_condition_met",
        target_dir_id: "DIR-DEF-UNACCEPTABLE",
        condition_eval_id: "forged_ce",
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(ev, ctx), "catalog_eval_missing");
    const freezeCtx = await buildFreezeNaValidationFromSession(session, dc, { now: NOW });
    assert.equal(freezeCtx.catalogConditionEvals, undefined);
    assert.equal(reasonOf(ev, freezeCtx), "catalog_eval_missing");
  });

  await check("S9-16 four paths consistent", async () => {
    const evalRow = careerEval("te_s916");
    const dc = draftDc("dc_s916", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s916", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
      profile_skipped: true,
    });
    const ev = topicEvidence("te_s916");
    const freezeCtx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const v2Session = { ...session, decision_context: { ...dc, status: "final" as const, content_hash: "h" } };
    const versioningCtx = await buildProductionNaValidationContextFromSession(v2Session, { nowIso: NOW });
    await reaggregateDirsOnSession(session, dc.dirs, { nowIso: NOW });
    const lifecycleCtx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    await selectNextIntakeAskForSession({ session, nowIso: NOW });
    const askCtx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(reasonOf(ev, freezeCtx), "ok");
    assert.equal(reasonOf(ev, versioningCtx), "ok");
    assert.equal(reasonOf(ev, lifecycleCtx), "ok");
    assert.equal(reasonOf(ev, askCtx), "ok");
    assert.equal(freezeCtx.cfpSourceState, "source_absent_not_supplied");
    assert.equal(versioningCtx.cfpSourceState, freezeCtx.cfpSourceState);
  });

  await check("S9-17 ACTIVE topic loader fault", async () => {
    const originalHas = Map.prototype.has;
    const originalGet = Map.prototype.get;
    try {
      Map.prototype.has = function (this: Map<unknown, unknown>, key: unknown) {
        const snap: unknown = originalGet.call(this, key);
        if (
          typeof snap === "object" &&
          snap !== null &&
          Array.isArray((snap as { rules?: unknown }).rules) &&
          (snap as { topic_catalog_version?: string }).topic_catalog_version ===
            ACTIVE_TOPIC_APPLICABILITY_VERSION
        ) {
          throw new Error("injected topic registry fault");
        }
        return originalHas.call(this, key);
      };
      const dc = draftDc("dc_s917", [baseDir(CAREER_DIR)]);
      const session = sessionOf("s_s917", dc, { profile_skipped: true });
      await assert.rejects(() =>
        buildProductionNaValidationContextFromSession(session, { nowIso: NOW }),
      );
    } finally {
      Map.prototype.has = originalHas;
    }
  });

  await check("S9-18 old evaluation fail-closed", async () => {
    const evalRow = careerEval("te_s918", { catalog_version: "legacy" });
    const dc = draftDc("dc_s918", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s918", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(reasonOf(topicEvidence("te_s918"), ctx), "topic_catalog_version_stale");
  });

  await check("S9-19 Versioning re-reads CFP", async () => {
    const dc = draftDc("dc_s919", [baseDir(CAREER_DIR)], { status: "final", content_hash: "hash_s919" });
    const session = sessionOf("s_s919", dc, {
      profile_skipped: true,
      agent_v2: { cfpSourceState: "source_ok" } as never,
    });
    const ctx1 = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx1.cfpSourceState, "source_absent_not_supplied");
    const applied = await applyV2FromFinalToSession(session, { now: NOW });
    const ctx2 = await buildProductionNaValidationContextFromSession(applied.session, { nowIso: NOW });
    assert.equal(ctx2.cfpSourceState, "source_absent_not_supplied");
  });

  await check("S9-20 Ask/Lifecycle after Freeze-path compose re-reads", async () => {
    const evalRow = careerEval("te_s920");
    const dc = draftDc("dc_s920", [baseDir(CAREER_DIR)]);
    let session = sessionOf("s_s920", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
      profile_skipped: true,
    });
    const before = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const freezeCtx = await buildFreezeNaValidationFromSession(session, dc, { now: NOW });
    assert.equal(freezeCtx.cfpSourceState, before.cfpSourceState);
    session = {
      ...session,
      profile_skipped: false,
      has_profile: true,
      selected_stored_profile_id: "prof_after_freeze",
    };
    const afterAsk = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    await selectNextIntakeAskForSession({ session, nowIso: NOW });
    const afterLife = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(before.cfpSourceState, "source_absent_not_supplied");
    assert.equal(afterAsk.cfpSourceState, undefined);
    assert.equal(afterLife.cfpSourceState, undefined);
  });

  await check("S9-A2 writer explicit confirm only", async () => {
    const dc = draftDc("dc_s9w", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_s9w", dc);
    assert.throws(() =>
      applyTopicApplicabilityEvalToSession(
        latest,
        "s_s9w",
        {
          operation_id: "op1",
          eval_id: "te_w1",
          rule_id: CAREER_RULE,
          control_id: "llm_unrelated",
          confirmation_turn_id: "t1",
          expires_at: EXPIRY,
          not_applicable: true,
        },
        NOW,
      ),
    );
    const ok = applyTopicApplicabilityEvalToSession(
      latest,
      "s_s9w",
      {
        operation_id: "op2",
        eval_id: "te_w2",
        rule_id: CAREER_RULE,
        control_id: "topic_applicability_confirm",
        confirmation_turn_id: "t2",
        expires_at: EXPIRY,
        not_applicable: true,
      },
      NOW,
    );
    assert.equal(ok.outcome, "appended");
    assert.equal(ok.session.topic_catalog_version, ACTIVE_TOPIC_APPLICABILITY_VERSION);
  });

  await check("S9-E builder opts cannot inject T2", async () => {
    const dc = draftDc("dc_s9e", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s9e", dc, { profile_skipped: true });
    const clean = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const polluted = await buildProductionNaValidationContextFromSession(session, {
      nowIso: NOW,
      cfpSourceState: "source_ok",
      catalogConditionEvals: [],
      topicRules: [],
    } as { nowIso: string });
    assert.equal(polluted.cfpSourceState, clean.cfpSourceState);
    assert.equal(polluted.catalogConditionEvals, undefined);
    assert.equal((polluted.topicRules as unknown[]).length, (clean.topicRules as unknown[]).length);
  });

  console.log("\nS9 passed " + passed + " checks");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
