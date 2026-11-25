/**
 * Batch3 Unified Production Consistency — MemoryKv lifecycle E2E.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-unified.ts
 *
 * MemoryKv behavioral proof only. Does not claim Redis or deploy verification.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  REPORT_BATCH2_EVENTS,
  createJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { claimPageExecution } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/claim-page-execution";
import {
  buildFrozenCascadeTargets,
  planCascadePageIds,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3/cascade-operation";
import {
  activateGeneration,
  allocateGeneration,
  claimFinalization,
  commitPageResult,
  computeTaskKey,
  continueCascadeOperation,
  enqueueDispatchIntent,
  ensurePageFence,
  invalidateFromPage,
  invalidatePageAuthority,
  markFinalizationDelivered,
  markFinalizationDelivering,
  markIntentSent,
  readActiveCascadeOperation,
  readActiveGeneration,
  readAuthorityPageOutput,
  readFinalizationClaim,
  readGeneration,
  readPageFence,
  readPageProvenance,
  readTask,
  reopenStaleFenceIfReady,
  resetBatch3KeysForTests,
  saveCascadeOperation,
  type FinalizationPageBinding,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { reportPageDefinition } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import {
  hashCanonicalPayload,
  REPORT_PAGE_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import type { PageProvenance } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3_unified",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Should I take a solo promotion and keep my runway?",
      concrete_event: "x",
      desired_outcome: "y",
      stakes: "z",
    },
    constraints: [],
    reality_facts: [],
    dirs: [],
    conflicts: [],
    hypotheses: [],
  } as unknown as DecisionContext;
}

function inputs(report_id: string): ReportBatch2JobInputs {
  return {
    report_id,
    dc: baseDc(),
    pack: {
      version: 1,
      locale: "en",
      cfp_hash: "c",
      zfp_hash: null,
      zfpOmitted: true,
      shot_mode: "one",
      created_at: "2026-01-01T00:00:00Z",
      units: [],
      by_face: {},
      pattern_hits_used: [],
      science_tags_used: [],
    } as unknown as BookJudgmentPack,
    chart_fact_pack: "cfp",
    bazi_available: true,
  };
}

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
}

async function boot(report_id: string, generation_id: string) {
  const gen = await allocateGeneration({
    report_id,
    locale: "en",
    generation_id,
  });
  assert.ok(gen.ok);
  if (!gen.ok) throw new Error("allocate");
  await activateGeneration({ record: gen.value, job_id: report_id });
  await createJob({
    report_id,
    generation_id: gen.value.generation_id,
    locale: "en",
    inputs: inputs(report_id),
    generation_epoch: gen.value.generation_epoch,
  });
  return gen.value;
}

async function upstreamFingerprints(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<ReportUpstreamOutputFingerprints> {
  const def = reportPageDefinition(page_id);
  const out: ReportUpstreamOutputFingerprints = {};
  for (const up of def.required_upstream) {
    const auth = await readAuthorityPageOutput(report_id, generation_id, up);
    assert.ok(auth.ok && auth.value?.output_fingerprint, `upstream ${up} for ${page_id}`);
    out[up] = auth.value!.output_fingerprint;
  }
  for (const up of def.optional_upstream ?? []) {
    const prov = await readPageProvenance(report_id, generation_id, page_id);
    if (
      prov.ok &&
      prov.value?.upstream_output_fingerprints?.[up] != null
    ) {
      const auth = await readAuthorityPageOutput(report_id, generation_id, up);
      if (auth.ok && auth.value?.output_fingerprint) {
        out[up] = auth.value.output_fingerprint;
      }
    }
  }
  return out;
}

function pageOutput(page_id: ReportPageId): { out: unknown; outcome: string } {
  if (page_id === "07") {
    const out = { page: "07", gate: "skipped_not_applicable" };
    return { out, outcome: "skipped_not_applicable" };
  }
  const out = { page: page_id, body: `unified-${page_id}` };
  return { out, outcome: "completed" };
}

async function commitViaClaim(opts: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  worker_id?: string;
}): Promise<{
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  input_fingerprint: string;
  upstream: ReportUpstreamOutputFingerprints;
  output_fingerprint: string;
}> {
  const input_fingerprint = `fp_${opts.page_id}`;
  const upstream = await upstreamFingerprints(
    opts.report_id,
    opts.generation_id,
    opts.page_id,
  );
  const fence = await ensurePageFence({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
  });
  assert.ok(fence.ok);
  if (!fence.ok) throw new Error("fence");
  if (fence.value.status === "stale") {
    const reopen = await reopenStaleFenceIfReady({
      report_id: opts.report_id,
      generation_id: opts.generation_id,
      generation_epoch: opts.generation_epoch,
      page_id: opts.page_id,
    });
    assert.ok(reopen.ok, JSON.stringify(reopen));
  }
  const claimed = await claimPageExecution({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    task_type: "generate",
    input_fingerprint,
    upstream_output_fingerprints: upstream,
    worker_id: opts.worker_id ?? `w_${opts.page_id}`,
  });
  assert.ok(claimed.ok, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim");

  const { out, outcome } = pageOutput(opts.page_id);
  const output_fingerprint = hashCanonicalPayload(out);
  const def = reportPageDefinition(opts.page_id);
  const provenance: PageProvenance = {
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    input_fingerprint,
    upstream_output_fingerprints: upstream,
    page_contract_version: def.production_version,
    prompt_version: def.prompt_version,
    validator_version: def.validator_version,
    output_fingerprint,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    validity_rev: claimed.value.validity_rev,
  };
  const committed = await commitPageResult({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    output: out,
    output_fingerprint,
    state_patch: {
      outcome,
      input_fingerprint,
      applicability_status:
        opts.page_id === "07" ? "not_applicable" : undefined,
    },
    provenance,
  });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  return {
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    validity_rev: claimed.value.validity_rev,
    input_fingerprint,
    upstream,
    output_fingerprint,
  };
}

async function tryLateCommit(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  input_fingerprint: string;
  upstream: ReportUpstreamOutputFingerprints;
}): Promise<string> {
  const def = reportPageDefinition(input.page_id);
  const { out } = pageOutput(input.page_id);
  const fp = hashCanonicalPayload(out);
  const r = await commitPageResult({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    output: out,
    output_fingerprint: fp,
    state_patch: { outcome: "completed" },
    provenance: {
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      page_id: input.page_id,
      input_fingerprint: input.input_fingerprint,
      upstream_output_fingerprints: input.upstream,
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      output_fingerprint: fp,
      attempt_id: input.attempt_id,
      task_key: input.task_key,
      validity_rev: input.validity_rev,
    },
  });
  assert.equal(r.ok, false);
  return r.ok ? "ok" : r.code;
}

async function buildBindings(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<FinalizationPageBinding[]> {
  const bindings: FinalizationPageBinding[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const fence = await readPageFence(report_id, generation_id, page_id);
    assert.ok(fence.ok && fence.value?.status === "committed", page_id);
    const auth = await readAuthorityPageOutput(
      report_id,
      generation_id,
      page_id,
    );
    assert.ok(auth.ok && auth.value, page_id);
    const { outcome } = pageOutput(page_id);
    bindings.push({
      page_id,
      generation_id,
      generation_epoch,
      validity_rev: fence.value!.validity_rev,
      attempt_id: fence.value!.attempt_id!,
      task_key: fence.value!.task_key!,
      output_fingerprint: fence.value!.output_fingerprint!,
      input_fingerprint: fence.value!.input_fingerprint!,
      sealed_output: auth.value!.output,
      outcome,
    });
  }
  return bindings;
}

async function main(): Promise<void> {
  console.log("=== Batch3 Unified Production Consistency (MemoryKv) ===");

  // --- Preconditions: computeTaskKey requires validity_rev ---
  {
    const base = {
      report_id: "rpt_taskkey_probe",
      generation_id: "g_probe",
      generation_epoch: 1,
      page_id: "01" as ReportPageId,
      input_fingerprint: "in",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate" as const,
    };
    const k0 = computeTaskKey({ ...base, validity_rev: 0 });
    const k1 = computeTaskKey({ ...base, validity_rev: 1 });
    assert.notEqual(k0, k1, "validity_rev must affect task identity");
    console.log("PRE ok — computeTaskKey binds validity_rev");
  }

  let lifecycle_report_id = "rpt_b3_unified_lifecycle";
  let lifecycle_gen!: Awaited<ReturnType<typeof boot>>;

  // --- A. Full generation lifecycle (MemoryKv) ---
  {
    await cleanup();
    lifecycle_report_id = "rpt_b3_unified_lifecycle";
    lifecycle_gen = await boot(lifecycle_report_id, "gen_lifecycle");

    await ensurePageFence({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
    });

    const first = await commitViaClaim({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
      worker_id: "w_old",
    });

    const inv = await invalidateFromPage({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      source_page_id: "01",
      reason: "unified_lifecycle_invalidate",
    });
    assert.ok(inv.ok, JSON.stringify(inv));
    if (!inv.ok) throw new Error("inv");
    assert.ok(inv.value.invalidated.includes("01"));
    assert.ok(
      inv.value.invalidated.some((p) => p === "04"),
      "cascade must reach dependents",
    );

    const f01 = await readPageFence(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
      "01",
    );
    assert.equal(f01.value?.status, "stale");
    for (const dep of inv.value.invalidated) {
      const f = await readPageFence(
        lifecycle_report_id,
        lifecycle_gen.generation_id,
        dep,
      );
      assert.equal(f.value?.status, "stale", dep);
    }

    const lateBefore = await tryLateCommit({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
      attempt_id: first.attempt_id,
      task_key: first.task_key,
      validity_rev: first.validity_rev,
      input_fingerprint: first.input_fingerprint,
      upstream: first.upstream,
    });
    assert.ok(
      lateBefore === "stale_page" ||
        lateBefore === "stale_attempt" ||
        lateBefore === "conflict",
      `late commit before reopen: ${lateBefore}`,
    );

    const reopen = await reopenStaleFenceIfReady({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
    });
    assert.ok(reopen.ok, JSON.stringify(reopen));
    assert.equal(reopen.value.status, "open");

    const lateAfter = await tryLateCommit({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
      attempt_id: first.attempt_id,
      task_key: first.task_key,
      validity_rev: first.validity_rev,
      input_fingerprint: first.input_fingerprint,
      upstream: first.upstream,
    });
    assert.ok(
      lateAfter === "stale_page" ||
        lateAfter === "stale_attempt" ||
        lateAfter === "conflict",
      `late commit after reopen: ${lateAfter}`,
    );

    await commitViaClaim({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      page_id: "01",
      worker_id: "w_new",
    });

    for (const page_id of REPORT_PAGE_IDS) {
      if (page_id === "01") continue;
      await commitViaClaim({
        report_id: lifecycle_report_id,
        generation_id: lifecycle_gen.generation_id,
        generation_epoch: lifecycle_gen.generation_epoch,
        page_id,
      });
    }

    const bindings = await buildBindings(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
      lifecycle_gen.generation_epoch,
    );
    const claim_id = randomUUID();
    const seal = await claimFinalization({
      report_id: lifecycle_report_id,
      generation_id: lifecycle_gen.generation_id,
      generation_epoch: lifecycle_gen.generation_epoch,
      claim_id,
      pages: bindings,
    });
    assert.ok(seal.ok, JSON.stringify(seal));

    const claim = await readFinalizationClaim(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
    );
    assert.ok(claim.ok && claim.value?.status === "sealed");

    const genAfterSeal = await readGeneration(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
    );
    assert.equal(genAfterSeal.value?.status, "finalizing");

    const delivering = await markFinalizationDelivering(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
    );
    assert.ok(delivering.ok);
    assert.equal(delivering.value.status, "delivering");

    const delivered = await markFinalizationDelivered(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
      lifecycle_gen.generation_epoch,
    );
    assert.ok(delivered.ok);
    assert.equal(delivered.value.status, "delivered");

    const genDone = await readGeneration(
      lifecycle_report_id,
      lifecycle_gen.generation_id,
    );
    assert.equal(genDone.value?.status, "completed");

    console.log("A ok — full generation lifecycle including seal and delivery");
  }

  // --- B. Shared Finalization lock (Activation + Invalidation) ---
  {
    await cleanup();
    const report_id = "rpt_b3_unified_lock";
    const gen = await boot(report_id, "gen_lock");
    for (const page_id of REPORT_PAGE_IDS) {
      await commitViaClaim({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
      });
    }
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.ok(
      (
        await claimFinalization({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          claim_id: randomUUID(),
          pages: bindings,
        })
      ).ok,
    );

    const invLocked = await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "unified_post_seal",
    });
    assert.equal(invLocked.ok ? "" : invLocked.code, "finalization_locked");

    const genNext = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "gen_lock_next",
    });
    assert.ok(genNext.ok);
    if (!genNext.ok) throw new Error("genNext");
    const blocked = await activateGeneration({
      record: genNext.value,
      job_id: report_id,
    });
    assert.equal(blocked.ok, false);
    assert.ok(
      !blocked.ok &&
        (blocked.code === "finalization_locked" || blocked.code === "conflict"),
      JSON.stringify(blocked),
    );

    await markFinalizationDelivering(report_id, gen.generation_id);
    await markFinalizationDelivered(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );

    const allowed = await activateGeneration({
      record: genNext.value,
      job_id: report_id,
    });
    assert.ok(allowed.ok, JSON.stringify(allowed));
    const active = await readActiveGeneration(report_id);
    assert.equal(
      active.value?.generation_id,
      genNext.value.generation_id,
      "after delivered, next activation allowed",
    );

    console.log("B ok — shared lock: sealed blocks inv+activate; delivered unlocks");
  }

  // --- C. Outbox: sent ≠ page completed ---
  {
    await cleanup();
    const report_id = "rpt_b3_unified_outbox";
    const gen = await boot(report_id, "gen_outbox");
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });

    const intent = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "02",
      task_key: "pending_task",
      payload: {
        report_id,
        generation_id: gen.generation_id,
        page_id: "02",
        generation_epoch: gen.generation_epoch,
      },
    });
    assert.ok(intent.ok);
    if (!intent.ok) throw new Error("intent");
    assert.equal(intent.value.status, "pending");

    const sent = await markIntentSent(intent.value);
    assert.ok(sent.ok);
    assert.equal(sent.value.status, "sent");

    const fence = await readPageFence(
      report_id,
      gen.generation_id,
      "02",
    );
    assert.equal(fence.value?.status, "open", "sent intent must not commit page");
    const def = reportPageDefinition("02");
    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      validity_rev: fence.value!.validity_rev,
      input_fingerprint: "fp_02",
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      task_type: "generate",
    });
    const task = await readTask(
      report_id,
      gen.generation_id,
      task_key,
    );
    assert.ok(task.value == null || task.value.status !== "completed");

    console.log("C ok — outbox sent does not imply page completed");
  }

  // --- D. Cascade: idempotent continue + finalization blocked ---
  {
    await cleanup();
    const report_id = "rpt_b3_unified_cascade";
    const gen = await boot(report_id, "gen_cascade");
    await commitViaClaim({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    await commitViaClaim({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });

    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "unified_cascade",
    });
    assert.ok(inv.ok);
    if (!inv.ok) throw new Error("inv");
    const op_id = inv.value.operation_id;

    const again = await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: op_id,
    });
    assert.ok(again.ok);
    assert.equal(again.value.cascade_status, inv.value.cascade_status);
    assert.deepEqual(
      [...again.value.invalidated].sort(),
      [...inv.value.invalidated].sort(),
    );

    const activeCascade = await readActiveCascadeOperation(
      report_id,
      gen.generation_id,
    );
    assert.ok(
      activeCascade.value == null ||
        activeCascade.value.status === "completed",
    );

    console.log("D.1 ok — cascade continue idempotent after invalidate");

    // Separate report: all pages committed, synthetic cascade blocks seal.
    await cleanup();
    const block_report = "rpt_b3_unified_cascade_block";
    const block_gen = await boot(block_report, "gen_cascade_block");
    for (const page_id of REPORT_PAGE_IDS) {
      await commitViaClaim({
        report_id: block_report,
        generation_id: block_gen.generation_id,
        generation_epoch: block_gen.generation_epoch,
        page_id,
      });
    }
    const bindings = await buildBindings(
      block_report,
      block_gen.generation_id,
      block_gen.generation_epoch,
    );
    const planned = await planCascadePageIds({
      report_id: block_report,
      generation_id: block_gen.generation_id,
      source_page_id: "01",
      shouldIncludeOptional: async () => ({ ok: true, value: false }),
    });
    assert.ok(planned.ok);
    if (!planned.ok) throw new Error("plan");
    const frozen = await buildFrozenCascadeTargets({
      report_id: block_report,
      generation_id: block_gen.generation_id,
      page_ids: planned.value.slice(0, 2),
    });
    assert.ok(frozen.ok);
    if (!frozen.ok) throw new Error("frozen");
    const now = new Date().toISOString();
    const operation_id = randomUUID();
    const blocking = {
      operation_id,
      report_id: block_report,
      generation_id: block_gen.generation_id,
      generation_epoch: block_gen.generation_epoch,
      source_page_id: "01" as ReportPageId,
      reason: "synthetic_running",
      targets: frozen.value.map((t) => ({ ...t, done: false })),
      status: "running" as const,
      created_at: now,
      updated_at: now,
    };
    const saved = await saveCascadeOperation(blocking, null);
    assert.ok(saved.ok);

    const refused = await claimFinalization({
      report_id: block_report,
      generation_id: block_gen.generation_id,
      generation_epoch: block_gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(refused.ok ? "" : refused.code, "cascade_incomplete");

    // failed_recoverable also blocks
    const failedOp = {
      ...blocking,
      operation_id: randomUUID(),
      status: "failed_recoverable" as const,
      failure_detail: "simulated",
    };
    assert.ok((await saveCascadeOperation(failedOp, null)).ok);
    const refused2 = await claimFinalization({
      report_id: block_report,
      generation_id: block_gen.generation_id,
      generation_epoch: block_gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(refused2.ok ? "" : refused2.code, "cascade_incomplete");

    console.log("D ok — cascade idempotent continue; finalization blocked while cascade active");
  }

  console.log("MEMORY_KV: PASS");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exitCode = 1;
  });