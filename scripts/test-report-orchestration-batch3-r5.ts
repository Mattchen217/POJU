/**
 * Batch3 R5 — Finalization / Invalidation atomic mutual exclusion.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r5.ts
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createJob,
  resetBatch2JobStoreForTests,
  setReportBatch2EventSenderForTests,
  updateJobStatus,
  type ReportBatch2JobInputs,
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
  invalidatePageAuthority,
  readAuthorityPageOutput,
  readFinalizationClaim,
  readPageFence,
  resetBatch3KeysForTests,
  setBeforeClaimAtomicHookForTests,
  setBeforeInvalidateAtomicHookForTests,
  type FinalizationPageBinding,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import { readPageProvenance } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/provenance";
import {
  hashCanonicalPayload,
  REPORT_PAGE_IDS,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import { durableKv } from "@/lib/kv/client";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r5",
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
}): Promise<void> {
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
  const outcome =
    opts.page_id === "07" ? "skipped_not_applicable" : "completed";
  const out =
    opts.page_id === "07"
      ? { page: "07", gate: outcome }
      : { page: opts.page_id, body: `c-${opts.page_id}` };
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
        opts.page_id === "07" ? "not_applicable" : undefined,
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
}

async function commitAll(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<void> {
  for (const page_id of REPORT_PAGE_IDS) {
    await commitOne({
      report_id,
      generation_id,
      generation_epoch,
      page_id,
    });
  }
  await updateJobStatus(report_id, generation_id, "completed");
}

async function buildBindings(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<{
  bindings: FinalizationPageBinding[];
  fenceRevs: Map<string, number>;
}> {
  const bindings: FinalizationPageBinding[] = [];
  const fenceRevs = new Map<string, number>();
  for (const page_id of REPORT_PAGE_IDS) {
    const fence = await readPageFence(report_id, generation_id, page_id);
    assert.ok(fence.ok && fence.value?.status === "committed");
    fenceRevs.set(page_id, fence.value!.validity_rev);
    const auth = await readAuthorityPageOutput(
      report_id,
      generation_id,
      page_id,
    );
    assert.ok(auth.ok && auth.value);
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
      outcome: page_id === "07" ? "skipped_not_applicable" : "completed",
    });
  }
  return { bindings, fenceRevs };
}

async function main(): Promise<void> {
  console.log("=== Report orchestration Batch3 R5 ===");

  // --- A. Finalization first → Invalidation locked ---
  {
    await cleanup();
    const report_id = "rpt_b3r5_a";
    const gen = await boot(report_id, "g_a");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings, fenceRevs } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const claim_id = randomUUID();
    const claimed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id,
      pages: bindings,
    });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));

    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "r5_a",
    });
    assert.equal(inv.ok, false);
    assert.equal(inv.ok ? "" : inv.code, "finalization_locked");

    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id,
        gen.generation_id,
        page_id,
      );
      assert.ok(fence.ok && fence.value);
      assert.equal(fence.value!.status, "committed");
      assert.equal(fence.value!.validity_rev, fenceRevs.get(page_id));
      const prov = await readPageProvenance(
        report_id,
        gen.generation_id,
        page_id,
      );
      assert.ok(prov.ok && prov.value && prov.value.stale === false);
    }
    const still = await readFinalizationClaim(report_id, gen.generation_id);
    assert.ok(still.ok && still.value?.status === "claimed");

    // Idempotent same claim_id
    const again = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id,
      pages: bindings,
    });
    assert.equal(again.ok, true, JSON.stringify(again));

    console.log("R5-A ok — finalization first locks invalidation");
  }

  // --- B. Invalidation first → Finalization refuses ---
  {
    await cleanup();
    const report_id = "rpt_b3r5_b";
    const gen = await boot(report_id, "g_b");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const inv = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "04",
      reason: "r5_b",
    });
    assert.equal(inv.ok, true, JSON.stringify(inv));
    const fence04 = await readPageFence(
      report_id,
      gen.generation_id,
      "04",
    );
    assert.ok(fence04.ok && fence04.value?.status === "stale");

    const claimed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(claimed.ok, false);
    assert.equal(claimed.ok ? "" : claimed.code, "stale_page");
    const noClaim = await readFinalizationClaim(report_id, gen.generation_id);
    assert.ok(noClaim.ok && noClaim.value == null);

    console.log("R5-B ok — invalidation first blocks old finalization");
  }

  // --- C. True barrier race: both ops reach pre-atomic hook before either runs ---
  // (Ordered A/B tests stay separate; this must NOT be Promise.all without barrier.)
  {
    let bothSucceeded = 0;
    let claimWins = 0;
    let invWins = 0;
    let bothFailed = 0;

    for (let i = 0; i < 40; i++) {
      await cleanup();
      const report_id = `rpt_b3r5_c_${i}`;
      const gen = await boot(report_id, `g_c_${i}`);
      await commitAll(report_id, gen.generation_id, gen.generation_epoch);
      const { bindings, fenceRevs } = await buildBindings(
        report_id,
        gen.generation_id,
        gen.generation_epoch,
      );
      const fence01Before = fenceRevs.get("01")!;

      let claimArrived = false;
      let invArrived = false;
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const arrived = {
        claim: null as null | (() => void),
        inv: null as null | (() => void),
      };
      const bothArrived = new Promise<void>((resolve) => {
        const check = () => {
          if (claimArrived && invArrived) resolve();
        };
        arrived.claim = () => {
          claimArrived = true;
          check();
        };
        arrived.inv = () => {
          invArrived = true;
          check();
        };
      });

      setBeforeClaimAtomicHookForTests(async () => {
        arrived.claim!();
        await gate;
      });
      setBeforeInvalidateAtomicHookForTests(async () => {
        arrived.inv!();
        await gate;
      });

      try {
        // Alternate which op starts first so gate waiters resume in both orders.
        // Both must still arrive at the barrier before either enters runMemoryAtomic.
        let claimP: ReturnType<typeof claimFinalization>;
        let invP: ReturnType<typeof invalidatePageAuthority>;
        if (i % 2 === 0) {
          claimP = claimFinalization({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            claim_id: randomUUID(),
            pages: bindings,
          });
          invP = invalidatePageAuthority({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "01",
            reason: `r5_c_${i}`,
          });
        } else {
          invP = invalidatePageAuthority({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            page_id: "01",
            reason: `r5_c_${i}`,
          });
          claimP = claimFinalization({
            report_id,
            generation_id: gen.generation_id,
            generation_epoch: gen.generation_epoch,
            claim_id: randomUUID(),
            pages: bindings,
          });
        }

        await bothArrived;
        assert.equal(claimArrived, true);
        assert.equal(invArrived, true);

        // Confirm neither finished before release (still pending at barrier).
        let claimSettledEarly = false;
        let invSettledEarly = false;
        void claimP.then(
          () => {
            claimSettledEarly = true;
          },
          () => {
            claimSettledEarly = true;
          },
        );
        void invP.then(
          () => {
            invSettledEarly = true;
          },
          () => {
            invSettledEarly = true;
          },
        );
        await Promise.resolve();
        assert.equal(
          claimSettledEarly,
          false,
          "claim must not finish before barrier release",
        );
        assert.equal(
          invSettledEarly,
          false,
          "invalidate must not finish before barrier release",
        );

        // Simultaneous release — both already started; MemoryKv serializes atomics.
        release();
        const [claimR, invR] = await Promise.all([claimP, invP]);

        if (claimR.ok && invR.ok) bothSucceeded += 1;
        else if (claimR.ok && !invR.ok) {
          claimWins += 1;
          assert.equal(invR.ok ? "" : invR.code, "finalization_locked");
          const still = await readFinalizationClaim(
            report_id,
            gen.generation_id,
          );
          assert.ok(still.ok && still.value?.status === "claimed");
          const fence = await readPageFence(
            report_id,
            gen.generation_id,
            "01",
          );
          assert.equal(fence.value!.status, "committed");
          assert.equal(fence.value!.validity_rev, fence01Before);
          const prov = await readPageProvenance(
            report_id,
            gen.generation_id,
            "01",
          );
          assert.ok(prov.ok && prov.value && prov.value.stale !== true);
        } else if (!claimR.ok && invR.ok) {
          invWins += 1;
          assert.equal(claimR.ok ? "" : claimR.code, "stale_page");
          const noClaim = await readFinalizationClaim(
            report_id,
            gen.generation_id,
          );
          assert.ok(noClaim.ok && noClaim.value == null);
          const fence = await readPageFence(
            report_id,
            gen.generation_id,
            "01",
          );
          assert.equal(fence.value!.status, "stale");
          assert.ok((fence.value!.validity_rev ?? 0) > fence01Before);
          const prov = await readPageProvenance(
            report_id,
            gen.generation_id,
            "01",
          );
          assert.ok(prov.ok && prov.value?.stale === true);
        } else {
          bothFailed += 1;
          assert.fail(
            `both failed i=${i} claim=${JSON.stringify(claimR)} inv=${JSON.stringify(invR)}`,
          );
        }
      } finally {
        setBeforeClaimAtomicHookForTests(null);
        setBeforeInvalidateAtomicHookForTests(null);
      }
    }
    assert.equal(bothSucceeded, 0, "claim and invalidate must never both succeed");
    assert.equal(bothFailed, 0, "both-fail must not be treated as mutex success");
    assert.ok(claimWins > 0, "claim should win some barrier races");
    assert.ok(invWins > 0, "invalidate should win some barrier races");
    console.log(
      `R5-C ok — barrier races claimWins=${claimWins} invWins=${invWins} both=0`,
    );
  }

  // --- D. Cascade: claim blocks entire cascade; no partial fence bumps ---
  {
    await cleanup();
    const report_id = "rpt_b3r5_d";
    const gen = await boot(report_id, "g_d");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings, fenceRevs } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.equal(
      (
        await claimFinalization({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          claim_id: randomUUID(),
          pages: bindings,
        })
      ).ok,
      true,
    );

    const cascade = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "01",
      reason: "r5_d_cascade",
    });
    assert.equal(cascade.ok, false);
    assert.equal(cascade.ok ? "" : cascade.code, "finalization_locked");

    for (const page_id of REPORT_PAGE_IDS) {
      const fence = await readPageFence(
        report_id,
        gen.generation_id,
        page_id,
      );
      assert.equal(fence.value!.status, "committed");
      assert.equal(fence.value!.validity_rev, fenceRevs.get(page_id));
    }

    // Pre-claim cascade still works
    await durableKv().del(
      `report-batch3:${report_id}:${gen.generation_id}:finalization`,
    );
    const pre = await invalidateFromPage({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      source_page_id: "05",
      reason: "r5_d_pre",
    });
    assert.equal(pre.ok, true, JSON.stringify(pre));
    assert.ok(pre.ok && pre.value.invalidated.includes("05"));
    assert.ok(pre.ok && pre.value.invalidated.includes("06"));

    console.log("R5-D ok — cascade locked after claim; works before claim");
  }

  // --- E. Claim idempotent retry still validates fences ---
  {
    await cleanup();
    const report_id = "rpt_b3r5_e";
    const gen = await boot(report_id, "g_e");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const claim_id = randomUUID();
    assert.equal(
      (
        await claimFinalization({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          claim_id,
          pages: bindings,
        })
      ).ok,
      true,
    );

    // Same claim_id + same bindings → idempotent success
    const idemp = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id,
      pages: bindings,
    });
    assert.equal(idemp.ok, true);

    // Different claim_id + same bindings → also idempotent (same seal)
    const sameBind = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(sameBind.ok, true);

    // Different bindings → conflict (cannot overwrite)
    const bad = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings.map((b) =>
        b.page_id === "01" ? { ...b, validity_rev: b.validity_rev + 99 } : b,
      ),
    });
    assert.equal(bad.ok, false);
    // Either conflict (existing claim) or stale_page (fence check first)
    assert.ok(
      bad.ok === false &&
        (bad.code === "conflict" || bad.code === "stale_page"),
      JSON.stringify(bad),
    );

    console.log("R5-E ok — claim idempotency without bypass");
  }

  // --- F. Superseded generation ---
  {
    await cleanup();
    const report_id = "rpt_b3r5_f";
    const gen = await boot(report_id, "g_f_old");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const next = await allocateGeneration({
      report_id,
      locale: "en",
      generation_id: "g_f_new",
    });
    assert.ok(next.ok);
    if (!next.ok) throw new Error("next");
    await activateGeneration({ record: next.value, job_id: report_id });

    const claimed = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(claimed.ok, false);
    assert.equal(claimed.ok ? "" : claimed.code, "stale_generation");

    console.log("R5-F ok — superseded generation cannot claim");
  }

  // Single-page authority also respects lock
  {
    await cleanup();
    const report_id = "rpt_b3r5_page";
    const gen = await boot(report_id, "g_page");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    assert.equal(
      (
        await claimFinalization({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          claim_id: randomUUID(),
          pages: bindings,
        })
      ).ok,
      true,
    );
    const one = await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "08",
      reason: "r5_single",
    });
    assert.equal(one.ok, false);
    assert.equal(one.ok ? "" : one.code, "finalization_locked");
    console.log("R5-page ok — invalidatePageAuthority respects claim lock");
  }

  console.log(
    "DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here",
  );
  console.log("ok report orchestration batch3 r5");
}

main()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
