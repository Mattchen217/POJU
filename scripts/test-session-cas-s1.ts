/**
 * Phase 3 S1 — Session CAS Foundation tests (unit + fake-indexeddb).
 * Run: pnpm test:session-cas-s1
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
memoryStore.set("pojulife_device_id_v4", "dev_s1_cas");
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
  console.log("phase3-s1-session-cas");

  const {
    resolveRevisionMirror,
    didDecisionContextChange,
    mergeMessageByClientId,
    applyMessageAppend,
    casWritePOJUSession,
    mutatePOJUSession,
    createPOJUSessionRecordIfAbsent,
    casWritePOJUSessionFromCandidate,
    REVISION_MIRROR_MISMATCH,
    SESSION_CAS_CONFLICT,
    MESSAGE_CLIENT_ID_CONFLICT,
    SessionCasError,
  } = await import("../lib/poju/session-mutation");
  const { __resetPojuDbForTests, getPojuDb, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { encryptJson, decryptJson } = await import("../lib/crypto");
  const {
    createPOJUSession,
    loadPOJUSession,
    savePOJUSessionCore,
    commitDecisionContextChange,
  } = await import("../lib/poju/session-manager");
  const { resolveLocalOwnerKey } = await import("../lib/storage/local-owner");
  const { applyDcToWorking } = await import("../lib/poju/decision-context/persist");
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type POJUMessage = import("../lib/poju/types").POJUMessage;

  const SESSION_SECRET = "pojulife_v4_poju_session";

  function mockSession(partial: Partial<POJUSessionState> = {}): POJUSessionState {
    const now = "2026-11-03T10:00:00.000Z";
    return {
      session_id: "sess_s1_cas_0001",
      device_id: "dev_s1_cas",
      original_question: "CAS foundation?",
      messages: [],
      context_collected: {},
      has_profile: false,
      profile_skipped: false,
      actions: [],
      main_delivery_done: false,
      main_delivery: null,
      tokens_used: 0,
      abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
      created_at: now,
      last_interaction_at: now,
      expires_at: "2026-12-03T10:00:00.000Z",
      unlock_status: "preview",
      cycles: [
        {
          cycle_id: "cyc_s1_1",
          cycle_index: 1,
          original_question: "CAS foundation?",
          question_category: "unknown",
          current_summary: null,
          started_at: now,
          tool_suggestions: [],
          is_delivered: false,
          is_active: true,
        },
      ],
      active_cycle_id: "cyc_s1_1",
      shared_context: {},
      session_revision: 0,
      dc_write_revision: 0,
      ...partial,
    };
  }

  async function resetDb(): Promise<void> {
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
  }

  async function seedWithCas(state: POJUSessionState): Promise<void> {
    const ownerKey = await resolveLocalOwnerKey();
    const { created } = await createPOJUSessionRecordIfAbsent({
      session_id: state.session_id,
      device_id: state.device_id,
      owner_key: ownerKey,
      state,
      payment_id: "pay_s1",
    });
    assert.equal(created, true);
  }

  // --- pure unit tests (no IDB) ---

  await check("dual-rev: both absent → logical 0", () => {
    const r = resolveRevisionMirror({}, {});
    assert.deepEqual(r, { session_revision: 0, dc_write_revision: 0 });
  });

  await check("dual-rev: mismatch → REVISION_MIRROR_MISMATCH", () => {
    assert.throws(
      () => resolveRevisionMirror({ session_revision: 1, dc_write_revision: 0 }, { session_revision: 2, dc_write_revision: 0 }),
      (e: unknown) => e instanceof SessionCasError && e.code === REVISION_MIRROR_MISMATCH,
    );
  });

  await check("dual-rev: one-sided → REVISION_MIRROR_MISMATCH", () => {
    assert.throws(
      () => resolveRevisionMirror({ session_revision: 1, dc_write_revision: 0 }, {}),
      (e: unknown) => e instanceof SessionCasError && e.code === REVISION_MIRROR_MISMATCH,
    );
  });

  await check("dual-rev: illegal type → REVISION_MIRROR_MISMATCH", () => {
    assert.throws(
      () =>
        resolveRevisionMirror(
          { session_revision: 1.5 as unknown as number, dc_write_revision: 0 },
          { session_revision: 1.5 as unknown as number, dc_write_revision: 0 },
        ),
      (e: unknown) => e instanceof SessionCasError && e.code === REVISION_MIRROR_MISMATCH,
    );
  });

  await check("message client_id identical → idempotent", () => {
    const msg: POJUMessage = {
      role: "user",
      content: "hi",
      timestamp: "2026-11-03T10:00:00.000Z",
      client_id: "c1",
    };
    const r1 = mergeMessageByClientId([msg], { ...msg });
    assert.equal(r1.already_applied, true);
    assert.equal(r1.messages.length, 1);
  });

  await check("message client_id conflict → hard fail", () => {
    const msg: POJUMessage = {
      role: "user",
      content: "hi",
      timestamp: "2026-11-03T10:00:00.000Z",
      client_id: "c1",
    };
    assert.throws(
      () => mergeMessageByClientId([msg], { ...msg, content: "different" }),
      (e: unknown) => e instanceof SessionCasError && e.code === MESSAGE_CLIENT_ID_CONFLICT,
    );
  });

  await check("message different client_id → both kept", () => {
    const a: POJUMessage = {
      role: "user",
      content: "a",
      timestamp: "2026-11-03T10:00:00.000Z",
      client_id: "c1",
    };
    const b: POJUMessage = {
      role: "user",
      content: "b",
      timestamp: "2026-11-03T10:00:01.000Z",
      client_id: "c2",
    };
    const r = mergeMessageByClientId([a], b);
    assert.equal(r.messages.length, 2);
  });

  await check("didDecisionContextChange detects DC content only", async () => {
    const { seedDecisionContextFromOpening } = await import("../lib/poju/decision-context");
    const base = mockSession({ decision_context: null });
    const same = mockSession({
      decision_context: null,
      messages: [{ role: "user", content: "x", timestamp: "t", client_id: "m1" }],
    });
    assert.equal(didDecisionContextChange(base, same), false);
    const dc = seedDecisionContextFromOpening({
      context_id: "dc1",
      now: "2026-11-03T10:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const changed = mockSession({ decision_context: dc });
    assert.equal(didDecisionContextChange(base, changed), true);
  });

  // --- IDB / Dexie tests ---

  await check("create-if-absent inits dual rev 0; second create does not overwrite", async () => {
    await resetDb();
    const state = mockSession({ original_question: "first" });
    const ownerKey = await resolveLocalOwnerKey();
    const r1 = await createPOJUSessionRecordIfAbsent({
      session_id: state.session_id,
      device_id: state.device_id,
      owner_key: ownerKey,
      state,
      payment_id: "pay1",
    });
    assert.equal(r1.created, true);

    const r2 = await createPOJUSessionRecordIfAbsent({
      session_id: state.session_id,
      device_id: state.device_id,
      owner_key: ownerKey,
      state: { ...state, original_question: "SHOULD_NOT_WIN" },
      payment_id: "pay2",
    });
    assert.equal(r2.created, false);

    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row!.session_revision, 0);
    assert.equal(row!.dc_write_revision, 0);
    assert.equal(row!.original_question, "first");
    const blob = await decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row!.iv,
      cipher: row!.encrypted_data,
    });
    assert.equal(blob.session_revision, 0);
    assert.equal(blob.dc_write_revision, 0);
    assert.equal(blob.original_question, "first");
  });

  await check("createPOJUSession production path is create-if-absent", async () => {
    await resetDb();
    const id = await createPOJUSession({
      payment_id: "pay_prod",
      original_question: "hello create",
      session_id: "sess_create_prod01",
    });
    assert.equal(id, "sess_create_prod01");
    const loaded = await loadPOJUSession(id);
    assert.equal(loaded!.session_revision, 0);
    assert.equal(loaded!.dc_write_revision, 0);

    await assert.rejects(
      () =>
        createPOJUSession({
          payment_id: "pay_prod2",
          original_question: "overwrite?",
          session_id: "sess_create_prod01",
        }),
      (e: unknown) => e instanceof SessionCasError && e.code === "SESSION_CREATE_EXISTS",
    );
    const loaded2 = await loadPOJUSession(id);
    assert.equal(loaded2!.original_question, "hello create");
  });

  await check("non-DC write bumps session_revision only", async () => {
    await resetDb();
    const state = mockSession();
    await seedWithCas(state);

    const result = await mutatePOJUSession(state.session_id, {
      operation_id: "op_msg_1",
      kind: "message_append",
      apply: (latest) =>
        applyMessageAppend(latest, {
          role: "user",
          content: "hello",
          timestamp: "2026-11-03T10:01:00.000Z",
          client_id: "msg_1",
        }),
      bump_dc: false,
    });

    assert.equal(result.session_revision, 1);
    assert.equal(result.dc_write_revision, 0);

    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row!.session_revision, 1);
    assert.equal(row!.dc_write_revision, 0);
    const blob = await decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row!.iv,
      cipher: row!.encrypted_data,
    });
    assert.equal(blob.session_revision, 1);
    assert.equal(blob.dc_write_revision, 0);
    assert.equal(blob.messages.length, 1);
  });

  await check("DC write bumps both revisions", async () => {
    await resetDb();
    const state = mockSession();
    await seedWithCas(state);

    const base = await loadPOJUSession(state.session_id);
    assert.ok(base);
    const { seedDecisionContextFromOpening } = await import("../lib/poju/decision-context");
    const nextDc = seedDecisionContextFromOpening({
      context_id: "dc_s1",
      now: "2026-11-03T10:00:00.000Z",
      core_dilemma: { concrete_event: "Should I?", stakes: "high", sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const { __resetPersistIdempotencyForTests } = await import("../lib/poju/decision-context");
    __resetPersistIdempotencyForTests();
    const commit = await commitDecisionContextChange({
      session: base!,
      idempotency_key: `dc:${state.session_id}:op_dc_1`,
      require_control_plane: false,
      apply: (tx) => {
        applyDcToWorking(tx, nextDc);
      },
      afterCommit: async () => {},
    });
    assert.equal(commit.committed, true);
    assert.equal(commit.session.session_revision, 1);
    assert.equal(commit.session.dc_write_revision, 1);

    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row!.session_revision, 1);
    assert.equal(row!.dc_write_revision, 1);
  });

  await check("CAS conflict replays same operation_id", async () => {
    await resetDb();
    const state = mockSession();
    await seedWithCas(state);

    let applyCount = 0;
    const result = await mutatePOJUSession(
      state.session_id,
      {
        operation_id: "op_replay_stable",
        kind: "session_patch",
        apply: (latest) => {
          applyCount += 1;
          return {
            ...latest,
            original_question: `patched-${applyCount}`,
            last_interaction_at: "2026-11-03T10:05:00.000Z",
          };
        },
        bump_dc: false,
      },
      {
        casWrite: async (input) => {
          if (applyCount === 1) {
            // Simulate concurrent writer winning first attempt.
            await casWritePOJUSession({
              candidate: {
                ...input.candidate,
                original_question: "concurrent-win",
              },
              expected_session_revision: input.expected_session_revision,
              expected_dc_write_revision: input.expected_dc_write_revision,
              bump_dc_write_revision: false,
            });
            throw new SessionCasError(SESSION_CAS_CONFLICT, "simulated conflict");
          }
          return casWritePOJUSession(input);
        },
      },
    );

    assert.ok(applyCount >= 2, "mutation must replay after conflict");
    assert.equal(result.session_revision, 2);
    assert.equal(result.state.original_question, `patched-${applyCount}`);
  });

  await check("revision mirror hard-fail on load/mutate path", async () => {
    await resetDb();
    const state = mockSession({ session_revision: 0, dc_write_revision: 0 });
    await seedWithCas(state);
    const db = getPojuDb();
    // Corrupt row mirror only (one-sided / mismatch)
    await db.pojuSessionRecords.update(state.session_id, { session_revision: 9 });

    await assert.rejects(
      () =>
        mutatePOJUSession(state.session_id, {
          operation_id: "op_should_fail",
          kind: "session_patch",
          apply: (s) => s,
        }),
      (e: unknown) => e instanceof SessionCasError && e.code === REVISION_MIRROR_MISMATCH,
    );
  });

  await check("loadPOJUSession: corrupted row mirror → REVISION_MIRROR_MISMATCH", async () => {
    await resetDb();
    const state = mockSession({ session_revision: 0, dc_write_revision: 0 });
    await seedWithCas(state);
    const db = getPojuDb();
    // Corrupt row mirror only — blob still at 0/0; load must hard-fail (S1.1).
    await db.pojuSessionRecords.update(state.session_id, { session_revision: 9 });

    await assert.rejects(
      () => loadPOJUSession(state.session_id),
      (e: unknown) => e instanceof SessionCasError && e.code === REVISION_MIRROR_MISMATCH,
    );
  });

  await check("savePOJUSessionCore thin CAS wrapper bumps session rev", async () => {
    await resetDb();
    const state = mockSession({ original_question: "core-wrap" });
    await seedWithCas(state);
    const loaded = await loadPOJUSession(state.session_id);
    assert.ok(loaded);
    loaded!.original_question = "core-wrap-2";
    await savePOJUSessionCore(loaded!);
    assert.equal(loaded!.session_revision, 1);
    assert.equal(loaded!.dc_write_revision, 0);
    const again = await loadPOJUSession(state.session_id);
    assert.equal(again!.original_question, "core-wrap-2");
    assert.equal(again!.session_revision, 1);
  });

  await check("message append idempotent across mutate retries", async () => {
    await resetDb();
    const state = mockSession();
    await seedWithCas(state);
    const msg: POJUMessage = {
      role: "assistant",
      content: "welcome",
      timestamp: "2026-11-03T10:02:00.000Z",
      client_id: "asst_1",
    };
    await mutatePOJUSession(state.session_id, {
      operation_id: "op_asst_1",
      kind: "message_append",
      apply: (latest) => applyMessageAppend(latest, msg),
      bump_dc: false,
    });
    await mutatePOJUSession(state.session_id, {
      operation_id: "op_asst_1_retry",
      kind: "message_append",
      apply: (latest) => applyMessageAppend(latest, msg),
      bump_dc: false,
    });
    const loaded = await loadPOJUSession(state.session_id);
    assert.equal(loaded!.messages.filter((m) => m.client_id === "asst_1").length, 1);
    assert.equal(loaded!.session_revision, 1); // second mutate is idempotent no-op (no CAS write)
  });

  console.log(`\nphase3-s1-session-cas: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
