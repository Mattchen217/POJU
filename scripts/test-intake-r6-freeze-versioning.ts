/**
 * Stage 3.2 — Freeze / Versioning Intake resolver unification.
 *   pnpm exec tsx scripts/test-intake-r6-freeze-versioning.ts
 *   pnpm test:intake-r6-freeze-versioning
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
memoryStore.set("pojulife_device_id_v4", "dev_intake_r6_freeze_v2");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

const NOW = "2026-11-05T16:00:00.000Z";
const NA_CODE = "explicit_not_applicable";
const SESS = "sess_freeze_v2_pure";
const CTX = "dc_freeze_v2";

async function main() {
  console.log("intake-r6-freeze-versioning");

  const {
    aggregateDirStateIntake,
    aggregateDirState,
    applySufficiencyFreezeToSession,
    buildNaValidationContextFromSession,
    computeContentHash,
    computeUnresolvedCount,
    freezeDecisionContext,
    freezeDraftForDelivery,
    FreezeError,
    naValidationBoundToDc,
    persistV2FromFinalOnSession,
    plannerAggregatorRoleMismatches,
    reaggregateDirsIntake,
    reaggregateDirsOnSession,
    snapshotFromDc,
    startV2FromFinal,
    VersioningError,
    ensureSessionFrozenForDelivery,
  } = await import("../lib/poju/decision-context");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession, SESSION_CAS_CONFLICT } = await import(
    "../lib/poju/session-mutation"
  );

  type DecisionContext =
    import("../lib/poju/decision-context/types").DecisionContext;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;

  function baseDir(overrides: Partial<DecisionContext["dirs"][number]> = {}) {
    return {
      dir_id: "DIR-A",
      need: "need",
      why: "why",
      required_fact_roles: ["situation"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false,
      ...overrides,
    };
  }

  function makeSufficientDraft(
    overrides: Partial<DecisionContext> = {},
  ): DecisionContext {
    const fact = {
      fact_id: "f_runway",
      statement: "six months runway",
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_runway",
      user_confirmed: true,
      fact_roles: ["situation"],
      related_dir_ids: ["DIR-A"],
    };
    const dir = baseDir();
    const na = naValidationBoundToDc(
      {
        context_id: CTX,
        version: 1,
        status: "draft",
        definition: {
          concrete_event: "Stay or leave",
          stakes: "Income",
          desired_outcome: null,
          decision_question: "Q",
          goal_priorities: [],
          unacceptable_outcomes: [],
        },
        reality_facts: [fact],
        constraints: [],
        hypotheses: [],
        dirs: [dir],
        conflicts: [],
        content_hash: null,
        created_at: NOW,
        updated_at: NOW,
      },
      SESS,
    );
    const dirs = reaggregateDirsIntake(
      [dir],
      [fact],
      [],
      [],
      [],
      na,
    );
    return {
      context_id: CTX,
      version: 1,
      status: "draft",
      definition: {
        concrete_event: "Stay or leave",
        stakes: "Income",
        desired_outcome: null,
        decision_question: "Q",
        goal_priorities: [],
        unacceptable_outcomes: [],
      },
      reality_facts: [fact],
      constraints: [],
      hypotheses: [],
      dirs,
      conflicts: [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
      ...overrides,
    };
  }

  function sessionOf(dc: DecisionContext, extra: Partial<POJUSessionState> = {}) {
    return {
      session_id: SESS,
      decision_context: dc,
      decision_context_versions: [],
      confirmation_events: [
        {
          event_id: "e1_f_runway",
          target_type: "fact",
          fact_id: "f_runway",
          source_turn_id: "t_runway",
          confirmation_turn_id: "t_runway_b",
          confirmation_action_id: "ca_f_runway",
          event_type: "confirm_fact",
          actor: "user",
          confirmed_at: NOW,
          event_version: 1,
        },
      ],
      na_declaration_actions: [],
      ...extra,
    } as POJUSessionState;
  }

  // ---------- A. Freeze ----------
  console.log("\n== A. Freeze Intake aggregation ==");
  {
    const draft = makeSufficientDraft();
    const session = sessionOf(draft);
    const na = buildNaValidationContextFromSession(session, { nowIso: NOW });
    const { frozen } = freezeDecisionContext(draft, {
      stage3_sufficiency_end: true,
      now: NOW,
      naValidation: na,
      expectedSessionId: SESS,
    });
    assert.equal(frozen.status, "final");
    assert.equal(frozen.dirs[0]!.current_state, "known");
    assert.ok(frozen.content_hash);
    console.log("  PASS  Freeze uses Intake → known with linked confirmed fact");

    assert.throws(
      () =>
        freezeDecisionContext(draft, {
          stage3_sufficiency_end: true,
          from_purchase_or_report_cta: true,
          naValidation: na,
        }),
      FreezeError,
    );
    assert.throws(
      () =>
        freezeDecisionContext(draft, {
          stage3_sufficiency_end: true,
          from_stall_or_max_turns: true,
          naValidation: na,
        }),
      FreezeError,
    );
    console.log("  PASS  CTA / stall still blocked");

    // Agenda covered ≠ known: DIR with no matching facts stays unknown → freeze blocked if critical
    const agendaish = makeSufficientDraft({
      reality_facts: [],
      dirs: [
        baseDir({
          required_fact_roles: ["goal:runway"],
          may_affect_p5_ranking: true,
          agenda_item_ids: ["ag_1"],
        }),
      ],
    });
    // re-seed empty facts → critical unknown blocks
    assert.throws(
      () =>
        freezeDecisionContext(agendaish, {
          stage3_sufficiency_end: true,
          naValidation: naValidationBoundToDc(agendaish, SESS),
        }),
      (e: unknown) =>
        e instanceof FreezeError &&
        String(e.message).includes("not sufficient"),
    );
    console.log("  PASS  critical unknown (no role/DIR facts) blocks Freeze");

    // Missing DIR link — Intake unknown vs legacy known; freeze of non-critical unknown may pass with boundaries
    const noLinkFact = {
      ...draft.reality_facts[0]!,
      related_dir_ids: [] as string[],
    };
    const noLinkDraft = {
      ...draft,
      reality_facts: [noLinkFact],
      dirs: [baseDir({ may_affect_p5_ranking: false })],
    };
    const intake = aggregateDirStateIntake(
      noLinkDraft.dirs[0]!,
      [noLinkFact],
      [],
      [],
      [],
      naValidationBoundToDc(noLinkDraft, SESS),
    );
    const legacy = aggregateDirState(noLinkDraft.dirs[0]!, [noLinkFact], []);
    assert.equal(intake.current_state, "unknown");
    assert.equal(legacy.current_state, "known");
    console.log("  PASS  no DIR link → Intake unknown; legacy OR would be known");

    // Scheme A constraint
    const hardDir = baseDir({
      required_fact_roles: ["hard_constraint"],
      may_affect_p5_ranking: false,
    });
    const hardCst = {
      constraint_id: "k1",
      statement: "must keep salary",
      category: "time" as const,
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_k",
      rigidity: "hard" as const,
      user_confirmed: true,
      related_dir_ids: ["DIR-A"],
    };
    const hardDraft = {
      ...draft,
      reality_facts: [],
      constraints: [hardCst],
      dirs: [hardDir],
    };
    const hardNa = naValidationBoundToDc(hardDraft, SESS);
    const hardAgg = reaggregateDirsIntake(
      [hardDir],
      [],
      [],
      [hardCst],
      [],
      hardNa,
    );
    assert.equal(hardAgg[0]!.current_state, "known");
    console.log("  PASS  Scheme A hard_constraint satisfies role");

    // N/A without catalog fail-closed
    const naEv = {
      evidence_id: "na_ev_f",
      target: "dir" as const,
      dir_id: "DIR-A",
      na_condition_code: NA_CODE,
      evidence_type: "user_explicit_na" as const,
      source_ref: { kind: "reality_fact" as const, fact_id: "f_runway" },
      written_by: "code" as const,
      revoked: false,
    };
    const withNaDraft = {
      ...draft,
      explicit_na_evidence: [naEv],
      explicit_na_classifications: [
        {
          classification_id: "na_cls_f",
          context_id: CTX,
          source_ref: naEv.source_ref,
          dir_id: "DIR-A",
          na_condition_code: NA_CODE,
          authority: "user_declared" as const,
          written_by: "code" as const,
          declaration_action_id: "na-act-f",
          declaration_turn_id: "t_na",
          revoked: false,
          expires_at: null,
          created_at: NOW,
        },
      ],
    };
    const sessNa = sessionOf(withNaDraft, {
      na_declaration_actions: [
        {
          declaration_action_id: "na-act-f",
          session_id: SESS,
          context_id: CTX,
          actor: "user",
          control_id: "na_declare",
          source_ref: naEv.source_ref,
          dir_id: "DIR-A",
          na_condition_code: NA_CODE,
          declaration_turn_id: "t_na",
          occurred_at: NOW,
          revoked: false,
          expires_at: null,
        },
      ],
    });
    const noCat = reaggregateDirsOnSession(sessNa, withNaDraft.dirs, {
      nowIso: NOW,
    });
    assert.notEqual(noCat[0]!.current_state, "n_a");
    const withCat = reaggregateDirsOnSession(sessNa, withNaDraft.dirs, {
      nowIso: NOW,
      authority: {
        dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
      },
    });
    assert.equal(withCat[0]!.current_state, "n_a");
    console.log("  PASS  N/A fail-closed without catalog; valid+catalog → n_a");

    // Revoked / cross-context
    const revokedAgg = reaggregateDirsOnSession(
      {
        ...sessNa,
        decision_context: {
          ...withNaDraft,
          explicit_na_evidence: [{ ...naEv, revoked: true }],
        },
      },
      withNaDraft.dirs,
      {
        nowIso: NOW,
        authority: {
          dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
        },
      },
    );
    assert.notEqual(revokedAgg[0]!.current_state, "n_a");
    const crossAgg = reaggregateDirsOnSession(
      {
        ...sessNa,
        decision_context: {
          ...withNaDraft,
          explicit_na_classifications: [
            {
              ...withNaDraft.explicit_na_classifications![0]!,
              context_id: "OTHER",
            },
          ],
        },
      },
      withNaDraft.dirs,
      {
        nowIso: NOW,
        authority: {
          dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
        },
      },
    );
    assert.notEqual(crossAgg[0]!.current_state, "n_a");
    console.log("  PASS  revoked / cross-context N/A ineffective");

    // Conflict > N/A; post-agg sufficiency
    const conflictDraft = {
      ...withNaDraft,
      dirs: [baseDir({ may_affect_p5_ranking: true })],
      conflicts: [
        {
          conflict_id: "c_block",
          fact_ids: ["f_runway"],
          conflict_field: "path",
          statements_snapshot: ["a", "b"],
          source_refs: [
            {
              fact_id: "f_runway",
              source_stage: "user_supplement",
              source_turn_id: "t_runway",
            },
          ],
          state: "open" as const,
          resolution: null,
          user_confirmation: false,
          affects_preferred_path: true,
        },
      ],
    };
    assert.throws(
      () =>
        freezeDecisionContext(conflictDraft, {
          stage3_sufficiency_end: true,
          naValidation: buildNaValidationContextFromSession(
            sessionOf(conflictDraft, {
              na_declaration_actions: sessNa.na_declaration_actions,
            }),
            {
              nowIso: NOW,
              dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
            },
          ),
          expectedSessionId: SESS,
        }),
      FreezeError,
    );
    console.log("  PASS  blocking conflict blocks Freeze (post-agg gate)");

    // Session/context mismatch
    assert.throws(
      () =>
        freezeDecisionContext(draft, {
          stage3_sufficiency_end: true,
          naValidation: naValidationBoundToDc(draft, "OTHER_SESS"),
          expectedSessionId: SESS,
        }),
      FreezeError,
    );
    assert.throws(
      () =>
        freezeDecisionContext(draft, {
          stage3_sufficiency_end: true,
          naValidation: {
            ...na,
            contextId: "OTHER_DC",
          },
        }),
      FreezeError,
    );
    console.log("  PASS  Session/DC mismatch rejected");
  }

  // ---------- B. Versioning ----------
  console.log("\n== B. Versioning Intake aggregation ==");
  {
    const draft = makeSufficientDraft();
    const session = sessionOf(draft);
    const { frozen } = freezeDecisionContext(draft, {
      stage3_sufficiency_end: true,
      now: NOW,
      naValidation: buildNaValidationContextFromSession(session, {
        nowIso: NOW,
      }),
      expectedSessionId: SESS,
    });
    const v1Hash = frozen.content_hash!;
    const frozenCopy = structuredClone(frozen);

    const extra = {
      fact_id: "f_extra",
      statement: "new note",
      status: "unverified" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_extra",
      user_confirmed: false,
      fact_roles: ["situation"],
      related_dir_ids: ["DIR-A"],
    };
    const { superseded, draft: v2 } = startV2FromFinal(frozen, {
      now: "2026-11-05T17:00:00.000Z",
      add_facts: [extra],
      affected_dir_ids: ["DIR-A"],
      naValidation: naValidationBoundToDc(frozen, SESS),
    });
    assert.equal(superseded.status, "superseded");
    assert.equal(superseded.content_hash, v1Hash);
    assert.equal(frozenCopy.content_hash, v1Hash);
    assert.equal(v2.status, "draft");
    assert.equal(v2.content_hash, null);
    assert.equal(v2.version, frozen.version + 1);
    assert.ok(v2.reality_facts.some((f) => f.fact_id === "f_extra"));
    assert.equal(
      v2.dirs.find((d) => d.dir_id === "DIR-A")?.satisfaction,
      "reaggregated_after_v2_supplement",
    );
    // V1 immutable — mutating v2 facts must not change frozenCopy
    v2.reality_facts.push({
      ...extra,
      fact_id: "f_should_not_touch_v1",
    });
    assert.equal(
      frozenCopy.reality_facts.some((f) => f.fact_id === "f_should_not_touch_v1"),
      false,
    );
    console.log("  PASS  V1 superseded + hash stable; V2 draft; deep clone");

    assert.throws(
      () =>
        startV2FromFinal(frozen, {
          naValidation: naValidationBoundToDc(frozen, "OTHER"),
          expectedSessionId: SESS,
        }),
      VersioningError,
    );
    console.log("  PASS  Versioning Session mismatch rejected");

    const conflictV2 = startV2FromFinal(frozen, {
      naValidation: naValidationBoundToDc(frozen, SESS),
      add_conflicts: [
        {
          conflict_id: "c_v2",
          fact_ids: ["f_runway"],
          conflict_field: "path",
          statements_snapshot: ["x", "y"],
          source_refs: [
            {
              fact_id: "f_runway",
              source_stage: "user_supplement",
              source_turn_id: "t_runway",
            },
          ],
          state: "open",
          resolution: null,
          user_confirmation: false,
          affects_preferred_path: true,
        },
      ],
    });
    assert.equal(
      conflictV2.draft.dirs.find((d) => d.dir_id === "DIR-A")?.current_state,
      "conflict",
    );
    console.log("  PASS  V2 add_conflicts → Intake conflict state");
  }

  // ---------- C. Production persist ----------
  console.log("\n== C. Production Freeze / V2 persist ==");
  {
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
    const sid = await createPOJUSession({
      payment_id: "pay_freeze_v2",
      original_question: "freeze v2",
    });
    const draft = makeSufficientDraft({ context_id: `dc_${sid}` });
    // Align fact related_dir and context
    draft.reality_facts = draft.reality_facts.map((f) => ({
      ...f,
      related_dir_ids: ["DIR-A"],
    }));
    draft.dirs = reaggregateDirsIntake(
      draft.dirs,
      draft.reality_facts,
      [],
      [],
      [],
      naValidationBoundToDc(draft, sid),
    );

    await mutatePOJUSession(sid, {
      operation_id: "op_seed_freeze_draft",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        const ctxId = `dc_${sid}`;
        const seededDraft = {
          ...draft,
          context_id: ctxId,
        };
        // Re-aggregate under the live session id / context id.
        const na = naValidationBoundToDc(seededDraft, sid, { nowIso: NOW });
        seededDraft.dirs = reaggregateDirsIntake(
          seededDraft.dirs,
          seededDraft.reality_facts,
          seededDraft.conflicts,
          seededDraft.constraints,
          seededDraft.explicit_na_evidence ?? [],
          na,
        );
        return {
          ...latest,
          agent_v2: latest.agent_v2
            ? {
                ...latest.agent_v2,
                stall_offer_pending: false,
                delivery_mode: "full" as const,
              }
            : latest.agent_v2,
          confirmation_events: [
            {
              event_id: "e1_seed",
              target_type: "fact" as const,
              fact_id: "f_runway",
              source_turn_id: "t_runway",
              confirmation_turn_id: "t_runway_b",
              confirmation_action_id: "ca_seed",
              event_type: "confirm_fact" as const,
              actor: "user" as const,
              confirmed_at: NOW,
              event_version: 1,
            },
          ],
          decision_context: seededDraft,
        };
      },
    });

    let sess = (await loadPOJUSession(sid))!;
    // Fix context_id on draft after load
    const liveDraft = sess.decision_context!;
    assert.equal(liveDraft.status, "draft");

    const freeze = await ensureSessionFrozenForDelivery(sess, {
      trigger: "pre_delivery_safety",
      now: NOW,
    });
    if (!freeze.ok || ("skipped" in freeze && freeze.skipped)) {
      throw new Error(
        `freeze unexpected: ok=${freeze.ok} detail=${JSON.stringify(freeze)}`,
      );
    }
    sess = (await loadPOJUSession(sid))!;
    assert.equal(sess.decision_context?.status, "final");
    assert.ok(sess.decision_context?.content_hash);
    const v1Hash = sess.decision_context!.content_hash!;
    const versionsAfterFreeze = sess.decision_context_versions ?? [];
    assert.ok(versionsAfterFreeze.length >= 1);
    console.log("  PASS  ensureSessionFrozenForDelivery persist + reload");

    // Final immutable via assert path — second freeze skips
    const again = applySufficiencyFreezeToSession(sess);
    assert.equal(again.ok, true);
    assert.equal("skipped" in again && again.skipped, true);

    // V2 persist
    const v2 = await persistV2FromFinalOnSession(sess, {
      now: "2026-11-05T18:00:00.000Z",
      add_facts: [
        {
          fact_id: "f_v2_only",
          statement: "supplement",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "user_supplement",
          source_turn_id: "t_v2",
          user_confirmed: false,
          fact_roles: ["situation"],
          related_dir_ids: ["DIR-A"],
        },
      ],
      affected_dir_ids: ["DIR-A"],
    });
    assert.equal(v2.ok, true);
    assert.equal("skipped" in v2 && v2.skipped, false);
    if (!v2.ok || ("skipped" in v2 && v2.skipped)) throw new Error("v2 fail");
    sess = (await loadPOJUSession(sid))!;
    assert.equal(sess.decision_context?.status, "draft");
    assert.equal(sess.decision_context?.content_hash, null);
    assert.equal(sess.decision_context?.version, 2);
    assert.ok(
      sess.decision_context!.reality_facts.some((f) => f.fact_id === "f_v2_only"),
    );
    // V1 history hash intact in versions
    const v1Snap = (sess.decision_context_versions ?? []).find(
      (v) => v.version === 1,
    );
    assert.ok(v1Snap);
    assert.equal(v1Snap!.content_hash, v1Hash);
    console.log("  PASS  persistV2FromFinalOnSession + reload; V1 history intact");

    // Idempotent V2 key
    const v2again = await persistV2FromFinalOnSession(sess, {
      now: "2026-11-05T18:00:00.000Z",
      operation_id: v2.idempotency_key,
    });
    assert.equal(v2again.ok, true);
    // already draft — not_final skip OR idempotent
    assert.ok(
      ("skipped" in v2again && v2again.skipped) ||
        sess.decision_context?.version === 2,
    );

    // CAS conflict on a patch that re-freezes is N/A; exercise mutate conflict on V2 draft note
    let conflictInjected = false;
    await mutatePOJUSession(
      sid,
      {
        operation_id: "op_cas_v2_touch",
        kind: "session_patch",
        bump_dc: true,
        apply: (latest) => {
          const dc = latest.decision_context!;
          return {
            ...latest,
            decision_context: {
              ...dc,
              information_boundaries: [
                ...(dc.information_boundaries ?? []),
                "cas_touch",
              ],
              updated_at: NOW,
            },
          };
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
    assert.equal(conflictInjected, true);
    sess = (await loadPOJUSession(sid))!;
    assert.equal(
      (sess.decision_context?.information_boundaries ?? []).filter(
        (b) => b === "cas_touch",
      ).length,
      1,
    );
    console.log("  PASS  CAS conflict retry no duplicate boundary");
  }

  // ---------- D. Three-path consistency ----------
  console.log("\n== D. Planner / Aggregator / Freeze consistency ==");
  {
    const draft = makeSufficientDraft();
    const session = sessionOf(draft);
    const na = buildNaValidationContextFromSession(session, { nowIso: NOW });
    const dir = draft.dirs[0]!;

    const agg = aggregateDirStateIntake(
      dir,
      draft.reality_facts,
      draft.conflicts,
      draft.constraints,
      draft.explicit_na_evidence ?? [],
      na,
    );
    const planner = computeUnresolvedCount(
      {
        candidate_id: "cq",
        kind: "dir_based",
        dir_ids: [dir.dir_id],
        ddr_ids: [],
        fact_role_codes: dir.required_fact_roles.map(
          (r) => `v1/dir/${dir.dir_id}/role/${r}`,
        ),
        impact: {
          decision_critical: false,
          may_affect_p5_ranking: false,
          gate_class: "P1",
        },
      },
      snapshotFromDc(draft),
      na,
    );
    assert.deepEqual(
      plannerAggregatorRoleMismatches({
        dir,
        plannerRoleStates: planner.role_states,
        aggregatorRoleStates: agg.role_states,
      }),
      [],
    );
    assert.equal(agg.current_state, "known");
    assert.equal(planner.unresolved_count, 0);

    const { frozen } = freezeDecisionContext(draft, {
      stage3_sufficiency_end: true,
      naValidation: na,
      expectedSessionId: SESS,
      now: NOW,
    });
    assert.equal(frozen.dirs[0]!.current_state, agg.current_state);

    const prodAgg = reaggregateDirsOnSession(session, draft.dirs, {
      nowIso: NOW,
    });
    assert.equal(prodAgg[0]!.current_state, frozen.dirs[0]!.current_state);
    console.log(
      "  PASS  Planner / Production agg / Freeze agree on role_states + current_state",
    );
  }

  // ---------- E. Session/DC business snapshot binding ----------
  console.log("\n== E. freezeDraftForDelivery Session/DC snapshot binding ==");
  {
    const draft = makeSufficientDraft();
    const session = sessionOf(draft);

    assert.throws(
      () =>
        freezeDraftForDelivery(
          { ...draft, context_id: "OTHER_CTX" },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error && String(e.message).includes("context_id mismatch"),
    );
    console.log("  PASS  context_id mismatch → reject");

    assert.throws(
      () =>
        freezeDraftForDelivery(
          { ...draft, version: draft.version + 1 },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error && String(e.message).includes("version mismatch"),
    );
    console.log("  PASS  version mismatch → reject");

    assert.throws(
      () =>
        freezeDraftForDelivery(draft, {
          session: sessionOf({ ...draft, status: "final", content_hash: "a".repeat(64) }),
          now: NOW,
        }),
      (e: unknown) =>
        e instanceof Error &&
        String(e.message).includes("session DC status must be draft"),
    );
    console.log("  PASS  session final + draft draft → reject");

    assert.throws(
      () =>
        freezeDraftForDelivery(
          {
            ...draft,
            reality_facts: [
              {
                ...draft.reality_facts[0]!,
                statement: "TAMPERED FACT",
              },
            ],
          },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error &&
        String(e.message).includes("reality_facts"),
    );
    console.log("  PASS  facts diverge → reject");

    assert.throws(
      () =>
        freezeDraftForDelivery(
          {
            ...draft,
            explicit_na_evidence: [
              {
                evidence_id: "na_ev_tamper",
                target: "dir",
                dir_id: "DIR-A",
                na_condition_code: NA_CODE,
                evidence_type: "user_explicit_na",
                source_ref: { kind: "reality_fact", fact_id: "f_runway" },
                written_by: "code",
                revoked: false,
              },
            ],
          },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error &&
        String(e.message).includes("explicit_na_evidence"),
    );
    console.log("  PASS  Explicit N/A Evidence diverge → reject");

    assert.throws(
      () =>
        freezeDraftForDelivery(
          {
            ...draft,
            constraints: [
              {
                constraint_id: "k_tamper",
                statement: "tampered",
                category: "time",
                status: "confirmed",
                verification_level: "user_asserted",
                source_stage: "user_supplement",
                source_turn_id: "t_k",
                rigidity: "hard",
                user_confirmed: true,
                related_dir_ids: ["DIR-A"],
              },
            ],
          },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error && String(e.message).includes("constraints"),
    );
    assert.throws(
      () =>
        freezeDraftForDelivery(
          {
            ...draft,
            conflicts: [
              {
                conflict_id: "c_tamper",
                fact_ids: ["f_runway"],
                conflict_field: "path",
                statements_snapshot: ["a", "b"],
                source_refs: [
                  {
                    fact_id: "f_runway",
                    source_stage: "user_supplement",
                    source_turn_id: "t_runway",
                  },
                ],
                state: "open",
                resolution: null,
                user_confirmation: false,
                affects_preferred_path: false,
              },
            ],
          },
          { session, now: NOW },
        ),
      (e: unknown) =>
        e instanceof Error && String(e.message).includes("conflicts"),
    );
    console.log("  PASS  constraints / conflicts diverge → reject");

    const pack = freezeDraftForDelivery(structuredClone(draft), {
      session,
      now: NOW,
    });
    assert.equal(pack.frozen.status, "final");
    assert.ok(pack.frozen.content_hash);
    assert.equal(pack.version_snapshot.content_hash, pack.frozen.content_hash);
    assert.equal(pack.binding.context_hash, pack.frozen.content_hash);
    console.log("  PASS  identical snapshot → Freeze OK");

    // Persist + reload: use ensureSessionFrozen path already seeded in C; also
    // verify matching clone freeze then in-memory apply keeps hash.
    const applied = applySufficiencyFreezeToSession(session, { now: NOW });
    assert.equal(applied.ok, true);
    if (!applied.ok || ("skipped" in applied && applied.skipped)) {
      throw new Error("expected matching freeze apply");
    }
    assert.equal(
      applied.session.decision_context?.content_hash,
      pack.frozen.content_hash,
    );
    assert.equal(
      computeContentHash(applied.pack.version_snapshot),
      applied.pack.frozen.content_hash,
    );
    console.log(
      "  PASS  matching Freeze → version snapshot + content_hash consistent",
    );
  }

  console.log("\nAll intake-r6-freeze-versioning checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
