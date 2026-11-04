const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf('await p3("P3-70"');
const end = s.indexOf('await p3("P3-71"');
if (start < 0 || end < 0 || end <= start) {
  console.error("P3-70 block bounds not found", start, end);
  process.exit(1);
}

const replacement = `await p3("P3-70", "encrypt failure — no Revision/blob change", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_70", original_question: "70" });
    const before = await loadPOJUSession(sid);
    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    const cyclesBefore = await db.poju_cycles.where("session_id").equals(sid).count();
    const keysBefore = [...(before!.decision_context_idempotency_keys ?? [])].sort();
    const bindingsBefore = JSON.stringify(before!.generation_operation_bindings ?? []);
    const registryBefore = JSON.stringify(before!.generation_registry ?? []);
    const tasksBefore = JSON.stringify(before!.generation_task_contexts ?? []);
    const cipherBefore = rowBefore!.encrypted_data;
    const ivBefore = rowBefore!.iv;
    const sRevBefore = before!.session_revision;
    const dRevBefore = before!.dc_write_revision;
    const rowSBefore = rowBefore!.session_revision;
    const rowDBefore = rowBefore!.dc_write_revision;

    let encryptCalls = 0;
    const failingEncrypt: typeof encryptJson = async (_secret, payload) => {
      encryptCalls += 1;
      // Prove we reached the real encrypt step with a concrete candidate payload.
      assert.ok(payload && typeof payload === "object");
      assert.equal((payload as any).session_id, sid);
      throw new Error("simulated-encrypt-failure");
    };

    let threw = false;
    let thrownMsg = "";
    try {
      await mutatePOJUSession(
        sid,
        {
          operation_id: "op_70_encrypt_fail",
          kind: "session_patch",
          bump_dc: false,
          apply: (latest) => ({
            ...latest,
            original_question: "70-after-encrypt-should-not-persist",
            last_interaction_at: "2026-11-03T12:70:00.000Z",
          }),
        },
        { encrypt: failingEncrypt },
      );
    } catch (err) {
      threw = true;
      thrownMsg = err instanceof Error ? err.message : String(err);
    }
    assert.equal(threw, true, "encrypt failure must throw");
    assert.match(thrownMsg, /simulated-encrypt-failure/);
    assert.ok(encryptCalls >= 1, "real encrypt path must have been invoked");

    const afterFail = await loadPOJUSession(sid);
    const rowAfterFail = await db.pojuSessionRecords.get(sid);
    const cyclesAfterFail = await db.poju_cycles.where("session_id").equals(sid).count();
    assert.equal(afterFail!.session_revision, sRevBefore);
    assert.equal(afterFail!.dc_write_revision, dRevBefore);
    assert.equal(rowAfterFail!.session_revision, rowSBefore);
    assert.equal(rowAfterFail!.dc_write_revision, rowDBefore);
    assert.equal(rowAfterFail!.encrypted_data, cipherBefore);
    assert.equal(rowAfterFail!.iv, ivBefore);
    assert.equal(afterFail!.original_question, before!.original_question);
    assert.equal(cyclesAfterFail, cyclesBefore);
    assert.deepEqual([...(afterFail!.decision_context_idempotency_keys ?? [])].sort(), keysBefore);
    assert.equal(JSON.stringify(afterFail!.generation_operation_bindings ?? []), bindingsBefore);
    assert.equal(JSON.stringify(afterFail!.generation_registry ?? []), registryBefore);
    assert.equal(JSON.stringify(afterFail!.generation_task_contexts ?? []), tasksBefore);

    // Same stable operation identity retry with real encrypt must complete.
    const retry = await mutatePOJUSession(sid, {
      operation_id: "op_70_encrypt_fail",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        original_question: "70-after-encrypt-should-not-persist",
        last_interaction_at: "2026-11-03T12:70:00.000Z",
      }),
    });
    assert.equal(retry.session_revision, sRevBefore! + 1);
    assert.equal(retry.dc_write_revision, dRevBefore);
    assert.equal(retry.state.original_question, "70-after-encrypt-should-not-persist");

    const afterOk = await loadPOJUSession(sid);
    const rowAfterOk = await db.pojuSessionRecords.get(sid);
    assert.equal(afterOk!.session_revision, sRevBefore! + 1);
    assert.equal(afterOk!.dc_write_revision, dRevBefore);
    assert.notEqual(rowAfterOk!.encrypted_data, cipherBefore);
    assert.equal(afterOk!.original_question, "70-after-encrypt-should-not-persist");
  });

  `;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log("patched P3-70 test OK; bytes", replacement.length);
