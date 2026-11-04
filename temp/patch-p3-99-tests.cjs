const fs = require("fs");
const p = "scripts/test-decision-context-phase3-e2e.ts";
let s = fs.readFileSync(p, "utf8");

// Ensure imports include new symbols
if (!s.includes("assertFormalGenerationResultReadable")) {
  s = s.replace(
    `  const {
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
    restoreTaskContextOnReload,
    commitGenerationGuarded,
    transitionGenerationTaskContext,
    GenerationError,
  } = await import("../lib/poju/generation");`,
    `  const {
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
    restoreTaskContextOnReload,
    restoreGenerationOnJobReload,
    commitGenerationGuarded,
    transitionGenerationTaskContext,
    GenerationError,
    assertFormalGenerationResultReadable,
    assertSessionGenerationConsistency,
    isGenerationStateInconsistentError,
    GENERATION_STATE_INCONSISTENT,
  } = await import("../lib/poju/generation");`,
  );
}

const start99 = s.indexOf('await p3("P3-99"');
const start100 = s.indexOf('await p3("P3-100"');
const start105 = s.indexOf('await p3("P3-105"');
if (start99 < 0 || start100 < 0 || start105 < 0) {
  console.error("bounds", start99, start100, start105);
  process.exit(1);
}

const block = `await p3("P3-99", "TaskContext completed but Registry missing → inconsistency hard fail", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_99", original_question: "99" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp99",
      fingerprint_version: fpv,
      client_task_id: "ctask_99",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_99",
      job_id: "job_99",
    });
    await mutatePOJUSession(sid, {
      operation_id: "op_99_bad",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const tasks = [...(latest.generation_task_contexts ?? [])];
        const idx = tasks.findIndex((t) => t.client_task_id === "ctask_99");
        assert.ok(idx >= 0);
        tasks[idx] = { ...tasks[idx], status: "completed" };
        return {
          ...latest,
          generation_task_contexts: tasks,
          generation_registry: [],
        };
      },
    });
    const after = await loadPOJUSession(sid);
    assert.equal(
      after!.generation_task_contexts!.find((t) => t.client_task_id === "ctask_99")!.status,
      "completed",
    );
    assert.equal((after!.generation_registry ?? []).length, 0);

    // Runtime hard-fail at restore / job reload / formal read / commit boundaries.
    let restoreThrew = false;
    try {
      restoreTaskContextOnReload(after!, "ctask_99");
    } catch (err) {
      restoreThrew = true;
      assert.ok(isGenerationStateInconsistentError(err));
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      assert.equal((err as any).diagnosis.case, "A_TASK_COMPLETED_REGISTRY_MISSING_OR_INCOMPLETE");
    }
    assert.equal(restoreThrew, true);

    let jobReloadThrew = false;
    try {
      restoreGenerationOnJobReload(after!, "ctask_99");
    } catch (err) {
      jobReloadThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(jobReloadThrew, true);

    let readThrew = false;
    try {
      assertFormalGenerationResultReadable(after!, "ctask_99", {
        generation_type: "call_a_hypothesis",
        generation_id: "job_99",
      });
    } catch (err) {
      readThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(readThrew, true);

    let commitThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_99",
          generation_type: "call_a_hypothesis",
          generation_id: "job_99",
          client_task_id: "ctask_99",
          generation_base_revision: after!.dc_write_revision ?? 0,
          fingerprint: "fp99",
          fingerprint_version: fpv,
          job_id: "job_99",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({ context_id: "ctx_99", version: 1 }),
          result_marker: "m99",
        },
      });
    } catch (err) {
      commitThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      // Must not auto-fix or delete records.
      const still = await loadPOJUSession(sid);
      assert.equal(
        still!.generation_task_contexts!.find((t) => t.client_task_id === "ctask_99")!.status,
        "completed",
      );
      assert.equal((still!.generation_registry ?? []).length, 0);
    }
    assert.equal(commitThrew, true);
  });

  await p3("P3-100", "Registry completed but TaskContext still running → inconsistency", async () => {
    const sid = await createPOJUSession({ payment_id: "pay_s5_100", original_question: "100" });
    await createPendingGenerationTaskContext({
      session_id: sid,
      generation_type: "call_b_dir",
      fingerprint: "fp100",
      fingerprint_version: fpv,
      client_task_id: "ctask_100",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid,
      client_task_id: "ctask_100",
      job_id: "job_100",
    });
    await commitGenerationGuarded({
      probe: {
        session_id: sid,
        idempotency_key: "idem_100",
        generation_type: "call_b_dir",
        generation_id: "job_100",
        client_task_id: "ctask_100",
        generation_base_revision: 0,
        fingerprint: "fp100",
        fingerprint_version: fpv,
        job_id: "job_100",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: makeDc({ context_id: "ctx_100", version: 1, content_hash: "h100" }),
        result_marker: "m",
        context_hash: "h100",
      },
    });
    // Force TaskContext back to running while registry completed (corruption)
    await mutatePOJUSession(sid, {
      operation_id: "op_100_corrupt",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const tasks = [...(latest.generation_task_contexts ?? [])];
        const idx = tasks.findIndex((t) => t.client_task_id === "ctask_100");
        tasks[idx] = { ...tasks[idx], status: "running" };
        return { ...latest, generation_task_contexts: tasks };
      },
    });
    const after = await loadPOJUSession(sid);
    const regDone = after!.generation_registry!.some((r) => r.status === "completed");
    const taskRunning = after!.generation_task_contexts!.some(
      (t) => t.client_task_id === "ctask_100" && t.status === "running",
    );
    assert.equal(regDone && taskRunning, true);

    let restoreThrew = false;
    try {
      restoreTaskContextOnReload(after!, "ctask_100");
    } catch (err) {
      restoreThrew = true;
      assert.ok(isGenerationStateInconsistentError(err));
      assert.equal((err as any).diagnosis.case, "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED");
    }
    assert.equal(restoreThrew, true);

    // Path B idempotent replay must hard-fail (not treat as normal completion).
    let pathBThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_100",
          generation_type: "call_b_dir",
          generation_id: "job_100",
          client_task_id: "ctask_100",
          generation_base_revision: 0,
          fingerprint: "fp100",
          fingerprint_version: fpv,
          job_id: "job_100",
          sync_task_id: null,
        },
        dc_mutation: {
          decision_context: makeDc({ context_id: "ctx_100b", version: 2 }),
          result_marker: "m2",
        },
      });
    } catch (err) {
      pathBThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
      const still = await loadPOJUSession(sid);
      assert.ok(still!.generation_registry!.some((r) => r.status === "completed"));
      assert.ok(
        still!.generation_task_contexts!.some(
          (t) => t.client_task_id === "ctask_100" && t.status === "running",
        ),
      );
    }
    assert.equal(pathBThrew, true);

    // Path C new key register must also hard-fail.
    let pathCThrew = false;
    try {
      await commitGenerationGuarded({
        probe: {
          session_id: sid,
          idempotency_key: "idem_100_new",
          generation_type: "call_b_dir",
          generation_id: "job_100",
          client_task_id: "ctask_100",
          generation_base_revision: 0,
          fingerprint: "fp100",
          fingerprint_version: fpv,
          job_id: "job_100",
          sync_task_id: null,
        },
      });
    } catch (err) {
      pathCThrew = true;
      assert.equal((err as any).code, GENERATION_STATE_INCONSISTENT);
    }
    assert.equal(pathCThrew, true);

    assert.throws(
      () =>
        assertSessionGenerationConsistency(after!, "ctask_100", "formal_result_read", {
          generation_type: "call_b_dir",
          generation_id: "job_100",
        }),
      (e: unknown) =>
        isGenerationStateInconsistentError(e) &&
        e.diagnosis.case === "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED",
    );
  });

  `;

s = s.slice(0, start99) + block + s.slice(start105);
fs.writeFileSync(p, s);
console.log("P3-99/100 tests rewritten");
