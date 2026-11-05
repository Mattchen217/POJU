/**
 * Stage 3.2 Round-5 — declareDirNotApplicable CAS integration (fake-indexeddb).
 *   pnpm exec tsx scripts/test-intake-r6-na-cas.ts
 *   pnpm test:intake-r6-na-cas
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
memoryStore.set("pojulife_device_id_v4", "dev_intake_r6_na_cas");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

const NOW = "2026-11-05T12:00:00.000Z";
const NA_CODE = "explicit_not_applicable";

async function main() {
  console.log("intake-r6-na-cas (declareDirNotApplicable production CAS)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession, SESSION_CAS_CONFLICT, isSessionCasError } =
    await import("../lib/poju/session-mutation");
  const {
    declareDirNotApplicable,
    revokeDirNaDeclaration,
    applyDeclareDirNaToSession,
    NaDeclarationError,
  } = await import("../lib/poju/decision-context/na-declaration");
  const { validateExplicitNaEvidence } = await import(
    "../lib/poju/decision-context/explicit-na-validate"
  );
  const { emptyNaValidation } = await import(
    "../lib/poju/decision-context/role-resolver"
  );
  type DecisionContext =
    import("../lib/poju/decision-context/types").DecisionContext;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const emptyDefinition = {
    concrete_event: null,
    stakes: null,
    desired_outcome: null,
    decision_question: null,
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
    };
  }

  // --- Seed session with DC + confirmed fact ---
  const sid = await createPOJUSession({
    payment_id: "pay_intake_na_cas",
    original_question: "na cas",
  });
  await mutatePOJUSession(sid, {
    operation_id: "op_seed_dc_na",
    kind: "session_patch",
    bump_dc: true,
    apply: (latest) => ({
      ...latest,
      decision_context: makeDc({
        context_id: "dc_na_cas",
        version: 1,
        reality_facts: [
          {
            fact_id: "fact_na_1",
            statement: "topic does not apply",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "user_supplement",
            source_turn_id: "turn_na_1",
            user_confirmed: true,
            fact_roles: ["situation"],
            related_dir_ids: ["DIR-A"],
          },
          {
            fact_id: "fact_na_2",
            statement: "other fact",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "user_supplement",
            source_turn_id: "turn_na_2",
            user_confirmed: true,
            fact_roles: ["situation"],
            related_dir_ids: ["DIR-A"],
          },
        ],
        constraints: [
          {
            constraint_id: "cst_na_1",
            statement: "hard time",
            category: "time",
            status: "confirmed",
            verification_level: "user_asserted",
            source_stage: "user_supplement",
            source_turn_id: "turn_na_c",
            rigidity: "hard",
            user_confirmed: true,
            related_dir_ids: ["DIR-A"],
          },
        ],
        dirs: [
          {
            dir_id: "DIR-A",
            need: "need",
            why: "why",
            required_fact_roles: ["situation"],
            current_state: "unknown",
            partial_satisfaction: false,
            agenda_item_ids: [],
            id_lifecycle: "active",
          },
        ],
      }),
      confirmation_events: [
        {
          event_id: "e1_fact_na_1",
          target_type: "fact",
          fact_id: "fact_na_1",
          source_turn_id: "turn_na_1",
          confirmation_turn_id: "turn_na_1b",
          confirmation_action_id: "ca_fact_na_1",
          event_type: "confirm_fact",
          actor: "user",
          confirmed_at: NOW,
          event_version: 1,
        },
      ],
    }),
  });

  const declareInput = {
    operation_id: "op_declare_na_1",
    declaration_action_id: "na-act-cas-1",
    control_id: "na_declare" as const,
    fact_id: "fact_na_1",
    dir_id: "DIR-A",
    na_condition_code: NA_CODE,
    declaration_turn_id: "turn_declare_1",
    dir_na_conditions: [NA_CODE],
    occurred_at: NOW,
  };

  console.log("\n== declareDirNotApplicable CAS write + reload ==");
  const first = await declareDirNotApplicable(sid, declareInput);
  assert.equal(first.outcome, "appended");
  assert.equal(first.action.session_id, sid);
  assert.equal(first.action.context_id, "dc_na_cas");
  assert.equal(first.evidence.evidence_id, "na_ev_na-act-cas-1");
  assert.equal(
    first.classification.declaration_action_id,
    first.action.declaration_action_id,
  );

  const reloaded = await loadPOJUSession(sid);
  assert.ok(reloaded);
  assert.equal(
    (reloaded!.na_declaration_actions ?? []).length,
    1,
    "action persisted on session",
  );
  assert.equal(
    (reloaded!.decision_context?.explicit_na_classifications ?? []).length,
    1,
    "classification persisted on DC",
  );
  assert.equal(
    (reloaded!.decision_context?.explicit_na_evidence ?? []).filter(
      (e) => e.evidence_id === "na_ev_na-act-cas-1",
    ).length,
    1,
    "evidence persisted by exact id",
  );
  console.log("  PASS  CAS write + reload binds action/classification/evidence");

  console.log("\n== same operation_id + same payload → CAS idempotent ==");
  const again = await declareDirNotApplicable(sid, declareInput);
  assert.equal(again.outcome, "idempotent_skip");
  const afterAgain = await loadPOJUSession(sid);
  assert.equal((afterAgain!.na_declaration_actions ?? []).length, 1);
  assert.equal(
    (afterAgain!.decision_context?.explicit_na_classifications ?? []).length,
    1,
  );
  console.log("  PASS  repeat operation_id does not duplicate records");

  console.log("\n== same action_id + different fact_id → reject ==");
  let mismatchFact = false;
  try {
    await declareDirNotApplicable(sid, {
      ...declareInput,
      operation_id: "op_declare_na_mismatch_fact",
      fact_id: "fact_na_2",
    });
  } catch (err) {
    mismatchFact = err instanceof NaDeclarationError;
    assert.ok(
      err instanceof NaDeclarationError &&
        err.message.includes("idempotent_source_mismatch"),
    );
  }
  assert.equal(mismatchFact, true);
  console.log("  PASS  different fact_id rejected");

  console.log("\n== same action_id + different constraint_id → reject ==");
  // Seed a second action path first with constraint via new id, then try reuse with wrong source
  await declareDirNotApplicable(sid, {
    operation_id: "op_declare_cst",
    declaration_action_id: "na-act-cas-cst",
    control_id: "na_declare",
    constraint_id: "cst_na_1",
    dir_id: "DIR-A",
    na_condition_code: NA_CODE,
    declaration_turn_id: "turn_declare_cst",
    dir_na_conditions: [NA_CODE],
    occurred_at: NOW,
  });
  let mismatchCst = false;
  try {
    await declareDirNotApplicable(sid, {
      operation_id: "op_declare_cst_bad",
      declaration_action_id: "na-act-cas-cst",
      control_id: "na_declare",
      fact_id: "fact_na_1",
      dir_id: "DIR-A",
      na_condition_code: NA_CODE,
      declaration_turn_id: "turn_declare_cst",
      dir_na_conditions: [NA_CODE],
      occurred_at: NOW,
    });
  } catch (err) {
    mismatchCst = err instanceof NaDeclarationError;
  }
  assert.equal(mismatchCst, true);
  const afterCst = await loadPOJUSession(sid);
  assert.equal(
    (afterCst!.na_declaration_actions ?? []).filter(
      (a) => a.declaration_action_id === "na-act-cas-cst",
    ).length,
    1,
  );
  console.log("  PASS  different constraint vs fact source rejected");

  console.log("\n== two actions same DIR/condition stay distinct ==");
  const a1 = (afterCst!.na_declaration_actions ?? []).find(
    (a) => a.declaration_action_id === "na-act-cas-1",
  )!;
  const a2 = (afterCst!.na_declaration_actions ?? []).find(
    (a) => a.declaration_action_id === "na-act-cas-cst",
  )!;
  assert.notEqual(a1.source_ref.kind, a2.source_ref.kind);
  const ev1 = afterCst!.decision_context!.explicit_na_evidence!.find(
    (e) => e.evidence_id === "na_ev_na-act-cas-1",
  )!;
  const ev2 = afterCst!.decision_context!.explicit_na_evidence!.find(
    (e) => e.evidence_id === "na_ev_na-act-cas-cst",
  )!;
  assert.ok(ev1 && ev2);
  assert.notEqual(ev1.evidence_id, ev2.evidence_id);
  console.log("  PASS  distinct action/evidence ids for same DIR/condition");

  console.log("\n== missing evidence fail-closed on pure replay ==");
  const broken = structuredClone(afterCst!);
  broken.decision_context = {
    ...broken.decision_context!,
    explicit_na_evidence: (
      broken.decision_context!.explicit_na_evidence ?? []
    ).filter((e) => e.evidence_id !== "na_ev_na-act-cas-1"),
  };
  let missingEv = false;
  try {
    applyDeclareDirNaToSession(broken, sid, declareInput, NOW);
  } catch (err) {
    missingEv =
      err instanceof NaDeclarationError &&
      err.message.includes("idempotent_action_missing_evidence");
  }
  assert.equal(missingEv, true);
  console.log("  PASS  missing evidence fail-closed");

  console.log("\n== CAS conflict retry does not duplicate ==");
  let conflictInjected = false;
  const casOnce = await declareDirNotApplicable(
    sid,
    {
      ...declareInput,
      operation_id: "op_declare_na_retry",
      declaration_action_id: "na-act-cas-retry",
      fact_id: "fact_na_2",
      declaration_turn_id: "turn_retry",
    },
    {
      max_retries: 3,
      casWrite: async (args) => {
        if (!conflictInjected) {
          conflictInjected = true;
          const { SessionCasError } = await import(
            "../lib/poju/session-mutation"
          );
          throw new SessionCasError(SESSION_CAS_CONFLICT, "injected conflict");
        }
        const { casWritePOJUSession } = await import(
          "../lib/poju/session-mutation"
        );
        return casWritePOJUSession(args);
      },
    },
  );
  assert.equal(casOnce.outcome, "appended");
  const afterRetry = await loadPOJUSession(sid);
  assert.equal(
    (afterRetry!.na_declaration_actions ?? []).filter(
      (a) => a.declaration_action_id === "na-act-cas-retry",
    ).length,
    1,
  );
  console.log("  PASS  CAS conflict retry single record");

  console.log("\n== revokeDirNaDeclaration + validator reject ==");
  await revokeDirNaDeclaration(sid, {
    operation_id: "op_revoke_na_1",
    declaration_action_id: "na-act-cas-1",
    revoked_at: NOW,
  });
  const revokedSess = await loadPOJUSession(sid);
  const revokedAction = (revokedSess!.na_declaration_actions ?? []).find(
    (a) => a.declaration_action_id === "na-act-cas-1",
  )!;
  const revokedCls = (
    revokedSess!.decision_context?.explicit_na_classifications ?? []
  ).find((c) => c.declaration_action_id === "na-act-cas-1")!;
  const revokedEv = (
    revokedSess!.decision_context?.explicit_na_evidence ?? []
  ).find((e) => e.evidence_id === "na_ev_na-act-cas-1")!;
  assert.equal(revokedAction.revoked, true);
  assert.equal(revokedCls.revoked, true);
  assert.equal(revokedEv.revoked, true);

  const v = validateExplicitNaEvidence(revokedEv, emptyNaValidation({
    contextId: "dc_na_cas",
    sessionId: sid,
    nowIso: NOW,
    dirCatalog: [{ dir_id: "DIR-A", na_conditions: [NA_CODE] }],
    realityFacts: revokedSess!.decision_context!.reality_facts,
    confirmationEvents: revokedSess!.confirmation_events ?? [],
    explicitNaClassifications:
      revokedSess!.decision_context!.explicit_na_classifications ?? [],
    naDeclarationActions: revokedSess!.na_declaration_actions ?? [],
  }));
  assert.equal(v.ok, false);

  let replayRevoked = false;
  try {
    await declareDirNotApplicable(sid, {
      ...declareInput,
      operation_id: "op_replay_revoked",
    });
  } catch (err) {
    replayRevoked =
      err instanceof NaDeclarationError &&
      err.message.includes("action_revoked_replay");
  }
  assert.equal(replayRevoked, true);
  console.log("  PASS  revoke sync + replay rejected + validator fail-closed");

  // silence unused
  void isSessionCasError;

  console.log("\nAll intake-r6-na-cas checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
