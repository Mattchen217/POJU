/**
 * S4 — Write / Freeze consistency (C01–C25).
 *   pnpm test:intake-r6-write-freeze-consistency
 *
 * Production entries: declareDirNotApplicable / revokeDirNaDeclaration /
 * ensureSessionFrozenForDelivery / buildFreezeNaValidationFromSession /
 * findValidatedDirLevelNa / reaggregateDirsIntake.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_intake_r6_s4_wfc");

const NOW = "2026-11-05T12:00:00.000Z";
const SSOT_DIR = "DIR-DEF-UNACCEPTABLE";
const SSOT_CODE = "explicit_no_hard_red_lines";
const T_ACTION = "2026-12-05T12:00:00.000Z"; // NOW + 30d
const T_CLS = "2027-01-04T12:00:00.000Z"; // NOW + 60d — both future, unequal

let passed = 0;
let failed = 0;
let untested = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label: string, e: unknown) {
  failed += 1;
  console.error(`  FAIL  ${label}`);
  console.error(e);
}

function markUntested(label: string, detail: string) {
  untested += 1;
  console.log(`  UNTESTED  ${label}`);
  console.log(`           ${detail}`);
}

async function check(
  label: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
    pass(label);
  } catch (e) {
    fail(label, e);
  }
}

async function main() {
  console.log("intake-r6-write-freeze-consistency (S4 C01–C25)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession, deletePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const {
    mutatePOJUSession,
    casWritePOJUSession,
    SESSION_CAS_CONFLICT,
    SessionCasError,
    isSessionCasError,
  } = await import("../lib/poju/session-mutation");
  const {
    declareDirNotApplicable,
    revokeDirNaDeclaration,
    NaDeclarationError,
    NA_DECLARATION_CONTEXT_INVALID,
  } = await import("../lib/poju/decision-context/na-declaration");
  const {
    findValidatedDirLevelNa,
    validateExplicitNaEvidence,
  } = await import("../lib/poju/decision-context/explicit-na-validate");
  const {
    buildFreezeNaValidationFromSession,
    freezeDraftForDelivery,
    ensureSessionFrozenForDelivery,
    reaggregateDirsIntake,
    bindingFromDecisionContext,
  } = await import("../lib/poju/decision-context");

  type DecisionContext =
    import("../lib/poju/decision-context/types").DecisionContext;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type ExplicitNaClassification =
    import("../lib/poju/decision-context/types").ExplicitNaClassification;
  type ExplicitNaEvidence =
    import("../lib/poju/decision-context/types").ExplicitNaEvidence;
  type ConfirmationEvent =
    import("../lib/poju/decision-context/confirmation-event").ConfirmationEvent;
  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const emptyDefinition = {
    concrete_event: "Stay or leave",
    stakes: "Income",
    desired_outcome: null,
    decision_question: "Q",
    goal_priorities: [] as string[],
    unacceptable_outcomes: [] as string[],
  };

  function makeDc(
    partial: Partial<DecisionContext> &
      Pick<DecisionContext, "context_id" | "version">,
  ): DecisionContext {
    const now = partial.updated_at ?? NOW;
    return {
      context_id: partial.context_id,
      version: partial.version,
      status: partial.status ?? "draft",
      definition: partial.definition ?? emptyDefinition,
      reality_facts: partial.reality_facts ?? [],
      constraints: partial.constraints ?? [],
      hypotheses: partial.hypotheses ?? [],
      dirs: partial.dirs ?? [],
      conflicts: partial.conflicts ?? [],
      explicit_na_evidence: partial.explicit_na_evidence,
      explicit_na_classifications: partial.explicit_na_classifications,
      content_hash: partial.content_hash ?? null,
      created_at: partial.created_at ?? now,
      updated_at: now,
      information_boundaries: partial.information_boundaries,
      delivery_mode: partial.delivery_mode,
      superseded_by: partial.superseded_by,
      parent_version: partial.parent_version,
    };
  }

  function ssotFact(factId = "fact_s4") {
    return {
      fact_id: factId,
      statement: "no hard red lines",
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_s4",
      user_confirmed: true,
      fact_roles: ["situation"],
      related_dir_ids: [SSOT_DIR],
    };
  }

  function ssotDir() {
    return {
      dir_id: SSOT_DIR,
      need: "need",
      why: "why",
      required_fact_roles: ["situation"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: true as const,
    };
  }

  function e1For(factId: string): ConfirmationEvent {
    return {
      event_id: `e1_${factId}`,
      target_type: "fact" as const,
      fact_id: factId,
      source_turn_id: "t_s4",
      confirmation_turn_id: "t_s4b",
      confirmation_action_id: `ca_${factId}`,
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: NOW,
      event_version: 1,
    };
  }

  async function seedDraftSession(
    tag: string,
    overrides: {
      status?: DecisionContext["status"];
      factId?: string;
      extraFacts?: DecisionContext["reality_facts"];
      conflicts?: DecisionContext["conflicts"];
      clearStall?: boolean;
    } = {},
  ): Promise<string> {
    const sid = await createPOJUSession({
      payment_id: `pay_s4_${tag}`,
      original_question: `s4 ${tag}`,
    });
    const factId = overrides.factId ?? `fact_${tag}`;
    await mutatePOJUSession(sid, {
      operation_id: `op_seed_${tag}`,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => {
        const facts = [ssotFact(factId), ...(overrides.extraFacts ?? [])];
        const dc = makeDc({
          context_id: `dc_${tag}`,
          version: 1,
          status: overrides.status ?? "draft",
          reality_facts: facts,
          dirs: [ssotDir()],
          conflicts: overrides.conflicts ?? [],
        });
        return {
          ...latest,
          agent_v2: latest.agent_v2
            ? {
                ...latest.agent_v2,
                stall_offer_pending: false,
                delivery_mode: "full" as const,
              }
            : latest.agent_v2,
          confirmation_events: [e1For(factId)],
          decision_context: dc,
        };
      },
    });
    return sid;
  }

  function declareInput(
    tag: string,
    overrides: Partial<{
      operation_id: string;
      declaration_action_id: string;
      fact_id: string;
      dir_id: string;
      na_condition_code: string;
      dir_na_conditions: readonly string[];
      expires_at: string | null;
      declaration_turn_id: string;
      constraint_id: string;
    }> = {},
  ) {
    const base: Record<string, unknown> = {
      operation_id: overrides.operation_id ?? `op_declare_${tag}`,
      declaration_action_id: overrides.declaration_action_id ?? `na-act-${tag}`,
      control_id: "na_declare" as const,
      dir_id: overrides.dir_id ?? SSOT_DIR,
      na_condition_code: overrides.na_condition_code ?? SSOT_CODE,
      declaration_turn_id: overrides.declaration_turn_id ?? `turn_${tag}`,
      dir_na_conditions: overrides.dir_na_conditions ?? [SSOT_CODE],
      occurred_at: NOW,
    };
    if (overrides.constraint_id) {
      base.constraint_id = overrides.constraint_id;
    } else {
      base.fact_id = overrides.fact_id ?? `fact_${tag}`;
    }
    if (overrides.expires_at !== undefined) {
      base.expires_at = overrides.expires_at;
    }
    return base as Parameters<typeof declareDirNotApplicable>[1];
  }

  function businessBaseline(s: POJUSessionState): string {
    const dc = s.decision_context;
    return JSON.stringify({
      actions: s.na_declaration_actions ?? [],
      classifications: dc?.explicit_na_classifications ?? [],
      evidence: dc?.explicit_na_evidence ?? [],
      dc: dc
        ? {
            context_id: dc.context_id,
            version: dc.version,
            status: dc.status,
            updated_at: dc.updated_at,
            content_hash: dc.content_hash,
            dirs: dc.dirs,
            conflicts: dc.conflicts,
            reality_facts: dc.reality_facts,
          }
        : null,
    });
  }

  function freezeNa(session: POJUSessionState) {
    const dc = session.decision_context!;
    return buildFreezeNaValidationFromSession(session, dc, { now: NOW });
  }

  function dirStateAfterAgg(session: POJUSessionState): string | undefined {
    const dc = session.decision_context!;
    const na = freezeNa(session);
    const dirs = reaggregateDirsIntake(
      dc.dirs,
      dc.reality_facts,
      dc.conflicts,
      dc.constraints,
      dc.explicit_na_evidence ?? [],
      na,
    );
    return dirs.find((d) => d.dir_id === SSOT_DIR)?.current_state;
  }

  function assertNotNa(session: POJUSessionState, why: string) {
    const na = freezeNa(session);
    const validated = findValidatedDirLevelNa(
      SSOT_DIR,
      session.decision_context?.explicit_na_evidence,
      na,
    );
    assert.equal(validated, null, `${why}: findValidatedDirLevelNa must be null`);
    const state = dirStateAfterAgg(session);
    assert.notEqual(state, "n_a", `${why}: DIR must not be n_a (got ${state})`);
  }

  function withTamperedClassification(
    session: POJUSessionState,
    patch: (c: ExplicitNaClassification) => ExplicitNaClassification,
  ): POJUSessionState {
    const dc = session.decision_context!;
    const classifications = (dc.explicit_na_classifications ?? []).map(patch);
    return {
      ...session,
      decision_context: { ...dc, explicit_na_classifications: classifications },
    };
  }

  function withTamperedEvidence(
    session: POJUSessionState,
    patch: (e: ExplicitNaEvidence) => ExplicitNaEvidence,
  ): POJUSessionState {
    const dc = session.decision_context!;
    const evidence = (dc.explicit_na_evidence ?? []).map(patch);
    return {
      ...session,
      decision_context: { ...dc, explicit_na_evidence: evidence },
    };
  }

  // ========== C01–C06 legal write → persist → n_a → freeze compose ==========
  console.log("\n== C01–C06 legal write / persist / freeze ==");

  const sidMain = await seedDraftSession("main");
  const inputMain = declareInput("main");

  await check("C01 declareDirNotApplicable triad key fields", async () => {
    const r = await declareDirNotApplicable(sidMain, inputMain);
    assert.equal(r.outcome, "appended");
    assert.equal(r.action.declaration_action_id, "na-act-main");
    assert.equal(r.action.session_id, sidMain);
    assert.equal(r.action.context_id, "dc_main");
    assert.equal(r.action.actor, "user");
    assert.equal(r.action.control_id, "na_declare");
    assert.equal(r.action.dir_id, SSOT_DIR);
    assert.equal(r.action.na_condition_code, SSOT_CODE);
    assert.equal(r.action.declaration_turn_id, "turn_main");
    assert.equal(r.action.revoked, false);
    assert.equal(r.action.expires_at, null);
    assert.equal(r.action.source_ref.kind, "reality_fact");
    assert.equal(
      r.classification.authority,
      "user_declared",
    );
    assert.equal(r.classification.written_by, "code");
    assert.equal(
      r.classification.declaration_action_id,
      r.action.declaration_action_id,
    );
    assert.equal(r.classification.dir_id, r.action.dir_id);
    assert.equal(
      r.classification.na_condition_code,
      r.action.na_condition_code,
    );
    assert.equal(
      r.classification.declaration_turn_id,
      r.action.declaration_turn_id,
    );
    assert.equal(r.classification.expires_at, r.action.expires_at);
    assert.equal(r.evidence.evidence_type, "user_explicit_na");
    assert.equal(r.evidence.target, "dir");
    assert.equal(
      r.evidence.evidence_id,
      `na_ev_${r.action.declaration_action_id}`,
    );
    assert.equal(r.evidence.written_by, "code");
    assert.equal(r.evidence.revoked, false);
  });

  let loadedMain: POJUSessionState | null = null;
  await check("C02 loadPOJUSession triad durable", async () => {
    loadedMain = await loadPOJUSession(sidMain);
    assert.ok(loadedMain);
    assert.equal((loadedMain!.na_declaration_actions ?? []).length, 1);
    assert.equal(
      (loadedMain!.decision_context?.explicit_na_classifications ?? []).length,
      1,
    );
    assert.ok(
      (loadedMain!.decision_context?.explicit_na_evidence ?? []).some(
        (e) => e.evidence_id === "na_ev_na-act-main",
      ),
    );
  });

  await check("C03 reaggregate → DIR n_a", async () => {
    const s = (await loadPOJUSession(sidMain))!;
    assert.equal(dirStateAfterAgg(s), "n_a");
    const na = freezeNa(s);
    assert.ok(
      findValidatedDirLevelNa(
        SSOT_DIR,
        s.decision_context?.explicit_na_evidence,
        na,
      ),
    );
  });

  await check("C04 freeze compose → frozen DIR n_a", async () => {
    const s = (await loadPOJUSession(sidMain))!;
    // Reaggregate dirs onto draft before freeze so sufficiency sees n_a.
    const dc = s.decision_context!;
    const na = freezeNa(s);
    const dirs = reaggregateDirsIntake(
      dc.dirs,
      dc.reality_facts,
      dc.conflicts,
      dc.constraints,
      dc.explicit_na_evidence ?? [],
      na,
    );
    await mutatePOJUSession(sidMain, {
      operation_id: "op_reagg_main",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        decision_context: {
          ...latest.decision_context!,
          dirs,
          version: latest.decision_context!.version + 1,
          updated_at: NOW,
        },
      }),
    });
    const s2 = (await loadPOJUSession(sidMain))!;
    const pack = freezeDraftForDelivery(
      structuredClone(s2.decision_context!),
      { session: s2, now: NOW },
    );
    assert.equal(pack.frozen.status, "final");
    assert.equal(
      pack.frozen.dirs.find((d) => d.dir_id === SSOT_DIR)?.current_state,
      "n_a",
    );
  });

  await check("C05/C06 version_snapshot + hash/binding (compose pack)", async () => {
    const s = (await loadPOJUSession(sidMain))!;
    // still draft after C04 compose-only; re-seed dirs if needed
    const dc = s.decision_context!;
    assert.equal(dc.status, "draft");
    const pack = freezeDraftForDelivery(structuredClone(dc), {
      session: s,
      now: NOW,
    });
    assert.equal(pack.version_snapshot.context_id, pack.frozen.context_id);
    assert.equal(pack.version_snapshot.version, pack.frozen.version);
    assert.deepEqual(
      pack.version_snapshot.dirs.map((d) => ({
        dir_id: d.dir_id,
        current_state: d.current_state,
      })),
      pack.frozen.dirs.map((d) => ({
        dir_id: d.dir_id,
        current_state: d.current_state,
      })),
    );
    assert.ok(pack.frozen.content_hash);
    const binding = bindingFromDecisionContext(pack.frozen);
    assert.equal(binding.context_id, pack.frozen.context_id);
    assert.equal(binding.context_version, pack.frozen.version);
    assert.equal(binding.context_hash, pack.frozen.content_hash);
    assert.equal(pack.binding.context_hash, pack.frozen.content_hash);
  });

  // ========== C07 / C08 forged / bad membership ==========
  console.log("\n== C07–C08 catalog membership ==");

  await check("C07 forged dir_na_conditions ignored (legal SSOT still ok)", async () => {
    const sid = await seedDraftSession("c07");
    const r = await declareDirNotApplicable(
      sid,
      declareInput("c07", {
        dir_na_conditions: ["forged_allow_all", "explicit_totally_fake"],
      }),
    );
    assert.equal(r.outcome, "appended");
    const s = (await loadPOJUSession(sid))!;
    assert.equal(dirStateAfterAgg(s), "n_a");
  });

  await check("C08 bad DIR/condition write reject", async () => {
    const sid = await seedDraftSession("c08");
    let rejected = false;
    try {
      await declareDirNotApplicable(
        sid,
        declareInput("c08", {
          dir_id: "DIR-NOT-REGISTERED",
          na_condition_code: SSOT_CODE,
        }),
      );
    } catch (err) {
      rejected = err instanceof NaDeclarationError;
    }
    assert.equal(rejected, true);
    const s = (await loadPOJUSession(sid))!;
    assert.equal((s.na_declaration_actions ?? []).length, 0);
  });

  // ========== C09 / C10 tamper fixtures ==========
  console.log("\n== C09–C10 binding tampers ==");

  async function legalThen(
    tag: string,
  ): Promise<POJUSessionState> {
    const sid = await seedDraftSession(tag);
    await declareDirNotApplicable(sid, declareInput(tag));
    const s = (await loadPOJUSession(sid))!;
    assert.equal(dirStateAfterAgg(s), "n_a", `${tag} setup must be n_a`);
    return s;
  }

  await check("C09a classification declaration_action_id mismatch", async () => {
    const s = await legalThen("c09a");
    const tampered = withTamperedClassification(s, (c) =>
      c.declaration_action_id === "na-act-c09a"
        ? { ...c, declaration_action_id: "na-act-WRONG" }
        : c,
    );
    assertNotNa(tampered, "C09a");
  });

  await check("C09b classification dir_id / condition mismatch", async () => {
    const s = await legalThen("c09b");
    const tampered = withTamperedClassification(s, (c) =>
      c.declaration_action_id === "na-act-c09b"
        ? { ...c, dir_id: "DIR-DEF-QUESTION" }
        : c,
    );
    assertNotNa(tampered, "C09b");
  });

  await check("C09c classification source_ref mismatch", async () => {
    const s = await legalThen("c09c");
    const tampered = withTamperedClassification(s, (c) =>
      c.declaration_action_id === "na-act-c09c"
        ? {
            ...c,
            source_ref: { kind: "reality_fact", fact_id: "fact_other" },
          }
        : c,
    );
    assertNotNa(tampered, "C09c");
  });

  await check("C09d classification context_id / turn mismatch", async () => {
    const s = await legalThen("c09d");
    const tampered = withTamperedClassification(s, (c) =>
      c.declaration_action_id === "na-act-c09d"
        ? { ...c, declaration_turn_id: "turn_OTHER" }
        : c,
    );
    assertNotNa(tampered, "C09d");
  });

  await check(
    "C09e both unexpired but unequal expires_at → not n_a",
    async () => {
      const sid = await seedDraftSession("c09e");
      await declareDirNotApplicable(
        sid,
        declareInput("c09e", { expires_at: T_ACTION }),
      );
      const s = (await loadPOJUSession(sid))!;
      assert.equal(dirStateAfterAgg(s), "n_a");
      // Tamper ONLY Classification.expires_at to a different future ISO.
      const tampered = withTamperedClassification(s, (c) =>
        c.declaration_action_id === "na-act-c09e"
          ? { ...c, expires_at: T_CLS }
          : c,
      );
      const action = (tampered.na_declaration_actions ?? []).find(
        (a) => a.declaration_action_id === "na-act-c09e",
      )!;
      const cls = (
        tampered.decision_context?.explicit_na_classifications ?? []
      ).find((c) => c.declaration_action_id === "na-act-c09e")!;
      assert.equal(action.expires_at, T_ACTION);
      assert.equal(cls.expires_at, T_CLS);
      assert.notEqual(action.expires_at, cls.expires_at);
      // Both still in the future relative to NOW.
      assert.ok(Date.parse(action.expires_at!) > Date.parse(NOW));
      assert.ok(Date.parse(cls.expires_at!) > Date.parse(NOW));
      assertNotNa(tampered, "C09e");
    },
  );

  await check("C10a evidence_id only wrong → not n_a", async () => {
    const s = await legalThen("c10a");
    const tampered = withTamperedEvidence(s, (e) =>
      e.evidence_id === "na_ev_na-act-c10a"
        ? { ...e, evidence_id: "na_ev_WRONG" }
        : e,
    );
    // Other evidence fields remain legal; classification/action untouched.
    const ev = (tampered.decision_context?.explicit_na_evidence ?? []).find(
      (e) => e.evidence_id === "na_ev_WRONG",
    )!;
    assert.equal(ev.evidence_type, "user_explicit_na");
    assert.equal(ev.target, "dir");
    assert.equal(ev.dir_id, SSOT_DIR);
    assert.equal(ev.na_condition_code, SSOT_CODE);
    assert.equal(ev.written_by, "code");
    assert.equal(ev.revoked, false);
    const na = freezeNa(tampered);
    const result = validateExplicitNaEvidence(ev, na);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason_code, "evidence_id_action_mismatch");
    }
    assertNotNa(tampered, "C10a");
  });

  await check("C10b evidence dir/condition mismatch", async () => {
    const s = await legalThen("c10b");
    const tampered = withTamperedEvidence(s, (e) =>
      e.evidence_id === "na_ev_na-act-c10b" && e.target === "dir"
        ? { ...e, dir_id: "DIR-DEF-QUESTION" }
        : e,
    );
    assertNotNa(tampered, "C10b");
  });

  await check("C10c evidence source_ref mismatch", async () => {
    const s = await legalThen("c10c");
    const tampered = withTamperedEvidence(s, (e) =>
      e.evidence_id === "na_ev_na-act-c10c" &&
      e.evidence_type === "user_explicit_na"
        ? {
            ...e,
            source_ref: { kind: "reality_fact", fact_id: "fact_other" },
          }
        : e,
    );
    assertNotNa(tampered, "C10c");
  });

  await check("C10d evidence target/type wrong", async () => {
    const s = await legalThen("c10d");
    const tampered = withTamperedEvidence(s, (e) =>
      e.evidence_id === "na_ev_na-act-c10d"
        ? ({
            evidence_id: e.evidence_id,
            target: "ddr",
            ddr_id: "DDR-03-CHART-APPENDIX",
            na_condition_code: SSOT_CODE,
            evidence_type: "user_explicit_na",
            source_ref:
              e.evidence_type === "user_explicit_na"
                ? e.source_ref
                : { kind: "reality_fact", fact_id: "fact_c10d" },
            written_by: "code",
            revoked: false,
          } as ExplicitNaEvidence)
        : e,
    );
    assertNotNa(tampered, "C10d");
  });

  // ========== C11–C14 revoke / flags / expiry ==========
  console.log("\n== C11–C14 revoke / flags / expiry ==");

  await check("C11 revoke → not n_a", async () => {
    const sid = await seedDraftSession("c11");
    await declareDirNotApplicable(sid, declareInput("c11"));
    await revokeDirNaDeclaration(sid, {
      operation_id: "op_revoke_c11",
      declaration_action_id: "na-act-c11",
      revoked_at: NOW,
    });
    const s = (await loadPOJUSession(sid))!;
    assert.equal(
      (s.na_declaration_actions ?? []).find(
        (a) => a.declaration_action_id === "na-act-c11",
      )?.revoked,
      true,
    );
    assertNotNa(s, "C11");
  });

  await check("C12 classification revoked flag → not n_a", async () => {
    const s = await legalThen("c12");
    const tampered = withTamperedClassification(s, (c) =>
      c.declaration_action_id === "na-act-c12" ? { ...c, revoked: true } : c,
    );
    assertNotNa(tampered, "C12");
  });

  await check("C13 evidence revoked flag → not n_a", async () => {
    const s = await legalThen("c13");
    const tampered = withTamperedEvidence(s, (e) =>
      e.evidence_id === "na_ev_na-act-c13" ? { ...e, revoked: true } : e,
    );
    assertNotNa(tampered, "C13");
  });

  await check("C14 expired action/classification → not n_a", async () => {
    const sid = await seedDraftSession("c14");
    // Write with future expiry (create rejects already-expired), then tamper to past.
    await declareDirNotApplicable(
      sid,
      declareInput("c14", { expires_at: T_ACTION }),
    );
    const s0 = (await loadPOJUSession(sid))!;
    assert.equal(dirStateAfterAgg(s0), "n_a");
    const past = "2026-10-01T00:00:00.000Z";
    const actions = (s0.na_declaration_actions ?? []).map((a) =>
      a.declaration_action_id === "na-act-c14"
        ? { ...a, expires_at: past }
        : a,
    );
    const classifications = (
      s0.decision_context?.explicit_na_classifications ?? []
    ).map((c) =>
      c.declaration_action_id === "na-act-c14"
        ? { ...c, expires_at: past }
        : c,
    );
    const tampered: POJUSessionState = {
      ...s0,
      na_declaration_actions: actions,
      decision_context: {
        ...s0.decision_context!,
        explicit_na_classifications: classifications,
      },
    };
    assertNotNa(tampered, "C14");
  });

  // ========== C15–C18 source / idempotent ==========
  console.log("\n== C15–C18 source / idempotent ==");

  await check("C15 independently_verified source → not n_a", async () => {
    const s0 = await legalThen("c15");
    const dc = s0.decision_context!;
    const facts = dc.reality_facts.map((f) =>
      f.fact_id === "fact_c15"
        ? {
            ...f,
            verification_level: "independently_verified" as const,
          }
        : f,
    );
    const tampered = {
      ...s0,
      decision_context: { ...dc, reality_facts: facts },
    };
    assertNotNa(tampered, "C15");
  });

  await check("C16 unconfirmed / missing E1 → not n_a", async () => {
    const s0 = await legalThen("c16");
    const tampered = { ...s0, confirmation_events: [] };
    assertNotNa(tampered, "C16");
  });

  await check("C17 idempotent skip same payload", async () => {
    const sid = await seedDraftSession("c17");
    const input = declareInput("c17");
    const first = await declareDirNotApplicable(sid, input);
    assert.equal(first.outcome, "appended");
    const again = await declareDirNotApplicable(sid, input);
    assert.equal(again.outcome, "idempotent_skip");
    const s = (await loadPOJUSession(sid))!;
    assert.equal((s.na_declaration_actions ?? []).length, 1);
  });

  await check("C18 binding clash same action_id → reject", async () => {
    const sid = await seedDraftSession("c18", {
      extraFacts: [ssotFact("fact_c18b")],
    });
    await mutatePOJUSession(sid, {
      operation_id: "op_e1_c18b",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        confirmation_events: [
          ...(latest.confirmation_events ?? []),
          e1For("fact_c18b"),
        ],
      }),
    });
    await declareDirNotApplicable(sid, declareInput("c18"));
    let rejected = false;
    try {
      await declareDirNotApplicable(
        sid,
        declareInput("c18", {
          operation_id: "op_declare_c18_clash",
          fact_id: "fact_c18b",
        }),
      );
    } catch (err) {
      rejected =
        err instanceof NaDeclarationError &&
        err.message.includes("idempotent_source_mismatch");
    }
    assert.equal(rejected, true);
  });

  // ========== C19–C21 fail-closed write/revoke ==========
  console.log("\n== C19–C21 draft-only write/revoke ==");

  await check("C19 declare on final → reject; reload unchanged", async () => {
    const sid = await seedDraftSession("c19", { status: "final" });
    const before = businessBaseline((await loadPOJUSession(sid))!);
    let rejected = false;
    try {
      await declareDirNotApplicable(sid, declareInput("c19"));
    } catch (err) {
      rejected =
        err instanceof NaDeclarationError &&
        err.code === NA_DECLARATION_CONTEXT_INVALID &&
        err.message.includes("not writable");
    }
    assert.equal(rejected, true);
    const after = (await loadPOJUSession(sid))!;
    assert.equal(businessBaseline(after), before);
    assert.equal((after.na_declaration_actions ?? []).length, 0);
  });

  await check(
    "C20 declare on superseded → reject; reload unchanged",
    async () => {
      const sid = await seedDraftSession("c20", { status: "superseded" });
      const before = businessBaseline((await loadPOJUSession(sid))!);
      let rejected = false;
      try {
        await declareDirNotApplicable(sid, declareInput("c20"));
      } catch (err) {
        rejected =
          err instanceof NaDeclarationError &&
          err.code === NA_DECLARATION_CONTEXT_INVALID &&
          err.message.includes("not writable");
      }
      assert.equal(rejected, true);
      assert.equal(
        businessBaseline((await loadPOJUSession(sid))!),
        before,
      );
    },
  );

  await check(
    "C21a revoke on final → reject; actions not newly revoked",
    async () => {
      const sid = await seedDraftSession("c21a");
      await declareDirNotApplicable(sid, declareInput("c21a"));
      await mutatePOJUSession(sid, {
        operation_id: "op_force_final_c21a",
        kind: "session_patch",
        bump_dc: true,
        apply: (latest) => ({
          ...latest,
          decision_context: {
            ...latest.decision_context!,
            status: "final",
            content_hash:
              latest.decision_context!.content_hash ??
              "a".repeat(64),
            version: latest.decision_context!.version + 1,
            updated_at: NOW,
          },
        }),
      });
      const beforeSess = (await loadPOJUSession(sid))!;
      const before = businessBaseline(beforeSess);
      assert.equal(
        (beforeSess.na_declaration_actions ?? []).find(
          (a) => a.declaration_action_id === "na-act-c21a",
        )?.revoked,
        false,
      );
      let rejected = false;
      try {
        await revokeDirNaDeclaration(sid, {
          operation_id: "op_revoke_c21a",
          declaration_action_id: "na-act-c21a",
          revoked_at: NOW,
        });
      } catch (err) {
        rejected =
          err instanceof NaDeclarationError &&
          err.code === NA_DECLARATION_CONTEXT_INVALID &&
          err.message.includes("not writable");
      }
      assert.equal(rejected, true);
      const after = (await loadPOJUSession(sid))!;
      assert.equal(businessBaseline(after), before);
      assert.equal(
        (after.na_declaration_actions ?? []).find(
          (a) => a.declaration_action_id === "na-act-c21a",
        )?.revoked,
        false,
      );
    },
  );

  await check(
    "C21b missing DC revoke → reject; actions not revoked; reload stable",
    async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_s4_c21b",
        original_question: "s4 c21b",
      });
      const seededAction = {
        declaration_action_id: "na-act-c21b",
        session_id: sid,
        context_id: "dc_orphan_c21b",
        actor: "user" as const,
        control_id: "na_declare",
        source_ref: {
          kind: "reality_fact" as const,
          fact_id: "fact_orphan",
        },
        dir_id: SSOT_DIR,
        na_condition_code: SSOT_CODE,
        declaration_turn_id: "turn_c21b",
        occurred_at: NOW,
        revoked: false,
        expires_at: null as string | null,
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_seed_c21b_missing_dc",
        kind: "session_patch",
        bump_dc: false,
        apply: (latest) => ({
          ...latest,
          decision_context: null,
          na_declaration_actions: [seededAction],
        }),
      });
      const beforeSess = (await loadPOJUSession(sid))!;
      assert.equal(beforeSess.decision_context, null);
      const before = businessBaseline(beforeSess);
      let rejected = false;
      try {
        await revokeDirNaDeclaration(sid, {
          operation_id: "op_revoke_c21b",
          declaration_action_id: "na-act-c21b",
          revoked_at: NOW,
        });
      } catch (err) {
        rejected =
          err instanceof NaDeclarationError &&
          err.code === NA_DECLARATION_CONTEXT_INVALID &&
          err.message.includes("missing");
      }
      assert.equal(rejected, true);
      const after = (await loadPOJUSession(sid))!;
      assert.equal(businessBaseline(after), before);
      assert.equal(after.decision_context, null);
      assert.equal(
        (after.na_declaration_actions ?? []).find(
          (a) => a.declaration_action_id === "na-act-c21b",
        )?.revoked,
        false,
      );
    },
  );

  // ========== C22 conflict > N/A ==========
  console.log("\n== C22 conflict > N/A ==");

  await check("C22 open blocking conflict → DIR conflict not n_a", async () => {
    const sid = await seedDraftSession("c22", {
      conflicts: [
        {
          conflict_id: "c_c22",
          fact_ids: ["fact_c22"],
          conflict_field: "path",
          statements_snapshot: ["a", "b"],
          source_refs: [
            {
              fact_id: "fact_c22",
              source_stage: "user_supplement",
              source_turn_id: "t_s4",
            },
          ],
          state: "open",
          resolution: null,
          user_confirmation: false,
          affects_preferred_path: true,
        },
      ],
    });
    await declareDirNotApplicable(sid, declareInput("c22"));
    const s = (await loadPOJUSession(sid))!;
    assert.equal(dirStateAfterAgg(s), "conflict");
  });

  // ========== C23 forged authority.dirCatalog ==========
  console.log("\n== C23 forged authority.dirCatalog ==");

  await check("C23 forged dirCatalog ignored on freeze compose", async () => {
    const sid = await seedDraftSession("c23");
    // Seed non-SSOT triad manually (write would reject).
    const forgeDir = "DIR-A";
    const forgeCode = "explicit_not_applicable";
    await mutatePOJUSession(sid, {
      operation_id: "op_seed_c23_forge",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => {
        const fact = {
          fact_id: "fact_c23_forge",
          statement: "forge",
          status: "confirmed" as const,
          verification_level: "user_asserted" as const,
          source_stage: "user_supplement" as const,
          source_turn_id: "t_forge",
          user_confirmed: true,
          fact_roles: ["situation"],
          related_dir_ids: [forgeDir],
        };
        const dir = {
          dir_id: forgeDir,
          need: "need",
          why: "why",
          required_fact_roles: ["situation"],
          current_state: "known" as const,
          partial_satisfaction: false,
          agenda_item_ids: [] as string[],
          id_lifecycle: "active" as const,
          may_affect_p5_ranking: false as const,
        };
        const source_ref = {
          kind: "reality_fact" as const,
          fact_id: "fact_c23_forge",
        };
        const action = {
          declaration_action_id: "na-act-c23",
          session_id: sid,
          context_id: latest.decision_context!.context_id,
          actor: "user" as const,
          control_id: "na_declare",
          source_ref,
          dir_id: forgeDir,
          na_condition_code: forgeCode,
          declaration_turn_id: "turn_c23",
          occurred_at: NOW,
          revoked: false,
          expires_at: null as string | null,
        };
        const classification = {
          classification_id: "na_cls_na-act-c23",
          context_id: latest.decision_context!.context_id,
          source_ref,
          dir_id: forgeDir,
          na_condition_code: forgeCode,
          authority: "user_declared" as const,
          written_by: "code" as const,
          declaration_action_id: "na-act-c23",
          declaration_turn_id: "turn_c23",
          revoked: false,
          expires_at: null as string | null,
          created_at: NOW,
        };
        const evidence = {
          evidence_id: "na_ev_na-act-c23",
          target: "dir" as const,
          dir_id: forgeDir,
          na_condition_code: forgeCode,
          evidence_type: "user_explicit_na" as const,
          source_ref,
          written_by: "code" as const,
          revoked: false,
        };
        return {
          ...latest,
          confirmation_events: [
            ...(latest.confirmation_events ?? []),
            e1For("fact_c23_forge"),
          ],
          na_declaration_actions: [action],
          decision_context: {
            ...latest.decision_context!,
            reality_facts: [
              ...latest.decision_context!.reality_facts,
              fact,
            ],
            dirs: [...latest.decision_context!.dirs, dir],
            explicit_na_classifications: [classification],
            explicit_na_evidence: [evidence],
            version: latest.decision_context!.version + 1,
            updated_at: NOW,
          },
        };
      },
    });
    const s0 = (await loadPOJUSession(sid))!;
    // Mark seeded SSOT DIR non-blocking so freeze sufficiency is not blocked by it.
    const dcReady = {
      ...s0.decision_context!,
      dirs: s0.decision_context!.dirs.map((d) =>
        d.dir_id === SSOT_DIR
          ? {
              ...d,
              current_state: "known" as const,
              may_affect_p5_ranking: false as const,
            }
          : d,
      ),
    };
    const s: POJUSessionState = { ...s0, decision_context: dcReady };
    // Untyped caller payload: `authority` is not part of FreezeDraftForDeliveryOpts.
    const forgedOpts = {
      session: s,
      now: NOW,
      authority: {
        dirCatalog: [{ dir_id: forgeDir, na_conditions: [forgeCode] }],
      },
    };
    const pack = freezeDraftForDelivery(structuredClone(dcReady), forgedOpts);
    const frozenForge = pack.frozen.dirs.find((d) => d.dir_id === forgeDir);
    assert.ok(frozenForge);
    assert.notEqual(frozenForge!.current_state, "n_a");
  });

  // ========== C24 full CAS + post-freeze reload ==========
  console.log("\n== C24 full CAS freeze + reload ==");

  await check("C24 ensureSessionFrozenForDelivery + reload checklist", async () => {
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
    const sid = await seedDraftSession("c24");
    await declareDirNotApplicable(sid, declareInput("c24"));

    // Persist reaggregated dirs so sufficiency sees n_a.
    let sess = (await loadPOJUSession(sid))!;
    {
      const dc = sess.decision_context!;
      const na = freezeNa(sess);
      const dirs = reaggregateDirsIntake(
        dc.dirs,
        dc.reality_facts,
        dc.conflicts,
        dc.constraints,
        dc.explicit_na_evidence ?? [],
        na,
      );
      await mutatePOJUSession(sid, {
        operation_id: "op_reagg_c24",
        kind: "session_patch",
        bump_dc: true,
        apply: (latest) => ({
          ...latest,
          agent_v2: latest.agent_v2
            ? {
                ...latest.agent_v2,
                stall_offer_pending: false,
                delivery_mode: "full" as const,
              }
            : latest.agent_v2,
          decision_context: {
            ...latest.decision_context!,
            dirs,
            version: latest.decision_context!.version + 1,
            updated_at: NOW,
          },
        }),
      });
    }

    sess = (await loadPOJUSession(sid))!;
    assert.equal(sess.decision_context?.status, "draft");
    assert.equal(
      sess.decision_context?.dirs.find((d) => d.dir_id === SSOT_DIR)
        ?.current_state,
      "n_a",
    );

    const freeze = await ensureSessionFrozenForDelivery(sess, {
      trigger: "pre_delivery_safety",
      now: NOW,
    });
    assert.equal(freeze.ok, true);
    assert.ok(!("skipped" in freeze && freeze.skipped), JSON.stringify(freeze));

    const post1 = (await loadPOJUSession(sid))!;
    const dc1 = post1.decision_context!;
    assert.equal(dc1.status, "final");
    assert.equal(
      dc1.dirs.find((d) => d.dir_id === SSOT_DIR)?.current_state,
      "n_a",
    );
    assert.ok(dc1.content_hash);
    const versions = post1.decision_context_versions ?? [];
    const snap = versions.find(
      (v) => v.context_id === dc1.context_id && v.version === dc1.version,
    );
    assert.ok(snap, "decision_context_versions must contain frozen snapshot");
    assert.equal(snap!.content_hash, dc1.content_hash);
    assert.deepEqual(
      snap!.dirs.map((d) => ({ dir_id: d.dir_id, current_state: d.current_state })),
      dc1.dirs.map((d) => ({ dir_id: d.dir_id, current_state: d.current_state })),
    );
    const binding = bindingFromDecisionContext(dc1);
    assert.equal(binding.context_id, dc1.context_id);
    assert.equal(binding.context_version, dc1.version);
    assert.equal(binding.context_hash, dc1.content_hash);
    if (freeze.ok && freeze.pack) {
      assert.equal(freeze.pack.binding.context_hash, dc1.content_hash);
    }
    assert.ok(
      (dc1.explicit_na_classifications ?? []).some(
        (c) => c.declaration_action_id === "na-act-c24" && !c.revoked,
      ),
    );
    assert.ok(
      (dc1.explicit_na_evidence ?? []).some(
        (e) => e.evidence_id === "na_ev_na-act-c24" && !e.revoked,
      ),
    );
    assert.ok(
      (post1.na_declaration_actions ?? []).some(
        (a) => a.declaration_action_id === "na-act-c24" && !a.revoked,
      ),
    );

    const post2 = (await loadPOJUSession(sid))!;
    assert.equal(
      JSON.stringify({
        status: post2.decision_context?.status,
        hash: post2.decision_context?.content_hash,
        version: post2.decision_context?.version,
        dirs: post2.decision_context?.dirs,
        classifications: post2.decision_context?.explicit_na_classifications,
        evidence: post2.decision_context?.explicit_na_evidence,
        actions: post2.na_declaration_actions,
        versions: post2.decision_context_versions,
      }),
      JSON.stringify({
        status: post1.decision_context?.status,
        hash: post1.decision_context?.content_hash,
        version: post1.decision_context?.version,
        dirs: post1.decision_context?.dirs,
        classifications: post1.decision_context?.explicit_na_classifications,
        evidence: post1.decision_context?.explicit_na_evidence,
        actions: post1.na_declaration_actions,
        versions: post1.decision_context_versions,
      }),
    );
  });

  // ========== C25 CAS / IndexedDB persist failure ==========
  // Plan §9: real production-path persist failure, else UNTESTED [production-path].
  // Replacing casWrite with an early throw is NOT production-path evidence.
  console.log("\n== C25 CAS / IndexedDB persist failure ==");

  let c25ProductionPathPass = false;

  // Attempt A — concurrent real casWritePOJUSession race (no early throw).
  // Harness only schedules a second production write; the declare write itself
  // must fail inside casWritePOJUSession / IndexedDB CAS checks.
  try {
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
    const sid = await seedDraftSession("c25a");
    let racedThroughProductionWrite = false;
    let declareErr: unknown = null;
    try {
      await declareDirNotApplicable(sid, declareInput("c25a"), {
        max_retries: 0,
        casWrite: async (args) => {
          const live = (await loadPOJUSession(sid))!;
          await casWritePOJUSession({
            candidate: {
              ...live,
              last_interaction_at: "2026-11-05T12:00:01.000Z",
            },
            expected_session_revision: live.session_revision ?? 0,
            expected_dc_write_revision: live.dc_write_revision ?? 0,
            bump_dc_write_revision: false,
          });
          racedThroughProductionWrite = true;
          // Stale expected revisions from declare's apply → real CAS reject.
          return casWritePOJUSession(args);
        },
      });
    } catch (err) {
      declareErr = err;
    }

    if (
      racedThroughProductionWrite &&
      isSessionCasError(declareErr) &&
      declareErr.code === SESSION_CAS_CONFLICT
    ) {
      const after = (await loadPOJUSession(sid))!;
      assert.equal((after.na_declaration_actions ?? []).length, 0);
      assert.equal(
        (after.decision_context?.explicit_na_classifications ?? []).length,
        0,
      );
      assert.equal(
        (after.decision_context?.explicit_na_evidence ?? []).filter(
          (e) => e.evidence_type === "user_explicit_na",
        ).length,
        0,
      );
      c25ProductionPathPass = true;
      pass(
        "C25 [production-path] real casWritePOJUSession conflict → no durable N/A",
      );
    } else {
      markUntested(
        "C25 [production-path] Attempt A concurrent casWritePOJUSession race",
        `Did not prove real IndexedDB CAS reject on declare write. raced=${racedThroughProductionWrite} err=${
          declareErr instanceof Error
            ? `${declareErr.name}:${declareErr.message}`
            : String(declareErr)
        }`,
      );
    }
  } catch (e) {
    markUntested(
      "C25 [production-path] Attempt A concurrent casWritePOJUSession race",
      `Harness threw before proof: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // Attempt B — delete durable row then declare (existing S3-style IDB harness).
  if (!c25ProductionPathPass) {
    try {
      await __resetPojuDbForTests();
      await ensurePojuDbReady();
      const sid = await seedDraftSession("c25b");
      await deletePOJUSession(sid);
      let declareErr: unknown = null;
      try {
        await declareDirNotApplicable(sid, declareInput("c25b"));
      } catch (err) {
        declareErr = err;
      }
      // delete-then-declare fails at load ("session not found"), before apply /
      // casWritePOJUSession persist of the N/A triad — not mid-persist proof.
      markUntested(
        "C25 [production-path] Attempt B deletePOJUSession then declare",
        `Session-row delete yields load-time failure (${
          declareErr instanceof Error
            ? `${
                "code" in declareErr && typeof declareErr.code === "string"
                  ? declareErr.code
                  : declareErr.name
              }:${declareErr.message}`
            : String(declareErr)
        }), not a mid-persist CAS reject after apply. Insufficient for C25 PASS.`,
      );
    } catch (e) {
      markUntested(
        "C25 [production-path] Attempt B deletePOJUSession then declare",
        `Harness threw before proof: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  if (!c25ProductionPathPass) {
    // Non-PASS harness note only — early throw before casWritePOJUSession is
    // NOT production persist-failure evidence (Rev 1.2 §9 / independent review).
    console.log(
      "\n== C25 harness-note (NOT production-path; does not count as C25 PASS) ==",
    );
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
    const sid = await seedDraftSession("c25note");
    let earlyThrowHookRan = false;
    let sawSessionCasConflict = false;
    try {
      await declareDirNotApplicable(sid, declareInput("c25note"), {
        max_retries: 0,
        casWrite: async () => {
          earlyThrowHookRan = true;
          throw new SessionCasError(
            SESSION_CAS_CONFLICT,
            "harness early-throw before casWritePOJUSession (not production-path)",
          );
        },
      });
    } catch (err) {
      sawSessionCasConflict =
        isSessionCasError(err) && err.code === SESSION_CAS_CONFLICT;
    }
    const after = (await loadPOJUSession(sid))!;
    const noDurableNa =
      (after.na_declaration_actions ?? []).length === 0 &&
      (after.decision_context?.explicit_na_classifications ?? []).length === 0 &&
      (after.decision_context?.explicit_na_evidence ?? []).filter(
        (e) => e.evidence_type === "user_explicit_na",
      ).length === 0;
    console.log(
      `  NOTE  early-throw casWrite hook: hookRan=${earlyThrowHookRan} SessionCasError=${sawSessionCasConflict} noDurableNa=${noDurableNa}`,
    );
    console.log(
      "         This only shows mutatePOJUSession surfaces a replaced casWrite throw;",
    );
    console.log(
      "         it does NOT prove real IndexedDB / casWritePOJUSession persist failure.",
    );

    markUntested(
      "C25 [production-path]",
      "Locked toolchain: no reliable way to force declareDirNotApplicable through real casWritePOJUSession/IndexedDB persist failure without a pre-write casWrite replacement throw (disallowed as C25 PASS) or new production fault-inject APIs (forbidden). Attempt A race and Attempt B delete-row did not yield mid-persist proof. See harness-note above (not PASS).",
    );
  }

  // Disclose freeze-versioning F1 outside this script (run separately).
  markUntested(
    "[disclose] freeze-versioning F1",
    "Run test:intake-r6-freeze-versioning separately; F1 RED disclosed until S5",
  );

  console.log(
    `\nS4 write-freeze-consistency done. PASS=${passed} FAIL=${failed} UNTESTED=${untested}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
