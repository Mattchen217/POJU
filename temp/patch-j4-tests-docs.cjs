const fs = require("fs");

function insertBefore(src, marker, insert, label) {
  const i = src.lastIndexOf(marker);
  if (i < 0) throw new Error("marker missing: " + label);
  return src.slice(0, i) + insert + src.slice(i);
}

// --- job idempotency tests ---
{
  const p = "scripts/test-decision-context-phase3-job-idempotency.ts";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("P3-144")) {
    console.log("tests already present");
  } else {
    // ensure imports include getXhighJob, findLatest, jobMatchesIdentity
    if (!s.includes("getXhighJob,")) {
      s = s.replace(
        `    createXhighJob,
    getXhighJobByClientTaskId,
    runWithEphemeralXhighKv,
  } = await import("../lib/poju/xhigh-job-store");`,
        `    createXhighJob,
    getXhighJobByClientTaskId,
    getXhighJob,
    findLatestXhighJobForSession,
    jobMatchesIdentity,
    runWithEphemeralXhighKv,
  } = await import("../lib/poju/xhigh-job-store");`,
      );
    }

    const tests = `
  await p3("P3-144", "J4 POJU Generation must not recover Lab/legacy job lacking generation_type", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_144", original_question: "144" });
      // Lab-style create: same phase+session, no client_task_id / generation_type.
      const lab = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        job_input: seg2Input(sid, "lab-144"),
      });
      assert.equal(lab.generation_type, undefined);
      assert.equal(lab.client_task_id, undefined);

      const latest = await findLatestXhighJobForSession("segment2_breakthrough_core", sid);
      assert.ok(latest);
      assert.equal(latest!.job_id, lab.job_id);

      // Generation recovery with client_task + generation_type must not accept Lab latest.
      const found = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: "ctask_gen_144",
        generation_type: "call_a_hypothesis",
        consult_latest_candidate: true,
      });
      assert.equal(found.status, "missing");

      assert.equal(
        jobMatchesIdentity(lab, {
          phase: "segment2_breakthrough_core",
          session_id: sid,
          client_task_id: "ctask_gen_144",
          generation_type: "call_a_hypothesis",
        }),
        false,
      );

      // POJU create with Phase 3 fields still succeeds as a distinct identity.
      const poju = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: "ctask_gen_144",
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "poju-144"),
      });
      assert.notEqual(poju.job_id, lab.job_id);
      assert.equal(poju.generation_type, "call_a_hypothesis");
      assert.equal(poju.client_task_id, "ctask_gen_144");
    });
  });

  await p3("P3-145", "J4 cross-phase recovery missing; getByClientTaskId scoped to phase", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_145", original_question: "145" });
      const ctid = "ctask_cross_phase_145";
      const core = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "145-core"),
      });
      const wrongPhase = await getXhighJobByClientTaskId({
        phase: "synthesis",
        session_id: sid,
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
      });
      assert.equal(wrongPhase.status, "missing");
      const right = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
      });
      assert.equal(right.status, "found");
      if (right.status === "found") assert.equal(right.job.job_id, core.job_id);
    });
  });

  await p3("P3-146", "J4 Lab/FD/Synthesis without Phase3 fields keep create+latest semantics", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_146", original_question: "146" });
      const labCore = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        job_input: seg2Input(sid, "lab-146"),
      });
      const syn = await createXhighJob({
        phase: "synthesis",
        session_id: sid,
        locale: "en",
        job_input: {
          kind: "synthesis",
          multi_dimension_reckoning: [],
          desired_outcome: "x",
          original_question: "146",
          question_category: "unknown",
          covered_agenda: [],
          structured_inventory: "",
        },
      });
      const fd = await createXhighJob({
        phase: "final_delivery",
        session_id: sid,
        locale: "en",
        job_input: {
          kind: "final_delivery",
          session_id: sid,
          locale: "en",
          agent_v2: {} as any,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
        },
      });
      assert.equal(labCore.client_task_id, undefined);
      assert.equal(syn.client_task_id, undefined);
      assert.equal(fd.client_task_id, undefined);
      assert.equal((await getXhighJob(labCore.job_id))!.job_id, labCore.job_id);
      assert.equal(
        (await findLatestXhighJobForSession("segment2_breakthrough_core", sid))!.job_id,
        labCore.job_id,
      );
      assert.equal((await findLatestXhighJobForSession("synthesis", sid))!.job_id, syn.job_id);
      assert.equal((await findLatestXhighJobForSession("final_delivery", sid))!.job_id, fd.job_id);
      // Cross-business latest isolation
      assert.notEqual(
        (await findLatestXhighJobForSession("synthesis", sid))!.job_id,
        labCore.job_id,
      );
    });
  });

  await p3("P3-147", "J4 same client_task_id across businesses: recovery never cross-binds", async () => {
    await runWithEphemeralXhighKv(async () => {
      const sid = await createPOJUSession({ payment_id: "pay_job_147", original_question: "147" });
      const ctid = "ctask_biz_147";
      const poju = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
        job_input: seg2Input(sid, "147-poju"),
      });
      const syn = await createXhighJob({
        phase: "synthesis",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        job_input: {
          kind: "synthesis",
          multi_dimension_reckoning: [],
          desired_outcome: "x",
          original_question: "147",
          question_category: "unknown",
          covered_agenda: [],
          structured_inventory: "",
        },
      });
      const fd = await createXhighJob({
        phase: "final_delivery",
        session_id: sid,
        locale: "en",
        client_task_id: ctid,
        job_input: {
          kind: "final_delivery",
          session_id: sid,
          locale: "en",
          agent_v2: {} as any,
          breakthrough_core: null,
          covered_agenda: [],
          base_analysis: {},
          delivery_mode: "full",
        },
      });
      assert.notEqual(poju.job_id, syn.job_id);
      assert.notEqual(poju.job_id, fd.job_id);
      const asPoju = await getXhighJobByClientTaskId({
        phase: "segment2_breakthrough_core",
        session_id: sid,
        client_task_id: ctid,
        generation_type: "call_a_hypothesis",
      });
      const asSyn = await getXhighJobByClientTaskId({
        phase: "synthesis",
        session_id: sid,
        client_task_id: ctid,
      });
      const asFd = await getXhighJobByClientTaskId({
        phase: "final_delivery",
        session_id: sid,
        client_task_id: ctid,
      });
      assert.equal(asPoju.status, "found");
      assert.equal(asSyn.status, "found");
      assert.equal(asFd.status, "found");
      if (asPoju.status === "found") assert.equal(asPoju.job.job_id, poju.job_id);
      if (asSyn.status === "found") assert.equal(asSyn.job.job_id, syn.job_id);
      if (asFd.status === "found") assert.equal(asFd.job.job_id, fd.job_id);
      // POJU generation_type probe must not match synthesis job even with shared ctid via wrong phase already covered;
      // also: synthesis job lacks generation_type — strict match rejects if probed as call_a on synthesis phase.
      assert.equal(
        jobMatchesIdentity(syn, {
          phase: "synthesis",
          session_id: sid,
          client_task_id: ctid,
          generation_type: "call_a_hypothesis",
        }),
        false,
      );
    });
  });

`;
    s = insertBefore(s, "\n  summarize();\n}", tests);
    // Also handle CRLF summarize
    if (!s.includes("P3-144")) {
      s = insertBefore(s, "\r\n  summarize();\r\n}", tests.replace(/\n/g, "\r\n"));
    }
    fs.writeFileSync(p, s);
    console.log("added J4 tests");
  }
}

