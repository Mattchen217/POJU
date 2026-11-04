const fs = require("fs");
const p = "scripts/test-decision-context-phase3-e2e.ts";
let s = fs.readFileSync(p, "utf8");

// Ensure imports from confirmation-event include new APIs
if (!s.includes("confirmFact")) {
  const oldImp = `  const {
    appendConfirmationEvent,
    assertGateConfirmDoesNotCreateFactEvents,
  } = await import("../lib/poju/decision-context/confirmation-event");`;
  const newImp = `  const {
    appendConfirmationEvent,
    assertGateConfirmDoesNotCreateFactEvents,
    confirmFact,
    confirmConstraint,
    assertConfirmationEventProvenance,
    isConfirmationEventError,
    CONFIRMATION_SOURCE_INVALID,
    CONFIRMATION_TARGET_INVALID,
    CONFIRMATION_ACTION_REUSED,
  } = await import("../lib/poju/decision-context/confirmation-event");`;
  if (!s.includes(oldImp)) {
    console.error("confirmation import block missing");
    process.exit(1);
  }
  s = s.replace(oldImp, newImp);
}

const start = s.indexOf('await p3("P3-112"');
const next = s.indexOf('await p3("P3-114"');
if (start < 0 || next < 0) {
  console.error("bounds", start, next);
  process.exit(1);
}

const block = `await p3("P3-112", "source_turn provenance — real user message required", async () => {
    // (0) empty source_turn_id still hard-fails at schema layer
    assert.throws(
      () =>
        appendConfirmationEvent([], {
          event_id: "evt_112_empty",
          target_type: "fact",
          fact_id: "fact_1",
          source_turn_id: "",
          confirmation_turn_id: null,
          confirmation_action_id: "act_112_empty",
          event_type: "confirm_fact",
          actor: "user",
          confirmed_at: "2026-11-03T12:00:00.000Z",
          event_version: 1,
        } as any),
      (e: unknown) => isConfirmationEventError(e),
    );

    const sid = await createPOJUSession({ payment_id: "pay_s5_112", original_question: "112" });
    const sidOther = await createPOJUSession({
      payment_id: "pay_s5_112b",
      original_question: "112-other",
    });

    // Seed user + assistant messages and a Fact bound to the user turn.
    await mutatePOJUSession(sid, {
      operation_id: "op_112_seed",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "user",
            content: "I have a hard deadline next Friday",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "turn_user_112",
          },
          {
            role: "assistant",
            content: "Got it",
            timestamp: "2026-11-03T12:00:01.000Z",
            client_id: "turn_asst_112",
          },
        ],
        decision_context: makeDc({
          context_id: "ctx_112",
          version: 1,
          reality_facts: [
            {
              fact_id: "fact_112",
              statement: "Hard deadline next Friday",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112",
              user_confirmed: false,
            },
            {
              fact_id: "fact_112_other",
              statement: "Other fact",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112_other_missing",
              user_confirmed: false,
            },
          ],
          constraints: [
            {
              constraint_id: "cst_112",
              statement: "Cannot miss deadline",
              category: "time",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "opening",
              source_turn_id: "turn_user_112",
              rigidity: "hard",
              user_confirmed: false,
            },
          ],
        }),
      }),
    });

    // Seed a user message only on the OTHER session (cross-session trap).
    await mutatePOJUSession(sidOther, {
      operation_id: "op_112_other_msg",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "user",
            content: "other session statement",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "turn_user_other_session",
          },
        ],
      }),
    });

    // (1) forged non-empty source_turn_id — not in Session
    let forged = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_forge",
        event_id: "evt_112_forge",
        fact_id: "fact_112",
        source_turn_id: "totally_fake_turn",
        confirmation_action_id: "act_112_forge",
      });
    } catch (err) {
      forged = true;
      assert.ok(isConfirmationEventError(err));
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(forged, true);

    // (2) cross-Session turn id
    let cross = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_cross",
        event_id: "evt_112_cross",
        fact_id: "fact_112",
        source_turn_id: "turn_user_other_session",
        confirmation_action_id: "act_112_cross",
      });
    } catch (err) {
      cross = true;
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(cross, true);

    // (3) non-user (assistant) message
    let nonUser = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_asst",
        event_id: "evt_112_asst",
        fact_id: "fact_112",
        source_turn_id: "turn_asst_112",
        confirmation_action_id: "act_112_asst",
      });
    } catch (err) {
      nonUser = true;
      assert.equal((err as any).code, CONFIRMATION_SOURCE_INVALID);
    }
    assert.equal(nonUser, true);

    // (4) target Fact missing
    let missingTarget = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_nofact",
        event_id: "evt_112_nofact",
        fact_id: "fact_does_not_exist",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_nofact",
      });
    } catch (err) {
      missingTarget = true;
      assert.equal((err as any).code, CONFIRMATION_TARGET_INVALID);
    }
    assert.equal(missingTarget, true);

    // (5) target Fact exists but source association mismatch
    let mismatch = false;
    try {
      await confirmFact(sid, {
        operation_id: "op_112_mismatch",
        event_id: "evt_112_mismatch",
        fact_id: "fact_112_other",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_mismatch",
      });
    } catch (err) {
      mismatch = true;
      assert.equal((err as any).code, CONFIRMATION_TARGET_INVALID);
    }
    assert.equal(mismatch, true);

    // (6) happy path — real user provenance
    const ok = await confirmFact(sid, {
      operation_id: "op_112_ok",
      event_id: "evt_112_ok",
      fact_id: "fact_112",
      source_turn_id: "turn_user_112",
      confirmation_action_id: "act_112_ok",
      confirmed_at: "2026-11-03T12:05:00.000Z",
    });
    assert.equal(ok.outcome, "appended");
    assert.equal(ok.event.source_turn_id, "turn_user_112");

    // (7) confirmation_action_id reused for different target — hard fail
    let reused = false;
    try {
      await confirmConstraint(sid, {
        operation_id: "op_112_reuse",
        event_id: "evt_112_reuse",
        constraint_id: "cst_112",
        source_turn_id: "turn_user_112",
        confirmation_action_id: "act_112_ok",
      });
    } catch (err) {
      reused = true;
      assert.equal((err as any).code, CONFIRMATION_ACTION_REUSED);
    }
    assert.equal(reused, true);

    // Provenance helper rejects forged string even if schema-valid
    const after = await loadPOJUSession(sid);
    assert.throws(
      () =>
        assertConfirmationEventProvenance(
          {
            session_id: after!.session_id,
            messages: after!.messages,
            decision_context: after!.decision_context,
          },
          {
            event_id: "evt_x",
            target_type: "fact",
            fact_id: "fact_112",
            source_turn_id: "forged",
            confirmation_turn_id: null,
            confirmation_action_id: "act_x",
            event_type: "confirm_fact",
            actor: "user",
            confirmed_at: "2026-11-03T12:00:00.000Z",
            event_version: 1,
          },
        ),
      (e: unknown) =>
        isConfirmationEventError(e) && (e as any).code === CONFIRMATION_SOURCE_INVALID,
    );

    const still = await loadPOJUSession(sid);
    assert.equal(
      (still!.confirmation_events ?? []).filter((e) => e.event_id === "evt_112_ok").length,
      1,
    );
    assert.equal(
      still!.decision_context!.reality_facts.find((f) => f.fact_id === "fact_112")!.user_confirmed,
      true,
    );
  });

  `;

s = s.slice(0, start) + block + s.slice(next);
fs.writeFileSync(p, s);
console.log("P3-112 rewritten");
