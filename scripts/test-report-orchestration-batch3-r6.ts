/**
 * Batch3 R6 — Atomic race proof, Claim fail-closed, Redis/Memory binding parity.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch3-r6.ts
 *
 * REDIS_LUA_NOTE: This process uses MemoryKv (no Upstash). Redis Lua is covered by
 * source-contract asserts + return-code mapping tests, NOT by executing Lua on Redis.
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
  FINALIZE_LUA,
  INVALIDATE_LUA,
  activateGeneration,
  allocateGeneration,
  bindingsMatch,
  claimFinalization,
  claimTask,
  commitPageResult,
  computeTaskKey,
  ensurePageFence,
  ensureQueuedTask,
  finalizationClaimKey,
  inspectFinalizationClaimValue,
  invalidateFromPage,
  invalidatePageAuthority,
  mapFinalizeCode,
  mapInvalidateLuaCode,
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
import { isRemoteKvConfigured } from "@/lib/kv/memory-kv";

function baseDc(): DecisionContext {
  return {
    context_id: "dc_b3r6",
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
  setBeforeClaimAtomicHookForTests(null);
  setBeforeInvalidateAtomicHookForTests(null);
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
  console.log("=== Report orchestration Batch3 R6 ===");
  console.log(
    `REDIS_LUA_RUNTIME: ${isRemoteKvConfigured() ? "remote_kv_configured" : "not_available_memory_kv_only"}`,
  );

  // --- A. Corrupt / incomplete / unknown Claim → invalidate fail-closed ---
  {
    await cleanup();
    const report_id = "rpt_b3r6_a";
    const gen = await boot(report_id, "g_a");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { fenceRevs } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const cKey = finalizationClaimKey(report_id, gen.generation_id);
    const cases: Array<{ label: string; value: unknown }> = [
      { label: "invalid_json_string", value: "{not-json" },
      { label: "empty_object", value: {} },
      { label: "missing_status", value: { claim_id: "x" } },
      { label: "unknown_status", value: { status: "pending" } },
      { label: "null_status", value: { status: null } },
      { label: "array", value: [{ status: "claimed" }] },
    ];

    for (const c of cases) {
      assert.equal(
        inspectFinalizationClaimValue(c.value).kind,
        "unusable",
        c.label,
      );

      await durableKv().set(cKey, c.value);
      const inv = await invalidatePageAuthority({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "01",
        reason: `r6_a_${c.label}`,
      });
      assert.equal(inv.ok, false, c.label);
      assert.equal(inv.ok ? "" : inv.code, "conflict", c.label);
      const fence = await readPageFence(
        report_id,
        gen.generation_id,
        "01",
      );
      assert.equal(fence.value!.status, "committed", c.label);
      assert.equal(fence.value!.validity_rev, fenceRevs.get("01"), c.label);

      const cascade = await invalidateFromPage({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        source_page_id: "01",
        reason: `r6_a_cascade_${c.label}`,
      });
      assert.equal(cascade.ok, false, c.label);
      assert.equal(cascade.ok ? "" : cascade.code, "conflict", c.label);
      await durableKv().del(cKey);
    }

    // Valid claimed still locks
    await durableKv().set(cKey, {
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: "lock",
      claimed_at: new Date().toISOString(),
      status: "claimed",
      pages: [],
    });
    const locked = await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "01",
      reason: "r6_a_claimed",
    });
    assert.equal(locked.ok ? "" : locked.code, "finalization_locked");

    // Absent allows invalidate
    await durableKv().del(cKey);
    const ok = await invalidatePageAuthority({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "02",
      reason: "r6_a_absent",
    });
    assert.equal(ok.ok, true, JSON.stringify(ok));

    console.log("R6-A ok — corrupt/unknown claim fail-closed (MemoryKv)");
  }

  // --- B. Bindings parity: page_id + identity fields ---
  {
    await cleanup();
    const report_id = "rpt_b3r6_b";
    const gen = await boot(report_id, "g_b");
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

    // Same claim_id + same bindings → idempotent
    const again = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id,
      pages: bindings,
    });
    assert.equal(again.ok, true);
    assert.equal(again.ok ? again.value.claim_id : "", claim_id);

    // Different claim_id + same bindings → single seal (no overwrite)
    const otherId = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(otherId.ok, true);
    assert.equal(otherId.ok ? otherId.value.claim_id : "", claim_id);

    // Reordered pages: each fence still matches, but seal binding order differs → conflict
    const reordered = [...bindings.slice(1), bindings[0]!];
    assert.equal(bindingsMatch(bindings, reordered), false);
    const badOrder = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id,
      pages: reordered,
    });
    assert.equal(badOrder.ok, false);
    assert.equal(badOrder.ok ? "" : badOrder.code, "conflict");

    // page_id identity mismatch in bindingsMatch (unit + Lua contract)
    const swappedIds = bindings.map((b, i, arr) =>
      i === 0
        ? { ...b, page_id: arr[1]!.page_id }
        : i === 1
          ? { ...b, page_id: arr[0]!.page_id }
          : b,
    ) as FinalizationPageBinding[];
    assert.equal(bindingsMatch(bindings, swappedIds), false);

    // Different validity_rev / attempt_id / fingerprint / task_key → bindingsMatch false;
    // claimFinalization hits fence re-check first (stale_page) — still refuse, no overwrite.
    for (const field of [
      "validity_rev",
      "attempt_id",
      "output_fingerprint",
      "task_key",
    ] as const) {
      const mutated = bindings.map((b, i) =>
        i === 0
          ? {
              ...b,
              [field]:
                field === "validity_rev"
                  ? b.validity_rev + 99
                  : `${String(b[field])}_x`,
            }
          : b,
      );
      assert.equal(bindingsMatch(bindings, mutated), false, field);
      const r = await claimFinalization({
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        claim_id,
        pages: mutated,
      });
      assert.equal(r.ok, false, field);
      assert.ok(
        r.ok === false &&
          (r.code === "stale_page" || r.code === "conflict"),
        field,
      );
      const still = await readFinalizationClaim(
        report_id,
        gen.generation_id,
      );
      assert.equal(still.value!.claim_id, claim_id, field);
    }

    // Lua source must compare page_id (parity with bindingsMatch)
    assert.match(FINALIZE_LUA, /p\.page_id\s*~=\s*expectPageId/);
    assert.match(FINALIZE_LUA, /fence\.page_id\s*~=\s*expectPageId/);
    assert.match(FINALIZE_LUA, /prev\.report_id/);
    assert.match(FINALIZE_LUA, /return -5/);

    console.log("R6-B ok — binding page_id/identity parity + Lua source contract");
  }

  // --- C. Corrupt existing Claim must not be overwritten ---
  {
    await cleanup();
    const report_id = "rpt_b3r6_c";
    const gen = await boot(report_id, "g_c");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );
    const cKey = finalizationClaimKey(report_id, gen.generation_id);
    await durableKv().set(cKey, "{broken");
    const refused = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.ok ? "" : refused.code, "conflict");
    const still = await durableKv().get(cKey);
    assert.equal(still, "{broken");

    await durableKv().set(cKey, { status: "weird" });
    const refused2 = await claimFinalization({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      claim_id: randomUUID(),
      pages: bindings,
    });
    assert.equal(refused2.ok, false);
    assert.equal(refused2.ok ? "" : refused2.code, "conflict");

    console.log("R6-C ok — corrupt claim not overwritten");
  }

  // --- D. Barrier concurrent race (true pre-atomic sync) ---
  {
    let bothSucceeded = 0;
    let claimWins = 0;
    let invWins = 0;
    for (let i = 0; i < 24; i++) {
      await cleanup();
      const report_id = `rpt_b3r6_d_${i}`;
      const gen = await boot(report_id, `g_d_${i}`);
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
      const bothArrived = new Promise<void>((resolve) => {
        const check = () => {
          if (claimArrived && invArrived) resolve();
        };
        setBeforeClaimAtomicHookForTests(async () => {
          claimArrived = true;
          check();
          await gate;
        });
        setBeforeInvalidateAtomicHookForTests(async () => {
          invArrived = true;
          check();
          await gate;
        });
      });

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
          reason: `r6_d_${i}`,
        });
      } else {
        invP = invalidatePageAuthority({
          report_id,
          generation_id: gen.generation_id,
          generation_epoch: gen.generation_epoch,
          page_id: "01",
          reason: `r6_d_${i}`,
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
      assert.ok(claimArrived && invArrived);
      release();
      const [claimR, invR] = await Promise.all([claimP, invP]);
      setBeforeClaimAtomicHookForTests(null);
      setBeforeInvalidateAtomicHookForTests(null);

      if (claimR.ok && invR.ok) bothSucceeded += 1;
      else if (claimR.ok && !invR.ok) {
        claimWins += 1;
        assert.equal(invR.ok ? "" : invR.code, "finalization_locked");
        const fence = await readPageFence(
          report_id,
          gen.generation_id,
          "01",
        );
        assert.equal(fence.value!.validity_rev, fence01Before);
        assert.equal(fence.value!.status, "committed");
        const claim = await readFinalizationClaim(
          report_id,
          gen.generation_id,
        );
        assert.ok(claim.ok && claim.value?.status === "claimed");
      } else if (!claimR.ok && invR.ok) {
        invWins += 1;
        assert.equal(claimR.ok ? "" : claimR.code, "stale_page");
        const fence = await readPageFence(
          report_id,
          gen.generation_id,
          "01",
        );
        assert.equal(fence.value!.status, "stale");
        const claim = await readFinalizationClaim(
          report_id,
          gen.generation_id,
        );
        assert.ok(claim.ok && claim.value == null);
        const prov = await readPageProvenance(
          report_id,
          gen.generation_id,
          "01",
        );
        assert.ok(prov.ok && prov.value?.stale === true);
      } else {
        assert.fail(
          `both failed i=${i} claim=${JSON.stringify(claimR)} inv=${JSON.stringify(invR)}`,
        );
      }
    }
    assert.equal(bothSucceeded, 0);
    assert.ok(claimWins > 0 && invWins > 0);
    console.log(
      `R6-D ok — barrier races claimWins=${claimWins} invWins=${invWins} both=0`,
    );
  }

  // --- E. Regression: ordered mutex, cascade, superseded, idempotent ---
  {
    await cleanup();
    const report_id = "rpt_b3r6_e";
    const gen = await boot(report_id, "g_e");
    await commitAll(report_id, gen.generation_id, gen.generation_epoch);
    const { bindings, fenceRevs } = await buildBindings(
      report_id,
      gen.generation_id,
      gen.generation_epoch,
    );

    // Claim first → cascade locked, no fence rev change
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
      reason: "r6_e_cascade",
    });
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

    // Invalidation first → old claim fails
    await cleanup();
    const report_id2 = "rpt_b3r6_e2";
    const gen2 = await boot(report_id2, "g_e2");
    await commitAll(report_id2, gen2.generation_id, gen2.generation_epoch);
    const b2 = await buildBindings(
      report_id2,
      gen2.generation_id,
      gen2.generation_epoch,
    );
    assert.equal(
      (
        await invalidatePageAuthority({
          report_id: report_id2,
          generation_id: gen2.generation_id,
          generation_epoch: gen2.generation_epoch,
          page_id: "01",
          reason: "r6_e_inv_first",
        })
      ).ok,
      true,
    );
    const staleClaim = await claimFinalization({
      report_id: report_id2,
      generation_id: gen2.generation_id,
      generation_epoch: gen2.generation_epoch,
      claim_id: randomUUID(),
      pages: b2.bindings,
    });
    assert.equal(staleClaim.ok ? "" : staleClaim.code, "stale_page");

    // Superseded generation cannot claim
    await cleanup();
    const report_id3 = "rpt_b3r6_e3";
    const genOld = await boot(report_id3, "g_e3_old");
    await commitAll(
      report_id3,
      genOld.generation_id,
      genOld.generation_epoch,
    );
    const bOld = await buildBindings(
      report_id3,
      genOld.generation_id,
      genOld.generation_epoch,
    );
    const genNew = await allocateGeneration({
      report_id: report_id3,
      locale: "en",
      generation_id: "g_e3_new",
    });
    assert.ok(genNew.ok);
    if (!genNew.ok) throw new Error("genNew");
    await activateGeneration({
      record: genNew.value,
      job_id: report_id3,
    });
    const superClaim = await claimFinalization({
      report_id: report_id3,
      generation_id: genOld.generation_id,
      generation_epoch: genOld.generation_epoch,
      claim_id: randomUUID(),
      pages: bOld.bindings,
    });
    assert.equal(superClaim.ok ? "" : superClaim.code, "stale_generation");

    console.log("R6-E ok — ordered mutex / cascade / superseded regressions");
  }

  // --- F. Redis Lua source + return-code mapping (not executed on Redis) ---
  {
    assert.match(INVALIDATE_LUA, /return -10/);
    assert.match(INVALIDATE_LUA, /return -13/);
    assert.match(
      INVALIDATE_LUA,
      /if not cok or type\(claim\) ~= "table" then\s*return -13/s,
    );
    assert.match(INVALIDATE_LUA, /status == "claimed"/);
    // Decode failure must not fall through to fence bump
    assert.ok(
      INVALIDATE_LUA.indexOf("return -13") <
        INVALIDATE_LUA.indexOf("local fcur = redis.call"),
    );

    assert.equal(mapInvalidateLuaCode(-10).ok, false);
    assert.equal(
      mapInvalidateLuaCode(-10).ok
        ? ""
        : mapInvalidateLuaCode(-10).code,
      "finalization_locked",
    );
    assert.equal(
      mapInvalidateLuaCode(-13).ok
        ? ""
        : mapInvalidateLuaCode(-13).code,
      "conflict",
    );
    assert.equal(
      mapInvalidateLuaCode(-99).ok
        ? ""
        : mapInvalidateLuaCode(-99).code,
      "conflict",
    );
    assert.equal(mapInvalidateLuaCode(3).ok, true);

    assert.equal(
      mapFinalizeCode(-5).ok ? "" : mapFinalizeCode(-5).code,
      "conflict",
    );
    assert.equal(
      mapFinalizeCode(-4).ok ? "" : mapFinalizeCode(-4).code,
      "conflict",
    );
    assert.match(FINALIZE_LUA, /page_id/);
    assert.match(FINALIZE_LUA, /ARGV\[base \+ 1\]/);

    console.log(
      "R6-F ok — Lua source contracts + code maps (Redis Lua NOT executed here)",
    );
  }

  console.log(
    "DEPLOY_ENV_PENDING: real Upstash multi-key Lua concurrency not proven here",
  );
  console.log("ok report orchestration batch3 r6");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
