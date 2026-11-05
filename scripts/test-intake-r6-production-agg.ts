/**
 * Stage 3.2 — Production DIR aggregation wiring (Call B / Collecting / CAS).
 *   pnpm exec tsx scripts/test-intake-r6-production-agg.ts
 *   pnpm test:intake-r6-production-agg
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const memoryStore = new Map<string, string>();
const localStoragePolyfill = {
  getItem(key: string): string | null {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, String(value));
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
  clear(): void {
    memoryStore.clear();
  },
  key(i: number): string | null {
    return [...memoryStore.keys()][i] ?? null;
  },
  get length() {
    return memoryStore.size;
  },
};

const g = globalThis as typeof globalThis & {
  window: typeof globalThis;
  localStorage: typeof localStoragePolyfill;
  crypto: Crypto;
};
g.window = globalThis as unknown as typeof globalThis;
(g.window as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
(g as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
g.localStorage = localStoragePolyfill;
if (!g.crypto || !g.crypto.getRandomValues) {
  g.crypto = webcrypto as unknown as Crypto;
}
memoryStore.set("pojulife_device_id_v4", "dev_intake_r6_prod_agg");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

const NOW = "2026-11-05T14:00:00.000Z";
const NA_CODE = "explicit_not_applicable";

async function main() {
  console.log("intake-r6-production-agg (Call B / Collecting → reaggregateDirsIntake)");

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
    buildNaValidationContextFromSession,
    PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
    reaggregateDirsOnSession,
  } = await import("../lib/poju/decision-context/na-validation-from-session");
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
    return {
      session_id: "sess_prod_agg_pure",
      user_id: "u_agg",
      created_at: NOW,
      last_interaction_at: NOW,
      expires_at: "2026-12-05T00:00:00.000Z",
      original_question: "Should I leave my job?",
      messages: [
        {
          role: "user" as const,
          content: "I got a startup offer but I am worried about runway.",
          timestamp: NOW,
          client_id: "u_open_1",
        },
      ],
      context_collected: {},
      has_profile: false,
      profile_skipped: false,
      actions: [],
      tokens_used: 0,
      abuse_metrics: {
        long_input_count: 0,
        jailbreak_attempts: 0,
        duplicate_attempts: 0,
      },
      agent_v2: agent,
    } as import("../lib/poju/types").POJUSessionState;
  }

  // ---------- A. Call B aggregation ----------
  console.log("\n== A. Call B production aggregation ==");
  {
    let s = seedOpeningDraftDcOnSession(agentSession(), { now: NOW }).session;
    s = applyCallAToSessionDc(s, sampleCore, {
      source_ref: "call_a:agg",
      now: NOW,
    }).session;
    const applied = applyCallBToSessionDc(s, sampleAgenda, { now: NOW });
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
    console.log("  PASS  Call B seed → unknown; covered ≠ known");

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
    const knownDirs = reaggregateDirsOnSession(
      withRoles,
      withRoles.decision_context!.dirs,
      { nowIso: NOW },
    );
    const known = knownDirs.find((d) => d.dir_id === targetId)!;
    assert.equal(known.current_state, "known");
    console.log("  PASS  confirmed Fact+Constraint (Scheme A) → known");

    // Missing related_dir_ids → must NOT satisfy (no OR-fallback).
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
    const noLinkDirs = reaggregateDirsOnSession(
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
      "  PASS  missing DIR link → Intake unknown; legacy OR path would be known",
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
    const softDirs = reaggregateDirsOnSession(
      softOnly,
      softOnly.decision_context!.dirs,
      { nowIso: NOW },
    );
    assert.notEqual(
      softDirs.find((d) => d.dir_id === targetId)!.current_state,
      "known",
    );
    console.log("  PASS  soft Constraint ≠ hard_constraint Scheme A");
  }

  // ---------- B. Collecting aggregation ----------
  console.log("\n== B. Collecting production aggregation ==");
  {
    let s = seedOpeningDraftDcOnSession(agentSession(), { now: NOW }).session;
    s = applyCallAToSessionDc(s, sampleCore, {
      source_ref: "call_a:col",
      now: NOW,
    }).session;
    s = applyCallBToSessionDc(s, sampleAgenda, { now: NOW }).session;
    const before = s.decision_context!.dirs.map((d) => d.current_state);
    const collected = applyCollectingUserTurnToSessionDc(s, {
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
    console.log("  PASS  collecting fact reaggregates; no role/DIR link → not known");
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

    const sessionShell = {
      ...agentSession(),
      session_id: "sess_na",
      confirmation_events: [
        {
          event_id: "e1_f1",
          target_type: "fact" as const,
          fact_id: "f1",
          source_turn_id: "t1",
          confirmation_turn_id: "t1b",
          confirmation_action_id: "ca_f1",
          event_type: "confirm_fact" as const,
          actor: "user" as const,
          confirmed_at: NOW,
          event_version: 1,
        },
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

    // Without catalog authority → N/A fail-closed, DIR stays unknown/known from facts
    const noCatalog = reaggregateDirsOnSession(sessionShell, [dir], {
      nowIso: NOW,
    });
    assert.notEqual(noCatalog[0]!.current_state, "n_a");
    console.log("  PASS  missing dirCatalog → N/A not applied (fail-closed)");

    const withCatalog = reaggregateDirsOnSession(sessionShell, [dir], {
      nowIso: NOW,
      authority: {
        dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
      },
    });
    assert.equal(withCatalog[0]!.current_state, "n_a");
    console.log("  PASS  valid DIR-level ExplicitNaEvidence + catalog → n_a");

    // Revoked evidence
    const revoked = reaggregateDirsOnSession(
      {
        ...sessionShell,
        decision_context: {
          ...sessionShell.decision_context!,
          explicit_na_evidence: [{ ...evidence, revoked: true }],
        },
      },
      [dir],
      {
        nowIso: NOW,
        authority: {
          dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
        },
      },
    );
    assert.notEqual(revoked[0]!.current_state, "n_a");
    console.log("  PASS  revoked N/A → no aggregation effect");

    // Cross-context classification
    const crossCtx = reaggregateDirsOnSession(
      {
        ...sessionShell,
        decision_context: {
          ...sessionShell.decision_context!,
          explicit_na_classifications: [
            { ...classification, context_id: "OTHER_DC" },
          ],
        },
      },
      [dir],
      {
        nowIso: NOW,
        authority: {
          dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
        },
      },
    );
    assert.notEqual(crossCtx[0]!.current_state, "n_a");
    console.log("  PASS  cross-context classification → no n_a");

    // Blocking conflict > N/A
    const conflicted = reaggregateDirsOnSession(sessionShell, [dir], {
      nowIso: NOW,
      conflicts: [
        {
          conflict_id: "c1",
          fact_ids: ["f1"],
          conflict_field: "path",
          statements_snapshot: ["a", "b"],
          source_refs: [
            {
              fact_id: "f1",
              source_stage: "user_supplement",
              source_turn_id: "t1",
            },
          ],
          state: "open",
          resolution: null,
          user_confirmation: false,
          affects_preferred_path: true,
          updated_at: NOW,
        },
      ],
      authority: {
        dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
      },
    });
    assert.equal(conflicted[0]!.current_state, "conflict");
    console.log("  PASS  blocking conflict priority over N/A");

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
    const ctxBase = buildNaValidationContextFromSession(sessionShell, {
      nowIso: NOW,
      cfpSourceState: "source_calc_failed",
    });
    assert.equal(validateExplicitNaEvidence(ddrEv, ctxBase).ok, false);
    const ctxOk = buildNaValidationContextFromSession(sessionShell, {
      nowIso: NOW,
      cfpSourceState: "source_absent_not_supplied",
    });
    assert.equal(validateExplicitNaEvidence(ddrEv, ctxOk).ok, true);
    console.log("  PASS  DDR-03 CFP: calc_failed reject; absent_not_supplied accept");

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
    console.log("  PASS  persistCallBDcOnSession + reload → dirs unknown");

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
        apply: (latest) => {
          const applied = applyCollectingUserTurnToSessionDc(latest, {
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
      apply: (latest) => {
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
        const withFacts = {
          ...latest,
          confirmation_events: [
            ...(latest.confirmation_events ?? []),
            {
              event_id: "e1_f_plan",
              target_type: "fact" as const,
              fact_id: "f_plan_sit",
              source_turn_id: "t_plan",
              confirmation_turn_id: "t_plan_b",
              confirmation_action_id: "ca_f_plan",
              event_type: "confirm_fact" as const,
              actor: "user" as const,
              confirmed_at: NOW,
              event_version: 1,
            },
          ],
          decision_context: {
            ...dc,
            dirs: nextDirs,
            reality_facts: facts,
          },
        };
        const dirs = reaggregateDirsOnSession(withFacts, nextDirs, {
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

    const na = buildNaValidationContextFromSession(sess, { nowIso: NOW });
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

    const planned = selectNextIntakeAskForSession({
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
    console.log("  PASS  planner ↔ aggregator role states match on same DC snapshot");
  }

  // silence unused import
  void reaggregateDirsIntake;

  console.log("\nAll intake-r6-production-agg checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
