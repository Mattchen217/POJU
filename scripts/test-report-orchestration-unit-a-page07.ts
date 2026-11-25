/**
 * Unit A — Page07 full-path production gap fix (Batch3 generation_epoch enabled).
 * Run: pnpm exec tsx scripts/test-report-orchestration-unit-a-page07.ts
 *
 * Proves:
 * 1. applicable → Fence released → Generate Claim succeeds
 * 2. not_applicable → Authority Commit → Authority Gate accepts
 * 3. insufficient_information → Authority Commit → Authority Gate accepts
 * 4. Terminal Page07 allows Page08 Generate Claim (DAG continuity)
 */

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createJob,
  loadJob,
  resetBatch2JobStoreForTests,
  type ReportBatch2JobInputs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { runReportPage07ApplicabilityGate } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/page07-gate";
import { fenceAndClaimPageTask } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/worker-guard";
import { commitPageResult } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/fenced-commit";
import {
  activateGeneration,
  allocateGeneration,
  ensurePageFence,
  readPageFence,
  readPageProvenance,
  readAuthorityPageOutput,
  resetBatch3KeysForTests,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3";
import {
  hashCanonicalPayload,
  reportPageDefinition,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";

function baseDc(overrides?: Partial<{
  question: string;
  facts: DecisionContext["reality_facts"];
  dirs: DecisionContext["dirs"];
}>): DecisionContext {
  return {
    context_id: "dc_unit_a_page07",
    version: 1,
    status: "final",
    content_hash: "h",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question:
        overrides?.question ??
        "Should I form a partnership with a co-founder for this venture?",
      concrete_event: "x",
      desired_outcome: "y",
      stakes: "z",
    },
    constraints: [],
    reality_facts: overrides?.facts ?? [],
    dirs: overrides?.dirs ?? [],
    conflicts: [],
    hypotheses: [],
  } as unknown as DecisionContext;
}

function inputs(report_id: string, dc: DecisionContext): ReportBatch2JobInputs {
  return {
    report_id,
    dc,
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
}

async function bootWithUpstream(
  report_id: string,
  generation_id: string,
  dc: DecisionContext,
) {
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
    inputs: inputs(report_id, dc),
    generation_epoch: gen.value.generation_epoch,
  });
  // Upstream pages must Authority-Commit so loadJob Gate keeps them terminal.
  for (const page_id of ["01", "02", "04", "05", "06"] as ReportPageId[]) {
    const def = reportPageDefinition(page_id);
    const input_fingerprint = `fp_${page_id}`;
    const out = { page: page_id, body: "upstream" };
    const fp = hashCanonicalPayload(out);
    await ensurePageFence({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
    });
    const claimed = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
      task_type: "generate",
      input_fingerprint,
      upstream_output_fingerprints: {},
      worker_id: `w_up_${page_id}`,
    });
    assert.ok(claimed.ok, `${page_id}: ${JSON.stringify(claimed)}`);
    if (!claimed.ok) throw new Error(`claim ${page_id}`);
    const committed = await commitPageResult({
      report_id,
      generation_id: gen.value.generation_id,
      generation_epoch: gen.value.generation_epoch,
      page_id,
      attempt_id: claimed.value.attempt_id,
      task_key: claimed.value.task_key,
      output: out,
      output_fingerprint: fp,
      state_patch: { outcome: "completed", input_fingerprint },
      provenance: {
        report_id,
        generation_id: gen.value.generation_id,
        generation_epoch: gen.value.generation_epoch,
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
    assert.ok(committed.ok, `${page_id}: ${JSON.stringify(committed)}`);
  }
  return gen.value;
}

function upstreamFps(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const page_id of ["01", "02", "04", "05", "06"]) {
    out[page_id] = hashCanonicalPayload({ page: page_id, body: "upstream" });
  }
  return out;
}