// --- inventory doc ---
{
  const doc = `# PHASE3-J4-JOB-STORE-ISOLATION

> Phase 3 Remediation ITEM 9 / Max §9 — shared Job Store business isolation.
> HEAD at rem commit. Authority: Final Engineering Contract §6 / Mapping §2.4. No Contract invention.

## Acceptance

Shared storage ≠ shared business identity. Strict isolation across businesses, sessions, phases, and generation_type.

## Inventory — callers of \`lib/poju/xhigh-job-store\`

| Caller | Phase(s) | Uses \`client_task_id\`? | Uses \`generation_type\`? | Notes |
|--------|----------|-------------------------|--------------------------|-------|
| \`app/api/poju/breakthrough-core/route.ts\` | \`segment2_breakthrough_core\` | optional (Generation path) | optional (\`call_a_hypothesis\`) | Resume now phase-guarded (J4) |
| \`app/api/poju/breakthrough-core/agenda/route.ts\` | \`segment2_agenda_bridge\` | optional | optional (\`call_b_dir\`) | Resume phase-guarded |
| \`app/api/poju/breakthrough-core/status/route.ts\` | (by job_id) | — | — | Status/fail/complete |
| \`app/api/poju/synthesis/route.ts\` + status | \`synthesis\` | optional | no | Resume phase-guarded |
| \`app/api/poju/final-delivery/*\` + Inngest + runners | \`final_delivery\` | optional | no | Already checked \`job.phase === final_delivery\` |
| \`lib/llm/pro/delivery/lab/pipeline-jobs.ts\` | segment2_a/b + synthesis | **no** | **no** | Lab-style create; latest/lock per phase+session |
| \`lib/poju/generation/*\` | via create + bind | **yes** | **yes** | Registry/TaskContext identity; does not create Lab jobs |
| Tests (phase3 job/e2e/s2, block91, …) | mixed | mixed | mixed | |

Re-export: \`lib/poju/shared/xhigh-job/index.ts\`.

## Identity rules

KV keys already partition by **phase + session_id**:

- job: \`poju-xhigh:job:{job_id}\` (job_id prefix encodes phase: s2a/s2b/syn/fd)
- latest: \`poju-xhigh:latest:{phase}:{session_id}\`
- client_task index: \`poju-xhigh:client_task:{phase}:{session_id}:{client_task_id}\`
- lock: \`poju-xhigh:lock:{phase}:{session_id}\`

\`getXhighJobByClientTaskId\` / create NX recovery use \`jobMatchesIdentity\`:

1. \`job.phase === input.phase\`
2. \`job.session_id === input.session_id\`
3. \`job.client_task_id === input.client_task_id\`
4. **J4:** if caller supplies \`generation_type\`, require \`job.generation_type === input.generation_type\` (Lab/legacy jobs missing the field do **not** match)

## Semantics preserved

- Lab / Synthesis / Final Delivery creates without Phase 3 fields still work (create, get by job_id, findLatest, locks).
- Phase 3 \`client_task_id\` + recovery is additive; absent fields keep pre-ITEM6 behavior.
- POJU Generation cannot recover into a Lab job: Lab omits \`client_task_id\`/\`generation_type\`; latest-candidate consult still requires identity match.

## Tests

P3-133–135 (ITEM6 / J4-lite), P3-144–147 (J4 rem).

## Gaps (honest)

- \`getXhighJob(job_id)\` itself is unscoped; callers must check phase (resume routes now do for Call A/B/synthesis; FD already did).
- Lab shares phase namespace with product segment2/synthesis when using the same \`session_id\` — isolation is via optional Generation fields + latest identity verify, not a separate Lab KV namespace (no Contract text for a fifth phase).
`;
  fs.writeFileSync("docs/phase3/PHASE3-J4-JOB-STORE-ISOLATION.md", doc);
  console.log("wrote J4 inventory doc");
}

