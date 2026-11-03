/**
 * Decision Context Phase 2 integration tests — real session C1 wiring.
 * Run: pnpm test:decision-context-phase2
 *
 * Covers: successful C1 commit; failure rollback; durable idempotency across reload;
 * cross-session idempotency isolation; restore prefers DC over agent_v2 buffers.
 * Does NOT wire Gate/Opening/CallA/B.
 */

import assert from "node:assert/strict";
import {
  applyControlPlaneToWorking,
  applyDcToWorking,
  seedDecisionContextFromOpening,
  __resetPersistIdempotencyForTests,
  type DecisionContext,
} from "../lib/poju/decision-context";
import {
  applyDecisionContextRestore,
  commitDecisionContextChange,
  confirmSessionAfterCorePersist,
  mergeDcPersistSliceIntoSession,
} from "../lib/poju/session-manager";
import type { POJUSessionState } from "../lib/poju/types";
import type { POJUAgentState } from "../lib/poju/agent-state";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  PASS  ${name}`);
    })
    .catch((err) => {
      console.error(`  FAIL  ${name}`);
      throw err;
    });
}

function mockSession(partial: Partial<POJUSessionState> = {}): POJUSessionState {
  const now = "2026-11-03T06:00:00.000Z";
  return {
    session_id: "sess_phase2_test",
    device_id: "dev_phase2",
    original_question: "Should I leave?",
    messages: [],
    context_collected: {},
    has_profile: false,
    profile_skipped: false,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now,
    last_interaction_at: now,
    expires_at: "2026-12-03T06:00:00.000Z",
    unlock_status: "preview",
    cycles: [
      {
        cycle_id: "cyc_1",
        cycle_index: 1,
        original_question: "Should I leave?",
        question_category: "unknown",
        current_summary: null,
        started_at: now,
        tool_suggestions: [],
        is_delivered: false,
        is_active: true,
      },
    ],
    active_cycle_id: "cyc_1",
    shared_context: {},
    agent_v2: {
      current_phase: "opening",
      core_dilemma: {
        concrete_event: "BUFFER EVENT",
        stakes: "BUFFER STAKES",
        sticking_point: null,
      },
      desired_direction: {
        wants: "BUFFER WANTS",
        priority: null,
      },
      breakthrough_core: null,
    } as unknown as POJUAgentState,
    ...partial,
  };
}

/** In-memory stand-in for encrypted session blob + cycle index (C1 core). */
function createMemoryCoreStore() {
  const blobs = new Map<string, POJUSessionState>();
  let failNext = false;
  let writeCount = 0;
  let sideEffectCount = 0;
  let sideEffectShouldFail = false;

  return {
    blobs,
    get writeCount() {
      return writeCount;
    },
    get sideEffectCount() {
      return sideEffectCount;
    },
    failNextWrite() {
      failNext = true;
    },
    failNextSideEffect() {
      sideEffectShouldFail = true;
    },
    async writeCore(state: POJUSessionState): Promise<void> {
      writeCount += 1;
      if (failNext) {
        failNext = false;
        throw new Error("IDB core write failed");
      }
      blobs.set(state.session_id, JSON.parse(JSON.stringify(state)) as POJUSessionState);
    },
    async afterCommit(_state: POJUSessionState): Promise<void> {
      sideEffectCount += 1;
      if (sideEffectShouldFail) {
        sideEffectShouldFail = false;
        throw new Error("archive side effect failed");
      }
    },
    /** Simulate page reload: read blob and apply restore authority with cleared process registry. */
    reload(sessionId: string): POJUSessionState | null {
      const raw = blobs.get(sessionId);
      if (!raw) return null;
      __resetPersistIdempotencyForTests();
      return applyDecisionContextRestore(JSON.parse(JSON.stringify(raw)) as POJUSessionState);
    },
  };
}

async function main() {
  console.log("decision-context phase2");

  await check("C1 successful commit writes DC + durable key + control plane", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_ok",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const session = mockSession({
      decision_context: baseDc,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });

    const nextDc: DecisionContext = {
      ...baseDc,
      definition: { ...baseDc.definition, stakes: "high" },
    };

    const result = await commitDecisionContextChange({
      session,
      idempotency_key: "op_opening_seed_1",
      now: "2026-11-03T06:01:00.000Z",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, nextDc);
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });

    assert.equal(result.committed, true);
    assert.equal(result.rolled_back, false);
    assert.equal(result.session.decision_context?.definition.stakes, "high");
    assert.ok(result.session.decision_context_idempotency_keys?.includes("op_opening_seed_1"));
    assert.equal(result.session.agent_v2?.current_phase, "collecting_context");
    // Buffers still present but are not DC authority
    assert.equal(
      (result.session.agent_v2 as { core_dilemma?: { concrete_event?: string } })?.core_dilemma
        ?.concrete_event,
      "BUFFER EVENT",
    );
    assert.equal(result.session.decision_context?.definition.concrete_event, "E");
    assert.equal(store.writeCount, 1);
    assert.equal(store.sideEffectCount, 1);
    assert.equal(store.blobs.get(session.session_id)?.decision_context?.definition.stakes, "high");
  });

  await check("C1 failure rolls back memory; blob unchanged; no durable key", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_fail",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "keep", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const session = mockSession({
      decision_context: baseDc,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
      agent_v2: {
        current_phase: "opening",
        core_dilemma: { concrete_event: "BUFFER", stakes: null, sticking_point: null },
        desired_direction: { wants: null, priority: null },
        breakthrough_core: null,
      } as unknown as POJUAgentState,
    });

    // Seed blob with original so we can assert it stays put.
    await store.writeCore(session);
    store.failNextWrite();

    const result = await commitDecisionContextChange({
      session,
      idempotency_key: "op_fail_write",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDc,
          definition: { ...baseDc.definition, stakes: "SHOULD_NOT_STICK" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });

    assert.equal(result.committed, false);
    assert.equal(result.rolled_back, true);
    assert.equal(result.session.decision_context?.definition.stakes, "keep");
    assert.equal(result.session.agent_v2?.current_phase, "opening");
    assert.ok(!(result.session.decision_context_idempotency_keys ?? []).includes("op_fail_write"));
    assert.equal(store.blobs.get(session.session_id)?.decision_context?.definition.stakes, "keep");
    assert.equal(store.sideEffectCount, 0);
  });

  await check("control-plane missing fails before blob write and rolls back", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_cp",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    // Session without agent_v2 → extractDcSessionSlice has no control_plane
    const session = mockSession({
      decision_context: baseDc,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
      agent_v2: undefined,
    });

    const result = await commitDecisionContextChange({
      session,
      idempotency_key: "op_no_cp",
      require_control_plane: true,
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, baseDc);
        // Intentionally do NOT apply control plane
      },
    });

    assert.equal(result.committed, false);
    assert.equal(result.rolled_back, true);
    assert.match(result.error ?? "", /Control plane/i);
    assert.equal(store.writeCount, 0);
  });

  await check("durable idempotency survives reload (process registry cleared)", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_idem",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "v1", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    let memory = mockSession({
      decision_context: baseDc,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });

    const first = await commitDecisionContextChange({
      session: memory,
      idempotency_key: "op_once_reload",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDc,
          definition: { ...baseDc.definition, stakes: "v2" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });
    assert.equal(first.committed, true);
    memory = first.session;

    // Simulate hard reload: wipe process registry, rehydrate from blob.
    const reloaded = store.reload(memory.session_id);
    assert.ok(reloaded);
    assert.equal(reloaded!.decision_context?.definition.stakes, "v2");
    assert.ok(reloaded!.decision_context_idempotency_keys?.includes("op_once_reload"));

    const second = await commitDecisionContextChange({
      session: reloaded!,
      idempotency_key: "op_once_reload",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDc,
          definition: { ...baseDc.definition, stakes: "v3-DUP" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "awaiting_confirmation" });
      },
    });

    assert.equal(second.idempotent_skip, true);
    assert.equal(second.committed, false);
    assert.equal(second.session.decision_context?.definition.stakes, "v2");
    assert.equal(store.blobs.get(memory.session_id)?.decision_context?.definition.stakes, "v2");
  });

  await check("restore prefers persisted DC over agent_v2 buffers", async () => {
    __resetPersistIdempotencyForTests();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_restore",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "AUTHORITATIVE EVENT", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
    });
    const stale = mockSession({
      decision_context: baseDc,
      decision_context_versions: [baseDc],
      decision_context_idempotency_keys: ["op_prior"],
      agent_v2: {
        current_phase: "collecting_context",
        core_dilemma: {
          concrete_event: "STALE BUFFER MUST NOT WIN",
          stakes: "stale",
          sticking_point: null,
        },
        desired_direction: { wants: "stale wants", priority: null },
        breakthrough_core: {
          situation_conclusion: "ignore",
        },
      } as unknown as POJUAgentState,
      context_collected: { note: "legacy buffer" },
    });

    const restored = applyDecisionContextRestore(stale);
    assert.equal(restored.decision_context?.definition.concrete_event, "AUTHORITATIVE EVENT");
    assert.notEqual(
      restored.decision_context?.definition.concrete_event,
      (restored.agent_v2 as { core_dilemma?: { concrete_event?: string } })?.core_dilemma
        ?.concrete_event,
    );
    // Buffers remain for UI/compat but are not copied onto DC
    assert.equal(
      (restored.agent_v2 as { core_dilemma?: { concrete_event?: string } })?.core_dilemma
        ?.concrete_event,
      "STALE BUFFER MUST NOT WIN",
    );
    assert.ok(restored.decision_context_idempotency_keys?.includes("op_prior"));
  });

  await check("post-commit side effect failure does NOT roll back core", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_p2_side",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const session = mockSession({
      decision_context: baseDc,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });
    store.failNextSideEffect();

    const result = await commitDecisionContextChange({
      session,
      idempotency_key: "op_side_fail",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDc,
          definition: { ...baseDc.definition, stakes: "committed_anyway" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });

    assert.equal(result.committed, true);
    assert.equal(result.session.decision_context?.definition.stakes, "committed_anyway");
    assert.equal(
      store.blobs.get(session.session_id)?.decision_context?.definition.stakes,
      "committed_anyway",
    );
  });

  await check("confirmSessionAfterCorePersist adopts only after core write", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const session = mockSession({ original_question: "before" });
    let adopted: POJUSessionState | null = null;

    const next = { ...session, original_question: "after" };
    await confirmSessionAfterCorePersist(
      next,
      (s) => {
        adopted = s;
      },
      {
        writeCore: (s) => store.writeCore(s),
        afterCommit: (s) => store.afterCommit(s),
      },
    );
    assert.equal(adopted?.original_question, "after");
    assert.equal(store.blobs.get(session.session_id)?.original_question, "after");

    store.failNextWrite();
    let adopted2: POJUSessionState | null = null;
    let threw = false;
    try {
      await confirmSessionAfterCorePersist(
        { ...session, original_question: "never" },
        (s) => {
          adopted2 = s;
        },
        {
          writeCore: (s) => store.writeCore(s),
          afterCommit: (s) => store.afterCommit(s),
        },
      );
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
    assert.equal(adopted2, null);
    assert.equal(store.blobs.get(session.session_id)?.original_question, "after");
  });

  await check("cross-session idempotency isolation: same op_1 does not skip other session", async () => {
    __resetPersistIdempotencyForTests();
    const store = createMemoryCoreStore();
    const baseDcA = seedDecisionContextFromOpening({
      context_id: "dc_p2_iso_a",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "A", stakes: "a1", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const baseDcB = seedDecisionContextFromOpening({
      context_id: "dc_p2_iso_b",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "B", stakes: "b1", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });

    let sessionA = mockSession({
      session_id: "sess_iso_a",
      decision_context: baseDcA,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });
    let sessionB = mockSession({
      session_id: "sess_iso_b",
      decision_context: baseDcB,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });

    // 1) Session A successfully commits op_1
    const a1 = await commitDecisionContextChange({
      session: sessionA,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcA,
          definition: { ...baseDcA.definition, stakes: "a2" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });
    assert.equal(a1.committed, true);
    assert.equal(a1.idempotent_skip, false);
    assert.equal(a1.session.decision_context?.definition.stakes, "a2");
    assert.ok(a1.session.decision_context_idempotency_keys?.includes("op_1"));
    sessionA = a1.session;

    // 2) Session B with same op_1 MUST commit normally (NOT idempotent_skip)
    const b1 = await commitDecisionContextChange({
      session: sessionB,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcB,
          definition: { ...baseDcB.definition, stakes: "b2" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });
    assert.equal(b1.idempotent_skip, false, "Session B must not see Session A keys");
    assert.equal(b1.committed, true);
    assert.equal(b1.session.decision_context?.definition.stakes, "b2");
    assert.ok(b1.session.decision_context_idempotency_keys?.includes("op_1"));
    sessionB = b1.session;

    // 3) Session A repeating op_1 MUST still skip
    const a2 = await commitDecisionContextChange({
      session: sessionA,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcA,
          definition: { ...baseDcA.definition, stakes: "a3-DUP" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "awaiting_confirmation" });
      },
    });
    assert.equal(a2.idempotent_skip, true);
    assert.equal(a2.committed, false);
    assert.equal(a2.session.decision_context?.definition.stakes, "a2");

    // 4) After reload of each session, idempotency remains correct for that session only
    const reloadedA = store.reload(sessionA.session_id);
    const reloadedB = store.reload(sessionB.session_id);
    assert.ok(reloadedA);
    assert.ok(reloadedB);
    assert.equal(reloadedA!.decision_context?.definition.stakes, "a2");
    assert.equal(reloadedB!.decision_context?.definition.stakes, "b2");
    assert.ok(reloadedA!.decision_context_idempotency_keys?.includes("op_1"));
    assert.ok(reloadedB!.decision_context_idempotency_keys?.includes("op_1"));

    // Loading A must not poison B: B repeating op_1 still skips for B only;
    // a fresh Session C with op_1 must still commit.
    const aReloadSkip = await commitDecisionContextChange({
      session: reloadedA!,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcA,
          definition: { ...baseDcA.definition, stakes: "a-reload-dup" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "awaiting_confirmation" });
      },
    });
    assert.equal(aReloadSkip.idempotent_skip, true);

    const bReloadSkip = await commitDecisionContextChange({
      session: reloadedB!,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcB,
          definition: { ...baseDcB.definition, stakes: "b-reload-dup" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "awaiting_confirmation" });
      },
    });
    assert.equal(bReloadSkip.idempotent_skip, true);

    // Hydrate A then try C — C must still commit with op_1
    __resetPersistIdempotencyForTests();
    const afterHydrateA = applyDecisionContextRestore(
      JSON.parse(JSON.stringify(store.blobs.get(sessionA.session_id))) as POJUSessionState,
    );
    assert.ok(afterHydrateA.decision_context_idempotency_keys?.includes("op_1"));

    const baseDcC = seedDecisionContextFromOpening({
      context_id: "dc_p2_iso_c",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "C", stakes: "c1", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const sessionC = mockSession({
      session_id: "sess_iso_c",
      decision_context: baseDcC,
      decision_context_versions: [],
      decision_context_idempotency_keys: [],
    });
    const c1 = await commitDecisionContextChange({
      session: sessionC,
      idempotency_key: "op_1",
      writeCore: (s) => store.writeCore(s),
      afterCommit: (s) => store.afterCommit(s),
      apply: (tx) => {
        applyDcToWorking(tx, {
          ...baseDcC,
          definition: { ...baseDcC.definition, stakes: "c2" },
        });
        applyControlPlaneToWorking(tx, { current_phase: "collecting_context" });
      },
    });
    assert.equal(c1.idempotent_skip, false, "hydrating A must not block Session C");
    assert.equal(c1.committed, true);
    assert.equal(c1.session.decision_context?.definition.stakes, "c2");
  });

  await check("mergeDcPersistSliceIntoSession does not elevate buffers to DC", () => {
    const base = mockSession({
      decision_context: null,
      decision_context_idempotency_keys: [],
    });
    const dc = seedDecisionContextFromOpening({
      context_id: "dc_merge",
      now: "2026-11-03T06:00:00.000Z",
      core_dilemma: { concrete_event: "FROM_DC", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const merged = mergeDcPersistSliceIntoSession(base, {
      decision_context: dc,
      decision_context_idempotency_keys: ["k1"],
      control_plane: { current_phase: "collecting_context" },
    });
    assert.equal(merged.decision_context?.definition.concrete_event, "FROM_DC");
    assert.equal(merged.agent_v2?.current_phase, "collecting_context");
    assert.equal(
      (merged.agent_v2 as { core_dilemma?: { concrete_event?: string } })?.core_dilemma
        ?.concrete_event,
      "BUFFER EVENT",
    );
  });

  console.log(`\nphase2: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
