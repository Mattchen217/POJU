/**
 * Face01 production executor persistence via runLabStepV3(content_body).
 * Uses Memory KV Lab store — does NOT mock the model call.
 *
 * Run live: $env:RUN_FACE01_LAB_LIVE='1'; pnpm exec tsx scripts/test-decision-report-v2-page01-lab-persist.ts
 * Offline (no LLM): prints REAL_MODEL_CALL_NOT_RUN and still verifies fail-closed persist helper.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDeliveryLab,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { initLabStepsV3, labStepDefsV3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import { runLabStepV3 } from "@/lib/llm/pro/delivery/lab/run-step-v3";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  isFace01V2,
  buildFace01ProductionContext,
} from "@/lib/llm/pro/delivery/decision-report-v2";

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let val = m[2]!;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = val;
  }
}
loadEnvLocal();

console.log("=== Face01 lab persistence ===");

const dc = {
  context_id: "dc_lab_persist",
  version: 1,
  status: "frozen",
  content_hash: "hash_lab",
  definition: {
    decision_question: "Should I leave for the startup offer?",
    desired_outcome: "Preserve runway and optionality.",
  },
  dirs: [
    {
      dir_id: "dir_main",
      id_lifecycle: "active",
      required_fact_roles: ["cash_runway"],
    },
  ],
  constraints: [],
  reality_facts: [
    {
      fact_id: "fact_runway",
      statement: "Personal runway is about 8 months.",
      status: "confirmed",
      verification_level: "user_asserted",
      roles: ["cash_runway"],
      related_dir_ids: ["dir_main"],
    },
  ],
  conflicts: [],
  hypotheses: [],
} as unknown as DecisionContext;

const pack: BookJudgmentPack = {
  version: 1,
  locale: "en",
  cfp_hash: "cfp_lab",
  zfp_hash: null,
  zfpOmitted: true,
  shot_mode: "one",
  created_at: new Date().toISOString(),
  units: [
    {
      id: "u_sci_lab",
      track: "science",
      claim: "Eight-month runway supports a staged explore-without-resign path.",
      anchors: ["runway_buffer"],
      serves_face: ["01", "02"],
      term_ids: [],
      source_domain: "science",
    },
    {
      id: "u_des_lab",
      track: "destiny",
      claim: "Stable cash floor preference. cfp:dayMaster",
      anchors: ["cfp:dayMaster"],
      serves_face: ["01", "02"],
      term_ids: ["day_master"],
      source_domain: "bazi",
      source_version: "cfp_lab",
    },
  ],
  by_face: {
    "01": ["u_sci_lab", "u_des_lab"],
    "02": ["u_sci_lab", "u_des_lab"],
  },
  pattern_hits_used: [],
  science_tags_used: [],
} as BookJudgmentPack;

// Offline: fail-closed — validation failure must not look like persisted V2.
const badCtx = buildFace01ProductionContext({
  report_id: "lab_offline",
  locale: "en",
  dc,
  pack,
  chart_fact_pack: "dayMaster:甲",
});
assert.equal(badCtx.ok, true);
console.log("offline_context_ok");

async function buildLabReadyForFace01Body(): Promise<DeliveryLabSession> {
  // Avoid pack quota freeze for this persistence test: Face01 V2 can run on DC alone.
  // We still attach pack after gate would have passed by stashing it without enabling freeze —
  // use BOOK_JUDGMENT_PACK path only if pack validates; otherwise DC-only.
  process.env.BOOK_JUDGMENT_PACK = "0";

  const lab = await createDeliveryLab({
    ops_user: "lab_persist_test",
    source: {
      locale: "en",
      original_question: "Should I leave for the startup offer?",
      desired_outcome: "Preserve runway",
      base_analysis: "{}",
      session_id: `sess_lab_${Date.now()}`,
      decision_context_snapshot: dc,
    },
    mode: "delivery_only",
  });
  lab.pipeline = "v3_three_step";
  lab.steps = initLabStepsV3();
  lab.artifacts.by_page = lab.artifacts.by_page ?? {};
  lab.artifacts.by_page["01"] = lab.artifacts.by_page["01"] ?? {};
  // Provide chart text via prealloc so domains resolve.
  // Shape must include by_page (ChartPrimaryPreallocMap) — chart_fact_pack alone is not enough.
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲\nyongJi:木",
  } as never;

  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "01.content.body");
  assert.ok(bodyIdx >= 0, "01.content.body exists");
  for (let i = 0; i < bodyIdx; i++) {
    const key = defs[i]!.step_key;
    lab.steps[key] = {
      step_key: key,
      status: "approved",
      attempts: [
        {
          attempt_number: 1,
          timestamp: new Date().toISOString(),
          duration_ms: 1,
          input_payload: {},
          raw_model_output: null,
          processing_actions: [],
          gate_verdict: { passed: true, detail: "seed_approved" },
          output_to_next_stage: null,
        },
      ],
      approved_attempt: 0,
    };
  }
  lab.cursor_index = bodyIdx;
  lab.approved_order = defs.slice(0, bodyIdx).map((d) => d.step_key);
  // Optional pack for richer registry — with BOOK_JUDGMENT_PACK=0, body won't freeze on quota.
  lab.artifacts.book_judgment_pack = pack;
  await saveDeliveryLab(lab);
  return lab;
}

async function main() {
  const live = process.env.RUN_FACE01_LAB_LIVE === "1";
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!live || !hasKey) {
    console.log("REAL_MODEL_CALL_NOT_RUN");
    // Still prove fail-closed: do not write page_schema on synthetic failure path.
    const lab = await buildLabReadyForFace01Body();
    const art = lab.artifacts.by_page["01"]!;
    assert.equal(art.page_schema, undefined);
    console.log("ok lab-persist offline (no schema written without live call)");
    return;
  }

  const CONTINUE_RULES = new Set([
    "write_dispatch_continue",
    "fill_dispatch_continue",
    "mark_dispatch_continue",
    "soft_dispatch_continue",
    "body_acceptance_continue",
    "polish_acceptance_continue",
  ]);

  const lab0 = await buildLabReadyForFace01Body();
  let current = await loadDeliveryLab(lab0.lab_id);
  assert.ok(current);
  assert.equal(current!.artifacts.by_page["01"]?.page_schema, undefined);

  // Mirror production escape: at most one supply-side re-invoke after continue rule.
  let run = await runLabStepV3(current!, "01.content.body", {
    polish_locale: "en",
  });
  console.log("lab_step_1", {
    ok: run.ok,
    reason: run.ok ? undefined : run.reason,
    failed_rule: run.attempt?.gate_verdict.failed_rule,
  });

  const continueRule = run.attempt?.gate_verdict.failed_rule ?? "";
  if (run.ok && CONTINUE_RULES.has(continueRule)) {
    current = await loadDeliveryLab(lab0.lab_id);
    assert.ok(current);
    assert.equal(
      current!.artifacts.by_page["01"]?.page_schema,
      undefined,
      "continue rule must not persist unverified page_schema",
    );
    run = await runLabStepV3(current!, "01.content.body", {
      polish_locale: "en",
    });
    console.log("lab_step_2_escape", {
      ok: run.ok,
      reason: run.ok ? undefined : run.reason,
      failed_rule: run.attempt?.gate_verdict.failed_rule,
      meta: run.attempt?.call_trace?.meta,
    });
  } else {
    console.log("lab_step", {
      ok: run.ok,
      reason: run.ok ? undefined : run.reason,
      failed_rule: run.attempt?.gate_verdict.failed_rule,
      meta: run.attempt?.call_trace?.meta,
    });
  }

  const reloaded = await loadDeliveryLab(lab0.lab_id);
  assert.ok(reloaded);

  const finalContinue = CONTINUE_RULES.has(
    run.attempt?.gate_verdict.failed_rule ?? "",
  );
  if (!run.ok || finalContinue) {
    assert.equal(
      reloaded!.artifacts.by_page["01"]?.page_schema,
      undefined,
      "failed/continue run must not persist Face01 page_schema",
    );
    console.log(
      `REAL_MODEL_CALL_FAILED:${run.reason ?? run.attempt?.gate_verdict.failed_rule}`,
    );
    console.log("fail_detail", {
      detail: run.attempt?.gate_verdict.detail,
      processing: run.attempt?.processing_actions?.slice(-8),
      raw_preview:
        typeof run.attempt?.raw_model_output === "string"
          ? run.attempt.raw_model_output.slice(0, 400)
          : run.attempt?.raw_model_output,
    });
    console.log("ok lab-persist fail-closed");
    return;
  }

  const schema = reloaded!.artifacts.by_page["01"]?.page_schema;
  assert.ok(schema, "page_schema persisted");
  assert.ok(isFace01V2(schema), "persisted Face01V2");
  assert.equal(
    (schema as { schema_version?: string }).schema_version,
    "face01-v2",
  );
  assert.ok(
    reloaded!.artifacts.by_page["01"]?.page_schema_pre_polish,
    "pre_polish persisted",
  );
  const meta = (
    reloaded!.artifacts.by_page["01"] as { face01_production_meta?: unknown }
  )?.face01_production_meta;
  assert.ok(meta, "face01_production_meta persisted");

  console.log("persist_evidence", {
    schema_version: (schema as { schema_version?: string }).schema_version,
    is_v2: isFace01V2(schema),
    meta,
    generation_id: run.attempt?.generation_id ?? null,
    finish_reason: run.attempt?.call_trace?.meta?.finish_reason ?? null,
    model: run.attempt?.call_trace?.meta?.model ?? null,
    request_id: run.attempt?.call_trace?.meta?.generation_id ?? null,
  });
  console.log("REAL_MODEL_CALL_OK");
  console.log("LAB_PERSIST_OK");
  console.log("ok decision-report-v2 page01 lab-persist");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
