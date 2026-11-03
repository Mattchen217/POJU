/**
 * Phase 3 S3 — ControlPlane + Confirmation Event + Opening Anchor.
 * Run: pnpm test:control-plane-s3
 * Does NOT start S4. Does NOT call real LLM/payment.
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
memoryStore.set("pojulife_device_id_v4", "dev_s3_cp");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

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

async function main() {
  console.log("phase3-s3-control-plane");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const {
    createPOJUSession,
    loadPOJUSession,
    mergeDcPersistSliceIntoSession,
  } = await import("../lib/poju/session-manager");
  const {
    createDefaultControlPlane,
    validateControlPlaneInput,
    validateControlPlaneOutput,
    replaceFormalControlPlane,
    mergeControlPlanePatch,
    assertAgentV2CannotOverwriteControlPlane,
    UNKNOWN_CONTROL_PLANE_FIELD,
    INVALID_CONTROL_PLANE_FIELD,
    ControlPlaneError,
    isControlPlaneError,
  } = await import("../lib/poju/decision-context/control-plane");
  const {
    extractDcSessionSlice,
    applyControlPlaneToWorking,
    beginPersistTransaction,
    __resetPersistIdempotencyForTests,
  } = await import("../lib/poju/decision-context/persist");
  const {
    appendConfirmationEvent,
    deriveUserConfirmedFromEvents,
    assertGateConfirmDoesNotCreateFactEvents,
    ConfirmationEventError,
    CONFIRMATION_ACTION_REUSED,
  } = await import("../lib/poju/decision-context/confirmation-event");
  const { deriveUserConfirmed } = await import("../lib/poju/decision-context/fact-combination");
  const {
    buildCreateOpeningAnchorMutation,
    buildConfirmOpeningAnchorMutation,
    buildResetOpeningAnchorMutation,
    createOpeningAnchor,
    confirmOpeningAnchor,
    resetOpeningAnchor,
    resolveCurrentOpeningAnchor,
    applyOpeningAnchorSlice,
    OpeningAnchorError,
  } = await import("../lib/poju/decision-context/opening-anchor");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  __resetPersistIdempotencyForTests();

  const sessionId = await createPOJUSession({
    payment_id: "pay_s3_cp_test",
    original_question: "S3 control plane?",
  });
  assert.ok(sessionId.length >= 8);

  await check("CP validator rejects unknown top-level field", () => {
    const base = createDefaultControlPlane("opening");
    try {
      validateControlPlaneInput({ ...base, evil_field: 1 });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
      assert.equal((err as ControlPlaneError).code, UNKNOWN_CONTROL_PLANE_FIELD);
    }
  });

  await check("CP validator rejects wrong type (no coerce)", () => {
    const base = createDefaultControlPlane("opening");
    try {
      validateControlPlaneInput({ ...base, investigation_agenda: "nope" });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
      assert.equal((err as ControlPlaneError).code, INVALID_CONTROL_PLANE_FIELD);
    }
  });

  await check("CP AgendaItem rejects unknown field and duplicate id", () => {
    const base = createDefaultControlPlane("opening");
    try {
      validateControlPlaneInput({
        ...base,
        investigation_agenda: [
          {
            id: "a1",
            label: "L",
            critical: true,
            status: "unexplored",
            not_a_real_field: true,
          },
        ],
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
      assert.equal((err as ControlPlaneError).code, UNKNOWN_CONTROL_PLANE_FIELD);
    }
    try {
      validateControlPlaneInput({
        ...base,
        investigation_agenda: [
          { id: "a1", label: "L1", critical: true, status: "unexplored" },
          { id: "a1", label: "L2", critical: false, status: "partial" },
        ],
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
      assert.equal((err as ControlPlaneError).code, INVALID_CONTROL_PLANE_FIELD);
    }
  });

  await check("agent_v2 cannot overwrite formal CP", () => {
    const cp = createDefaultControlPlane("opening");
    try {
      assertAgentV2CannotOverwriteControlPlane({
        control_plane: cp,
        agent_v2_as_control_plane_candidate: { current_phase: "delivered" },
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
    }
    const kept = assertAgentV2CannotOverwriteControlPlane({ control_plane: cp });
    assert.equal(kept?.current_phase, "opening");
  });

  await check("extract/merge covers full formal CP (not only current_phase)", () => {
    const formal = createDefaultControlPlane("collecting_context");
    formal.opening_anchor_id = "opening_anchor_x";
    formal.opening_gate_state = "pending";
    formal.investigation_agenda = [
      { id: "ag1", label: "Q1", critical: true, status: "unexplored" },
    ];
    formal.last_call_a_fingerprint = "fpA";
    formal.last_call_a_fingerprint_version = "v1";

    const extracted = extractDcSessionSlice({
      session_id: sessionId,
      control_plane: formal,
      agent_v2: { current_phase: "delivered" },
    });
    assert.equal(extracted.control_plane?.current_phase, "collecting_context");
    assert.equal(extracted.control_plane?.opening_anchor_id, "opening_anchor_x");
    assert.equal(extracted.control_plane?.opening_gate_state, "pending");
    assert.equal(extracted.control_plane?.investigation_agenda[0]?.id, "ag1");
    assert.equal(extracted.control_plane?.last_call_a_fingerprint, "fpA");
    // agent_v2 must NOT synthesize / override extract
    assert.notEqual(extracted.control_plane?.current_phase, "delivered");

    const loaded = {
      session_id: sessionId,
      payment_id: "pay",
      original_question: "q",
      created_at: new Date().toISOString(),
      last_interaction_at: new Date().toISOString(),
      messages: [] as import("../lib/poju/types").POJUMessage[],
      agent_v2: {
        current_phase: "opening" as const,
        investigation_agenda: [],
      } as import("../lib/poju/types").POJUSessionState["agent_v2"],
    } as import("../lib/poju/types").POJUSessionState;

    const merged = mergeDcPersistSliceIntoSession(loaded, {
      control_plane: formal,
    });
    assert.equal(merged.control_plane?.opening_gate_state, "pending");
    assert.equal(merged.control_plane?.investigation_agenda[0]?.label, "Q1");
    assert.equal(merged.agent_v2?.current_phase, "collecting_context");
    assert.equal(merged.agent_v2?.investigation_agenda?.[0]?.id, "ag1");
  });

  await check("extract ignores agent_v2 when formal CP absent", () => {
    const extracted = extractDcSessionSlice({
      session_id: sessionId,
      agent_v2: { current_phase: "collecting_context" },
    });
    assert.equal(extracted.control_plane, undefined);
  });

  await check("Confirmation idempotent same action+target; hard-fail reuse different target", () => {
    const ev1 = {
      event_id: "evt_1",
      target_type: "fact" as const,
      fact_id: "fact_1",
      source_turn_id: "turn_src",
      confirmation_turn_id: null,
      confirmation_action_id: "action_1",
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1 as const,
    };
    const r1 = appendConfirmationEvent([], ev1);
    assert.equal(r1.outcome, "appended");
    const r2 = appendConfirmationEvent(r1.events, { ...ev1, event_id: "evt_2" });
    assert.equal(r2.outcome, "idempotent_skip");
    try {
      appendConfirmationEvent(r1.events, {
        ...ev1,
        event_id: "evt_3",
        fact_id: "fact_OTHER",
      });
      assert.fail("expected hard fail");
    } catch (err) {
      assert.ok(err instanceof ConfirmationEventError);
      assert.equal(err.code, CONFIRMATION_ACTION_REUSED);
    }
  });

  await check("user_confirmed is derived; independently_verified does not auto-confirm", () => {
    assert.equal(
      deriveUserConfirmed({
        status: "confirmed",
        verification_level: "independently_verified",
        has_user_confirm_event: false,
      }),
      false,
    );
    assert.equal(
      deriveUserConfirmed({
        status: "confirmed",
        verification_level: "independently_verified",
        has_user_confirm_event: true,
      }),
      false,
    );
    const events = appendConfirmationEvent([], {
      event_id: "evt_iv",
      target_type: "fact",
      fact_id: "fact_iv",
      source_turn_id: "t1",
      confirmation_turn_id: null,
      confirmation_action_id: "act_iv",
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1,
    }).events;
    assert.equal(
      deriveUserConfirmedFromEvents({
        status: "confirmed",
        verification_level: "independently_verified",
        events,
        target: { type: "fact", fact_id: "fact_iv" },
      }),
      false,
    );
    assert.equal(
      deriveUserConfirmedFromEvents({
        status: "confirmed",
        verification_level: "user_asserted",
        events,
        target: { type: "fact", fact_id: "fact_iv" },
      }),
      true,
    );
    assert.equal(
      deriveUserConfirmedFromEvents({
        status: "unknown",
        verification_level: "none",
        events,
        target: { type: "fact", fact_id: "fact_iv" },
      }),
      false,
    );
  });

  await check("Gate confirm does not create Fact Confirmation Events", () => {
    const before = appendConfirmationEvent([], {
      event_id: "evt_pre",
      target_type: "fact",
      fact_id: "f1",
      source_turn_id: "t",
      confirmation_turn_id: null,
      confirmation_action_id: "a_pre",
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1,
    }).events;
    assertGateConfirmDoesNotCreateFactEvents(before, [...before]);
    try {
      assertGateConfirmDoesNotCreateFactEvents(before, [
        ...before,
        {
          event_id: "evt_batch",
          target_type: "fact",
          fact_id: "f2",
          source_turn_id: "t",
          confirmation_turn_id: null,
          confirmation_action_id: "a_batch",
          event_type: "confirm_fact",
          actor: "user",
          confirmed_at: "2026-11-03T12:00:00.000Z",
          event_version: 1,
        },
      ]);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof ConfirmationEventError);
    }
  });

  await check("Opening Anchor create/confirm/reset C1 semantics + reload restore", async () => {
    // Seed an assistant message for mark
    const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
    await mutatePOJUSession(sessionId, {
      operation_id: "s3_seed_msg",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...(latest.messages ?? []),
          {
            role: "assistant",
            content: "Understanding card",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "msg_understanding_1",
          },
        ],
      }),
    });

    const created = await createOpeningAnchor(sessionId, {
      operation_id: "s3_create_anchor",
      session_id: sessionId,
      message_client_id: "msg_understanding_1",
      anchor_id: "opening_anchor_1",
      history_id: "opening_history_1",
      now: "2026-11-03T12:01:00.000Z",
    });
    assert.equal(created.anchor.anchor_id, "opening_anchor_1");
    assert.notEqual(created.anchor.anchor_id, created.anchor.message_client_id);
    assert.equal(created.state.control_plane?.opening_gate_state, "pending");
    assert.equal(created.state.control_plane?.opening_anchor_id, "opening_anchor_1");
    const marked = created.state.messages.find((m) => m.client_id === "msg_understanding_1");
    assert.equal(marked?.meta?.is_opening_anchor, true);
    assert.equal(marked?.meta?.opening_anchor_id, "opening_anchor_1");
    assert.equal(created.state.confirmation_events?.length ?? 0, 0);

    // Confirm — no Fact events
    const confirmed = await confirmOpeningAnchor(sessionId, {
      operation_id: "s3_confirm_anchor",
      anchor_id: "opening_anchor_1",
      confirmation_action_id: "gate_confirm_1",
      now: "2026-11-03T12:02:00.000Z",
    });
    assert.equal(confirmed.anchor.status, "confirmed");
    assert.equal(confirmed.state.control_plane?.opening_gate_state, "confirmed");
    assert.equal(confirmed.state.confirmation_events?.length ?? 0, 0);

    // Reset requires pending — create a fresh pending via new understanding msg + create after clearing path:
    // Build reset on a pending session by mutating to pending again with a new create after manual reset path.
    // Use pure builders for reset semantics then CAS write.
    await mutatePOJUSession(sessionId, {
      operation_id: "s3_seed_msg2",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...(latest.messages ?? []),
          {
            role: "assistant",
            content: "Understanding card v2",
            timestamp: "2026-11-03T12:03:00.000Z",
            client_id: "msg_understanding_2",
          },
        ],
        // Force a pending gate bound to a new pending anchor via create mutation fields
        ...(() => {
          // Re-open gate: set pending on a NEW anchor without deleting history
          const pendingAnchor = {
            anchor_id: "opening_anchor_pending",
            session_id: sessionId,
            message_client_id: "msg_understanding_2",
            message_role: "assistant" as const,
            status: "pending" as const,
            created_at: "2026-11-03T12:03:00.000Z",
            resolved_at: null,
          };
          const hist = {
            history_id: "opening_history_pending",
            anchor_id: "opening_anchor_pending",
            message_client_id: "msg_understanding_2",
            state: "pending" as const,
            created_at: "2026-11-03T12:03:00.000Z",
            resolved_at: null,
            confirmation_action_id: null,
          };
          const cp = {
            ...(latest.control_plane ?? createDefaultControlPlane("awaiting_understanding_confirm")),
            opening_anchor_id: "opening_anchor_pending",
            opening_gate_state: "pending" as const,
          };
          return {
            opening_anchors: [...(latest.opening_anchors ?? []), pendingAnchor],
            opening_confirm_history: [...(latest.opening_confirm_history ?? []), hist],
            control_plane: cp,
          };
        })(),
      }),
    });

    await mutatePOJUSession(sessionId, {
      operation_id: "s3_seed_msg3",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...(latest.messages ?? []),
          {
            role: "assistant",
            content: "Understanding card v3",
            timestamp: "2026-11-03T12:04:00.000Z",
            client_id: "msg_understanding_3",
          },
        ],
      }),
    });

    const reset = await resetOpeningAnchor(sessionId, {
      operation_id: "s3_reset_anchor",
      session_id: sessionId,
      new_message_client_id: "msg_understanding_3",
      new_anchor_id: "opening_anchor_2",
      new_history_id: "opening_history_2",
      now: "2026-11-03T12:05:00.000Z",
    });
    assert.equal(reset.cleared_anchor.status, "cleared");
    assert.equal(reset.cleared_anchor.anchor_id, "opening_anchor_pending");
    assert.equal(reset.new_anchor.anchor_id, "opening_anchor_2");
    assert.equal(reset.new_anchor.status, "pending");
    // Old history preserved + new pending
    const hist = reset.state.opening_confirm_history ?? [];
    assert.ok(hist.some((h) => h.anchor_id === "opening_anchor_1"));
    assert.ok(hist.some((h) => h.anchor_id === "opening_anchor_pending" && h.state === "cleared"));
    assert.ok(hist.some((h) => h.anchor_id === "opening_anchor_2" && h.state === "pending"));
    // Old anchors retained
    assert.ok((reset.state.opening_anchors ?? []).some((a) => a.anchor_id === "opening_anchor_1"));
    assert.ok(
      (reset.state.opening_anchors ?? []).some(
        (a) => a.anchor_id === "opening_anchor_pending" && a.status === "cleared",
      ),
    );

    // Reload restores current effective Anchor
    const reloaded = await loadPOJUSession(sessionId);
    assert.ok(reloaded);
    assert.equal(reloaded!.control_plane?.opening_anchor_id, "opening_anchor_2");
    assert.equal(reloaded!.control_plane?.opening_gate_state, "pending");
    const effective = resolveCurrentOpeningAnchor(reloaded!);
    assert.ok(effective);
    assert.equal(effective!.anchor_id, "opening_anchor_2");
    assert.equal(effective!.status, "pending");
  });

  await check("pure builders: confirm refuses non-pending; create rejects anchor_id == client_id", () => {
    const base = {
      session_id: sessionId,
      payment_id: "p",
      original_question: "q",
      created_at: "2026-11-03T12:00:00.000Z",
      last_interaction_at: "2026-11-03T12:00:00.000Z",
      messages: [
        {
          role: "assistant" as const,
          content: "x",
          timestamp: "2026-11-03T12:00:00.000Z",
          client_id: "msg_x",
        },
      ],
      confirmation_events: [],
      opening_anchors: [],
      opening_confirm_history: [],
    } as import("../lib/poju/types").POJUSessionState;

    try {
      buildCreateOpeningAnchorMutation(base, {
        session_id: sessionId,
        message_client_id: "msg_x",
        anchor_id: "msg_x",
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof OpeningAnchorError);
    }

    const created = buildCreateOpeningAnchorMutation(base, {
      session_id: sessionId,
      message_client_id: "msg_x",
      anchor_id: "opening_anchor_pure",
      now: "2026-11-03T12:00:00.000Z",
    });
    const sess2 = applyOpeningAnchorSlice(base, created);
    const confirmed = buildConfirmOpeningAnchorMutation(sess2, {
      anchor_id: "opening_anchor_pure",
      now: "2026-11-03T12:01:00.000Z",
    });
    assert.equal(confirmed.confirmation_events.length, 0);
    const sess3 = applyOpeningAnchorSlice(sess2, confirmed);
    try {
      buildConfirmOpeningAnchorMutation(sess3, {
        anchor_id: "opening_anchor_pure",
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof OpeningAnchorError);
    }
  });

  await check("mergeControlPlanePatch / applyControlPlaneToWorking whitelist patch", () => {
    __resetPersistIdempotencyForTests();
    const slice = extractDcSessionSlice({
      session_id: sessionId,
      control_plane: createDefaultControlPlane("opening"),
    });
    const tx = beginPersistTransaction(slice, { idempotency_key: "s3_cp_patch" });
    assert.ok(tx);
    applyControlPlaneToWorking(tx!, { current_phase: "collecting_context" });
    assert.equal(tx!.working.control_plane?.current_phase, "collecting_context");
    assert.deepEqual(tx!.working.control_plane?.investigation_agenda, []);
    try {
      applyControlPlaneToWorking(tx!, { not_a_field: 1 } as any);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(isControlPlaneError(err));
      assert.equal((err as ControlPlaneError).code, UNKNOWN_CONTROL_PLANE_FIELD);
    }
    const full = replaceFormalControlPlane({
      ...createDefaultControlPlane("awaiting_confirmation"),
      opening_gate_state: "confirmed",
    });
    assert.equal(validateControlPlaneOutput(full).opening_gate_state, "confirmed");
    const merged = mergeControlPlanePatch(full, { current_phase: "delivered" });
    assert.equal(merged.current_phase, "delivered");
    assert.equal(merged.opening_gate_state, "confirmed");
  });

  console.log(`\nphase3-s3-control-plane: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
