/**
 * Batch3 Concurrency Repair — MemoryKv race / reclaim / cascade proofs.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-concurrency-repair.ts
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
  casSet,
  claimFinalization,
  claimTask,
  commitPageResult,
  computeTaskKey,
  enqueueDispatchIntent,
  ensurePageFence,
  ensureQueuedTask,
  invalidatePageAuthority,
  invalidatePageAuthorityForCascade,
  markFinalizationDelivered,
  markFinalizationDelivering,
  markFinalizationDeliveryFailed,
  markIntentSent,
  readFinalizationClaim,
  readGeneration,
  readIntent,
  readPageFence,
  readTask,
  reopenStaleFenceIfReady,
  resetBatch3KeysForTests,
  saveCascadeOperation,
  setBeforeClaimAtomicHookForTests,
  setBeforeInvalidateAtomicHookForTests,
  type FinalizationPageBinding,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { setBatch3NowMsForTests } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/clock";
import {
  hashCanonicalPayload,
  reportPageDefinition,
  REPORT_PAGE_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import type { TaskRecord } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/types";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3_conc_repair",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Batch3 concurrency repair probe",
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

function taskKvPath(
  report_id: string,
  generation_id: string,
  task_key: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:task:${task_key}`;
}

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
  setBeforeClaimAtomicHookForTests(null);
  setBeforeInvalidateAtomicHookForTests(null);
  setBatch3NowMsForTests(null);
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

async function buildBindings(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<FinalizationPageBinding[]> {
  const bindings: FinalizationPageBinding[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const fence = await readPageFence(report_id, generation_id, page_id);
    assert.ok(fence.ok && fence.value?.status === "committed", page_id);
    const def = reportPageDefinition(page_id);
    const input_fingerprint = `fp_${page_id}`;
    const upstream: ReportUpstreamOutputFingerprints = {};
    const out =
      page_id === "07"
        ? { page: "07", gate: "skipped_not_applicable" }
        : { page: page_id, n: 1 };
    const fp = hashCanonicalPayload(out);
    const outcome =
      page_id === "07" ? "skipped_not_applicable" : "completed";
    bindings.push({
      page_id,
      generation_id,
      generation_epoch,
      validity_rev: fence.value!.validity_rev,
      attempt_id: fence.value!.attempt_id!,
      task_key: fence.value!.task_key!,
      output_fingerprint: fence.value!.output_fingerprint!,
      input_fingerprint: fence.value!.input_fingerprint ?? input_fingerprint,
      sealed_output: out,
      outcome,
    });
    void def;
    void upstream;
    void fp;
  }
  return bindings;
}

async function commitPage01(ctx: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  worker_id?: string;
  input_fingerprint?: string;
}): Promise<{
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  input_fingerprint: string;
}> {
  const page_id: ReportPageId = "01";
  const input_fingerprint = ctx.input_fingerprint ?? "fp_01";
  const def = reportPageDefinition(page_id);
  await ensurePageFence({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
  });
  const claimed = await claimPageExecution({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
    task_type: "generate",
    input_fingerprint,
    upstream_output_fingerprints: {},
    worker_id: ctx.worker_id ?? "w_01",
  });
  assert.ok(claimed.ok, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim");
  const out = { page: "01", body: "conc" };
  const fp = hashCanonicalPayload(out);
  const committed = await commitPageResult({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    output: out,
    output_fingerprint: fp,
    state_patch: { outcome: "completed", input_fingerprint },
    provenance: {
      report_id: ctx.report_id,
      generation_id: ctx.generation_id,
      generation_epoch: ctx.generation_epoch,
      page_id,
      input_fingerprint,
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      output_fingerprint: fp,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      validity_rev: claimed.value.validity_rev,
    },
  });
  assert.ok(committed.ok, JSON.stringify(committed));
  return {
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    validity_rev: claimed.value.validity_rev,
    input_fingerprint,
  };
}

async function commitAllPages(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<void> {
  await commitPage01({ report_id, generation_id, generation_epoch });
  for (const page_id of REPORT_PAGE_IDS) {
    if (page_id === "01") continue;
    const def = reportPageDefinition(page_id);
    const input_fingerprint = `fp_${page_id}`;
    const upstream: ReportUpstreamOutputFingerprints = {};
    await ensurePageFence({
      report_id,
      generation_id,
      generation_epoch,
      page_id,
    });
    const claimed = await claimPageExecution({
      report_id,
      generation_id,
      generation_epoch,
      page_id,
      task_type: page_id === "07" ? "applicability" : "generate",
      input_fingerprint,
      upstream_output_fingerprints: upstream,
      worker_id: `w_${page_id}`,
    });
    assert.ok(claimed.ok, `${page_id}: ${JSON.stringify(claimed)}`);
    if (!claimed.ok) throw new Error(`claim ${page_id}`);
    const outcome =
      page_id === "07" ? "skipped_not_applicable" : "completed";
    const out =
      page_id === "07"
        ? { page: "07", gate: outcome }
        : { page: page_id, n: 1 };
    const fp = hashCanonicalPayload(out);
    assert.ok(
      (
        await commitPageResult({
          report_id,
          generation_id,
          generation_epoch,
          page_id,
          attempt_id: claimed.value.attempt_id,
          task_key: claimed.value.task_key,
          output: out,
          output_fingerprint: fp,
          state_patch: {
            outcome,
            applicability_status:
              page_id === "07" ? "not_applicable" : undefined,
          },
          provenance: {
            report_id,
            generation_id,
            generation_epoch,
            page_id,
            input_fingerprint,
            upstream_output_fingerprints: upstream,
            page_contract_version: def.production_version,
            prompt_version: def.prompt_version,
            validator_version: def.validator_version,
            output_fingerprint: fp,
            attempt_id: claimed.value.attempt_id,
            task_key: claimed.value.task_key,
            validity_rev: claimed.value.validity_rev,
          },
        })
      ).ok,
      page_id,
    );
  }
}

async function main(): Promise<void> {
  console.log("=== Batch3 Concurrency Repair (MemoryKv) ===");

  // --- A. Same task_key claim race — one winner ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_a";
    const gen = await boot(report_id, "g_cr_a");
    const page_id: ReportPageId = "01";
    const input_fingerprint = "fp_same_task";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const [c1, c2] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint,
        upstream_output_fingerprints: {},
        worker_id: "w_a1",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint,
        upstream_output_fingerprints: {},
        worker_id: "w_a2",
      }),
    ]);
    const wins = [c1, c2].filter((r) => r.ok);
    assert.equal(wins.length, 1, JSON.stringify({ c1, c2 }));
    const win = wins[0]!;
    const lose = c1.ok ? c2 : c1;
    assert.ok(
      !lose.ok &&
        (lose.code === "already_claimed" ||
          lose.code === "conflict" ||
          lose.code === "stale_page"),
    );
    assert.equal(win.value.task_key, (wins[0] as typeof c1).value!.task_key);
    const fence = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fence.value?.task_key, win.value.task_key);
    console.log("A ok — same task_key claim race");
  }

  // --- B. Generate vs Repair — task_conflict; fence owner unchanged ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_b";
    const gen = await boot(report_id, "g_cr_b");
    const page_id: ReportPageId = "01";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const genClaim = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_gen",
      upstream_output_fingerprints: {},
      worker_id: "w_gen",
      lease_ms: 60_000,
    });
    assert.ok(genClaim.ok);
    if (!genClaim.ok) throw new Error("genClaim");
    const fenceBefore = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    const ownerKey = fenceBefore.value!.task_key;
    const repair = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: "fp_repair",
      upstream_output_fingerprints: {},
      worker_id: "w_repair",
    });
    assert.equal(repair.ok, false);
    assert.equal(repair.ok ? "" : repair.code, "task_conflict");
    const fenceAfter = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fenceAfter.value?.task_key, ownerKey);
    assert.equal(fenceAfter.value?.attempt_id, genClaim.value.attempt_id);
    console.log("B ok — Generate×Repair task_conflict");
  }

  // --- C. Lease reclaim + stale attempt commit ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_c";
    const gen = await boot(report_id, "g_cr_c");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_lease";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const fence0 = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      validity_rev: fence0.value!.validity_rev,
      input_fingerprint,
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      task_type: "generate",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      task_key,
      input_fingerprint,
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      validity_rev: fence0.value!.validity_rev,
    });
    setBatch3NowMsForTests(1_000_000);
    const first = await claimTask({
      report_id,
      generation_id: gen.generation_id,
      task_key,
      worker_id: "w_lease_1",
      validity_rev: fence0.value!.validity_rev,
      lease_ms: 10_000,
    });
    assert.ok(first.ok);
    if (!first.ok) throw new Error("first claim");
    const tKey = taskKvPath(report_id, gen.generation_id, task_key);
    const curTask = await readTask(report_id, gen.generation_id, task_key);
    assert.ok(curTask.ok && curTask.value);
    const expired: TaskRecord = {
      ...curTask.value!,
      lease_expires_ms: 500_000,
      lease_expires_at: new Date(500_000).toISOString(),
    };
    const cas = await casSet(tKey, JSON.stringify(curTask.value), expired);
    assert.ok(cas.ok);
    setBatch3NowMsForTests(2_000_000);
    const second = await claimTask({
      report_id,
      generation_id: gen.generation_id,
      task_key,
      worker_id: "w_lease_2",
      validity_rev: fence0.value!.validity_rev,
    });
    assert.ok(second.ok);
    if (!second.ok) throw new Error("reclaim");
    assert.notEqual(second.value.attempt_id, first.value.attempt_id);
    const out = { page: "01", stale: true };
    const fp = hashCanonicalPayload(out);
    const late = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: first.value.attempt_id!,
      task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: fp,
        attempt_id: first.value.attempt_id!,
        task_key,
        validity_rev: first.value.validity_rev,
      },
    });
    assert.equal(late.ok, false);
    assert.ok(
      !late.ok &&
        (late.code === "stale_attempt" ||
          late.code === "lease_expired" ||
          late.code === "conflict"),
    );
    setBatch3NowMsForTests(null);
    console.log("C ok — lease reclaim + old commit rejected");
  }

  // --- D. Different task_key cannot reclaim expired lease on claimed fence ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_d";
    const gen = await boot(report_id, "g_cr_d");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    setBatch3NowMsForTests(1_000_000);
    const genClaim = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_d_gen",
      upstream_output_fingerprints: {},
      worker_id: "w_d_gen",
      lease_ms: 5_000,
    });
    assert.ok(genClaim.ok);
    if (!genClaim.ok) throw new Error("genClaim");
    const fence = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    const ownerKey = genClaim.value.task_key;
    const otherKey = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      validity_rev: fence.value!.validity_rev,
      input_fingerprint: "fp_d_repair",
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      task_type: "repair",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      task_key: otherKey,
      input_fingerprint: "fp_d_repair",
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      validity_rev: fence.value!.validity_rev,
    });
    setBatch3NowMsForTests(2_000_000);
    const steal = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: "fp_d_repair",
      upstream_output_fingerprints: {},
      worker_id: "w_d_steal",
    });
    setBatch3NowMsForTests(null);
    assert.equal(steal.ok, false);
    assert.equal(steal.ok ? "" : steal.code, "task_conflict");
    const fenceAfter = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(fenceAfter.value?.task_key, ownerKey);
    console.log("D ok — foreign task_key cannot reclaim expired fence lease");
  }

  // --- E. Cascade expected_old_rev race — one bump ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_e";
    const gen = await boot(report_id, "g_cr_e");
    await commitPage01({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
    });
    const fence = await readPageFence(report_id, gen.generation_id, "01");
    const expected_old = fence.value!.validity_rev;
    const target = expected_old + 1;

    let ready = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    setBeforeInvalidateAtomicHookForTests(async () => {
      ready += 1;
      if (ready >= 2) release();
      await gate;
    });

    const p1 = invalidatePageAuthorityForCascade({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "cr_e_1",
      expected_old_rev: expected_old,
      target_rev: target,
      operation_id: randomUUID(),
    });
    const p2 = invalidatePageAuthorityForCascade({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "cr_e_2",
      expected_old_rev: expected_old,
      target_rev: target,
      operation_id: randomUUID(),
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    setBeforeInvalidateAtomicHookForTests(null);

    const okCount = [r1, r2].filter((r) => r.ok).length;
    assert.equal(okCount, 1);
    const loser = r1.ok ? r2 : r1;
    assert.equal(loser.ok ? "" : loser.code, "revision_conflict");
    const fenceAfter = await readPageFence(report_id, gen.generation_id, "01");
    assert.equal(fenceAfter.value?.validity_rev, target);
    assert.equal(fenceAfter.value?.status, "stale");
    console.log("E ok — cascade expected_old race");
  }

  // --- F. claimFinalization blocked while cascade running ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_f";
    const gen = await boot(report_id, "g_cr_f");
    await commitAllPages(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const planned = await planCascadePageIds({
      report_id,
      generation_id: gen.generation_id,
      source_page_id: "01",
      shouldIncludeOptional: async () => ({ ok: true, value: false }),
    });
    assert.ok(planned.ok);
    if (!planned.ok) throw new Error("plan");
    const frozen = await buildFrozenCascadeTargets({
      report_id,
      generation_id: gen.generation_id,
      page_ids: planned.value.slice(0, 1),
    });
    assert.ok(frozen.ok);
    if (!frozen.ok) throw new Error("frozen");
    const now = new Date().toISOString();
    const op = {
      operation_id: randomUUID(),
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01" as ReportPageId,
      reason: "cr_running",
      targets: frozen.value.map((t) => ({ ...t, done: false })),
      status: "running" as const,
      created_at: now,
      updated_at: now,
    };
    assert.ok((await saveCascadeOperation(op, null)).ok);
    const blocked = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(blocked.ok ? "" : blocked.code, "cascade_incomplete");
    console.log("F ok — finalization blocked by running cascade");
  }

  // --- G. Delivery failed → resume → delivered; generation consistent ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_g";
    const gen = await boot(report_id, "g_cr_g");
    await commitAllPages(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
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
    const genSeal = await readGeneration(report_id, gen.generation_id);
    assert.equal(genSeal.value?.status, "finalizing");
    const claimSeal = await readFinalizationClaim(report_id, gen.generation_id);
    assert.ok(
      claimSeal.value?.status === "sealed" ||
        claimSeal.value?.status === "claimed",
    );

    await markFinalizationDelivering(report_id, gen.generation_id);
    await markFinalizationDeliveryFailed(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      "transport_reset",
    );
    const genFailed = await readGeneration(report_id, gen.generation_id);
    assert.equal(genFailed.value?.status, "delivery_failed");
    const claimFailed = await readFinalizationClaim(report_id, gen.generation_id);
    assert.equal(claimFailed.value?.status, "delivery_failed");

    const resume = await markFinalizationDelivering(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.ok(resume.ok);
    const genResume = await readGeneration(report_id, gen.generation_id);
    assert.equal(genResume.value?.status, "finalizing");
    const claimResume = await readFinalizationClaim(report_id, gen.generation_id);
    assert.equal(claimResume.value?.status, "delivering");

    const done = await markFinalizationDelivered(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.ok(done.ok);
    assert.equal(done.value.status, "delivered");
    const genDone = await readGeneration(report_id, gen.generation_id);
    assert.equal(genDone.value?.status, "completed");
    console.log("G ok — delivery_failed recovery loop");
  }

  // --- H. Dispatch intent idempotency + markIntentSent on completed ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_h";
    const gen = await boot(report_id, "g_cr_h");
    const page_id: ReportPageId = "01";
    const fence = await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    assert.ok(fence.ok);
    const task_key_rev0 = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      validity_rev: fence.value!.validity_rev,
      input_fingerprint: "fp_intent",
      upstream_output_fingerprints: {},
      page_contract_version: reportPageDefinition(page_id).production_version,
      prompt_version: reportPageDefinition(page_id).prompt_version,
      validator_version: reportPageDefinition(page_id).validator_version,
      task_type: "generate",
    });
    const basePayload = {
      report_id,
      generation_id: gen.generation_id,
      page_id: "01",
    };
    const i1 = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      task_key: task_key_rev0,
      payload: basePayload,
    });
    const i2 = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      task_key: task_key_rev0,
      payload: basePayload,
    });
    assert.ok(i1.ok && i2.ok);
    assert.equal(i1.value!.intent_id, i2.value!.intent_id);

    const task_key_rev1 = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      validity_rev: fence.value!.validity_rev + 1,
      input_fingerprint: "fp_intent",
      upstream_output_fingerprints: {},
      page_contract_version: reportPageDefinition(page_id).production_version,
      prompt_version: reportPageDefinition(page_id).prompt_version,
      validator_version: reportPageDefinition(page_id).validator_version,
      task_type: "generate",
    });
    const iRev = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      task_key: task_key_rev1,
      payload: basePayload,
    });
    assert.ok(iRev.ok);
    assert.notEqual(iRev.value!.intent_id, i1.value!.intent_id);

    const completed = await markIntentSent(i1.value!);
    assert.ok(completed.ok);
    assert.equal(completed.value.status, "sent");
    const { markIntentCompleted } = await import(
      "@/lib/llm/pro/delivery/decision-report-v2/batch3/dispatch-intent"
    );
    const done = await markIntentCompleted(completed.value);
    assert.ok(done.ok);
    assert.equal(done.value.status, "completed");
    const dupSent = await markIntentSent(done.value);
    assert.ok(dupSent.ok);
    assert.equal(dupSent.value.status, "completed");
    const reread = await readIntent(
      report_id,
      gen.generation_id,
      done.value.intent_id,
    );
    assert.equal(reread.value?.status, "completed");
    console.log("H ok — intent idempotency + sent no-op on completed");
  }

  // --- I. reopenStaleFence + late commit with old attempt ---
  {
    await cleanup();
    const report_id = "rpt_b3cr_i";
    const gen = await boot(report_id, "g_cr_i");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const first = await commitPage01({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      worker_id: "w_i_old",
    });
    const inv = await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      reason: "cr_i_inv",
    });
    assert.ok(inv.ok);
    if (!inv.ok) throw new Error("inv");
    const staleFence = await readPageFence(
      report_id,
      gen.generation_id,
      page_id,
    );
    assert.equal(staleFence.value?.status, "stale");

    const out = { page: "01", late: true };
    const fp = hashCanonicalPayload(out);
    const lateBeforeReopen = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: first.attempt_id,
      task_key: first.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: first.input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: fp,
        attempt_id: first.attempt_id,
        task_key: first.task_key,
        validity_rev: first.validity_rev,
      },
    });
    assert.equal(lateBeforeReopen.ok, false);

    const reopen = await reopenStaleFenceIfReady({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    assert.ok(reopen.ok, JSON.stringify(reopen));
    assert.equal(reopen.value.status, "open");

    const lateAfterReopen = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: first.attempt_id,
      task_key: first.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: first.input_fingerprint,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: fp,
        attempt_id: first.attempt_id,
        task_key: first.task_key,
        validity_rev: first.validity_rev,
      },
    });
    assert.equal(lateAfterReopen.ok, false);
    assert.ok(
      !lateAfterReopen.ok &&
        (lateAfterReopen.code === "stale_attempt" ||
          lateAfterReopen.code === "stale_page" ||
          lateAfterReopen.code === "conflict"),
    );
    console.log("I ok — reopen stale fence; old attempt commit rejected");
  }

  await cleanup();
  console.log("DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here");
  console.log("MEMORY_KV: PASS");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exitCode = 1;
  });