// --- S0 / S1 / S5 docs ---
function replaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error("doc miss " + label);
  if (src.indexOf(from, i + 1) >= 0) throw new Error("doc dup " + label);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "docs/phase3/PHASE3-S0-GENERATION-JOB-INVENTORY.md";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("| J4 | Lab/synthesis/final_delivery share store |")) {
    s = replaceOnce(
      s,
      `| J4 | Lab/synthesis/final_delivery share store | Same recovery gap; Phase3 Stage1–3 scope is Call A/B but store is shared — flag for implementers |`,
      `| J4 | Lab/synthesis/final_delivery share store | **CLOSED (rem)**: phase+session keys + strict \`generation_type\` match when supplied; resume phase guards; Lab omits Phase3 fields (semantics preserved). See \`PHASE3-J4-JOB-STORE-ISOLATION.md\`. Tests P3-144–147. |`,
      "S0 J4",
    );
    fs.writeFileSync(p, s);
    console.log("patched S0 J4");
  }
}

{
  const p = "docs/phase3/PHASE3-S1-WRITE-PATH-AUDIT.md";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("**J4 / Generation**")) {
    s = replaceOnce(
      s,
      `3. **J4 / Generation** — out of S1 scope (S2).`,
      `3. **J4 / Generation** — **closed (rem)**: shared store isolation documented + enforced (see PHASE3-J4-JOB-STORE-ISOLATION.md).`,
      "S1 J4",
    );
    fs.writeFileSync(p, s);
    console.log("patched S1 J4");
  }
}

{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("P3-144")) {
    const anchor = "| P3-135 |";
    const i = s.indexOf(anchor);
    if (i < 0) throw new Error("P3-135 missing");
    const lineEnd = s.indexOf("\n", i);
    const insert = `
| P3-144 | J4 POJU Gen must not recover Lab/legacy job | J4 rem / §6 | test-decision-context-phase3-job-idempotency.ts | generation_type strict; latest not enough |
| P3-145 | J4 cross-phase getByClientTaskId missing | J4 rem | test-decision-context-phase3-job-idempotency.ts | phase-scoped recovery |
| P3-146 | J4 Lab/FD/Syn without Phase3 fields OK | J4 rem | test-decision-context-phase3-job-idempotency.ts | create+latest semantics preserved |
| P3-147 | J4 same client_task across businesses no cross-bind | J4 rem | test-decision-context-phase3-job-idempotency.ts | recovery returns own job_id only |`;
    s = s.slice(0, lineEnd) + insert + s.slice(lineEnd);
    // Also mark P3-135 as full J4
    s = s.replace(
      "| P3-135 | Synthesis/FD/POJU shared store no identity collide | §18.4 / ITEM6 / J4-lite |",
      "| P3-135 | Synthesis/FD/POJU shared store no identity collide | §18.4 / ITEM6 / J4 |",
    );
    fs.writeFileSync(p, s);
    console.log("patched S5 index");
  }
}

console.log("j4 tests+docs done");
