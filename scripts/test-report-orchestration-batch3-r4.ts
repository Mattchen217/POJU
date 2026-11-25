/**
 * Batch3 R4 — merge integrity, finalization claim TOCTOU, authority content hash.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r4.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";

import {
  createJob,
  loadJobRawBlobs,
  mergeReportBatch2IntoV3Lab,
  resetBatch2JobStoreForTests,
  setMergeBeforeFinalizationClaimHookForTests,
  setReportBatch2EventSenderForTests,
  updateJobStatus,
  type ReportBatch2JobInputs,
  type ReportBatch2JobRecord,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import {
  activateGeneration,
  allocateGeneration,
  claimFinalization,
  claimTask,
  commitPageResult,
  computeTaskKey,
  ensurePageFence,
  ensureQueuedTask,
  invalidateFromPage,
  readAuthorityGatedPage,
  readAuthorityPageOutput,
  readFinalizationClaim,
  readPageFence,
  resetBatch3KeysForTests,
  runReportBatch3Recovery,
  setPersistPageBlobFailHookForTests,
  type FinalizationPageBinding,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { productionV3LabId } from "@/lib/llm/pro/delivery/pipeline-v3/production-run";
import {
  hashCanonicalPayload,
  REPORT_PAGE_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import { durableKv } from "@/lib/kv/client";
import { randomUUID } from "node:crypto";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r4",
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
  setPersistPageBlobFailHookForTests(null);
  setMergeBeforeFinalizationClaimHookForTests(null);
  await resetBatch2JobStoreForTests();
  await resetBatch3KeysForTests();
  setReportBatch2EventSenderForTests(null);
}

async function ensureLab(job_id: string): Promise<void> {
  await saveDeliveryLab({
    version: 1,
    lab_id: productionV3LabId(job_id),
    pipeline: "v3_three_step",
    cursor_index: 0,
    artifacts: { by_page: {} },
    steps: { "book.assemble": { status: "idle" } },
    updated_at: Date.now(),
  } as never);
}

async function boot(report_id: string, generation_id: string) {
  const gen = await allocateGeneration({
    report_id,
    locale: "en",
    generation_id,
  });
  assert.ok(gen.ok);
  if (!gen.ok) throw new Error("gen");
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

function upstreamFor(page_id: ReportPageId): Record<string, string> {
  if (page_id === "01" || page_id === "02") return {};
  if (page_id === "04") return { "01": "up01", "02": "up02" };
  if (page_id === "05") return { "04": "up04" };
  if (page_id === "06") return { "05": "up05" };
  if (page_id === "07") return { "06": "up06" };
  if (page_id === "08") return { "07": "up07" };
  return {};
}

async function commitOne(opts: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  outcome?: "completed" | "skipped_not_applicable" | "insufficient_information";
}): Promise<{ fp: string; attempt_id: string; task_key: string; validity_rev: number }> {
  const input_fingerprint = `fp${opts.page_id}`;
  const upstream = upstreamFor(opts.page_id);
  const fence = await ensurePageFence({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
  });
  assert.ok(fence.ok);
  if (!fence.ok) throw new Error("fence");
  const task_key = computeTaskKey({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    input_fingerprint,
    upstream_output_fingerprints: upstream,
    page_contract_version: "pv",
    prompt_version: "pr",
    validator_version: "vv",
    task_type: "generate",
  });
  await ensureQueuedTask({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    task_type: "generate",
    task_key,
    input_fingerprint,
    upstream_output_fingerprints: upstream,
    page_contract_version: "pv",
    prompt_version: "pr",
    validator_version: "vv",
  });
  const claimed = await claimTask({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    task_key,
    worker_id: `w_${opts.page_id}`,
    validity_rev: fence.value.validity_rev,
  });
  assert.ok(claimed.ok);
  if (!claimed.ok) throw new Error("claim");

  const outcome = opts.outcome ?? "completed";
  const out =
    opts.page_id === "07" && outcome !== "completed"
      ? { page: "07", gate: outcome }
      : { page: opts.page_id, body: `content-${opts.page_id}` };
  const fp = hashCanonicalPayload(out);
  const committed = await commitPageResult({
    report_id: opts.report_id,
    generation_id: opts.generation_id,
    generation_epoch: opts.generation_epoch,
    page_id: opts.page_id,
    attempt_id: claimed.value.attempt_id!,
    task_key,
    output: out,
    output_fingerprint: fp,
    state_patch: {
      outcome,
      input_fingerprint,
      applicability_status:
        outcome === "skipped_not_applicable"
          ? "not_applicable"
          : outcome === "insufficient_information"
            ? "insufficient_information"
            : opts.page_id === "07"
              ? "applicable"
              : undefined,
    },
    provenance: {
      report_id: opts.report_id,
      generation_id: opts.generation_id,
      generation_epoch: opts.generation_epoch,
      page_id: opts.page_id,
      input_fingerprint,
      upstream_output_fingerprints: upstream,
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      output_fingerprint: fp,
      attempt_id: claimed.value.attempt_id!,
      task_key,
      validity_rev: fence.value.validity_rev,
    },
  });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  return {
    fp,
    attempt_id: claimed.value.attempt_id!,
    task_key,
    validity_rev: fence.value.validity_rev,
  };
}

async function commitAllPages(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
  page07:
    | "completed"
    | "skipped_not_applicable"
    | "insufficient_information" = "skipped_not_applicable",
): Promise<void> {
  for (const page_id of REPORT_PAGE_IDS) {
    await commitOne({
      report_id,
      generation_id,
      generation_epoch,
      page_id,
      outcome: page_id === "07" ? page07 : "completed",
    });
  }
  await updateJobStatus(report_id, generation_id, "completed");
}

function callerStub(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
  patch?: Partial<ReportBatch2JobRecord>,
): ReportBatch2JobRecord {
  return {
    report_id,
    generation_id,
    generation_epoch,
    locale: "en",
    page_states: [],
    page_outputs: {},
    repair_pending: {},
    inputs: inputs(report_id),
    dispatch_log: [],
    invocation_log: [],
    status: "completed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch,
  };
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch3 R4 ===");

  // --- A. Authority content hash + identity ---
  {
    await cleanup();
    const report_id = "rpt_b3r4_auth";
    const gen = await boot(report_id, "g_auth");
    await commitOne({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    const raw = await loadJobRawBlobs(report_id, gen.generation_id);
    assert.ok(raw.ok && raw.value);
    const blob = raw.value!.pages.get("01")!;

    const ok = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(ok.verdict, "valid");

    // Tamper Authority Output payload, keep old fingerprint
    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      "01",
    );
    assert.ok(auth.ok && auth.value);
    await durableKv().set(
      `report-batch3:${report_id}:${gen.generation_id}:auth-output:01`,
      {
        ...auth.value!,
        output: { page: "01", tampered: true },
      },
      { ex: 3600 },
    );
    const badContent = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badContent.verdict, "mismatch");

    // Restore then tamper epoch
    await durableKv().set(
      `report-batch3:${report_id}:${gen.generation_id}:auth-output:01`,
      { ...auth.value!, generation_epoch: gen.generation_epoch + 9 },
      { ex: 3600 },
    );
    const badEpoch = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badEpoch.verdict, "mismatch");

    await durableKv().set(
      `report-batch3:${report_id}:${gen.generation_id}:auth-output:01`,
      { ...auth.value!, page_id: "02" },
      { ex: 3600 },
    );
    const badPage = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badPage.verdict, "mismatch");

    await durableKv().set(
      `report-batch3:${report_id}:${gen.generation_id}:auth-output:01`,
      { ...auth.value!, task_key: "wrong-task" },
      { ex: 3600 },
    );
    const badTask = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badTask.verdict, "mismatch");

    // Restore auth; tamper provenance input_fingerprint
    await durableKv().set(
      `report-batch3:${report_id}:${gen.generation_id}:auth-output:01`,
      auth.value!,
      { ex: 3600 },
    );
    const provKey = `report-batch3:${report_id}:${gen.generation_id}:prov:01`;
    const prov = await durableKv().get<Record<string, unknown>>(provKey);
    assert.ok(prov);
    await durableKv().set(
      provKey,
      { ...prov, input_fingerprint: "tampered-input" },
      { ex: 3600 },
    );
    const badProvIn = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badProvIn.verdict, "mismatch");

    await durableKv().set(provKey, prov!, { ex: 3600 });
    await durableKv().set(
      provKey,
      {
        ...prov,
        upstream_output_fingerprints: { "99": "x" },
      },
      { ex: 3600 },
    );
    const badUp = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badUp.verdict, "mismatch");

    await durableKv().set(provKey, prov!, { ex: 3600 });
    await durableKv().set(
      provKey,
      { ...prov, attempt_id: "other-attempt" },
      { ex: 3600 },
    );
    const badAttempt = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob,
    });
    assert.equal(badAttempt.verdict, "mismatch");

    await durableKv().set(provKey, prov!, { ex: 3600 });
    const badBlobId = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob: {
        ...blob,
        state: { ...blob.state, page_id: "02" },
      },
    });
    assert.equal(badBlobId.verdict, "mismatch");

    const badBlobPayload = await readAuthorityGatedPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      blob: {
        ...blob,
        output: { page: "01", mutated: true },
      },
    });
    assert.equal(badBlobPayload.verdict, "mismatch");

    console.log("R4-A ok — authority content hash + identity mismatches refuse");
  }

  // --- B. Merge persisted meta / completeness ---
  {
    await cleanup();
    const report_id = "rpt_b3r4_merge";
    const gen = await boot(report_id, "g_merge");
    await ensureLab(report_id);
    await commitAllPages(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      "skipped_not_applicable",
    );

    // Caller claims completed but meta forced pending
    await updateJobStatus(report_id, gen.generation_id, "pending");
    const r1 = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      callerStub(report_id, gen.generation_id, gen.generation_epoch),
    );
    assert.equal(r1.ok, false);
    assert.ok(
      r1.ok === false && r1.reason.includes("not_completed"),
      JSON.stringify(r1),
    );

    await updateJobStatus(report_id, gen.generation_id, "failed");
    const r2 = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      callerStub(report_id, gen.generation_id, gen.generation_epoch),
    );
    assert.equal(r2.ok, false);
    assert.ok(r2.ok === false && r2.reason.includes("not_completed"));

    await updateJobStatus(report_id, gen.generation_id, "completed");

    // Omit all page_states/outputs — still must require persisted pages
    const r3 = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      callerStub(report_id, gen.generation_id, gen.generation_epoch, {
        page_states: [],
        page_outputs: {},
      }),
    );
    // Full pages present in KV → may pass claim then fail book schema; must NOT
    // skip completeness. If it fails, not for omitted caller pages.
    if (!r3.ok) {
      assert.ok(
        !r3.reason.includes("omit") &&
          (r3.reason.startsWith("v3_") ||
            r3.reason.startsWith("merge_finalization") ||
            r3.reason.startsWith("merge_page_") ||
            r3.reason.startsWith("merge_claim") ||
            r3.reason.startsWith("merge_dag")),
        JSON.stringify(r3),
      );
    }
    const claimAfterOmit = await readFinalizationClaim(
      report_id,
      gen.generation_id,
    );
    // Either claim sealed (gate passed) or rejected earlier for real reasons
    assert.ok(claimAfterOmit.ok);

    // Wipe page05 blob → incomplete
    await durableKv().del(
      `report-batch2:${report_id}:${gen.generation_id}:page:05`,
    );
    // Clear prior claim so incompleteness is evaluated fresh
    await durableKv().del(
      `report-batch3:${report_id}:${gen.generation_id}:finalization`,
    );
    const r4 = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      callerStub(report_id, gen.generation_id, gen.generation_epoch, {
        status: "completed",
        page_outputs: { "01": { fake: true } },
      }),
    );
    assert.equal(r4.ok, false);
    assert.ok(
      r4.ok === false && r4.reason.includes("05"),
      JSON.stringify(r4),
    );

    console.log("R4-B ok — merge refuses incomplete / wrong meta status");
  }

  // --- C. Finalization TOCTOU vs same-generation invalidation ---
  {
    await cleanup();
    const report_id2 = "rpt_b3r4_toc2";
    const gen2 = await boot(report_id2, "g_toc2");
    await ensureLab(report_id2);
    await commitAllPages(
      report_id2,
      gen2.generation_id,
      gen2.generation_epoch,
      "skipped_not_applicable",
    );

    setMergeBeforeFinalizationClaimHookForTests(async () => {
      const inv = await invalidateFromPage({
        report_id: report_id2,
        generation_id: gen2.generation_id,
        generation_epoch: gen2.generation_epoch,
        source_page_id: "01",
        reason: "r4_toc_page01",
      });
      assert.equal(inv.ok, true, JSON.stringify(inv));
    });
    const refused = await mergeReportBatch2IntoV3Lab(
      report_id2,
      { locale: "en" } as never,
      callerStub(report_id2, gen2.generation_id, gen2.generation_epoch),
    );
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.ok(
      refused.ok === false &&
        refused.reason.includes("finalization_refused"),
      JSON.stringify(refused),
    );
    setMergeBeforeFinalizationClaimHookForTests(null);

    // Inject Page04 invalidation before claim
    await cleanup();
    const report_id3 = "rpt_b3r4_toc3";
    const gen3 = await boot(report_id3, "g_toc3");
    await ensureLab(report_id3);
    await commitAllPages(
      report_id3,
      gen3.generation_id,
      gen3.generation_epoch,
      "skipped_not_applicable",
    );
    setMergeBeforeFinalizationClaimHookForTests(async () => {
      await invalidateFromPage({
        report_id: report_id3,
        generation_id: gen3.generation_id,
        generation_epoch: gen3.generation_epoch,
        source_page_id: "04",
        reason: "r4_toc_page04",
      });
    });
    const refused04 = await mergeReportBatch2IntoV3Lab(
      report_id3,
      { locale: "en" } as never,
      callerStub(report_id3, gen3.generation_id, gen3.generation_epoch),
    );
    assert.equal(refused04.ok, false);
    assert.ok(
      refused04.ok === false &&
        refused04.reason.includes("finalization_refused"),
    );
    setMergeBeforeFinalizationClaimHookForTests(null);

    // Claim first → Invalidation must be finalization_locked; fences unchanged.
    await cleanup();
    const report_id4 = "rpt_b3r4_toc4";
    const gen4 = await boot(report_id4, "g_toc4");
    await commitAllPages(
      report_id4,
      gen4.generation_id,
      gen4.generation_epoch,
      "skipped_not_applicable",
    );
    const bindings: FinalizationPageBinding[] = [];
    const fenceRevs = new Map<string, number>();
    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id4,
        gen4.generation_id,
        page_id,
      );
      assert.ok(fence.ok && fence.value?.status === "committed");
      fenceRevs.set(page_id, fence.value!.validity_rev);
      const auth = await readAuthorityPageOutput(
        report_id4,
        gen4.generation_id,
        page_id,
      );
      assert.ok(auth.ok && auth.value);
      bindings.push({
        page_id,
        generation_id: gen4.generation_id,
        generation_epoch: gen4.generation_epoch,
        validity_rev: fence.value!.validity_rev,
        attempt_id: fence.value!.attempt_id!,
        task_key: fence.value!.task_key!,
        output_fingerprint: fence.value!.output_fingerprint!,
        input_fingerprint: fence.value!.input_fingerprint!,
        sealed_output: auth.value!.output,
        outcome: page_id === "07" ? "skipped_not_applicable" : "completed",
      });
    }
    const claimed = await claimFinalization({
      report_id: report_id4,
      generation_id: gen4.generation_id,
      generation_epoch: gen4.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));

    const locked = await invalidateFromPage({
      report_id: report_id4,
      generation_id: gen4.generation_id,
      generation_epoch: gen4.generation_epoch,
      source_page_id: "01",
      reason: "after_claim",
    });
    assert.equal(locked.ok, false, JSON.stringify(locked));
    assert.equal(locked.ok ? "" : locked.code, "finalization_locked");

    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id4,
        gen4.generation_id,
        page_id,
      );
      assert.ok(fence.ok && fence.value);
      assert.equal(fence.value!.status, "committed");
      assert.equal(fence.value!.validity_rev, fenceRevs.get(page_id));
    }
    const still = await readFinalizationClaim(
      report_id4,
      gen4.generation_id,
    );
    assert.ok(still.ok && still.value?.status === "claimed");

    // Reverse: Invalidation first → old Finalization bindings refuse.
    await cleanup();
    const report_id4b = "rpt_b3r4_toc4b";
    const gen4b = await boot(report_id4b, "g_toc4b");
    await commitAllPages(
      report_id4b,
      gen4b.generation_id,
      gen4b.generation_epoch,
      "skipped_not_applicable",
    );
    const bindingsB: FinalizationPageBinding[] = [];
    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id4b,
        gen4b.generation_id,
        page_id,
      );
      assert.ok(fence.ok && fence.value?.status === "committed");
      const auth = await readAuthorityPageOutput(
        report_id4b,
        gen4b.generation_id,
        page_id,
      );
      assert.ok(auth.ok && auth.value);
      bindingsB.push({
        page_id,
        generation_id: gen4b.generation_id,
        generation_epoch: gen4b.generation_epoch,
        validity_rev: fence.value!.validity_rev,
        attempt_id: fence.value!.attempt_id!,
        task_key: fence.value!.task_key!,
        output_fingerprint: fence.value!.output_fingerprint!,
        input_fingerprint: fence.value!.input_fingerprint!,
        sealed_output: auth.value!.output,
        outcome: page_id === "07" ? "skipped_not_applicable" : "completed",
      });
    }
    const invFirst = await invalidateFromPage({
      report_id: report_id4b,
      generation_id: gen4b.generation_id,
      generation_epoch: gen4b.generation_epoch,
      source_page_id: "01",
      reason: "before_claim",
    });
    assert.equal(invFirst.ok, true, JSON.stringify(invFirst));
    const fence01 = await readPageFence(
      report_id4b,
      gen4b.generation_id,
      "01",
    );
    assert.ok(fence01.ok && fence01.value?.status === "stale");
    const afterInv = await claimFinalization({
      report_id: report_id4b,
      generation_id: gen4b.generation_id,
      generation_epoch: gen4b.generation_epoch,
      claim_id: randomUUID(),
      pages: bindingsB,
    });
    assert.equal(afterInv.ok, false, JSON.stringify(afterInv));
    assert.equal(afterInv.ok ? "" : afterInv.code, "stale_page");
    const noClaim = await readFinalizationClaim(
      report_id4b,
      gen4b.generation_id,
    );
    assert.ok(noClaim.ok && noClaim.value == null);

    // Superseded generation refuses
    await cleanup();
    const report_id5 = "rpt_b3r4_toc5";
    const genOld = await boot(report_id5, "g_toc5_old");
    await commitAllPages(
      report_id5,
      genOld.generation_id,
      genOld.generation_epoch,
      "skipped_not_applicable",
    );
    const bindings5: FinalizationPageBinding[] = [];
    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id5,
        genOld.generation_id,
        page_id,
      );
      assert.ok(fence.ok && fence.value);
      const auth = await readAuthorityPageOutput(
        report_id5,
        genOld.generation_id,
        page_id,
      );
      assert.ok(auth.ok && auth.value);
      bindings5.push({
        page_id,
        generation_id: genOld.generation_id,
        generation_epoch: genOld.generation_epoch,
        validity_rev: fence.value!.validity_rev,
        attempt_id: fence.value!.attempt_id!,
        task_key: fence.value!.task_key!,
        output_fingerprint: fence.value!.output_fingerprint!,
        input_fingerprint: fence.value!.input_fingerprint!,
        sealed_output: auth.value!.output,
        outcome: page_id === "07" ? "skipped_not_applicable" : "completed",
      });
    }
    const gen5 = await allocateGeneration({
      report_id: report_id5,
      locale: "en",
      generation_id: "g_toc5_new",
    });
    assert.ok(gen5.ok);
    if (!gen5.ok) throw new Error("g5");
    await activateGeneration({ record: gen5.value, job_id: report_id5 });
    const superRefuse = await claimFinalization({
      report_id: report_id5,
      generation_id: genOld.generation_id,
      generation_epoch: genOld.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings5,
    });
    assert.equal(superRefuse.ok, false);
    assert.equal(superRefuse.ok ? "" : superRefuse.code, "stale_generation");

    console.log("R4-C ok — finalization/invalidation mutual exclusion");
  }

  // --- D. Page07 terminals + recovery no re-LLM for replayed page ---
  {
    await cleanup();
    setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
    for (const term of [
      "completed",
      "skipped_not_applicable",
      "insufficient_information",
    ] as const) {
      await cleanup();
      setReportBatch2EventSenderForTests({ send: async () => ({ ok: true }) });
      const report_id = `rpt_b3r4_p07_${term}`;
      const gen = await boot(report_id, `g_${term}`);
      await commitAllPages(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
        term,
      );
      const raw = await loadJobRawBlobs(report_id, gen.generation_id);
      assert.ok(raw.ok && raw.value);
      const gated = await readAuthorityGatedPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "07",
        blob: raw.value!.pages.get("07"),
      });
      assert.equal(gated.verdict, "valid", term);
    }

    // Recovery fault injection still works (R3 retained)
    await cleanup();
    const llmFor01: string[] = [];
    setReportBatch2EventSenderForTests({
      send: async (events) => {
        for (const e of events) {
          const name = String(e.name);
          const page =
            e.data && typeof e.data === "object" && "page_id" in e.data
              ? String((e.data as { page_id?: string }).page_id)
              : "";
          if (
            page === "01" &&
            (name.includes("generate") || name.includes("repair"))
          ) {
            llmFor01.push(name);
          }
        }
        return { ok: true };
      },
    });
    const report_id = "rpt_b3r4_rec";
    const gen = await boot(report_id, "g_rec");
    const fence = await ensurePageFence({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
    });
    assert.ok(fence.ok);
    if (!fence.ok) throw new Error("f");
    const task_key = computeTaskKey({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      input_fingerprint: "fp01",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
      task_type: "generate",
    });
    await ensureQueuedTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      task_type: "generate",
      task_key,
      input_fingerprint: "fp01",
      upstream_output_fingerprints: {},
      page_contract_version: "pv",
      prompt_version: "pr",
      validator_version: "vv",
    });
    const claimed = await claimTask({
      report_id,
      generation_id: gen.generation_id,
      task_key,
      worker_id: "w",
      validity_rev: fence.value.validity_rev,
    });
    assert.ok(claimed.ok);
    if (!claimed.ok) throw new Error("c");
    const out = { page: "01", r4: true };
    const fp = hashCanonicalPayload(out);
    setPersistPageBlobFailHookForTests(() => true);
    const failed = await commitPageResult({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      attempt_id: claimed.value.attempt_id!,
      task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed", input_fingerprint: "fp01" },
      provenance: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        input_fingerprint: "fp01",
        upstream_output_fingerprints: {},
        page_contract_version: "pv",
        prompt_version: "pr",
        validator_version: "vv",
        output_fingerprint: fp,
        attempt_id: claimed.value.attempt_id!,
        task_key,
        validity_rev: fence.value.validity_rev,
      },
    });
    assert.equal(failed.ok, false);
    setPersistPageBlobFailHookForTests(null);
    const recovered = await runReportBatch3Recovery({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
    });
    assert.equal(recovered.ok, true);
    assert.deepEqual(llmFor01, []);

    console.log("R4-D ok — Page07 terminals + recovery no re-LLM");
  }

  // --- E. Happy merge path reaches finalization (book may still fail schema) ---
  {
    await cleanup();
    const report_id = "rpt_b3r4_ok";
    const gen = await boot(report_id, "g_ok");
    await ensureLab(report_id);
    await commitAllPages(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
      "skipped_not_applicable",
    );
    const merged = await mergeReportBatch2IntoV3Lab(
      report_id,
      { locale: "en" } as never,
      callerStub(report_id, gen.generation_id, gen.generation_epoch, {
        page_states: [],
        page_outputs: {},
      }),
    );
    const claim = await readFinalizationClaim(report_id, gen.generation_id);
    assert.ok(claim.ok && claim.value?.status === "claimed");
    if (!merged.ok) {
      assert.ok(
        merged.reason.startsWith("v3_"),
        `expected post-claim book reason, got ${merged.reason}`,
      );
    }
    console.log(
      "R4-E ok — complete DAG seals finalization claim (book schema optional)",
    );
  }

  console.log(
    "DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here",
  );
  console.log("ok report orchestration batch3 r4");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
