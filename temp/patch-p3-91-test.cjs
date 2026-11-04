const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf('await p3("P3-91"');
if (start < 0) {
  console.error("P3-91 not found");
  process.exit(1);
}
// end at next summarize or end of main tests - find closing of this p3 by next blank+await or summarize
let end = s.indexOf("\n  summarize(", start);
if (end < 0) {
  // try next await p3 after 91
  end = s.indexOf("\n  await p3(", start + 1);
}
if (end < 0) {
  console.error("end not found");
  process.exit(1);
}

const replacement = `await p3("P3-91", "Registry written but Binding missing → whole txn fails, no half-product", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_91", original_question: "91" });
    const pending = await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_b_dir",
      fingerprint: "fp91",
      fingerprint_version: fpv,
      client_task_id: "ctask_91",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_91",
      job_id: "job_91",
    });

    const before = await loadPOJUSession(sid);
    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    const baseRev = before!.dc_write_revision ?? 0;
    const sRevBefore = before!.session_revision;
    const dRevBefore = before!.dc_write_revision;
    const cipherBefore = rowBefore!.encrypted_data;
    const dcBefore = before!.decision_context ?? null;
    const regBefore = JSON.stringify(before!.generation_registry ?? []);
    const bindBefore = JSON.stringify(before!.generation_operation_bindings ?? []);
    const tasksBefore = JSON.stringify(before!.generation_task_contexts ?? []);
    const keysBefore = [...(before!.decision_context_idempotency_keys ?? [])].sort();
    const taskBefore = (before!.generation_task_contexts ?? []).find(
      (t) => t.client_task_id === "ctask_91",
    );
    assert.ok(taskBefore, "running TaskContext required");
    assert.notEqual(taskBefore!.status, "completed");

    const idem = "idem_91";
    const dc = makeDc({ context_id: "ctx_91", version: 1, content_hash: "hash_91" });
    const probe = {
      session_id: sid,
      idempotency_key: idem,
      generation_type: "call_b_dir" as const,
      generation_id: "job_91",
      client_task_id: "ctask_91",
      generation_base_revision: baseRev,
      fingerprint: "fp91",
      fingerprint_version: fpv,
      job_id: "job_91",
      sync_task_id: null as string | null,
    };

    let stage1Writes = 0;
    let threw = false;
    let thrownMsg = "";
    try {
      await commitGenerationGuarded(
        {
          probe,
          dc_mutation: {
            decision_context: dc,
            result_marker: "marker_91",
            context_hash: "hash_91",
          },
        },
        {
          // Real Path A CAS path with staged Registry write then fail before Binding.
          casWrite: async (input) => {
            const stage1Candidate = {
              ...input.candidate,
              generation_operation_bindings: (
                input.candidate.generation_operation_bindings ?? []
              ).filter((b) => b.idempotency_key !== idem),
              decision_context_idempotency_keys: (
                input.candidate.decision_context_idempotency_keys ?? []
              ).filter((k) => k !== idem),
            };
            // Prove stage1 still carries formal DC + completed Registry.
            assert.equal(
              stage1Candidate.decision_context?.context_id,
              "ctx_91",
            );
            assert.ok(
              (stage1Candidate.generation_registry ?? []).some(
                (e) =>
                  e.generation_id === "job_91" &&
                  e.status === "completed" &&
                  e.client_task_id === "ctask_91",
              ),
              "stage1 must include completed Registry",
            );
            assert.equal(
              (stage1Candidate.generation_operation_bindings ?? []).some(
                (b) => b.idempotency_key === idem,
              ),
              false,
              "stage1 must not include Binding yet",
            );
            return casWritePOJUSession({
              ...input,
              testStagedPreBinding: {
                candidate: stage1Candidate,
                afterWrite: async () => {
                  stage1Writes += 1;
                  throw new Error(
                    "simulated-path-a-after-registry-before-binding",
                  );
                },
              },
            });
          },
        },
      );
    } catch (err) {
      threw = true;
      thrownMsg = err instanceof Error ? err.message : String(err);
    }

    assert.equal(threw, true, "Path A mid-txn fail must throw");
    assert.match(thrownMsg, /simulated-path-a-after-registry-before-binding/);
    assert.ok(stage1Writes >= 1, "stage1 Registry write must have executed inside txn");

    // Re-read IndexedDB — Dexie abort; no manual restore.
    const afterFail = await loadPOJUSession(sid);
    const rowAfterFail = await db.pojuSessionRecords.get(sid);
    assert.equal(afterFail!.session_revision, sRevBefore);
    assert.equal(afterFail!.dc_write_revision, dRevBefore);
    assert.equal(rowAfterFail!.encrypted_data, cipherBefore);
    assert.equal(
      afterFail!.decision_context?.context_id ?? null,
      dcBefore?.context_id ?? null,
    );
    assert.equal(JSON.stringify(afterFail!.generation_registry ?? []), regBefore);
    assert.equal(
      JSON.stringify(afterFail!.generation_operation_bindings ?? []),
      bindBefore,
    );
    assert.equal(
      JSON.stringify(afterFail!.generation_task_contexts ?? []),
      tasksBefore,
    );
    assert.deepEqual(
      [...(afterFail!.decision_context_idempotency_keys ?? [])].sort(),
      keysBefore,
    );
    assert.equal(
      (afterFail!.generation_registry ?? []).some(
        (e) => e.generation_id === "job_91" && e.status === "completed",
      ),
      false,
    );
    assert.equal(
      (afterFail!.generation_operation_bindings ?? []).some(
        (b) => b.idempotency_key === idem,
      ),
      false,
    );
    const taskAfterFail = (afterFail!.generation_task_contexts ?? []).find(
      (t) => t.client_task_id === "ctask_91",
    );
    assert.ok(taskAfterFail);
    assert.notEqual(taskAfterFail!.status, "completed");
    assert.equal((afterFail!.decision_context_idempotency_keys ?? []).includes(idem), false);

    // Same stable identity retry without inject — Path A commits fully.
    const retry = await commitGenerationGuarded({
      probe,
      dc_mutation: {
        decision_context: dc,
        result_marker: "marker_91",
        context_hash: "hash_91",
      },
    });
    assert.equal(retry.path, "A");
    if (retry.path !== "A") throw new Error("expected Path A");
    assert.equal(retry.outcome, "committed");

    const afterOk = await loadPOJUSession(sid);
    assert.equal(afterOk!.dc_write_revision, (dRevBefore ?? 0) + 1);
    assert.ok((afterOk!.session_revision ?? 0) > (sRevBefore ?? 0));
    assert.equal(afterOk!.decision_context?.context_id, "ctx_91");
    assert.ok(
      (afterOk!.generation_registry ?? []).some(
        (e) => e.generation_id === "job_91" && e.status === "completed",
      ),
    );
    assert.ok(
      (afterOk!.generation_operation_bindings ?? []).some(
        (b) => b.idempotency_key === idem,
      ),
    );
    assert.ok((afterOk!.decision_context_idempotency_keys ?? []).includes(idem));
    const taskOk = (afterOk!.generation_task_contexts ?? []).find(
      (t) => t.client_task_id === "ctask_91",
    );
    assert.equal(taskOk?.status, "completed");
    void pending;
  });

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log("P3-91 rewritten");
