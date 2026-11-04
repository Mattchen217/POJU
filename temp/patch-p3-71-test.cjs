const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");

// Ensure import of cycle hook
if (!s.includes("__setCycleIndexWriteHookForTests")) {
  const marker = '  const { resolveLocalOwnerKey } = await import("../lib/storage/local-owner");';
  if (!s.includes(marker)) {
    console.error("resolveLocalOwnerKey import marker missing");
    process.exit(1);
  }
  s = s.replace(
    marker,
    marker +
      '\n  const { __setCycleIndexWriteHookForTests } = await import("../lib/poju/cycle-db-sync");',
  );
}

const start = s.indexOf('await p3("P3-71"');
const end = s.indexOf('await p3("P3-91"');
if (start < 0 || end < 0) {
  console.error("bounds", start, end);
  process.exit(1);
}

const replacement = `await p3("P3-71", "Dexie mid-txn failure rolls back blob+revisions+indexes", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_71", original_question: "71" });
    const now = "2026-11-03T12:00:00.000Z";

    // Seed a real cycle index row via successful CAS (so mid-txn clear is a real write).
    await mutatePOJUSession(sid, {
      operation_id: "op_71_seed_cycle",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        original_question: "71-seeded",
        last_interaction_at: now,
        active_cycle_id: "cyc_71_seed",
        cycles: [
          {
            cycle_id: "cyc_71_seed",
            cycle_index: 1,
            original_question: "71-seeded",
            question_category: "unknown",
            current_summary: null,
            started_at: now,
            tool_suggestions: [],
            is_delivered: false,
            is_active: true,
          },
        ],
      }),
    });

    const before = await loadPOJUSession(sid);
    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    const cyclesBeforeRows = await db.poju_cycles.where("session_id").equals(sid).toArray();
    const suggestionsBefore = await db.poju_tool_suggestions.where("session_id").equals(sid).count();
    assert.ok(cyclesBeforeRows.length >= 1, "seed must leave real cycle index rows");
    const cipherBefore = rowBefore!.encrypted_data;
    const ivBefore = rowBefore!.iv;
    const sRevBefore = before!.session_revision;
    const dRevBefore = before!.dc_write_revision;
    const rowSBefore = rowBefore!.session_revision;
    const rowDBefore = rowBefore!.dc_write_revision;
    const keysBefore = [...(before!.decision_context_idempotency_keys ?? [])].sort();
    const bindingsBefore = JSON.stringify(before!.generation_operation_bindings ?? []);
    const registryBefore = JSON.stringify(before!.generation_registry ?? []);
    const tasksBefore = JSON.stringify(before!.generation_task_contexts ?? []);
    const cycleIdsBefore = cyclesBeforeRows.map((r) => r.cycle_id).sort();

    let hookHits = 0;
    __setCycleIndexWriteHookForTests(async (phase) => {
      // Fail AFTER session blob update AND after real related-table clears.
      if (phase === "after_clear") {
        hookHits += 1;
        throw new Error("simulated-dexie-mid-txn-fail");
      }
    });

    let threw = false;
    let thrownMsg = "";
    try {
      await mutatePOJUSession(sid, {
        operation_id: "op_71_mid_txn_fail",
        kind: "session_patch",
        bump_dc: false,
        apply: (latest) => ({
          ...latest,
          original_question: "71-should-rollback",
          last_interaction_at: "2026-11-03T12:08:00.000Z",
          active_cycle_id: "cyc_71_new",
          cycles: [
            {
              cycle_id: "cyc_71_new",
              cycle_index: 2,
              original_question: "71-should-rollback",
              question_category: "unknown",
              current_summary: null,
              started_at: "2026-11-03T12:08:00.000Z",
              tool_suggestions: [],
              is_delivered: false,
              is_active: true,
            },
          ],
        }),
      });
    } catch (err) {
      threw = true;
      thrownMsg = err instanceof Error ? err.message : String(err);
    } finally {
      __setCycleIndexWriteHookForTests(null);
    }

    assert.equal(threw, true, "mid-txn failure must throw");
    assert.match(thrownMsg, /simulated-dexie-mid-txn-fail/);
    assert.ok(hookHits >= 1, "cycle-index hook must run inside real CAS txn");

    // Re-read from IndexedDB — no manual restore; Dexie abort must have rolled back.
    const afterFail = await loadPOJUSession(sid);
    const rowAfterFail = await db.pojuSessionRecords.get(sid);
    const cyclesAfterFail = await db.poju_cycles.where("session_id").equals(sid).toArray();
    const suggestionsAfterFail = await db.poju_tool_suggestions.where("session_id").equals(sid).count();

    assert.equal(afterFail!.session_revision, sRevBefore);
    assert.equal(afterFail!.dc_write_revision, dRevBefore);
    assert.equal(rowAfterFail!.session_revision, rowSBefore);
    assert.equal(rowAfterFail!.dc_write_revision, rowDBefore);
    assert.equal(rowAfterFail!.encrypted_data, cipherBefore);
    assert.equal(rowAfterFail!.iv, ivBefore);
    assert.equal(afterFail!.original_question, "71-seeded");
    assert.equal(afterFail!.active_cycle_id, "cyc_71_seed");
    assert.deepEqual(
      cyclesAfterFail.map((r) => r.cycle_id).sort(),
      cycleIdsBefore,
    );
    assert.equal(suggestionsAfterFail, suggestionsBefore);
    assert.deepEqual([...(afterFail!.decision_context_idempotency_keys ?? [])].sort(), keysBefore);
    assert.equal(JSON.stringify(afterFail!.generation_operation_bindings ?? []), bindingsBefore);
    assert.equal(JSON.stringify(afterFail!.generation_registry ?? []), registryBefore);
    assert.equal(JSON.stringify(afterFail!.generation_task_contexts ?? []), tasksBefore);
    assert.equal(
      (afterFail!.cycles ?? []).some((c) => c.cycle_id === "cyc_71_new"),
      false,
    );

    // Same operation identity retry without hook must commit atomically.
    const retry = await mutatePOJUSession(sid, {
      operation_id: "op_71_mid_txn_fail",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        original_question: "71-should-rollback",
        last_interaction_at: "2026-11-03T12:08:00.000Z",
        active_cycle_id: "cyc_71_new",
        cycles: [
          {
            cycle_id: "cyc_71_new",
            cycle_index: 2,
            original_question: "71-should-rollback",
            question_category: "unknown",
            current_summary: null,
            started_at: "2026-11-03T12:08:00.000Z",
            tool_suggestions: [],
            is_delivered: false,
            is_active: true,
          },
        ],
      }),
    });
    assert.equal(retry.session_revision, sRevBefore! + 1);
    assert.equal(retry.state.original_question, "71-should-rollback");
    assert.equal(retry.state.active_cycle_id, "cyc_71_new");

    const afterOk = await loadPOJUSession(sid);
    const rowAfterOk = await db.pojuSessionRecords.get(sid);
    const cyclesAfterOk = await db.poju_cycles.where("session_id").equals(sid).toArray();
    assert.equal(afterOk!.session_revision, sRevBefore! + 1);
    assert.notEqual(rowAfterOk!.encrypted_data, cipherBefore);
    assert.deepEqual(
      cyclesAfterOk.map((r) => r.cycle_id).sort(),
      ["cyc_71_new"],
    );
  });

  `;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log("rewrote P3-71 OK");
