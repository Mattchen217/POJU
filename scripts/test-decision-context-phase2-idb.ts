/**
 * Decision Context Phase 2 — real IndexedDB / Dexie C1 atomicity tests.
 * Run: pnpm test:decision-context-phase2-idb
 *
 * Proves blob + cycle index + tool-suggestion index commit together and roll
 * back together. Uses fake-indexeddb (Dexie-compatible). Does NOT wire
 * Opening / Gate / Call A/B / Collecting.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

// Minimal browser globals before loading app modules that gate on `window`.
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
g.localStorage = localStoragePolyfill;
if (!g.crypto || !g.crypto.getRandomValues) {
  g.crypto = webcrypto as unknown as Crypto;
}
memoryStore.set("pojulife_device_id_v4", "dev_phase2_idb");
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
  console.log("decision-context phase2-idb");

  const { __resetPojuDbForTests, getPojuDb, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { encryptJson, decryptJson } = await import("../lib/crypto");
  const {
    savePOJUSessionCore,
    loadPOJUSession,
  } = await import("../lib/poju/session-manager");
  const { resolveLocalOwnerKey } = await import("../lib/storage/local-owner");
  const types = await import("../lib/poju/types");
  type POJUSessionState = types.POJUSessionState;

  const SESSION_SECRET = "pojulife_v4_poju_session";

  function mockSession(partial: Partial<POJUSessionState> = {}): POJUSessionState {
    const now = "2026-11-03T07:00:00.000Z";
    return {
      session_id: "sess_phase2_idb",
      device_id: "dev_phase2_idb",
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
      expires_at: "2026-12-03T07:00:00.000Z",
      unlock_status: "preview",
      cycles: [
        {
          cycle_id: "cyc_idb_1",
          cycle_index: 1,
          original_question: "Should I leave?",
          question_category: "unknown",
          current_summary: null,
          started_at: now,
          tool_suggestions: [
            {
              tool: "glyph",
              suggested_at: now,
              suggested_in_message_id: "msg_1",
              trigger_context: "test",
              user_action: "pending",
            },
          ],
          is_delivered: false,
          is_active: true,
        },
      ],
      active_cycle_id: "cyc_idb_1",
      shared_context: {},
      ...partial,
    };
  }

  async function resetDb(): Promise<void> {
    await __resetPojuDbForTests();
    await ensurePojuDbReady();
  }

  async function seedSessionRow(state: POJUSessionState): Promise<void> {
    const db = getPojuDb();
    const ownerKey = await resolveLocalOwnerKey();
    const payload = await encryptJson(SESSION_SECRET, state);
    const now = new Date(state.created_at);
    await db.pojuSessionRecords.put({
      session_id: state.session_id,
      device_id: state.device_id,
      owner_key: ownerKey,
      encrypted_data: payload.cipher,
      iv: payload.iv,
      status: "active",
      original_question: state.original_question,
      created_at: now,
      last_interaction_at: new Date(state.last_interaction_at),
      expires_at: new Date(state.expires_at),
      payment_id: "pay_test",
      payment_processor: "dodopayments",
      renewals: [],
      tokens_used: state.tokens_used,
      turn_count: 0,
      current_state_hint: "opening",
      main_delivery_done: false,
      active_cycle_id: state.active_cycle_id,
    });
  }

  async function readBlob(sessionId: string): Promise<POJUSessionState | null> {
    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(sessionId);
    if (!row) return null;
    return decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row.iv,
      cipher: row.encrypted_data,
    });
  }

  await check("successful commit writes blob + cycles + suggestions together", async () => {
    await resetDb();
    const state = mockSession({ original_question: "commit-ok" });
    await seedSessionRow(state);

    await savePOJUSessionCore(state);

    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.ok(row);
    assert.equal(row!.original_question, "commit-ok");
    const blob = await readBlob(state.session_id);
    assert.equal(blob?.original_question, "commit-ok");
    assert.equal(blob?.cycles?.[0]?.cycle_id, "cyc_idb_1");

    const cycles = await db.poju_cycles.where("session_id").equals(state.session_id).toArray();
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].cycle_id, "cyc_idb_1");

    const suggestions = await db.poju_tool_suggestions
      .where("session_id")
      .equals(state.session_id)
      .toArray();
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].tool, "glyph");
  });

  await check("session missing: update!==1 throws; cycle index not written", async () => {
    await resetDb();
    const state = mockSession({
      session_id: "sess_missing",
      original_question: "ghost",
    });
    // Intentionally do NOT seed the session row.

    let threw = false;
    try {
      await savePOJUSessionCore(state);
    } catch (e) {
      threw = true;
      assert.match(String(e), /expected 1 row/i);
    }
    assert.equal(threw, true);

    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row, undefined);
    const cycles = await db.poju_cycles.where("session_id").equals(state.session_id).toArray();
    assert.equal(cycles.length, 0);
    const suggestions = await db.poju_tool_suggestions
      .where("session_id")
      .equals(state.session_id)
      .toArray();
    assert.equal(suggestions.length, 0);
  });

  await check("cycles emptied: old cycle + suggestion index rows deleted", async () => {
    await resetDb();
    const seeded = mockSession({ original_question: "before-clear" });
    await seedSessionRow(seeded);
    await savePOJUSessionCore(seeded);

    const db = getPojuDb();
    assert.equal(
      (await db.poju_cycles.where("session_id").equals(seeded.session_id).toArray()).length,
      1,
    );
    assert.equal(
      (
        await db.poju_tool_suggestions.where("session_id").equals(seeded.session_id).toArray()
      ).length,
      1,
    );

    const emptied: POJUSessionState = {
      ...seeded,
      original_question: "cleared",
      cycles: [],
      active_cycle_id: undefined,
    };
    await savePOJUSessionCore(emptied);

    const row = await db.pojuSessionRecords.get(seeded.session_id);
    assert.equal(row!.original_question, "cleared");
    const blob = await readBlob(seeded.session_id);
    assert.deepEqual(blob?.cycles, []);
    assert.equal(
      (await db.poju_cycles.where("session_id").equals(seeded.session_id).toArray()).length,
      0,
    );
    assert.equal(
      (
        await db.poju_tool_suggestions.where("session_id").equals(seeded.session_id).toArray()
      ).length,
      0,
    );
  });

  await check("blob write failure rolls back cycle index writes", async () => {
    await resetDb();
    const state = mockSession({ original_question: "stable-blob" });
    await seedSessionRow(state);
    await savePOJUSessionCore(state);

    const db = getPojuDb();
    const beforeCycles = await db.poju_cycles.where("session_id").equals(state.session_id).count();
    assert.equal(beforeCycles, 1);

    const table = db.pojuSessionRecords as unknown as {
      update: (...args: unknown[]) => Promise<number>;
    };
    const originalUpdate = table.update.bind(db.pojuSessionRecords);
    table.update = async () => {
      throw new Error("IDB blob write failed");
    };

    const next: POJUSessionState = {
      ...state,
      original_question: "SHOULD_NOT_COMMIT",
      cycles: [
        {
          cycle_id: "cyc_should_not",
          cycle_index: 99,
          original_question: "nope",
          question_category: "unknown",
          current_summary: null,
          started_at: state.created_at,
          tool_suggestions: [],
          is_delivered: false,
          is_active: true,
        },
      ],
      active_cycle_id: "cyc_should_not",
    };

    let threw = false;
    try {
      await savePOJUSessionCore(next);
    } catch (e) {
      threw = true;
      assert.match(String(e), /blob write failed/i);
    } finally {
      table.update = originalUpdate;
    }
    assert.equal(threw, true);

    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row!.original_question, "stable-blob");
    const blob = await readBlob(state.session_id);
    assert.equal(blob?.original_question, "stable-blob");
    assert.equal(blob?.cycles?.[0]?.cycle_id, "cyc_idb_1");

    const cycles = await db.poju_cycles.where("session_id").equals(state.session_id).toArray();
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].cycle_id, "cyc_idb_1");
    assert.equal(
      (
        await db.poju_tool_suggestions.where("session_id").equals(state.session_id).toArray()
      ).length,
      1,
    );
  });

  await check("cycle write failure rolls back blob update", async () => {
    await resetDb();
    const state = mockSession({ original_question: "stable-cycle" });
    await seedSessionRow(state);
    await savePOJUSessionCore(state);

    const db = getPojuDb();
    const table = db.poju_cycles as unknown as {
      bulkPut: (...args: unknown[]) => Promise<unknown>;
    };
    const originalBulkPut = table.bulkPut.bind(db.poju_cycles);
    table.bulkPut = async () => {
      throw new Error("IDB cycle write failed");
    };

    const next: POJUSessionState = {
      ...state,
      original_question: "BLOB_SHOULD_ROLLBACK",
      last_interaction_at: "2026-11-03T08:00:00.000Z",
      cycles: [
        {
          cycle_id: "cyc_fail_write",
          cycle_index: 2,
          original_question: "fail",
          question_category: "unknown",
          current_summary: null,
          started_at: state.created_at,
          tool_suggestions: [
            {
              tool: "syncro",
              suggested_at: state.created_at,
              suggested_in_message_id: "msg_x",
              trigger_context: "x",
              user_action: "pending",
            },
          ],
          is_delivered: false,
          is_active: true,
        },
      ],
      active_cycle_id: "cyc_fail_write",
    };

    let threw = false;
    try {
      await savePOJUSessionCore(next);
    } catch (e) {
      threw = true;
      assert.match(String(e), /cycle write failed/i);
    } finally {
      table.bulkPut = originalBulkPut;
    }
    assert.equal(threw, true);

    const row = await db.pojuSessionRecords.get(state.session_id);
    assert.equal(row!.original_question, "stable-cycle");
    const blob = await readBlob(state.session_id);
    assert.equal(blob?.original_question, "stable-cycle");
    assert.equal(blob?.cycles?.[0]?.cycle_id, "cyc_idb_1");

    // Dexie aborts the whole rw transaction: prior deletes + puts are undone.
    const cycles = await db.poju_cycles.where("session_id").equals(state.session_id).toArray();
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].cycle_id, "cyc_idb_1");
    const suggestions = await db.poju_tool_suggestions
      .where("session_id")
      .equals(state.session_id)
      .toArray();
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].tool, "glyph");
  });

  await check("reload restore: loadPOJUSession returns committed blob+DC authority path", async () => {
    await resetDb();
    const state = mockSession({
      original_question: "reload-me",
      decision_context: null,
      decision_context_idempotency_keys: ["op_seed"],
    });
    await seedSessionRow(state);
    await savePOJUSessionCore({
      ...state,
      original_question: "reloaded-title",
      decision_context_idempotency_keys: ["op_seed", "op_after"],
    });

    const loaded = await loadPOJUSession(state.session_id);
    assert.ok(loaded);
    assert.equal(loaded!.original_question, "reloaded-title");
    assert.ok(loaded!.decision_context_idempotency_keys?.includes("op_after"));
    assert.equal(loaded!.cycles?.[0]?.cycle_id, "cyc_idb_1");

    const db = getPojuDb();
    assert.equal(
      (await db.poju_cycles.where("session_id").equals(state.session_id).count()),
      1,
    );
  });

  console.log(`\nphase2-idb: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
