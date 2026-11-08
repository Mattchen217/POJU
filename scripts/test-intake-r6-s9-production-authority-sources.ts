/**
 * S9 - Production N/A Authority Sources (+ S9-R1..R5 REQUEST CHANGES fixes)
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
import {
  readLiveCfpSourceState,
  testStoredProfileRecordShell,
  CFP_SOURCE_CODE_CHART_FACT_PACK,
} from "../lib/poju/decision-context/live-cfp-source";
import {
  PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
  buildProductionNaValidationContextFromSession,
  reaggregateDirsOnSession,
} from "../lib/poju/decision-context/na-validation-from-session";
import { selectNextIntakeAskForSession } from "../lib/poju/decision-context/production-intake-ask";
import { applyV2FromFinalToSession } from "../lib/poju/decision-context/production-versioning";
import {
  applyTopicApplicabilityEvalToSession,
  confirmTopicApplicabilityEval,
  confirmTopicApplicabilityEvalFromUiClick,
  TopicEvalWriteError,
} from "../lib/poju/decision-context/topic-applicability-write";
import type { AuthoritativeTopicEvalRecord } from "../lib/poju/decision-context/topic-eval-authority";
import type { DecisionContext, DIR } from "../lib/poju/decision-context/types";
import type { POJUMessage, POJUSessionState } from "../lib/poju/types";
import type { StoredProfileData } from "../lib/db/poju-db";
import { computeStoredBirthInfoHash } from "../lib/profile/stored-profiles-service";

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
function confirmUserTurn(
  turnId: string,
  sessionId: string,
  ruleId: string = CAREER_RULE,
  dirId: string = CAREER_DIR,
  controlId: string = "topic_applicability_confirm",
  notApplicable: boolean = true,
): POJUMessage {
  return {
    role: "user",
    content: "confirm topic N/A",
    timestamp: NOW,
    client_id: turnId,
    meta: {
      topic_applicability_confirm: {
        rule_id: ruleId,
        control_id: controlId,
        not_applicable: notApplicable,
        session_id: sessionId,
        target_dir_id: dirId,
      },
    },
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
    da_yun: [] as [],
    data_availability: {
      pillars_detail: false,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
}
function sampleBirth() {
  return {
    year: 1990,
    month: 5,
    day: 15,
    hour_period: "wu" as const,
    gender: "M" as const,
    timezone: "Asia/Shanghai",
  };
}

async function main() {
  console.log("S9 production N/A authority sources (R1-R5 fixes)");
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
    const birth = sampleBirth();
    const hash = await computeStoredBirthInfoHash(birth);
    const data: StoredProfileData = {
      birth_info: birth as StoredProfileData["birth_info"],
      user_profile: { birth } as StoredProfileData["user_profile"],
      base_analysis: {
        structured: okStructured(),
        generated_at: NOW,
        model: "test",
        content: {},
        tokens_used: 0,
      },
    };
    const record = testStoredProfileRecordShell("prof_s907", hash);
    const dc = draftDc("dc_s907", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s907", dc, { has_profile: true, selected_stored_profile_id: "prof_s907" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfileWithRecord: async () => ({ record, data }),
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) {
      assert.equal(read.state, "source_ok");
      assert.equal(read.session_id, "s_s907");
      assert.equal(read.profile_id, "prof_s907");
      assert.equal(read.source_code, CFP_SOURCE_CODE_CHART_FACT_PACK);
    }
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
    assert.ok(ctx.cfpLiveEvaluation);
    assert.equal(ctx.cfpLiveEvaluation?.state, "source_absent_not_supplied");
    assert.equal(ctx.cfpLiveEvaluation?.session_id, "s_s908");
    assert.equal(ctx.cfpLiveEvaluation?.profile_id, null);
  });

  await check("S9-09 profile calc failed", async () => {
    const birth = sampleBirth();
    const hash = await computeStoredBirthInfoHash(birth);
    const data = {
      birth_info: birth as StoredProfileData["birth_info"],
      user_profile: { birth } as StoredProfileData["user_profile"],
      base_analysis: { generated_at: NOW, model: "t", content: {}, tokens_used: 0 },
    } as StoredProfileData;
    const record = testStoredProfileRecordShell("prof_s909", hash);
    const dc = draftDc("dc_s909", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s909", dc, { has_profile: true, selected_stored_profile_id: "prof_s909" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfileWithRecord: async () => ({ record, data }),
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.state, "source_calc_failed");
  });

  await check("S9-10 provenance missing (empty Record hash)", async () => {
    const birth = sampleBirth();
    const data: StoredProfileData = {
      birth_info: birth as StoredProfileData["birth_info"],
      user_profile: { birth } as StoredProfileData["user_profile"],
      base_analysis: {
        structured: okStructured(),
        generated_at: NOW,
        model: "t",
        content: {},
        tokens_used: 0,
      },
    };
    // Real StoredProfileRecord shape with empty birth_info_hash (no cross-type content_hash).
    const record = testStoredProfileRecordShell("prof_s910", "");
    const dc = draftDc("dc_s910", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s910", dc, { has_profile: true, selected_stored_profile_id: "prof_s910" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfileWithRecord: async () => ({ record, data }),
      nowIso: NOW,
    });
    assert.equal(read.ok, true);
    if (read.ok) assert.equal(read.state, "source_provenance_missing");
  });

  await check("S9-10b provenance mismatch (Record hash != recomputed)", async () => {
    const birth = sampleBirth();
    const data: StoredProfileData = {
      birth_info: birth as StoredProfileData["birth_info"],
      user_profile: { birth } as StoredProfileData["user_profile"],
      base_analysis: {
        structured: okStructured(),
        generated_at: NOW,
        model: "t",
        content: {},
        tokens_used: 0,
      },
    };
    const record = testStoredProfileRecordShell("prof_s910b", "not_the_real_hash");
    const dc = draftDc("dc_s910b", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s910b", dc, { has_profile: true, selected_stored_profile_id: "prof_s910b" });
    const read = await readLiveCfpSourceState(session, {
      isBrowser: () => true,
      getStoredProfileWithRecord: async () => ({ record, data }),
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
    assert.equal(ctx.cfpLiveEvaluation, undefined);
  });

  await check("S9-12 reader unavailable no DDR-03 N/A", async () => {
    const dc = draftDc("dc_s912", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_s912", dc, { has_profile: true, selected_stored_profile_id: "prof_s912" });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.cfpSourceState, undefined);
    assert.equal(ctx.cfpLiveEvaluation, undefined);
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
        eval_id: "forged_eval",
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(ddrEv, ctx), "ddr03_live_eval_missing");
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

  await check("S9-16 four production paths consistent on real entries", async () => {
    const evalRow = careerEval("te_s916");
    const ev = topicEvidence("te_s916");
    const dc = draftDc("dc_s916", [baseDir(CAREER_DIR)], {
      explicit_na_evidence: [ev],
    });
    const session = sessionOf("s_s916", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
      profile_skipped: true,
    });

    // Freeze path — real Freeze NaValidation entry
    const freezeNa = await buildFreezeNaValidationFromSession(session, dc, { now: NOW });
    assert.equal(reasonOf(ev, freezeNa), "ok");
    assert.equal(freezeNa.cfpSourceState, "source_absent_not_supplied");
    assert.equal(freezeNa.cfpLiveEvaluation?.eval_id, freezeNa.cfpLiveEvaluation?.eval_id);

    // Lifecycle — real reaggregateDirsOnSession result DIR state
    const lifeDirs = await reaggregateDirsOnSession(session, dc.dirs, {
      nowIso: NOW,
      explicitNaEvidence: [ev],
    });
    assert.equal(lifeDirs.find((d) => d.dir_id === CAREER_DIR)?.current_state, "n_a");

    // Ask — real selectNextIntakeAskForSession skips n_a DIR candidates
    const sessionNaDirs: POJUSessionState = {
      ...session,
      decision_context: { ...dc, dirs: lifeDirs },
    };
    const ask = await selectNextIntakeAskForSession({ session: sessionNaDirs, nowIso: NOW });
    assert.ok(!ask.plan.ranked.some((r) => r.candidate.dir_ids.includes(CAREER_DIR)));
    assert.equal(ask.selected, null);

    // Versioning — real applyV2FromFinalToSession; draft dirs keep N/A after production NA
    const finalDc: DecisionContext = {
      ...dc,
      status: "final",
      content_hash: "hash_s916",
      dirs: lifeDirs,
      explicit_na_evidence: [ev],
    };
    const v2Session = sessionOf("s_s916", finalDc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
      profile_skipped: true,
    });
    const v2 = await applyV2FromFinalToSession(v2Session, { now: NOW });
    assert.equal(v2.draft.status, "draft");
    const v2Dirs = await reaggregateDirsOnSession(v2.session, v2.draft.dirs, {
      nowIso: NOW,
      explicitNaEvidence: v2.draft.explicit_na_evidence ?? [ev],
    });
    assert.equal(v2Dirs.find((d) => d.dir_id === CAREER_DIR)?.current_state, "n_a");

    // Cross-path NA validation agreement on the same Session/DC authority
    const lifeNa = await buildProductionNaValidationContextFromSession(sessionNaDirs, { nowIso: NOW });
    const v2Na = await buildProductionNaValidationContextFromSession(v2.session, { nowIso: NOW });
    assert.equal(reasonOf(ev, freezeNa), reasonOf(ev, lifeNa));
    assert.equal(reasonOf(ev, freezeNa), reasonOf(ev, v2Na));
    assert.equal(freezeNa.cfpSourceState, lifeNa.cfpSourceState);
    assert.equal(freezeNa.cfpSourceState, v2Na.cfpSourceState);
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

  // ---- S9-R1 reverse / CAS ----
  await check("S9-R1 writer rejects missing confirmation turn", async () => {
    const dc = draftDc("dc_r1_miss", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_r1_miss", dc, { messages: [] });
    assert.throws(
      () =>
        applyTopicApplicabilityEvalToSession(
          latest,
          "s_r1_miss",
          {
            operation_id: "op",
            eval_id: "te_miss",
            rule_id: CAREER_RULE,
            control_id: "topic_applicability_confirm",
            confirmation_turn_id: "t_missing",
            expires_at: EXPIRY,
            not_applicable: true,
          },
          NOW,
        ),
      (e: unknown) => e instanceof TopicEvalWriteError && e.code === "TOPIC_EVAL_WRITE_SOURCE_INVALID",
    );
  });

  await check("S9-R1 writer rejects assistant turn", async () => {
    const dc = draftDc("dc_r1_as", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_r1_as", dc, {
      messages: [
        {
          role: "assistant",
          content: "ask",
          timestamp: NOW,
          client_id: "t_as",
          meta: {
            topic_applicability_confirm: {
              rule_id: CAREER_RULE,
              control_id: "topic_applicability_confirm",
              not_applicable: true,
              session_id: "s_r1_as",
              target_dir_id: CAREER_DIR,
            },
          },
        },
      ],
    });
    assert.throws(
      () =>
        applyTopicApplicabilityEvalToSession(
          latest,
          "s_r1_as",
          {
            operation_id: "op",
            eval_id: "te_as",
            rule_id: CAREER_RULE,
            control_id: "topic_applicability_confirm",
            confirmation_turn_id: "t_as",
            expires_at: EXPIRY,
            not_applicable: true,
          },
          NOW,
        ),
      (e: unknown) => e instanceof TopicEvalWriteError && e.code === "TOPIC_EVAL_WRITE_SOURCE_INVALID",
    );
  });

  await check("S9-R1 writer rejects cross-session turn", async () => {
    const dc = draftDc("dc_r1_xs", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_r1_xs", dc, {
      messages: [confirmUserTurn("t_xs", "OTHER_SESSION")],
    });
    assert.throws(
      () =>
        applyTopicApplicabilityEvalToSession(
          latest,
          "s_r1_xs",
          {
            operation_id: "op",
            eval_id: "te_xs",
            rule_id: CAREER_RULE,
            control_id: "topic_applicability_confirm",
            confirmation_turn_id: "t_xs",
            expires_at: EXPIRY,
            not_applicable: true,
          },
          NOW,
        ),
      (e: unknown) => e instanceof TopicEvalWriteError && e.code === "TOPIC_EVAL_WRITE_SOURCE_INVALID",
    );
  });

  await check("S9-R1 writer rejects forged turn without confirm meta", async () => {
    const dc = draftDc("dc_r1_ord", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_r1_ord", dc, {
      messages: [{ role: "user", content: "hello", timestamp: NOW, client_id: "t_ord" }],
    });
    assert.throws(
      () =>
        applyTopicApplicabilityEvalToSession(
          latest,
          "s_r1_ord",
          {
            operation_id: "op",
            eval_id: "te_ord",
            rule_id: CAREER_RULE,
            control_id: "topic_applicability_confirm",
            confirmation_turn_id: "t_ord",
            expires_at: EXPIRY,
            not_applicable: true,
          },
          NOW,
        ),
      (e: unknown) => e instanceof TopicEvalWriteError && e.code === "TOPIC_EVAL_WRITE_SOURCE_INVALID",
    );
  });

  await check("S9-R1 writer accepts bound user confirm", async () => {
    const dc = draftDc("dc_r1_ok", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_r1_ok", dc, {
      messages: [confirmUserTurn("t_ok", "s_r1_ok")],
    });
    const ok = applyTopicApplicabilityEvalToSession(
      latest,
      "s_r1_ok",
      {
        operation_id: "op2",
        eval_id: "te_ok",
        rule_id: CAREER_RULE,
        control_id: "topic_applicability_confirm",
        confirmation_turn_id: "t_ok",
        expires_at: EXPIRY,
        not_applicable: true,
      },
      NOW,
    );
    assert.equal(ok.outcome, "appended");
    assert.equal(ok.session.topic_catalog_version, ACTIVE_TOPIC_APPLICABILITY_VERSION);
  });

  await check("S9-R1 full CAS write entry (injected load/casWrite)", async () => {
    const sid = "s9r1cas01";
    let store: POJUSessionState = {
      ...sessionOf(sid, draftDc("dc_r1_cas", [baseDir(CAREER_DIR)]), {
        session_revision: 1,
        dc_write_revision: 1,
      }),
    };
    const result = await confirmTopicApplicabilityEvalFromUiClick(
      sid,
      {
        operation_id: "op_confirm_s9_r1",
        eval_id: "te_cas_1",
        rule_id: CAREER_RULE,
        control_id: "topic_applicability_confirm",
        confirmation_turn_id: "turn_cas_1",
        confirmation_content: "This topic does not apply",
        expires_at: EXPIRY,
        not_applicable: true,
        occurred_at: NOW,
      },
      {
        load: async () => ({
          row: {
            session_id: sid,
            device_id: "test",
            status: "active",
            encrypted_data: "",
            iv: "",
            session_revision: store.session_revision ?? 1,
            dc_write_revision: store.dc_write_revision ?? 1,
            created_at: new Date(),
            expires_at: new Date(),
            last_interaction_at: new Date(),
          } as never,
          state: store,
        }),
        casWrite: async (args) => {
          const nextSessionRevision = args.expected_session_revision + 1;
          const nextDc = args.bump_dc_write_revision
            ? args.expected_dc_write_revision + 1
            : args.expected_dc_write_revision;
          store = {
            ...args.candidate,
            session_revision: nextSessionRevision,
            dc_write_revision: nextDc,
          };
          return {
            state: store,
            session_revision: nextSessionRevision,
            dc_write_revision: nextDc,
          };
        },
      },
    );
    assert.equal(result.outcome, "appended");
    assert.equal(result.record.rule_id, CAREER_RULE);
    assert.ok(result.state.topic_applicability_evals?.some((e) => e.eval_id === "te_cas_1"));
    assert.ok(
      result.state.messages.some(
        (m) => m.client_id === "turn_cas_1" && m.role === "user" && m.meta?.topic_applicability_confirm,
      ),
    );
    // Also exercise confirmTopicApplicabilityEval against already-bound turn (idempotent path prep).
    const again = await confirmTopicApplicabilityEval(
      sid,
      {
        operation_id: "op_confirm_s9_r1_idem",
        eval_id: "te_cas_1",
        rule_id: CAREER_RULE,
        control_id: "topic_applicability_confirm",
        confirmation_turn_id: "turn_cas_1",
        expires_at: EXPIRY,
        not_applicable: true,
        occurred_at: NOW,
      },
      {
        load: async () => ({
          row: {
            session_id: sid,
            session_revision: store.session_revision ?? 1,
            dc_write_revision: store.dc_write_revision ?? 1,
          } as never,
          state: store,
        }),
        casWrite: async (args) => {
          store = {
            ...args.candidate,
            session_revision: args.expected_session_revision + 1,
            dc_write_revision: args.expected_dc_write_revision,
          };
          return {
            state: store,
            session_revision: store.session_revision ?? 0,
            dc_write_revision: store.dc_write_revision ?? 0,
          };
        },
      },
    );
    assert.equal(again.outcome, "idempotent_skip");
  });

  // ---- S9-R2 reverse ----
  await check("S9-R2 ACTIVE=v1 Session=v0 Eval=v0 fail-closed", async () => {
    const evalRow = careerEval("te_r2", { catalog_version: "0" });
    const dc = draftDc("dc_r2", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_r2", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: "0",
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.currentTopicCatalogVersion, ACTIVE_TOPIC_APPLICABILITY_VERSION);
    assert.equal(reasonOf(topicEvidence("te_r2"), ctx), "topic_catalog_version_stale");
  });

  await check("S9-R2 Session missing version + old eval fail-closed", async () => {
    const evalRow = careerEval("te_r2m", { catalog_version: "0" });
    const dc = draftDc("dc_r2m", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_r2m", dc, {
      topic_applicability_evals: [evalRow],
      // topic_catalog_version omitted
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.currentTopicCatalogVersion, ACTIVE_TOPIC_APPLICABILITY_VERSION);
    assert.equal(reasonOf(topicEvidence("te_r2m"), ctx), "topic_catalog_version_stale");
  });

  await check("S9-R2 unknown session version + matching old eval fail-closed", async () => {
    const evalRow = careerEval("te_r2u", { catalog_version: "unknown-ver" });
    const dc = draftDc("dc_r2u", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_r2u", dc, {
      topic_applicability_evals: [evalRow],
      topic_catalog_version: "unknown-ver",
    });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.equal(ctx.currentTopicCatalogVersion, ACTIVE_TOPIC_APPLICABILITY_VERSION);
    assert.equal(reasonOf(topicEvidence("te_r2u"), ctx), "topic_catalog_version_stale");
  });

  // ---- S9-R4 DDR-03 eval bind ----
  await check("S9-R4 DDR-03 binds live eval_id (forged rejected)", async () => {
    const dc = draftDc("dc_r4", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_r4", dc, { profile_skipped: true });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    assert.ok(ctx.cfpLiveEvaluation);
    const liveId = ctx.cfpLiveEvaluation!.eval_id;
    const forged: ExplicitNaEvidence = {
      evidence_id: "ddr_r4_forged",
      target: "ddr",
      ddr_id: "DDR-03-CHART-APPENDIX",
      na_condition_code: "chart_not_supplied",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "empty_dir_source_absence",
        ddr_id: "DDR-03-CHART-APPENDIX",
        source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
        source_state: "source_absent_not_supplied",
        eval_id: "forged_cross_session_eval",
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(forged, ctx), "ddr03_eval_id_mismatch");
    const bound: ExplicitNaEvidence = {
      ...forged,
      evidence_id: "ddr_r4_bound",
      system_basis: {
        kind: "empty_dir_source_absence",
        ddr_id: "DDR-03-CHART-APPENDIX",
        source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
        source_state: "source_absent_not_supplied",
        eval_id: liveId,
      },
    };
    assert.equal(reasonOf(bound, ctx), "ok");
  });

  await check("S9-R4 DDR-03 rejects cross-session live eval", async () => {
    const dc = draftDc("dc_r4xs", [baseDir(CAREER_DIR)]);
    const session = sessionOf("s_r4xs", dc, { profile_skipped: true });
    const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
    const polluted = {
      ...ctx,
      cfpLiveEvaluation: {
        ...ctx.cfpLiveEvaluation!,
        session_id: "OTHER_SESSION",
      },
    };
    const ev: ExplicitNaEvidence = {
      evidence_id: "ddr_r4xs",
      target: "ddr",
      ddr_id: "DDR-03-CHART-APPENDIX",
      na_condition_code: "chart_not_supplied",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "empty_dir_source_absence",
        ddr_id: "DDR-03-CHART-APPENDIX",
        source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
        source_state: "source_absent_not_supplied",
        eval_id: ctx.cfpLiveEvaluation!.eval_id,
      },
      written_by: "code",
      revoked: false,
    };
    assert.equal(reasonOf(ev, polluted), "ddr03_eval_session_mismatch");
  });

  await check("S9-A2 writer explicit confirm only (decline forbidden)", async () => {
    const dc = draftDc("dc_s9w", [baseDir(CAREER_DIR)]);
    const latest = sessionOf("s_s9w", dc, {
      messages: [confirmUserTurn("t2", "s_s9w")],
    });
    assert.throws(() =>
      applyTopicApplicabilityEvalToSession(
        latest,
        "s_s9w",
        {
          operation_id: "op1",
          eval_id: "te_w1",
          rule_id: CAREER_RULE,
          control_id: "llm_unrelated",
          confirmation_turn_id: "t2",
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
    assert.equal(polluted.cfpLiveEvaluation?.eval_id, clean.cfpLiveEvaluation?.eval_id);
  });

  console.log("\nS9 passed " + passed + " checks");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
