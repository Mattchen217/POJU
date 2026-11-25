/**
 * Batch3 Redis Integration — real Upstash Lua races (when configured).
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-redis-integration.ts
 *
 * Does NOT use REPORT_BATCH2_ALLOW_MEMORY_STORE (MemoryKv must not label Redis PASS).
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { REPORT_BATCH2_EVENTS } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/events";
import { claimPageExecution } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/claim-page-execution";
import {
  activateGeneration,
  allocateGeneration,
  claimFinalization,
  commitPageResult,
  continueCascadeOperation,
  enqueueDispatchIntent,
  ensurePageFence,
  invalidateFromPage,
  invalidatePageAuthority,
  isRedisEvalAvailable,
  markFinalizationDelivered,
  markFinalizationDelivering,
  markFinalizationDeliveryFailed,
  markIntentSent,
  readAuthorityPageOutput,
  readFinalizationClaim,
  readPageFence,
  resetBatch3KeysForTests,
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
import { isRemoteKvConfigured } from "@/lib/kv/memory-kv";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3_redis",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: "Redis integration race probe",
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

const PREFIX = `rpt_redis_${Date.now()}_`;

async function cleanup(): Promise<void> {
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
  setBeforeClaimAtomicHookForTests(null);
  setBeforeInvalidateAtomicHookForTests(null);
  setBatch3NowMsForTests(null);
}

async function boot(suffix: string) {
  const report_id = `${PREFIX}${suffix}`;
  const gen = await allocateGeneration({
    report_id,
    locale: "en",
    generation_id: `gen_${suffix}`,
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
  return { report_id, gen: gen.value };
}

async function upstreamFor(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<ReportUpstreamOutputFingerprints> {
  const def = reportPageDefinition(page_id);
  const out: ReportUpstreamOutputFingerprints = {};
  for (const up of def.required_upstream) {
    const auth = await readAuthorityPageOutput(report_id, generation_id, up);
    if (auth.ok && auth.value?.output_fingerprint) {
      out[up] = auth.value.output_fingerprint;
    }
  }
  return out;
}

async function claimCommit01(ctx: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  worker_id?: string;
  lease_ms?: number;
}): Promise<void> {
  const page_id: ReportPageId = "01";
  const input_fingerprint = "fp_01";
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
    worker_id: ctx.worker_id ?? "w_redis",
    lease_ms: ctx.lease_ms,
  });
  assert.ok(claimed.ok, JSON.stringify(claimed));
  if (!claimed.ok) throw new Error("claim");
  const out = { page: "01", body: "redis" };
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
}

async function buildMinimalBindings(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<FinalizationPageBinding[]> {
  const bindings: FinalizationPageBinding[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const existing = await readPageFence(report_id, generation_id, page_id);
    if (existing.ok && existing.value?.status === "committed") continue;
    const def = reportPageDefinition(page_id);
    const input_fingerprint = `fp_${page_id}`;
    const upstream = await upstreamFor(report_id, generation_id, page_id);
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
      worker_id: `w_bind_${page_id}`,
    });
    assert.ok(claimed.ok, `bind ${page_id}: ${JSON.stringify(claimed)}`);
    if (!claimed.ok) throw new Error(`bind claim ${page_id}`);
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
    const f2 = await readPageFence(report_id, generation_id, page_id);
    assert.ok(f2.ok && f2.value?.status === "committed", page_id);
    bindings.push({
      page_id,
      generation_id,
      generation_epoch,
      validity_rev: f2.value!.validity_rev,
      attempt_id: f2.value!.attempt_id!,
      task_key: f2.value!.task_key!,
      output_fingerprint: f2.value!.output_fingerprint!,
      input_fingerprint: f2.value!.input_fingerprint!,
      sealed_output: out,
      outcome,
    });
  }
  // Refresh bindings from fences (includes any pre-committed pages).
  const full: FinalizationPageBinding[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const f2 = await readPageFence(report_id, generation_id, page_id);
    assert.ok(f2.ok && f2.value?.status === "committed", page_id);
    const outcome =
      page_id === "07" ? "skipped_not_applicable" : "completed";
    full.push({
      page_id,
      generation_id,
      generation_epoch,
      validity_rev: f2.value!.validity_rev,
      attempt_id: f2.value!.attempt_id!,
      task_key: f2.value!.task_key!,
      output_fingerprint: f2.value!.output_fingerprint!,
      input_fingerprint: f2.value!.input_fingerprint!,
      sealed_output: { page: page_id },
      outcome,
    });
  }
  return full;
}

async function main(): Promise<void> {
  console.log("=== Batch3 Redis Integration Suite ===");
  const redisReady =
    isRemoteKvConfigured() && isRedisEvalAvailable();

  if (!redisReady) {
    console.log(
      `kv: remote_configured=${isRemoteKvConfigured() ? "yes" : "no"} redis_eval=${isRedisEvalAvailable() ? "yes" : "no"}`,
    );
    console.log("DEPLOY_ENV_PENDING");
    console.log("REDIS_INTEGRATION: NOT_VERIFIED");
    return;
  }

  // --- 1. Activation × Activation ---
  {
    await cleanup();
    const report_id = `${PREFIX}act_x_act`;
    const g1 = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "gen_a1",
    });
    const g2 = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "gen_a2",
    });
    assert.ok(g1.ok && g2.ok);
    if (!g1.ok || !g2.ok) throw new Error("alloc");
    await activateGeneration({ record: g1.value, job_id: report_id });
    const [r2, r3] = await Promise.all([
      activateGeneration({ record: g2.value!, job_id: report_id }),
      allocateGeneration({
        report_id,
        locale: "en",
        generation_id: "gen_a3",
      }).then(async (g3) => {
        assert.ok(g3.ok);
        if (!g3.ok) throw new Error("g3");
        return activateGeneration({ record: g3.value, job_id: report_id });
      }),
    ]);
    const wins = [r2, r3].filter((r) => r.ok).length;
    assert.equal(wins, 1, "exactly one concurrent activation must win");
    console.log("1 ok — Activation×Activation");
  }

  // --- 2. Claim × Claim ---
  {
    await cleanup();
    const { report_id, gen } = await boot("claim_x_claim");
    await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
  const input_fingerprint = "fp_cc";
    const [c1, c2] = await Promise.all([
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        task_type: "generate",
        input_fingerprint,
        upstream_output_fingerprints: {},
        worker_id: "w_c1",
      }),
      claimPageExecution({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        task_type: "generate",
        input_fingerprint,
        upstream_output_fingerprints: {},
        worker_id: "w_c2",
      }),
    ]);
    const okCount = [c1, c2].filter((r) => r.ok).length;
    assert.equal(okCount, 1, "only one page claim may succeed");
    const loser = c1.ok ? c2 : c1;
    assert.ok(
      !loser.ok &&
        (loser.code === "already_claimed" ||
          loser.code === "stale_page" ||
          loser.code === "conflict"),
    );
    console.log("2 ok — Claim×Claim");
  }

  // --- 3. Lease expiry × Commit ---
  {
    await cleanup();
    const { report_id, gen } = await boot("lease_commit");
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
      input_fingerprint: "fp_lease",
      upstream_output_fingerprints: {},
      worker_id: "w_lease",
      lease_ms: 5,
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");
    await new Promise((r) => setTimeout(r, 25));
    const def = reportPageDefinition("01");
    const out = { page: "01" };
    const fp = hashCanonicalPayload(out);
    const late = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp_lease",
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
    assert.equal(late.ok, false);
    assert.ok(
      !late.ok &&
        (late.code === "lease_expired" ||
          late.code === "stale_attempt" ||
          late.code === "conflict"),
    );
    console.log("3 ok — Lease expiry×Commit");
  }

  // --- 4. Commit × Invalidation (barrier) ---
  {
    await cleanup();
    const { report_id, gen } = await boot("commit_x_inv");
    const page_id: ReportPageId = "01";
    const def = reportPageDefinition(page_id);
    const input_fingerprint = "fp_commit_inv";
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
      input_fingerprint,
      upstream_output_fingerprints: {},
      worker_id: "w_commit_inv",
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("claim");
    const out = { page: "01", race: true };
    const fp = hashCanonicalPayload(out);
    const commitP = commitPageResult({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id,
        attempt_id: claimed.value.attempt_id,
        task_key: claimed.value.task_key,
        output: out,
        output_fingerprint: fp,
        state_patch: { outcome: "completed", input_fingerprint },
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
          attempt_id: claimed.value.attempt_id,
          task_key: claimed.value.task_key,
          validity_rev: claimed.value.validity_rev,
        },
    });
    const invP = invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "redis_commit_inv",
    });
    const [commitR, invR] = await Promise.all([commitP, invP]);
    assert.ok(
      (commitR.ok && !invR.ok) || (!commitR.ok && invR.ok),
      `commit=${JSON.stringify(commitR)} inv=${JSON.stringify(invR)}`,
    );
    console.log("4 ok — Commit×Invalidation");
  }

  // --- 5. Invalidation × Finalization ---
  {
    await cleanup();
    const { report_id, gen } = await boot("inv_x_fin");
    await claimCommit01({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
    });
    await buildMinimalBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const bindings = await buildMinimalBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    let release!: () => void;
    const barrier = new Promise<void>((res) => {
      release = res;
    });
    let claimReady = false;
    let invReady = false;
    setBeforeClaimAtomicHookForTests(async () => {
      claimReady = true;
      if (invReady) release();
      await barrier;
    });
    setBeforeInvalidateAtomicHookForTests(async () => {
      invReady = true;
      if (claimReady) release();
      await barrier;
    });
    const claimP = claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    const invP = invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "redis_inv_fin",
    });
    const [claimR, invR] = await Promise.all([claimP, invP]);
    setBeforeClaimAtomicHookForTests(null);
    setBeforeInvalidateAtomicHookForTests(null);
    assert.ok(
      (claimR.ok && !invR.ok) || (!claimR.ok && invR.ok),
      JSON.stringify({ claimR, invR }),
    );
    console.log("5 ok — Invalidation×Finalization");
  }

  // --- 6. Finalization × Activation ---
  {
    await cleanup();
    const { report_id, gen } = await boot("fin_x_act");
    const bindings = await buildMinimalBindings(
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
    const gNext = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "gen_after_seal",
    });
    assert.ok(gNext.ok);
    if (!gNext.ok) throw new Error("gNext");
    const blocked = await activateGeneration({
      record: gNext.value,
      job_id: report_id,
    });
    assert.equal(blocked.ok, false);
    assert.ok(
      !blocked.ok &&
        (blocked.code === "finalization_locked" || blocked.code === "conflict"),
    );
    console.log("6 ok — Finalization×Activation");
  }

  // --- 7. Cascade interrupt + Recovery ---
  {
    await cleanup();
    const { report_id, gen } = await boot("cascade_recovery");
    await claimCommit01({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
    });
    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "redis_cascade",
    });
    assert.ok(inv.ok);
    if (!inv.ok) throw new Error("inv");
    const cont = await continueCascadeOperation({
      report_id,
      generation_id: gen.generation_id,
      operation_id: inv.value.operation_id,
    });
    assert.ok(cont.ok);
    assert.equal(cont.value.cascade_status, inv.value.cascade_status);
    console.log("7 ok — Cascade interrupt + Recovery");
  }

  // --- 8. Outbox duplicate delivery ---
  {
    await cleanup();
    const { report_id, gen } = await boot("outbox_dup");
    const first = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      task_key: "tk_dup",
      payload: {
        report_id,
        generation_id: gen.generation_id,
        page_id: "01",
      },
    });
    assert.ok(first.ok);
    if (!first.ok) throw new Error("intent");
    const dup = await enqueueDispatchIntent({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id: "01",
      task_key: "tk_dup",
      payload: {
        report_id,
        generation_id: gen.generation_id,
        page_id: "01",
      },
    });
    assert.ok(dup.ok);
    assert.equal(dup.value.intent_id, first.value.intent_id);
    const sent1 = await markIntentSent(first.value);
    const sent2 = await markIntentSent(dup.value);
    assert.ok(sent1.ok && sent2.ok);
    assert.equal(sent1.value.intent_id, sent2.value.intent_id);
    console.log("8 ok — Outbox duplicate delivery");
  }

  // --- 9. Finalization Delivery interrupt + Recovery ---
  {
    await cleanup();
    const { report_id, gen } = await boot("delivery_recovery");
    const bindings = await buildMinimalBindings(
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
    await markFinalizationDelivering(report_id, gen.generation_id);
    await markFinalizationDeliveryFailed(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      "simulated_transport",
    );
    const claim = await readFinalizationClaim(report_id, gen.generation_id);
    assert.equal(claim.value?.status, "delivery_failed");
    const resume = await markFinalizationDelivering(report_id, gen.generation_id);
    assert.ok(resume.ok);
    const done = await markFinalizationDelivered(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.ok(done.ok);
    assert.equal(done.value.status, "delivered");
    console.log("9 ok — Finalization Delivery interrupt + Recovery");
  }

  await cleanup();
  console.log("REDIS_INTEGRATION: PASS");
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exitCode = 1;
});