async function main(): Promise<void> {
  console.log("=== Unit A — Page07 full-path (Batch3 epoch) ===");

  // --- A1. applicable → handoff → Generate Claim ---
  {
    await cleanup();
    const report_id = "rpt_ua_app";
    const gen = await bootWithUpstream(
      report_id,
      "g_ua_app",
      baseDc({
        question:
          "Should I form a partnership with a co-founder for this venture?",
      }),
    );
    const gate = await runReportPage07ApplicabilityGate({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "07",
        locale: "en",
        upstream_output_fingerprints: upstreamFps(),
      },
      invocation_id: randomUUID(),
      worker_id: "w_app_gate",
    });
    assert.equal(gate.status, "applicable", JSON.stringify(gate));

    const fenceAfter = await readPageFence(report_id, gen.generation_id, "07");
    assert.equal(fenceAfter.value?.status, "open");
    assert.equal(fenceAfter.value?.task_key, null);
    assert.equal(fenceAfter.value?.attempt_id, null);

    const generateClaim = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "07",
      task_type: "generate",
      input_fingerprint: hashCanonicalPayload({ page07: "generate" }),
      upstream_output_fingerprints: upstreamFps(),
      worker_id: "w_app_gen",
    });
    assert.ok(generateClaim.ok, JSON.stringify(generateClaim));
    assert.equal(generateClaim.value?.task.task_type, "generate");
    const fenceClaimed = await readPageFence(report_id, gen.generation_id, "07");
    assert.equal(fenceClaimed.value?.status, "claimed");
    assert.equal(fenceClaimed.value?.task_key, generateClaim.value?.task_key);
    console.log("A1 ok — applicable handoff + Generate Claim");
  }

  // --- A2. not_applicable → Authority Commit + Gate ---
  {
    await cleanup();
    const report_id = "rpt_ua_na";
    const gen = await bootWithUpstream(
      report_id,
      "g_ua_na",
      baseDc({
        question: "Should I take a solo promotion and keep my runway?",
      }),
    );
    const gate = await runReportPage07ApplicabilityGate({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "07",
        locale: "en",
        upstream_output_fingerprints: upstreamFps(),
      },
      invocation_id: randomUUID(),
      worker_id: "w_na_gate",
    });
    assert.equal(gate.status, "not_applicable", JSON.stringify(gate));

    const fence = await readPageFence(report_id, gen.generation_id, "07");
    assert.equal(fence.value?.status, "committed");
    const prov = await readPageProvenance(report_id, gen.generation_id, "07");
    assert.ok(prov.ok && prov.value && !prov.value.stale);
    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      "07",
    );
    assert.ok(auth.ok && auth.value);

    // Reload applies Authority Gate — Page07 must survive as terminal.
    const reloaded = await loadJob(report_id, gen.generation_id);
    assert.ok(reloaded.ok && reloaded.value, JSON.stringify(reloaded));
    const st = reloaded.value!.page_states.find((s) => s.page_id === "07");
    assert.equal(st?.outcome, "skipped_not_applicable");
    assert.equal(st?.applicability_status, "not_applicable");
    assert.ok(reloaded.value!.page_outputs["07"]);

    // Page08 can claim after Page07 terminal
    const p08 = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "08",
      task_type: "generate",
      input_fingerprint: hashCanonicalPayload({ page08: "gen" }),
      upstream_output_fingerprints: {
        ...upstreamFps(),
        "07": fence.value!.output_fingerprint!,
      },
      worker_id: "w_p08",
    });
    assert.ok(p08.ok, JSON.stringify(p08));
    console.log("A2 ok — not_applicable Authority Commit + Page08 Claim");
  }

  // --- A3. insufficient_information → Authority Commit + Gate ---
  {
    await cleanup();
    const report_id = "rpt_ua_ins";
    const gen = await bootWithUpstream(
      report_id,
      "g_ua_ins",
      baseDc({
        question: "What should I do next?",
        facts: [],
        dirs: [
          {
            dir_id: "dir_move",
            need: "Whether relocation is still unknown",
            why: "The move is not decided",
            required_fact_roles: [],
            current_state: "unknown",
            partial_satisfaction: false,
            agenda_item_ids: [],
            id_lifecycle: "active",
          },
        ] as DecisionContext["dirs"],
      }),
    );
    const gate = await runReportPage07ApplicabilityGate({
      event: {
        report_id,
        generation_id: gen.generation_id,
        generation_epoch: gen.generation_epoch,
        page_id: "07",
        locale: "en",
        upstream_output_fingerprints: upstreamFps(),
      },
      invocation_id: randomUUID(),
      worker_id: "w_ins_gate",
    });
    assert.equal(gate.status, "insufficient_information", JSON.stringify(gate));

    const fence = await readPageFence(report_id, gen.generation_id, "07");
    assert.equal(fence.value?.status, "committed");
    const auth = await readAuthorityPageOutput(
      report_id,
      gen.generation_id,
      "07",
    );
    assert.ok(auth.ok && auth.value);

    const reloaded = await loadJob(report_id, gen.generation_id);
    assert.ok(reloaded.ok && reloaded.value, JSON.stringify(reloaded));
    const st = reloaded.value!.page_states.find((s) => s.page_id === "07");
    assert.equal(st?.outcome, "insufficient_information");
    assert.ok(reloaded.value!.page_outputs["07"]);

    const p08 = await fenceAndClaimPageTask({
      report_id,
      generation_id: gen.generation_id,
      generation_epoch: gen.generation_epoch,
      page_id: "08",
      task_type: "generate",
      input_fingerprint: hashCanonicalPayload({ page08: "gen2" }),
      upstream_output_fingerprints: {
        ...upstreamFps(),
        "07": fence.value!.output_fingerprint!,
      },
      worker_id: "w_p08_ins",
    });
    assert.ok(p08.ok, JSON.stringify(p08));
    console.log("A3 ok — insufficient_information Authority Commit + Page08 Claim");
  }

  console.log("UNIT_A_PAGE07: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
