const fs = require("fs");
const path = require("path");
const p = path.join("D:\\POJU\\pojulife", "scripts\\test-decision-context-phase2.ts");
let s = fs.readFileSync(p, "utf8");

const needle = `  await check("mergeDcPersistSliceIntoSession does not elevate buffers to DC", () => {`;
if (!s.includes(needle)) throw new Error("insert point not found");

const newTest = `  await check("cross-session idempotency isolation: same op_1 does not skip other session", async () => {
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

`;

s = s.replace(needle, newTest + needle);

// Also update the header comment to mention cross-session isolation
s = s.replace(
  ` * Covers: successful C1 commit; failure rollback; durable idempotency across reload;
 * restore prefers DC over agent_v2 buffers. Does NOT wire Gate/Opening/CallA/B.`,
  ` * Covers: successful C1 commit; failure rollback; durable idempotency across reload;
 * cross-session idempotency isolation; restore prefers DC over agent_v2 buffers.
 * Does NOT wire Gate/Opening/CallA/B.`
);

fs.writeFileSync(p, s);
console.log("added cross-session test to phase2");
