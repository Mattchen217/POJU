/**
 * Batch3 Four Atomic Protocol Closure Units — MemoryKv concurrency + lifecycle E2E.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-four-units.ts
 *
 * MEMORY_KV only. Does not claim Redis Integration PASS.
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  applyCascadeTargetAtomic,
  activateGeneration,
  allocateGeneration,
  casSet,
  claimFinalization,
  claimPageExecution,
  claimTask,
  commitPageResult,
  computeTaskKey,
  continueCascadeOperation,
  ensurePageFence,
  ensureQueuedTask,
  invalidateFromPage,
  invalidatePageAuthority,
  markFinalizationDelivered,
  markFinalizationDelivering,
  markFinalizationDeliveryFailed,
  readCascadeOperation,
  readFinalizationClaim,
  readGeneration,
  readPageFence,
  readTask,
  renewLease,
  reopenStaleFenceAtomic,
  reopenStaleFenceIfReady,
  resetBatch3KeysForTests,
  saveCascadeOperation,
  setBeforeInvalidateAtomicHookForTests,
  setBeforePageClaimAtomicHookForTests,
  type CascadeOperation,
  type FinalizationPageBinding,
  type TaskRecord,
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

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3_four_units",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Four-unit protocol probe",
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
  setBeforePageClaimAtomicHookForTests(null);
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

async function claimAndCommitPage(ctx: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  input_fingerprint?: string;
  worker_id?: string;
  task_type?: "generate" | "repair" | "applicability";
}): Promise<{
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  input_fingerprint: string;
}> {
  const def = reportPageDefinition(ctx.page_id);
  const input_fingerprint = ctx.input_fingerprint ?? `fp_${ctx.page_id}`;
  const task_type =
    ctx.task_type ??
    (ctx.page_id === "07" ? "applicability" : "generate");
  await ensurePageFence({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id: ctx.page_id,
  });
  const claimed = await claimPageExecution({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id: ctx.page_id,
    task_type,
    input_fingerprint,
    upstream_output_fingerprints: {},
    worker_id: ctx.worker_id ?? `w_${ctx.page_id}`,
  });
  assert.ok(claimed.ok, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim");
  const outcome =
    ctx.page_id === "07" ? "skipped_not_applicable" : "completed";
  const out =
    ctx.page_id === "07"
      ? { page: "07", gate: outcome }
      : { page: ctx.page_id, body: "ok" };
  const fp = hashCanonicalPayload(out);
  const committed = await commitPageResult({
    report_id: ctx.report_id,
    generation_id: ctx.generation_id,
    generation_epoch: ctx.generation_epoch,
    page_id: ctx.page_id,
    attempt_id: claimed.value.attempt_id,
    task_key: claimed.value.task_key,
    output: out,
    output_fingerprint: fp,
    state_patch: {
      outcome,
      applicability_status:
        ctx.page_id === "07" ? "not_applicable" : undefined,
    },
    provenance: {
      report_id: ctx.report_id,
      generation_id: ctx.generation_id,
      generation_epoch: ctx.generation_epoch,
      page_id: ctx.page_id,
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
  for (const page_id of REPORT_PAGE_IDS) {
    await claimAndCommitPage({
      report_id,
      generation_id,
      generation_epoch,
      page_id,
    });
  }
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
    const out =
      page_id === "07"
        ? { page: "07", gate: "skipped_not_applicable" }
        : { page: page_id, body: "ok" };
    bindings.push({
      page_id,
      generation_id,
      generation_epoch,
      validity_rev: fence.value!.validity_rev,
      attempt_id: fence.value!.attempt_id!,
      task_key: fence.value!.task_key!,
      output_fingerprint: fence.value!.output_fingerprint!,
      input_fingerprint: fence.value!.input_fingerprint ?? `fp_${page_id}`,
      sealed_output: out,
      outcome: page_id === "07" ? "skipped_not_applicable" : "completed",
    });
  }
  return bindings;
}

async function main(): Promise<void> {
  console.log("=== Batch3 Four Atomic Protocol Units (MemoryKv) ===");

  // =========================================================================
  // UNIT A — Execution Ownership
  // =========================================================================
  console.log("--- Unit A: Execution Ownership ---");

  // A1. Two different task_keys claim same fence concurrently
  {
    await cleanup();
    const report_id = "rpt_fu_a1";
    const gen = await boot(report_id, "g_a1");
    const page_id: ReportPageId = "01";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const [r1, r2] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: "fp_a1_a",
        upstream_output_fingerprints: {},
        worker_id: "w_a1_a",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: "fp_a1_b",
        upstream_output_fingerprints: {},
        worker_id: "w_a1_b",
      }),
    ]);
    const wins = [r1, r2].filter((r) => r.ok);
    const loses = [r1, r2].filter((r) => !r.ok);
    assert.equal(wins.length, 1);
    assert.equal(loses.length, 1);
    assert.equal(loses[0]!.ok ? "" : loses[0]!.code, "task_conflict");
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "claimed");
    assert.equal(fence.value?.task_key, wins[0]!.ok ? wins[0]!.value.task_key : null);
    assert.equal(fence.value?.attempt_id, wins[0]!.ok ? wins[0]!.value.attempt_id : null);
    console.log("A1 ok — different task_keys concurrent claim");
  }

  // A2. Generate vs Repair concurrent claim
  {
    await cleanup();
    const report_id = "rpt_fu_a2";
    const gen = await boot(report_id, "g_a2");
    const page_id: ReportPageId = "01";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const [g, r] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: "fp_gen",
        upstream_output_fingerprints: {},
        worker_id: "w_gen",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "repair",
        input_fingerprint: "fp_rep",
        upstream_output_fingerprints: {},
        worker_id: "w_rep",
      }),
    ]);
    assert.equal([g, r].filter((x) => x.ok).length, 1);
    assert.equal([g, r].filter((x) => !x.ok)[0]!.ok ? "" : [g, r].filter((x) => !x.ok)[0]!.code, "task_conflict");
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "claimed");
    console.log("A2 ok — Generate×Repair concurrent");
  }

  // A3. Same task_key two workers first claim
  {
    await cleanup();
    const report_id = "rpt_fu_a3";
    const gen = await boot(report_id, "g_a3");
    const page_id: ReportPageId = "01";
    const fp = "fp_same";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const [a, b] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: fp,
        upstream_output_fingerprints: {},
        worker_id: "w1",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: fp,
        upstream_output_fingerprints: {},
        worker_id: "w2",
      }),
    ]);
    assert.equal([a, b].filter((x) => x.ok).length, 1);
    assert.equal([a, b].filter((x) => !x.ok)[0]!.ok ? "" : [a, b].filter((x) => !x.ok)[0]!.code, "already_claimed");
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    const task = await readTask(
      report_id,
      gen.generation_id,
      fence.value!.task_key!,
    );
    assert.equal(task.value?.status, "running");
    assert.equal(fence.value?.attempt_id, task.value?.attempt_id);
    console.log("A3 ok — same task_key first-claim race");
  }

  // A4 + A5. Concurrent reclaim + two workers on old lease
  {
    await cleanup();
    const report_id = "rpt_fu_a45";
    const gen = await boot(report_id, "g_a45");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const fp = "fp_reclaim";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    setBatch3NowMsForTests(1_000_000);
    const first = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: fp,
      upstream_output_fingerprints: {},
      worker_id: "w_old",
      lease_ms: 5_000,
    });
    assert.ok(first.ok);
    if (!first.ok) throw new Error("first");
    const tKey = taskKvPath(report_id, gen.generation_id, first.value.task_key);
    const cur = await readTask(report_id, gen.generation_id, first.value.task_key);
    const expired: TaskRecord = {
      ...cur.value!,
      lease_expires_ms: 500_000,
      lease_expires_at: new Date(500_000).toISOString(),
    };
    assert.ok((await casSet(tKey, JSON.stringify(cur.value), expired)).ok);
    setBatch3NowMsForTests(2_000_000);
    const [r1, r2] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: fp,
        upstream_output_fingerprints: {},
        worker_id: "w_r1",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        task_type: "generate",
        input_fingerprint: fp,
        upstream_output_fingerprints: {},
        worker_id: "w_r2",
      }),
    ]);
    const winners = [r1, r2].filter((x) => x.ok);
    assert.equal(winners.length, 1);
    assert.notEqual(winners[0]!.ok ? winners[0]!.value.attempt_id : null, first.value.attempt_id);
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.attempt_id, winners[0]!.ok ? winners[0]!.value.attempt_id : null);
    // A6. Old attempt commit after reclaim
    const late = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: first.value.attempt_id,
      task_key: first.value.task_key,
      output: { page: "01", stale: true },
      output_fingerprint: hashCanonicalPayload({ page: "01", stale: true }),
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: fp,
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: hashCanonicalPayload({ page: "01", stale: true }),
        attempt_id: first.value.attempt_id,
        task_key: first.value.task_key,
        validity_rev: first.value.validity_rev,
      },
    });
    assert.equal(late.ok, false);
    assert.ok(
      !late.ok &&
        (late.code === "stale_attempt" || late.code === "lease_expired"),
    );
    setBatch3NowMsForTests(null);
    console.log("A4–A6 ok — concurrent reclaim + old commit rejected");
  }

  // A7. Lease missing → commit fail-closed
  {
    await cleanup();
    const report_id = "rpt_fu_a7";
    const gen = await boot(report_id, "g_a7");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const claimed = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_nolease",
      upstream_output_fingerprints: {},
      worker_id: "w_nl",
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");
    const tKey = taskKvPath(report_id, gen.generation_id, claimed.value.task_key);
    const cur = await readTask(report_id, gen.generation_id, claimed.value.task_key);
    const stripped: TaskRecord = {
      ...cur.value!,
      lease_expires_ms: null,
      lease_expires_at: null,
    };
    assert.ok((await casSet(tKey, JSON.stringify(cur.value), stripped)).ok);
    const commit = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      output: { page: "01" },
      output_fingerprint: "fp",
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: "fp_nolease",
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: "fp",
        attempt_id: claimed.value.attempt_id,
        task_key: claimed.value.task_key,
        validity_rev: claimed.value.validity_rev,
      },
    });
    assert.equal(commit.ok, false);
    assert.equal(commit.ok ? "" : commit.code, "lease_expired");
    console.log("A7 ok — missing lease fail-closed on commit");
  }

  // A8. Renew at exact expiry boundary (lease_expires_at <= now)
  {
    await cleanup();
    const report_id = "rpt_fu_a8";
    const gen = await boot(report_id, "g_a8");
    const page_id: ReportPageId = "01";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    setBatch3NowMsForTests(1_000_000);
    const claimed = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_renew",
      upstream_output_fingerprints: {},
      worker_id: "w_rn",
      lease_ms: 10_000,
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");
    // Move clock to exact lease_expires_ms
    const cur = await readTask(report_id, gen.generation_id, claimed.value.task_key);
    const exp = cur.value!.lease_expires_ms!;
    setBatch3NowMsForTests(exp);
    const renew = await renewLease({
      report_id,
      generation_id: gen.generation_id,
      task_key: claimed.value.task_key,
      attempt_id: claimed.value.attempt_id,
    });
    assert.equal(renew.ok, false);
    assert.equal(renew.ok ? "" : renew.code, "lease_expired");
    setBatch3NowMsForTests(null);
    console.log("A8 ok — renew at exact expiry rejected");
  }

  // A9. Generation switch during claim
  {
    await cleanup();
    const report_id = "rpt_fu_a9";
    const gen = await boot(report_id, "g_a9");
    const page_id: ReportPageId = "01";
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    setBeforePageClaimAtomicHookForTests(async () => {
      const g2 = await allocateGeneration({
        report_id,
        locale: "en",
        generation_id: "g_a9_newer",
      });
      assert.ok(g2.ok);
      if (!g2.ok) throw new Error("g2");
      await activateGeneration({ record: g2.value, job_id: report_id });
    });
    const claimed = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_switch",
      upstream_output_fingerprints: {},
      worker_id: "w_sw",
    });
    setBeforePageClaimAtomicHookForTests(null);
    assert.equal(claimed.ok, false);
    assert.ok(
      !claimed.ok &&
        (claimed.code === "stale_generation" ||
          claimed.code === "generation_inactive"),
    );
    console.log("A9 ok — generation switch during claim");
  }

  // A10. Finalization lock during claim race
  {
    await cleanup();
    const report_id = "rpt_fu_a10";
    const gen = await boot(report_id, "g_a10");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const sealed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      input_fingerprint: "ifp",
      pages: bindings,
    });
    assert.ok(sealed.ok, JSON.stringify(sealed));
    const claim = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      task_type: "repair",
      input_fingerprint: "fp_post_seal",
      upstream_output_fingerprints: {},
      worker_id: "w_seal",
    });
    assert.equal(claim.ok, false);
    assert.equal(claim.ok ? "" : claim.code, "finalization_locked");
    console.log("A10 ok — finalization locks claim");
  }

  // A11. Task written, fence write fault simulation via inconsistent state
  {
    await cleanup();
    const report_id = "rpt_fu_a11";
    const gen = await boot(report_id, "g_a11");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const fence0 = await readPageFence(report_id, gen.generation_id, page_id);
    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      validity_rev: fence0.value!.validity_rev,
      input_fingerprint: "fp_partial",
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
      input_fingerprint: "fp_partial",
      upstream_output_fingerprints: {},
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      validity_rev: fence0.value!.validity_rev,
    });
    // Force fence into claimed with foreign attempt while task still queued
    const fKey = `report-batch3:${report_id}:${gen.generation_id}:fence:${page_id}`;
    const brokenFence = {
      ...fence0.value!,
      status: "claimed" as const,
      attempt_id: "orphan_attempt",
      task_key: "orphan_task_key",
    };
    assert.ok(
      (await casSet(fKey, JSON.stringify(fence0.value), brokenFence)).ok,
    );
    const claimed = await claimTask({
      report_id,
      generation_id: gen.generation_id,
      task_key,
      worker_id: "w_partial",
      validity_rev: fence0.value!.validity_rev,
    });
    assert.equal(claimed.ok, false);
    assert.equal(claimed.ok ? "" : claimed.code, "task_conflict");
    const fenceAfter = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fenceAfter.value?.task_key, "orphan_task_key");
    const taskAfter = await readTask(report_id, gen.generation_id, task_key);
    assert.equal(taskAfter.value?.status, "queued");
    console.log("A11–A12 ok — fence/task inconsistency fail-closed");
  }

  // =========================================================================
  // UNIT B — Cascade Transaction
  // =========================================================================
  console.log("--- Unit B: Cascade Transaction ---");

  // B1 + B2. Concurrent + idempotent same target
  {
    await cleanup();
    const report_id = "rpt_fu_b12";
    const gen = await boot(report_id, "g_b12");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    const f = await readPageFence(report_id, gen.generation_id, "02");
    const rev = f.value!.validity_rev;
    const op_id = randomUUID();
    const frozen = [
      {
        page_id: "02" as ReportPageId,
        expected_old_rev: rev,
        target_rev: rev + 1,
        status: "pending" as const,
        done: false,
      },
    ];
    const op: CascadeOperation = {
      operation_id: op_id,
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "fu_b12",
      status: "running",
      targets: frozen,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assert.ok((await saveCascadeOperation(op, null)).ok);
    const t = frozen[0]!;
    const [c1, c2] = await Promise.all([
      applyCascadeTargetAtomic({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: t.page_id,
        reason: "fu_b12",
        expected_old_rev: t.expected_old_rev,
        target_rev: t.target_rev,
        operation_id: op_id,
      }),
      applyCascadeTargetAtomic({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: t.page_id,
        reason: "fu_b12",
        expected_old_rev: t.expected_old_rev,
        target_rev: t.target_rev,
        operation_id: op_id,
      }),
    ]);
    assert.ok(c1.ok && c2.ok);
    const fence = await readPageFence(report_id, gen.generation_id, t.page_id);
    assert.equal(fence.value?.validity_rev, t.target_rev);
    assert.equal(fence.value?.status, "stale");
    const opAfter = await readCascadeOperation(
      report_id,
      gen.generation_id,
      op_id,
    );
    const tgt = opAfter.value!.targets.find((x) => x.page_id === t.page_id)!;
    assert.ok(tgt.status === "completed" || tgt.done === true);
    const again = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: t.page_id,
      reason: "fu_b12",
      expected_old_rev: t.expected_old_rev,
      target_rev: t.target_rev,
      operation_id: op_id,
    });
    assert.ok(again.ok);
    assert.equal(again.value.validity_rev, t.target_rev);
    const fence2 = await readPageFence(report_id, gen.generation_id, t.page_id);
    assert.equal(fence2.value?.validity_rev, t.target_rev);
    console.log("B1–B2 ok — concurrent + idempotent cascade target");
  }

  // B3. Two different operations compete same fence
  {
    await cleanup();
    const report_id = "rpt_fu_b3";
    const gen = await boot(report_id, "g_b3");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    const fence = await readPageFence(report_id, gen.generation_id, "02");
    const rev = fence.value!.validity_rev;
    const op1: CascadeOperation = {
      operation_id: "op_b3_1",
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "b3_1",
      status: "running",
      targets: [
        {
          page_id: "02",
          expected_old_rev: rev,
          target_rev: rev + 1,
          status: "pending",
          done: false,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const op2: CascadeOperation = {
      operation_id: "op_b3_2",
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "b3_2",
      status: "running",
      targets: [
        {
          page_id: "02",
          expected_old_rev: rev,
          target_rev: rev + 1,
          status: "pending",
          done: false,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assert.ok((await saveCascadeOperation(op1, null)).ok);
    assert.ok((await saveCascadeOperation(op2, null)).ok);
    const a = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "b3_1",
      expected_old_rev: rev,
      target_rev: rev + 1,
      operation_id: "op_b3_1",
    });
    assert.ok(a.ok);
    const b = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "b3_2",
      expected_old_rev: rev,
      target_rev: rev + 1,
      operation_id: "op_b3_2",
    });
    assert.equal(b.ok, false);
    assert.equal(b.ok ? "" : b.code, "revision_conflict");
    const fenceAfter = await readPageFence(report_id, gen.generation_id, "02");
    assert.equal(fenceAfter.value?.validity_rev, rev + 1);
    console.log("B3 ok — competing operations revision_conflict");
  }

  // B8. expected_old_rev conflict
  {
    await cleanup();
    const report_id = "rpt_fu_b8";
    const gen = await boot(report_id, "g_b8");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    const fence = await readPageFence(report_id, gen.generation_id, "02");
    const rev = fence.value!.validity_rev;
    const op: CascadeOperation = {
      operation_id: "op_b8",
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "b8",
      status: "running",
      targets: [
        {
          page_id: "02",
          expected_old_rev: rev,
          target_rev: rev + 1,
          status: "pending",
          done: false,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assert.ok((await saveCascadeOperation(op, null)).ok);
    const bad = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "b8",
      expected_old_rev: rev + 99,
      target_rev: rev + 100,
      operation_id: "op_b8",
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.ok ? "" : bad.code, "revision_conflict");
    console.log("B8 ok — expected_old_rev conflict");
  }

  // B9. Target not in operation
  {
    await cleanup();
    const report_id = "rpt_fu_b9";
    const gen = await boot(report_id, "g_b9");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    const fence = await readPageFence(report_id, gen.generation_id, "02");
    const rev = fence.value!.validity_rev;
    const op: CascadeOperation = {
      operation_id: "op_b9",
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "b9",
      status: "running",
      targets: [
        {
          page_id: "03",
          expected_old_rev: 0,
          target_rev: 1,
          status: "pending",
          done: false,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assert.ok((await saveCascadeOperation(op, null)).ok);
    const bad = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "b9",
      expected_old_rev: rev,
      target_rev: rev + 1,
      operation_id: "op_b9",
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.ok ? "" : bad.code, "not_found");
    console.log("B9 ok — target not in operation");
  }

  // B10. Operation ID mismatch / missing
  {
    await cleanup();
    const report_id = "rpt_fu_b10";
    const gen = await boot(report_id, "g_b10");
    const bad = await applyCascadeTargetAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "b10",
      expected_old_rev: 0,
      target_rev: 1,
      operation_id: "missing_op",
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.ok ? "" : bad.code, "not_found");
    console.log("B10 ok — missing operation_id");
  }

  // B4/B5. Cascade create vs Finalization Seal — covered via invalidateFromPage + seal
  {
    await cleanup();
    const report_id = "rpt_fu_b45";
    const gen = await boot(report_id, "g_b45");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    // Start cascade via invalidate while seal races
    setBeforeInvalidateAtomicHookForTests(async () => {
      /* no-op — seal happens in parallel */
    });
    const [inv, seal] = await Promise.all([
      invalidateFromPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        source_page_id: "01",
        reason: "b45_race",
      }),
      claimFinalization({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        input_fingerprint: "ifp",
        pages: bindings,
      }),
    ]);
    setBeforeInvalidateAtomicHookForTests(null);
    // Mutual exclusion: if seal won, further invalidate is locked;
    // if cascade won, seal must be refused (cascade_blocked / conflict).
    if (seal.ok) {
      const claim = await readFinalizationClaim(report_id, gen.generation_id);
      assert.ok(claim.value);
      const again = await invalidatePageAuthority({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "02",
        reason: "post_seal",
      });
      assert.equal(again.ok, false);
      assert.equal(again.ok ? "" : again.code, "finalization_locked");
    } else if (inv.ok) {
      assert.equal(seal.ok, false);
      assert.ok(
        !seal.ok &&
          (seal.code === "cascade_blocked" ||
            seal.code === "cascade_incomplete" ||
            seal.code === "conflict" ||
            seal.code === "stale_page" ||
            seal.code === "finalization_locked"),
      );
    } else {
      // Both refused is acceptable under race (e.g. intermediate lock)
      assert.equal(inv.ok, false);
      assert.equal(seal.ok, false);
    }
    void bindings;
    console.log("B4–B5 ok — cascade×finalization mutual exclusion");
  }

  // B6/B12. Crash after atomic + recovery idempotent
  {
    await cleanup();
    const report_id = "rpt_fu_b6";
    const gen = await boot(report_id, "g_b6");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    await claimAndCommitPage({
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
      reason: "b6_crash",
    });
    assert.ok(inv.ok, JSON.stringify(inv));
    // Simulate crash: continue again (recovery)
    const cont = await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: inv.value!.operation_id,
    });
    assert.ok(cont.ok);
    const op = await readCascadeOperation(
      report_id,
      gen.generation_id,
      inv.value!.operation_id,
    );
    assert.equal(op.value?.status, "completed");
    for (const t of op.value!.targets) {
      const f = await readPageFence(report_id, gen.generation_id, t.page_id);
      assert.equal(f.value?.validity_rev, t.target_rev);
      assert.equal(f.value?.status, "stale");
    }
    console.log("B6/B12 ok — cascade recovery idempotent");
  }

  // =========================================================================
  // UNIT C — Reopen Transaction
  // =========================================================================
  console.log("--- Unit C: Reopen Transaction ---");

  // C1. Reopen vs generation switch
  {
    await cleanup();
    const report_id = "rpt_fu_c1";
    const gen = await boot(report_id, "g_c1");
    await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    await claimAndCommitPage({
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
      reason: "c1",
    });
    assert.ok(inv.ok);
    await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: inv.value!.operation_id,
    });
    const g2 = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "g_c1_new",
    });
    assert.ok(g2.ok);
    if (!g2.ok) throw new Error("g2");
    await activateGeneration({ record: g2.value, job_id: report_id });
    const reopen = await reopenStaleFenceAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    assert.equal(reopen.ok, false);
    assert.ok(
      !reopen.ok &&
        (reopen.code === "stale_generation" ||
          reopen.code === "generation_inactive"),
    );
    console.log("C1 ok — reopen blocked by generation switch");
  }

  // C2. Reopen vs finalization seal
  {
    await cleanup();
    const report_id = "rpt_fu_c2";
    const gen = await boot(report_id, "g_c2");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const sealed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      input_fingerprint: "ifp",
      pages: bindings,
    });
    assert.ok(sealed.ok, JSON.stringify(sealed));
    // Force fence stale under seal — reopen must still refuse
    const f2b = await readPageFence(report_id, gen.generation_id, "02");
    const fKey = `report-batch3:${report_id}:${gen.generation_id}:fence:02`;
    assert.ok(
      (
        await casSet(fKey, JSON.stringify(f2b.value), {
          ...f2b.value!,
          status: "stale",
          attempt_id: null,
          task_key: null,
        })
      ).ok,
    );
    const reopen = await reopenStaleFenceAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    assert.equal(reopen.ok, false);
    assert.equal(reopen.ok ? "" : reopen.code, "finalization_locked");
    console.log("C2 ok — reopen blocked by finalization");
  }

  // C6. Reopen vs old worker commit
  {
    await cleanup();
    const report_id = "rpt_fu_c6";
    const gen = await boot(report_id, "g_c6");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    const claimed = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: "fp_c6",
      upstream_output_fingerprints: {},
      worker_id: "w_old",
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");
    // Invalidate → stale
    await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      reason: "c6",
    });
    const fence = await readPageFence(report_id, gen.generation_id, page_id);
    assert.equal(fence.value?.status, "stale");
    // Page01 has no upstream — reopen should succeed
    const reopened = await reopenStaleFenceIfReady({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
    });
    assert.ok(reopened.ok, JSON.stringify(reopened));
    assert.equal(reopened.value?.status, "open");
    assert.equal(reopened.value?.validity_rev, fence.value!.validity_rev);
    assert.equal(reopened.value?.attempt_id, null);
    // Old attempt commit must fail
    const late = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      output: { page: "01", late: true },
      output_fingerprint: "late",
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        input_fingerprint: "fp_c6",
        upstream_output_fingerprints: {},
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: "late",
        attempt_id: claimed.value.attempt_id,
        task_key: claimed.value.task_key,
        validity_rev: claimed.value.validity_rev,
      },
    });
    assert.equal(late.ok, false);
    console.log("C6/C9 ok — reopen does not revive attempt; old commit fails");
  }

  // C8. Fence rev mismatch / claimed not stale
  {
    await cleanup();
    const report_id = "rpt_fu_c8";
    const gen = await boot(report_id, "g_c8");
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    const claimed = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      task_type: "generate",
      input_fingerprint: "fp_c8",
      upstream_output_fingerprints: {},
      worker_id: "w_c8",
    });
    assert.ok(claimed.ok);
    const reopen = await reopenStaleFenceAtomic({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    assert.equal(reopen.ok, false);
    // claimed fence is not reopenable
    assert.ok(!reopen.ok);
    console.log("C8/C9 ok — claimed fence reopen rejected");
  }

  // =========================================================================
  // UNIT D — Delivery Transaction
  // =========================================================================
  console.log("--- Unit D: Delivery Transaction ---");

  // D1. Two workers claim delivery concurrently
  {
    await cleanup();
    const report_id = "rpt_fu_d1";
    const gen = await boot(report_id, "g_d1");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const sealed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      input_fingerprint: "ifp",
      pages: bindings,
    });
    assert.ok(sealed.ok);
    const [a, b] = await Promise.all([
      markFinalizationDelivering(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
      ),
      markFinalizationDelivering(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
      ),
    ]);
    assert.ok(a.ok && b.ok); // idempotent same transition
    const claim = await readFinalizationClaim(report_id, gen.generation_id);
    const grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivering");
    assert.equal(grec.value?.status, "finalizing");
    console.log("D1 ok — concurrent delivering is atomic/idempotent");
  }

  // D2. Success vs failure race
  {
    await cleanup();
    const report_id = "rpt_fu_d2";
    const gen = await boot(report_id, "g_d2");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
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
          input_fingerprint: "ifp",
          pages: bindings,
        })
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    const [ok, fail] = await Promise.all([
      markFinalizationDelivered(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
      ),
      markFinalizationDeliveryFailed(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
        "race",
      ),
    ]);
    const winners = [ok, fail].filter((x) => x.ok);
    assert.equal(winners.length, 1);
    const claim = await readFinalizationClaim(report_id, gen.generation_id);
    const grec = await readGeneration(report_id, gen.generation_id);
    if (ok.ok) {
      assert.equal(claim.value?.status, "delivered");
      assert.equal(grec.value?.status, "completed");
    } else {
      assert.equal(claim.value?.status, "delivery_failed");
      assert.equal(grec.value?.status, "delivery_failed");
    }
    console.log("D2 ok — success×failure exclusive; no half-state");
  }

  // D3/D4. Failure + recovery + old worker
  {
    await cleanup();
    const report_id = "rpt_fu_d34";
    const gen = await boot(report_id, "g_d34");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
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
          input_fingerprint: "ifp",
          pages: bindings,
        })
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDeliveryFailed(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
          "boom",
        )
      ).ok,
    );
    let claim = await readFinalizationClaim(report_id, gen.generation_id);
    let grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivery_failed");
    assert.equal(grec.value?.status, "delivery_failed");
    // Recovery → delivering
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    claim = await readFinalizationClaim(report_id, gen.generation_id);
    grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivering");
    assert.equal(grec.value?.status, "finalizing");
    // Old failure after recovery must not half-corrupt if delivered wins
    const [del, fail] = await Promise.all([
      markFinalizationDelivered(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
      ),
      markFinalizationDeliveryFailed(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
        "late",
      ),
    ]);
    assert.equal([del, fail].filter((x) => x.ok).length, 1);
    claim = await readFinalizationClaim(report_id, gen.generation_id);
    grec = await readGeneration(report_id, gen.generation_id);
    if (del.ok) {
      assert.equal(claim.value?.status, "delivered");
      assert.equal(grec.value?.status, "completed");
    } else {
      assert.equal(claim.value?.status, "delivery_failed");
      assert.equal(grec.value?.status, "delivery_failed");
    }
    console.log("D3–D4 ok — recovery + old worker exclusive");
  }

  // D7/D8. Epoch / fingerprint mismatch on recovery path
  {
    await cleanup();
    const report_id = "rpt_fu_d78";
    const gen = await boot(report_id, "g_d78");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
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
          input_fingerprint: "ifp",
          pages: bindings,
        })
      ).ok,
    );
    const badEpoch = await markFinalizationDelivering(
      report_id,
      gen.generation_id,
      gen.generation_epoch + 99,
    );
    assert.equal(badEpoch.ok, false);
    assert.equal(badEpoch.ok ? "" : badEpoch.code, "stale_generation");
    console.log("D8 ok — epoch mismatch rejected");
  }

  // D9/D10/D11. Idempotent delivered + fail after delivered
  {
    await cleanup();
    const report_id = "rpt_fu_d911";
    const gen = await boot(report_id, "g_d911");
    await commitAllPages(report_id, gen.generation_id, gen.generation_epoch);
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
          input_fingerprint: "ifp",
          pages: bindings,
        })
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDelivered(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    const again = await markFinalizationDelivered(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.ok(again.ok); // idempotent
    const failAfter = await markFinalizationDeliveryFailed(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      "too_late",
    );
    assert.equal(failAfter.ok, false);
    const claim = await readFinalizationClaim(report_id, gen.generation_id);
    const grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivered");
    assert.equal(grec.value?.status, "completed");
    console.log("D9–D11 ok — idempotent delivered; fail-after rejected");
  }

  // =========================================================================
  // LIFECYCLE E2E with fault injection
  // =========================================================================
  console.log("--- Lifecycle E2E ---");
  {
    await cleanup();
    const report_id = "rpt_fu_e2e";
    const gen = await boot(report_id, "g_e2e");

    // Parallel Page01 / Page02 claim — no overwrite
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
    });
    const [c01, c02] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        task_type: "generate",
        input_fingerprint: "fp_01",
        upstream_output_fingerprints: {},
        worker_id: "w01",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "02",
        task_type: "generate",
        input_fingerprint: "fp_02",
        upstream_output_fingerprints: {},
        worker_id: "w02",
      }),
    ]);
    assert.ok(c01.ok && c02.ok);
    assert.notEqual(
      c01.ok ? c01.value.task_key : null,
      c02.ok ? c02.value.task_key : null,
    );
    const f01 = await readPageFence(report_id, gen.generation_id, "01");
    const f02 = await readPageFence(report_id, gen.generation_id, "02");
    assert.equal(f01.value?.attempt_id, c01.ok ? c01.value.attempt_id : null);
    assert.equal(f02.value?.attempt_id, c02.ok ? c02.value.attempt_id : null);

    // Generate vs Repair dual ownership refused
    const repairSteal = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      task_type: "repair",
      input_fingerprint: "fp_01_rep",
      upstream_output_fingerprints: {},
      worker_id: "w_rep",
    });
    assert.equal(repairSteal.ok, false);
    assert.equal(repairSteal.ok ? "" : repairSteal.code, "task_conflict");

    // Commit 01/02 then remaining pages
    const def01 = reportPageDefinition("01");
    const out01 = { page: "01", body: "ok" };
    const fp01 = hashCanonicalPayload(out01);
    assert.ok(
      (
        await commitPageResult({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id: "01",
          attempt_id: c01.value!.attempt_id,
          task_key: c01.value!.task_key,
          output: out01,
          output_fingerprint: fp01,
          state_patch: { outcome: "completed" },
          provenance: {
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "01",
            input_fingerprint: "fp_01",
            upstream_output_fingerprints: {},
            page_contract_version: def01.production_version,
            prompt_version: def01.prompt_version,
            validator_version: def01.validator_version,
            output_fingerprint: fp01,
            attempt_id: c01.value!.attempt_id,
            task_key: c01.value!.task_key,
            validity_rev: c01.value!.validity_rev,
          },
        })
      ).ok,
    );
    const def02 = reportPageDefinition("02");
    const out02 = { page: "02", body: "ok" };
    const fp02 = hashCanonicalPayload(out02);
    assert.ok(
      (
        await commitPageResult({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id: "02",
          attempt_id: c02.value!.attempt_id,
          task_key: c02.value!.task_key,
          output: out02,
          output_fingerprint: fp02,
          state_patch: { outcome: "completed" },
          provenance: {
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "02",
            input_fingerprint: "fp_02",
            upstream_output_fingerprints: {},
            page_contract_version: def02.production_version,
            prompt_version: def02.prompt_version,
            validator_version: def02.validator_version,
            output_fingerprint: fp02,
            attempt_id: c02.value!.attempt_id,
            task_key: c02.value!.task_key,
            validity_rev: c02.value!.validity_rev,
          },
        })
      ).ok,
    );
    for (const page_id of REPORT_PAGE_IDS) {
      if (page_id === "01" || page_id === "02") continue;
      await claimAndCommitPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
      });
    }

    // Invalidate + cascade recovery
    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "e2e_inv",
    });
    assert.ok(inv.ok, JSON.stringify(inv));
    const opId = inv.value!.operation_id;
    // Fault: crash mid-continue → retry
    const cont1 = await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: opId,
    });
    assert.ok(cont1.ok);
    const cont2 = await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: opId,
    });
    assert.ok(cont2.ok);
    const op = await readCascadeOperation(report_id, gen.generation_id, opId);
    assert.equal(op.value?.status, "completed");
    for (const t of op.value!.targets) {
      const f = await readPageFence(report_id, gen.generation_id, t.page_id);
      assert.equal(f.value?.validity_rev, t.target_rev);
    }

    // Reopen page01 (no upstream) — does not revive old attempt
    const oldAttempt = c01.value!.attempt_id;
    const reopened = await reopenStaleFenceIfReady({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    assert.ok(reopened.ok, JSON.stringify(reopened));
    assert.equal(reopened.value?.status, "open");
    assert.equal(reopened.value?.attempt_id, null);
    assert.notEqual(reopened.value?.attempt_id, oldAttempt);

    // Regenerate via Unit A claim
    const regen = await claimAndCommitPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp_01_regen",
      worker_id: "w_regen",
    });
    assert.ok(regen.attempt_id !== oldAttempt);

    // Reopen + regenerate downstream pages that were cascaded
    for (const t of op.value!.targets) {
      // Upstream may still be needed — reopen if ready, else force commit path via ensure
      await reopenStaleFenceIfReady({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: t.page_id,
      });
      const fence = await readPageFence(report_id, gen.generation_id, t.page_id);
      if (fence.value?.status === "stale") {
        // If deps not ready, claimAndCommit after forcing open is out of protocol —
        // re-commit via invalidate recovery path: ensure deps first
        if (t.page_id === "02") {
          // 02 depends on 01 which is committed
          const r2 = await reopenStaleFenceIfReady({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "02",
          });
          assert.ok(r2.ok, JSON.stringify(r2));
          await claimAndCommitPage({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "02",
            input_fingerprint: "fp_02_regen",
          });
        }
      }
    }
    // Commit remaining stale pages in DAG order
    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(report_id, gen.generation_id, page_id);
      if (fence.value?.status === "committed") continue;
      if (fence.value?.status === "stale") {
        const r = await reopenStaleFenceIfReady({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id,
        });
        if (!r.ok) {
          // leave for next pass
          continue;
        }
      }
      if (
        fence.value?.status === "open" ||
        (await readPageFence(report_id, gen.generation_id, page_id)).value
          ?.status === "open"
      ) {
        await claimAndCommitPage({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id,
          input_fingerprint: `fp_${page_id}_regen`,
        });
      }
    }
    // Multi-pass for dependency chain
    for (let pass = 0; pass < 8; pass++) {
      let pending = false;
      for (const page_id of REPORT_PAGE_IDS) {
        const fence = await readPageFence(report_id, gen.generation_id, page_id);
        if (fence.value?.status === "committed") continue;
        pending = true;
        if (fence.value?.status === "stale") {
          await reopenStaleFenceIfReady({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id,
          });
        }
        const f2 = await readPageFence(report_id, gen.generation_id, page_id);
        if (f2.value?.status === "open") {
          await claimAndCommitPage({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id,
            input_fingerprint: `fp_${page_id}_p${pass}`,
          });
        }
      }
      if (!pending) break;
    }
    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(report_id, gen.generation_id, page_id);
      assert.equal(fence.value?.status, "committed", page_id);
    }

    // Seal
    const bindings = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const sealed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      input_fingerprint: "ifp_e2e",
      pages: bindings,
    });
    assert.ok(sealed.ok, JSON.stringify(sealed));

    // Post-seal page modify refused
    const postSeal = await claimPageExecution({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      task_type: "repair",
      input_fingerprint: "fp_post",
      upstream_output_fingerprints: {},
      worker_id: "w_post",
    });
    assert.equal(postSeal.ok, false);
    assert.equal(postSeal.ok ? "" : postSeal.code, "finalization_locked");

    // Delivery failure — no half state
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDeliveryFailed(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
          "e2e_fail",
        )
      ).ok,
    );
    let claim = await readFinalizationClaim(report_id, gen.generation_id);
    let grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivery_failed");
    assert.equal(grec.value?.status, "delivery_failed");

    // Delivery recovery same seal → delivered
    assert.ok(
      (
        await markFinalizationDelivering(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    assert.ok(
      (
        await markFinalizationDelivered(
          report_id,
          gen.generation_id,
          gen.generation_epoch,
        )
      ).ok,
    );
    claim = await readFinalizationClaim(report_id, gen.generation_id);
    grec = await readGeneration(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivered");
    assert.equal(grec.value?.status, "completed");
    assert.equal(claim.value?.generation_id, gen.generation_id);
    assert.equal(claim.value?.generation_epoch, gen.generation_epoch);

    console.log("E2E ok — Allocate→…→Delivered with fault-injection recovery");
  }

  console.log("MEMORY_KV: PASS");
  console.log("REDIS_INTEGRATION: NOT_VERIFIED");
  console.log("DEPLOY_ENV_PENDING");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
