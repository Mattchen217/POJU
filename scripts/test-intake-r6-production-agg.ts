/**
 * Stage 3.2 鈥?Production DIR aggregation wiring (Call B / Collecting / CAS).
 *   pnpm exec tsx scripts/test-intake-r6-production-agg.ts
 *   pnpm test:intake-r6-production-agg
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

import { confirmFactEvent, testSessionState } from "./fixtures/intake-r6-session";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_prod_agg");

const NOW = "2026-11-05T14:00:00.000Z";
const NA_CODE = "explicit_not_applicable";

async function main() {
  console.log("intake-r6-production-agg (Call B / Collecting 鈫?reaggregateDirsIntake)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession, SESSION_CAS_CONFLICT } = await import(
    "../lib/poju/session-mutation"
  );
  const {
    applyCallBToSessionDc,
    applyCollectingUserTurnToSessionDc,
    persistCallBDcOnSession,
    persistCollectingUserTurnDc,
    seedOpeningDraftDcOnSession,
  } = await import("../lib/poju/decision-context/production-dc-lifecycle");
  const { applyCallAToSessionDc } = await import(
    "../lib/poju/decision-context/production-dc-lifecycle"
  );
  const {
    aggregateDirStateIntake,
    reaggregateDirsIntake,
  } = await import("../lib/poju/decision-context/dir-aggregator-intake");
  const { aggregateDirState } = await import(
    "../lib/poju/decision-context/dir-aggregator"
  );
  const {
    buildProductionNaValidationContextFromSession,
    naValidationBoundToDc,
    PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
    reaggregateDirsOnSession,
  } = await import("../lib/poju/decision-context/na-validation-from-session");
  type NaValidationFixtureOverrides =
    import("../lib/poju/decision-context/na-validation-from-session").NaValidationFixtureOverrides;
  const { ACTIVE_DIR_NA_CATALOG_VERSION, loadDirNaCatalog } = await import(
    "../lib/poju/decision-context/catalog"
  );
  const { validateExplicitNaEvidence } = await import(
    "../lib/poju/decision-context/explicit-na-validate"
  );
  const {
    computeUnresolvedCount,
    plannerAggregatorRoleMismatches,
    snapshotFromDc,
  } = await import("../lib/poju/decision-context/question-planning");
  const { selectNextIntakeAskForSession } = await import(
    "../lib/poju/decision-context/production-intake-ask"
  );
  const { createInitialAgentState } = await import("../lib/poju/agent-state");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const sampleAgenda = [
    {
      id: "ag_runway",
      label: "Current savings runway",
      critical: true,
      status: "covered" as const,
      collection_goal: "Know months of runway",
      role: "fill" as const,
      serves_page: "05",
      frame_kind: "modern_action" as const,
      frame_index: 1,
    },
  ];

  const sampleCore = {
    situation_conclusion: "Income risk vs optionality",
    key_crossroads: {
      real_fork: "Stay vs leave",
      path_costs: "Stability vs growth",
      decision_traits: "Risk tolerance",
      structural_basis: "Day master",
      needs_validation: "Family cash runway",
    },
    modern_action_frames: [
      {
        direction: "Negotiate bridge",
        why_fits: "Keeps optionality",
        structural_basis: "Resource star",
        needs_validation: "Manager flexibility",
      },
    ],
    primary_path: {
      direction: "Negotiate bridge",
      why_fits: "Keeps optionality",
      structural_basis: "Resource star",
      needs_validation: "Manager flexibility",
    },
    backup_path: {
      direction: "Defer leave 6 months",
      why_fits: "Buys runway",
      structural_basis: "Timing",
      needs_validation: "Offer expiry",
    },
    energy_retune_frame: {
      direction_fit: "Water support",
      timing_ripeness: "Next quarter",
      daily_retune: "Sleep",
      complementary: "Mentor",
      structural_basis: "Basis",
      needs_validation: "Stress",
    },
    rhythm_frame: {
      phase1_observe: "Watch cash",
      phase2_adjust: "Talk terms",
      phase3_consolidate: "Decide",
    },
    self_check_signals: ["anxiety spike"],
  } as import("../lib/poju/agent-state").BreakthroughCore;

  function agentSession() {
    const agent = createInitialAgentState({
      original_question: "Should I leave my job?",
    });
    agent.core_dilemma = {
      concrete_event: "Offer to join a startup",
      stakes: "Income stability",
      sticking_point: "Family depends on salary",
    };
    agent.desired_direction = {
      wants: "Keep optionality for 6 months",
      priority: "reversibility",
    };
    agent.current_phase = "awaiting_understanding_confirm";
    return testSessionState("sess_prod_agg_pure", NOW, {
      expires_at: "2026-12-05T00:00:00.000Z",
      original_question: "Should I leave my job?",
      messages: [
        {
          role: "user",
          content: "I got a startup offer but I am worried about runway.",
          timestamp: NOW,
          client_id: "u_open_1",
        },
      ],
      agent_v2: agent,
    });
  }

  // ---------- A. Call B aggregation ----------
  console.log("\n== A. Call B production aggregation ==");
  {
    let s = seedOpeningDraftDcOnSession(agentSession(), { now: NOW }).session;
    s = applyCallAToSessionDc(s, sampleCore, {
      source_ref: "call_a:agg",
      now: NOW,
    }).session;
    const applied = await applyCallBToSessionDc(s, sampleAgenda, { now: NOW });
    assert.equal(applied.applied, true);
    const dirs = applied.session.decision_context!.dirs;
    assert.ok(dirs.length >= 1);
    const dir = dirs.find((d) => d.agenda_item_ids?.includes("ag_runway"))!;
    assert.ok(dir);
    assert.equal(
      dir.current_state,
      "unknown",
      "new DIR after Call B starts unknown",
    );
    assert.notEqual(
      dir.current_state,
      "known",
      "agenda covered must not promote DIR known",
    );
    assert.equal(sampleAgenda[0]!.status, "covered");
    console.log("  PASS  Call B seed 鈫?unknown; covered 鈮?known");

    // Precise role + DIR association required for known
    const targetId = dir.dir_id;
    const withRoles = {
      ...applied.session,
      decision_context: {
        ...applied.session.decision_context!,
        dirs: applied.session.decision_context!.dirs.map((d) =>
          d.dir_id === targetId
            ? {
                ...d,
                required_fact_roles: ["situation", "hard_constraint"],
              }
            : d,
        ),
        reality_facts: [
          ...applied.session.decision_context!.reality_facts,
          {
            fact_id: "f_sit",
            statement: "four months runway",
            status: "confirmed" as const,
            verification_level: "user_asserted" as const,
            source_stage: "user_supplement" as const,
            source_turn_id: "t_sit",
            user_confirmed: true,
            fact_roles: ["situation"],
            related_dir_ids: [targetId],
          },
        ],
        constraints: [
          {
            constraint_id: "k_hard",
            statement: "must keep salary for 6 months",
            category: "time" as const,
            status: "confirmed" as const,
            verification_level: "user_asserted" as const,
            source_stage: "user_supplement" as const,
            source_turn_id: "t_k",
            rigidity: "hard" as const,
            user_confirmed: true,
            related_dir_ids: [targetId],
          },
        ],
      },
    };
    const knownDirs = await reaggregateDirsOnSession(
      withRoles,
      withRoles.decision_context!.dirs,
      { nowIso: NOW },
    );
    const known = knownDirs.find((d) => d.dir_id === targetId)!;
    assert.equal(known.current_state, "known");
    console.log("  PASS  confirmed Fact+Constraint (Scheme A) 鈫?known");

    // Missing related_dir_ids 鈫?must NOT satisfy (no OR-fallback).
    // Single-role DIR so legacy role-tag-only path would reach known.
    const situationOnlyDir = {
      ...dir,
      dir_id: targetId,
      required_fact_roles: ["situation"],
    };
    const factNoLink = {
      fact_id: "f_sit_nolink",
      statement: "role tag only",
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_nolink",
      user_confirmed: true,
      fact_roles: ["situation"],
      related_dir_ids: [] as string[],
    };
    const noLinkSession = {
      ...applied.session,
      decision_context: {
        ...applied.session.decision_context!,
        dirs: [situationOnlyDir],
        reality_facts: [factNoLink],
        constraints: [],
      },
    };
    const noLinkDirs = await reaggregateDirsOnSession(
      noLinkSession,
      [situationOnlyDir],
      { nowIso: NOW },
    );
    assert.equal(noLinkDirs[0]!.current_state, "unknown");
    const legacy = aggregateDirState(situationOnlyDir, [factNoLink], []);
    assert.equal(
      legacy.current_state,
      "known",
      "sanity: legacy OR/role-only path reaches known without related_dir_ids",
    );
    console.log(
      "  PASS  missing DIR link 鈫?Intake unknown; legacy OR path would be known",
    );

    // Soft constraint cannot fill hard_constraint role
    const softOnly = {
      ...withRoles,
      decision_context: {
        ...withRoles.decision_context!,
        reality_facts: withRoles.decision_context!.reality_facts.filter(
          (f) => f.fact_id !== "f_sit",
        ),
        constraints: [
          {
            ...withRoles.decision_context!.constraints[0]!,
            rigidity: "soft" as const,
          },
        ],
      },
    };
    const softDirs = await reaggregateDirsOnSession(
      softOnly,
      softOnly.decision_context!.dirs,
      { nowIso: NOW },
    );
    assert.notEqual(
      softDirs.find((d) => d.dir_id === targetId)!.current_state,
      "known",
    );
    console.log("  PASS  soft Constraint 鈮?hard_constraint Scheme A");
  }

  // ---------- B. Collecting aggregation ----------
  console.log("\n== B. Collecting production aggregation ==");
  {
    let s = seedOpeningDraftDcOnSession(agentSession(), { now: NOW }).session;
    s = applyCallAToSessionDc(s, sampleCore, {
      source_ref: "call_a:col",
      now: NOW,
    }).session;
    s = (await applyCallBToSessionDc(s, sampleAgenda, { now: NOW })).session;
    const before = s.decision_context!.dirs.map((d) => d.current_state);
    const collected = await applyCollectingUserTurnToSessionDc(s, {
      statement: "I have about four months of savings.",
      source_turn_id: "u_collect_agg_1",
      now: NOW,
    });
    assert.equal(collected.applied, true);
    const fact = collected.session.decision_context!.reality_facts.find(
      (f) => f.source_turn_id === "u_collect_agg_1",
    )!;
    assert.equal(fact.status, "unverified");
    assert.deepEqual(fact.fact_roles, ["collecting_user_statement"]);
    assert.equal(fact.related_dir_ids, undefined);
    const after = collected.session.decision_context!.dirs;
    assert.ok(after.every((d) => d.current_state === "unknown" || before.includes(d.current_state)));
    assert.ok(
      after.every((d) => d.current_state !== "known"),
      "unlinked collecting fact must not make DIR known",
    );
    console.log("  PASS  collecting fact reaggregates; no role/DIR link 鈫?not known");
  }

  // ---------- C. N/A + conflict ----------
  console.log("\n== C. N/A + conflict priorities ==");
  {
    const dir = {
      dir_id: "DIR-A",
      need: "need",
      why: "why",
      required_fact_roles: ["situation"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [],
      id_lifecycle: "active" as const,
    };
    const fact = {
      fact_id: "f1",
      statement: "s",
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t1",
      user_confirmed: true,
      fact_roles: ["situation"],
      related_dir_ids: ["DIR-A"],
    };
    const action = {
      declaration_action_id: "na-act-agg",
      session_id: "sess_na",
      context_id: "dc_na",
      actor: "user" as const,
      control_id: "na_declare",
      source_ref: { kind: "reality_fact" as const, fact_id: "f1" },
      dir_id: "DIR-A",
      na_condition_code: NA_CODE,
      declaration_turn_id: "t_na",
      occurred_at: NOW,
      revoked: false,
      expires_at: null,
    };
    const classification = {
      classification_id: "na_cls_na-act-agg",
      context_id: "dc_na",
      source_ref: action.source_ref,
      dir_id: "DIR-A",
      na_condition_code: NA_CODE,
      authority: "user_declared" as const,
      written_by: "code" as const,
      declaration_action_id: "na-act-agg",
      declaration_turn_id: "t_na",
      revoked: false,
      expires_at: null,
      created_at: NOW,
    };
    const evidence = {
      evidence_id: "na_ev_na-act-agg",
      target: "dir" as const,
      dir_id: "DIR-A",
      na_condition_code: NA_CODE,
      evidence_type: "user_explicit_na" as const,
      source_ref: action.source_ref,
      written_by: "code" as const,
      revoked: false,
    };

    const sessionShell: POJUSessionState = {
      ...agentSession(),
      session_id: "sess_na",
      confirmation_events: [
        confirmFactEvent({
          factId: "f1",
          sourceTurnId: "t1",
          confirmationTurnId: "t1b",
          confirmedAt: NOW,
        }),
      ],
      na_declaration_actions: [action],
      decision_context: {
        context_id: "dc_na",
        version: 1,
        status: "draft" as const,
        definition: {
          concrete_event: null,
          stakes: null,
          desired_outcome: null,
          decision_question: null,
          goal_priorities: [],
          unacceptable_outcomes: [],
        },
        reality_facts: [fact],
        constraints: [],
        hypotheses: [],
        dirs: [dir],
        conflicts: [],
        explicit_na_evidence: [evidence],
        explicit_na_classifications: [classification],
        content_hash: null,
        created_at: NOW,
        updated_at: NOW,
      },
    };

    assert.ok(PRODUCTION_NA_VALIDATION_SOURCE_GAPS.length >= 1);

    type Shell = typeof sessionShell;
    const reasonOf = (
      ev: Parameters<typeof validateExplicitNaEvidence>[0],
      ctx: Parameters<typeof validateExplicitNaEvidence>[1],
    ) => {
      const r = validateExplicitNaEvidence(ev, ctx);
      return r.ok ? "ok" : r.reason_code;
    };
    const blockingConflict = {
      conflict_id: "c1",
      fact_ids: ["f1"],
      conflict_field: "path",
      statements_snapshot: ["a", "b"],
      source_refs: [
        {
          fact_id: "f1",
          source_stage: "user_supplement" as const,
          source_turn_id: "t1",
        },
      ],
      state: "open" as const,
      resolution: null,
      user_confirmation: false,
      affects_preferred_path: true,
      updated_at: NOW,
    };
    const withDc = (
      s: Shell,
      patch: Partial<NonNullable<Shell["decision_context"]>>,
    ): Shell => ({
      ...s,
      decision_context: { ...s.decision_context!, ...patch },
    });

    // ----- C-Pure: fixture path (naValidationBoundToDc + reaggregateDirsIntake) -----
    // Explicit test catalog for DIR-A / NA_CODE (not ACTIVE). Session authority
    // passed explicitly from the shell so only the variable under test differs.
    const FIXTURE_CATALOG = [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }];
    const fixtureNa = (
      s: Shell,
      extra: NaValidationFixtureOverrides = {},
    ) =>
      naValidationBoundToDc(s.decision_context!, s.session_id, {
        nowIso: NOW,
        confirmationEvents: s.confirmation_events,
        naDeclarationActions: s.na_declaration_actions,
        ...extra,
      });
    const aggPure = (
      s: Shell,
      extra: NaValidationFixtureOverrides,
      conflicts: NonNullable<Shell["decision_context"]>["conflicts"] = s.decision_context!
        .conflicts,
    ) =>
      reaggregateDirsIntake(
        [dir],
        s.decision_context!.reality_facts,
        conflicts,
        s.decision_context!.constraints,
        s.decision_context!.explicit_na_evidence ?? [],
        fixtureNa(s, extra),
      );

    const pureWithCatalog = aggPure(sessionShell, {
      dirCatalog: FIXTURE_CATALOG,
    });
    assert.equal(pureWithCatalog[0]!.current_state, "n_a");
    console.log(
      "  PASS  [C-Pure] valid DIR-level ExplicitNaEvidence + fixture catalog 鈫?n_a",
    );

    // Precondition: pureWithCatalog === n_a with identical triad. Only catalog removed.
    const pureNoCatalog = aggPure(sessionShell, {});
    assert.notEqual(pureNoCatalog[0]!.current_state, "n_a");
    assert.equal(
      reasonOf(evidence, fixtureNa(sessionShell)),
      "na_condition_not_in_catalog",
    );
    console.log(
      "  PASS  [C-Pure] missing dirCatalog 鈫?not n_a (direct cause: na_condition_not_in_catalog)",
    );

    // Precondition: pureWithCatalog === n_a. Only evidence.revoked flipped.
    const revokedShell = withDc(sessionShell, {
      explicit_na_evidence: [{ ...evidence, revoked: true }],
    });
    const pureRevoked = aggPure(revokedShell, { dirCatalog: FIXTURE_CATALOG });
    assert.notEqual(pureRevoked[0]!.current_state, "n_a");
    assert.equal(
      reasonOf(
        { ...evidence, revoked: true },
        fixtureNa(revokedShell, { dirCatalog: FIXTURE_CATALOG }),
      ),
      "revoked",
    );
    console.log("  PASS  [C-Pure] revoked N/A 鈫?not n_a (direct cause: revoked)");

    // Precondition: pureWithCatalog === n_a. Only classification.context_id changed.
    const crossShell = withDc(sessionShell, {
      explicit_na_classifications: [
        { ...classification, context_id: "OTHER_DC" },
      ],
    });
    const pureCross = aggPure(crossShell, { dirCatalog: FIXTURE_CATALOG });
    assert.notEqual(pureCross[0]!.current_state, "n_a");
    assert.equal(
      reasonOf(evidence, fixtureNa(crossShell, { dirCatalog: FIXTURE_CATALOG })),
      "explicit_na_classification_missing",
    );
    console.log(
      "  PASS  [C-Pure] cross-context classification 鈫?not n_a (direct cause: explicit_na_classification_missing)",
    );

    // Precondition: pureWithCatalog === n_a and evidence still validates; only conflict added.
    assert.equal(
      reasonOf(evidence, fixtureNa(sessionShell, { dirCatalog: FIXTURE_CATALOG })),
      "ok",
    );
    const pureConflicted = aggPure(
      sessionShell,
      { dirCatalog: FIXTURE_CATALOG },
      [blockingConflict],
    );
    assert.equal(pureConflicted[0]!.current_state, "conflict");
    console.log("  PASS  [C-Pure] blocking conflict priority over valid N/A");

    // ----- C-Production: reaggregateDirsOnSession (ACTIVE catalog only) -----
    // ACTIVE v1 defines DIR-DEF-UNACCEPTABLE.na_conditions = ["explicit_no_hard_red_lines"].
    const activeLoad = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
    assert.equal(activeLoad.ok, true);
    if (!activeLoad.ok) throw new Error("ACTIVE catalog unavailable");
    const ACTIVE_DIR = "DIR-DEF-UNACCEPTABLE";
    const ACTIVE_CODE = "explicit_no_hard_red_lines";
    assert.deepEqual(
      activeLoad.entries.find((e) => e.dir_id === ACTIVE_DIR)?.na_conditions,
      [ACTIVE_CODE],
    );
    assert.equal(
      activeLoad.entries.some((e) => e.dir_id === "DIR-A"),
      false,
      "DIR-A must not be an ACTIVE catalog DIR",
    );

    const prodDir = { ...dir, dir_id: ACTIVE_DIR };
    const prodFact = { ...fact, related_dir_ids: [ACTIVE_DIR] };
    const prodAction = {
      ...action,
      declaration_action_id: "na-act-agg-prod",
      dir_id: ACTIVE_DIR,
      na_condition_code: ACTIVE_CODE,
    };
    const prodClassification = {
      ...classification,
      classification_id: "na_cls_na-act-agg-prod",
      dir_id: ACTIVE_DIR,
      na_condition_code: ACTIVE_CODE,
      declaration_action_id: "na-act-agg-prod",
    };
    const prodEvidence = {
      ...evidence,
      evidence_id: "na_ev_na-act-agg-prod",
      dir_id: ACTIVE_DIR,
      na_condition_code: ACTIVE_CODE,
    };
    const prodShell: Shell = {
      ...sessionShell,
      na_declaration_actions: [prodAction],
      decision_context: {
        ...sessionShell.decision_context!,
        reality_facts: [prodFact],
        dirs: [prodDir],
        explicit_na_evidence: [prodEvidence],
        explicit_na_classifications: [prodClassification],
      },
    };
    const prodReason = async (s: Shell, ev: typeof prodEvidence) =>
      reasonOf(
        ev,
        await buildProductionNaValidationContextFromSession(s, { nowIso: NOW }),
      );

    const prodValid = await reaggregateDirsOnSession(prodShell, [prodDir], {
      nowIso: NOW,
    });
    assert.equal(prodValid[0]!.current_state, "n_a");
    assert.equal(await prodReason(prodShell, prodEvidence), "ok");
    console.log(
      "  PASS  [C-Prod] ACTIVE legal pair + Session action/E1 + DC classification/evidence 鈫?n_a",
    );

    // Precondition: C-Pure with FIXTURE_CATALOG made this exact DIR-A triad n_a.
    // Forged catalog arrives via a non-literal opts object (no production field).
    const forgedReaggOpts = {
      nowIso: NOW,
      authority: { dirCatalog: FIXTURE_CATALOG },
      dirCatalog: FIXTURE_CATALOG,
    };
    const prodForgedCatalog = await reaggregateDirsOnSession(
      sessionShell,
      [dir],
      forgedReaggOpts,
    );
    assert.notEqual(prodForgedCatalog[0]!.current_state, "n_a");
    assert.equal(
      await prodReason(sessionShell, evidence),
      "na_condition_not_in_catalog",
    );
    console.log(
      "  PASS  [C-Prod] non-ACTIVE DIR-A + forged caller catalog 鈫?not n_a (direct cause: na_condition_not_in_catalog)",
    );

    // Precondition: prodValid === n_a. Only evidence.revoked flipped.
    const prodRevokedEv = { ...prodEvidence, revoked: true };
    const prodRevokedShell = withDc(prodShell, {
      explicit_na_evidence: [prodRevokedEv],
    });
    const prodRevoked = await reaggregateDirsOnSession(prodRevokedShell, [prodDir], {
      nowIso: NOW,
    });
    assert.notEqual(prodRevoked[0]!.current_state, "n_a");
    assert.equal(await prodReason(prodRevokedShell, prodRevokedEv), "revoked");
    console.log("  PASS  [C-Prod] revoked N/A 鈫?not n_a (direct cause: revoked)");

    // Precondition: prodValid === n_a. Only classification.context_id changed.
    const prodCrossShell = withDc(prodShell, {
      explicit_na_classifications: [
        { ...prodClassification, context_id: "OTHER_DC" },
      ],
    });
    const prodCross = await reaggregateDirsOnSession(prodCrossShell, [prodDir], {
      nowIso: NOW,
    });
    assert.notEqual(prodCross[0]!.current_state, "n_a");
    assert.equal(
      await prodReason(prodCrossShell, prodEvidence),
      "explicit_na_classification_missing",
    );
    console.log(
      "  PASS  [C-Prod] cross-context classification 鈫?not n_a (direct cause: explicit_na_classification_missing)",
    );

    // Precondition: prodValid === n_a with evidence ok; only blocking conflict added.
    const prodConflicted = await reaggregateDirsOnSession(prodShell, [prodDir], {
      nowIso: NOW,
      conflicts: [blockingConflict],
    });
    assert.equal(await prodReason(prodShell, prodEvidence), "ok");
    assert.equal(prodConflicted[0]!.current_state, "conflict");
    console.log("  PASS  [C-Prod] blocking conflict priority over valid N/A");

    // DDR-03: calc_failed reject; absent_not_supplied accepts with complete basis
    const ddrEv = {
      evidence_id: "na_ddr03",
      target: "ddr" as const,
      ddr_id: "DDR-03-CHART-APPENDIX" as const,
      na_condition_code: "chart_not_supplied",
      evidence_type: "system_na_marker" as const,
      system_basis: {
        kind: "empty_dir_source_absence" as const,
        ddr_id: "DDR-03-CHART-APPENDIX" as const,
        source_code: "cfp.birth",
        source_state: "source_absent_not_supplied" as const,
        eval_id: "cfp_eval_1",
      },
      written_by: "code" as const,
      revoked: false,
    };
    // C-Pure: CFP source + live evaluation are fixture-injected (S9-R4 bind).
    const ctxBase = fixtureNa(sessionShell, {
      cfpSourceState: "source_calc_failed",
      cfpLiveEvaluation: {
        state: "source_calc_failed",
        eval_id: "cfp_eval_1",
        source_code: "cfp.birth",
        profile_id: null,
        session_id: sessionShell.session_id,
      },
    });
    assert.equal(validateExplicitNaEvidence(ddrEv, ctxBase).ok, false);
    const ctxOk = fixtureNa(sessionShell, {
      cfpSourceState: "source_absent_not_supplied",
      cfpLiveEvaluation: {
        state: "source_absent_not_supplied",
        eval_id: "cfp_eval_1",
        source_code: "cfp.birth",
        profile_id: null,
        session_id: sessionShell.session_id,
      },
    });
    assert.equal(validateExplicitNaEvidence(ddrEv, ctxOk).ok, true);
    console.log(
      "  PASS  [C-Pure] DDR-03 CFP: calc_failed reject; absent_not_supplied accept",
    );

    // C-Production: production builder has no live CFP eval → reject.
    const prodCtx = await buildProductionNaValidationContextFromSession(sessionShell, {
      nowIso: NOW,
    });
    assert.equal(prodCtx.cfpSourceState, undefined);
    assert.equal(prodCtx.cfpLiveEvaluation, undefined);
    assert.equal(reasonOf(ddrEv, prodCtx), "ddr03_live_eval_missing");
    console.log(
      "  PASS  [C-Prod] DDR-03 CFP live eval missing in production → reject (direct cause: ddr03_live_eval_missing)",
    );

    // DIR-targeted empty_dir_source_absence must reject (basis only for DDR-03)
    const dirBadBasis = {
      evidence_id: "na_dir_bad_basis",
      target: "dir" as const,
      dir_id: "DIR-A",
      na_condition_code: "empty_dir_source_absence",
      evidence_type: "system_na_marker" as const,
      system_basis: {
        kind: "empty_dir_source_absence" as const,
        ddr_id: "DDR-03-CHART-APPENDIX" as const,
        source_code: "cfp.birth",
        source_state: "source_absent_not_supplied" as const,
        eval_id: "cfp_eval_1",
      },
      written_by: "code" as const,
      revoked: false,
    };
    assert.equal(
      validateExplicitNaEvidence(dirBadBasis, ctxOk).ok,
      false,
      "DIR cannot use empty_dir_source_absence (Rule A / allowlist)",
    );
    console.log("  PASS  DDR-02 Rule A / DIR empty_dir basis still rejected");
  }

  // ---------- D. Production entry CAS + planner consistency ----------
  console.log("\n== D. Production persist + planner/aggregator consistency ==");
  {
    const sid = await createPOJUSession({
      payment_id: "pay_prod_agg",
      original_question: "agg wiring",
    });
    // Seed agent + draft DC via mutate (production-like)
    await mutatePOJUSession(sid, {
      operation_id: "op_seed_agent_agg",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        const withAgent = {
          ...latest,
          ...agentSession(),
          session_id: latest.session_id,
        };
        const seeded = seedOpeningDraftDcOnSession(withAgent, { now: NOW });
        let s = seeded.session;
        s = applyCallAToSessionDc(s, sampleCore, {
          source_ref: "call_a:cas",
          now: NOW,
        }).session;
        return s;
      },
    });

    let sess = (await loadPOJUSession(sid))!;
    const callB = await persistCallBDcOnSession(sess, sampleAgenda, {
      now: NOW,
    });
    assert.equal(callB.applied, true);
    sess = (await loadPOJUSession(sid))!;
    assert.ok((sess.decision_context?.dirs.length ?? 0) >= 1);
    assert.ok(
      sess.decision_context!.dirs.every((d) => d.current_state === "unknown"),
    );
    console.log("  PASS  persistCallBDcOnSession + reload 鈫?dirs unknown");

    const collect = await persistCollectingUserTurnDc(sess, {
      statement: "Savings cover about four months.",
      source_turn_id: "u_cas_collect_1",
      now: NOW,
    });
    assert.equal(collect.applied, true);
    sess = (await loadPOJUSession(sid))!;
    assert.ok(
      sess.decision_context!.reality_facts.some(
        (f) => f.source_turn_id === "u_cas_collect_1",
      ),
    );
    console.log("  PASS  persistCollectingUserTurnDc + reload");

    // CAS conflict retry: collecting turn that mutates DC + reaggregates (must not no-op).
    let conflictInjected = false;
    const afterConflict = await mutatePOJUSession(
      sid,
      {
        operation_id: "op_cas_reagg_conflict",
        kind: "session_patch",
        bump_dc: true,
        apply: async (latest) => {
          const applied = await applyCollectingUserTurnToSessionDc(latest, {
            statement: "Also considering spouse income.",
            source_turn_id: "u_cas_collect_2",
            now: NOW,
          });
          assert.equal(applied.applied, true);
          return applied.session;
        },
      },
      {
        max_retries: 3,
        casWrite: async (args) => {
          if (!conflictInjected) {
            conflictInjected = true;
            const { SessionCasError } = await import(
              "../lib/poju/session-mutation"
            );
            throw new SessionCasError(SESSION_CAS_CONFLICT, "injected");
          }
          const { casWritePOJUSession } = await import(
            "../lib/poju/session-mutation"
          );
          return casWritePOJUSession(args);
        },
      },
    );
    assert.ok(afterConflict.state?.decision_context);
    assert.equal(conflictInjected, true);
    sess = (await loadPOJUSession(sid))!;
    assert.equal(
      sess.decision_context!.reality_facts.filter(
        (f) => f.source_turn_id === "u_cas_collect_2",
      ).length,
      1,
      "CAS retry must not duplicate collecting fact",
    );
    console.log("  PASS  CAS conflict retry does not duplicate/corrupt aggregate");

    // Install precise roles + confirmed fact for planner/aggregator match
    await mutatePOJUSession(sid, {
      operation_id: "op_install_roles_facts",
      kind: "session_patch",
      bump_dc: true,
      apply: async (latest): Promise<POJUSessionState> => {
        const dc = latest.decision_context!;
        const target = dc.dirs[0]!;
        const nextDirs = dc.dirs.map((d, i) =>
          i === 0
            ? { ...d, required_fact_roles: ["situation"] }
            : d,
        );
        const facts = [
          ...dc.reality_facts,
          {
            fact_id: "f_plan_sit",
            statement: "confirmed runway",
            status: "confirmed" as const,
            verification_level: "user_asserted" as const,
            source_stage: "user_supplement" as const,
            source_turn_id: "t_plan",
            user_confirmed: true,
            fact_roles: ["situation"],
            related_dir_ids: [target.dir_id],
          },
        ];
        const withFacts: POJUSessionState = {
          ...latest,
          confirmation_events: [
            ...(latest.confirmation_events ?? []),
            confirmFactEvent({
              factId: "f_plan_sit",
              sourceTurnId: "t_plan",
              confirmationTurnId: "t_plan_b",
              confirmedAt: NOW,
              eventId: "e1_f_plan",
              confirmationActionId: "ca_f_plan",
            }),
          ],
          decision_context: {
            ...dc,
            dirs: nextDirs,
            reality_facts: facts,
          },
        };
        const dirs = await reaggregateDirsOnSession(withFacts, nextDirs, {
          realityFacts: facts,
          nowIso: NOW,
        });
        return {
          ...withFacts,
          decision_context: {
            ...withFacts.decision_context!,
            dirs,
            updated_at: NOW,
          },
        };
      },
    });
    sess = (await loadPOJUSession(sid))!;
    const targetDir = sess.decision_context!.dirs[0]!;
    assert.equal(targetDir.current_state, "known");

    const na = await buildProductionNaValidationContextFromSession(sess, { nowIso: NOW });
    const agg = aggregateDirStateIntake(
      targetDir,
      sess.decision_context!.reality_facts,
      sess.decision_context!.conflicts,
      sess.decision_context!.constraints,
      sess.decision_context!.explicit_na_evidence ?? [],
      na,
    );
    const planner = computeUnresolvedCount(
      {
        candidate_id: "cq_test",
        kind: "dir_based",
        dir_ids: [targetDir.dir_id],
        ddr_ids: [],
        fact_role_codes: targetDir.required_fact_roles.map(
          (r) => `v1/dir/${targetDir.dir_id}/role/${r}`,
        ),
        impact: {
          decision_critical: false,
          may_affect_p5_ranking: false,
          gate_class: "P1",
        },
      },
      snapshotFromDc(sess.decision_context!),
      na,
    );
    const mismatches = plannerAggregatorRoleMismatches({
      dir: targetDir,
      plannerRoleStates: planner.role_states,
      aggregatorRoleStates: agg.role_states,
    });
    assert.deepEqual(mismatches, []);
    assert.equal(planner.unresolved_count, 0);

    const planned = await selectNextIntakeAskForSession({
      session: sess,
      nowIso: NOW,
    });
    assert.equal(planned.skipped_reason, undefined);
    // known DIR should not appear as gap candidate
    assert.ok(
      !planned.plan.ranked.some((r) =>
        r.candidate.dir_ids.includes(targetDir.dir_id),
      ),
    );
    console.log("  PASS  planner 鈫?aggregator role states match on same DC snapshot");
  }

  // silence unused import
  void reaggregateDirsIntake;

  console.log("\nAll intake-r6-production-agg checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
