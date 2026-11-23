/**
 * Face02 production executor persistence via runLabStepV3(content_body).
 * Run live: $env:RUN_FACE02_LAB_LIVE='1'; pnpm exec tsx scripts/test-decision-report-v2-page02-lab-persist.ts
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
  isFace02V2,
  buildFace02ProductionContext,
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

console.log("=== Face02 lab persistence ===");

const dc = {
  context_id: "dc_lab_persist_02",
  version: 1,
  status: "frozen",
  content_hash: "hash_lab_02",
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
      declared_term_ids: ["day_master"],
      source_domain: "bazi",
      declared_source_domain: "bazi",
      source_version: "cfp_lab",
      declared_source_version: "cfp_lab",
    },
  ],
  by_face: {
    "01": ["u_sci_lab", "u_des_lab"],
    "02": ["u_sci_lab", "u_des_lab"],
  },
  pattern_hits_used: [],
  science_tags_used: [],
} as BookJudgmentPack;

const page01Stub = {
  page: "01",
  face: "01",
  schema_version: "face01-v2",
  core_judgment: {
    text: "Prefer a staged explore path that keeps the cash floor intact.",
    claim_ids: ["claim_u_des_lab"],
  },
  why_this_path: [
    {
      text: "Runway supports testing without resigning cold.",
      claim_ids: ["claim_u_des_lab"],
      evidence_ids: ["u_des_lab"],
      target_page: "02",
      target_evidence_ids: ["u_des_lab"],
    },
  ],
  recommendation_conditions: [
    { condition: "Keep six months runway.", status: "satisfied", source_ids: ["fact_runway"] },
    { condition: "Offer terms still fluid.", status: "unconfirmed", source_ids: ["fact_runway"] },
  ],
  not_recommended: [
    {
      option: "Resign immediately",
      reason: "Burns runway buffer",
      cost_or_conflict: "Cash floor risk",
      claim_ids: ["claim_u_des_lab"],
      evidence_ids: ["u_des_lab"],
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway"],
    invalidation_conditions: ["Runway collapses"],
    page02_evidence_ids: ["u_des_lab"],
    page08_review_refs: [],
  },
};

const offlineCtx = buildFace02ProductionContext({
  report_id: "lab_offline_02",
  locale: "en",
  dc,
  pack,
  chart_fact_pack: "dayMaster:甲",
  page01: page01Stub,
});
assert.equal(offlineCtx.ok, true);
console.log("offline_context_ok");

async function buildLabReadyForFace02Body(): Promise<DeliveryLabSession> {
  process.env.BOOK_JUDGMENT_PACK = "0";

  const lab = await createDeliveryLab({
    ops_user: "lab_persist_02_test",
    source: {
      locale: "en",
      original_question: "Should I leave for the startup offer?",
      desired_outcome: "Preserve runway",
      base_analysis: "{}",
      session_id: `sess_lab02_${Date.now()}`,
      decision_context_snapshot: dc,
    },
    mode: "delivery_only",
  });
  lab.pipeline = "v3_three_step";
  lab.steps = initLabStepsV3();
  lab.artifacts.by_page = lab.artifacts.by_page ?? {};
  lab.artifacts.by_page["01"] = {
    page_schema: page01Stub as never,
    page_schema_pre_polish: structuredClone(page01Stub),
  };
  lab.artifacts.by_page["02"] = lab.artifacts.by_page["02"] ?? {};
  lab.artifacts.prealloc = {
    by_page: {},
    pool_source: "chart_fact_pack",
    chart_fact_pack: "dayMaster:甲\nyongJi:木",
  } as never;

  const defs = labStepDefsV3();
  const bodyIdx = defs.findIndex((d) => d.step_key === "02.content.body");
  assert.ok(bodyIdx >= 0, "02.content.body exists");
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
  lab.artifacts.book_judgment_pack = pack;
  await saveDeliveryLab(lab);
  return lab;
}

async function main() {
  const live = process.env.RUN_FACE02_LAB_LIVE === "1";
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!live || !hasKey) {
    console.log("REAL_MODEL_CALL_NOT_RUN");
    const lab = await buildLabReadyForFace02Body();
    const art = lab.artifacts.by_page["02"]!;
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

  const lab0 = await buildLabReadyForFace02Body();
  let current = await loadDeliveryLab(lab0.lab_id);
  assert.ok(current);
  assert.equal(current!.artifacts.by_page["02"]?.page_schema, undefined);

  let run = await runLabStepV3(current!, "02.content.body", {
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
      current!.artifacts.by_page["02"]?.page_schema,
      undefined,
      "continue rule must not persist unverified page_schema",
    );
    run = await runLabStepV3(current!, "02.content.body", {
      polish_locale: "en",
    });
    console.log("lab_step_2_escape", {
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
      reloaded!.artifacts.by_page["02"]?.page_schema,
      undefined,
      "failed/continue run must not persist Face02 page_schema",
    );
    console.log(
      `REAL_MODEL_CALL_FAILED:${run.reason ?? run.attempt?.gate_verdict.failed_rule}`,
    );
    console.log("ok lab-persist fail-closed");
    return;
  }

  const schema = reloaded!.artifacts.by_page["02"]?.page_schema;
  assert.ok(schema, "page_schema persisted");
  assert.ok(isFace02V2(schema), "persisted Face02V2");
  assert.equal(
    (schema as { schema_version?: string }).schema_version,
    "face02-v2",
  );
  assert.ok(
    reloaded!.artifacts.by_page["02"]?.page_schema_pre_polish,
    "pre_polish persisted",
  );
  const meta = (
    reloaded!.artifacts.by_page["02"] as { face02_production_meta?: unknown }
  )?.face02_production_meta;
  assert.ok(meta, "face02_production_meta persisted");
  const realized = (
    reloaded!.artifacts as { page02_realized_evidence_ids?: string[] }
  ).page02_realized_evidence_ids;
  assert.ok(Array.isArray(realized), "realized evidence ids persisted");

  console.log("persist_evidence", {
    schema_version: (schema as { schema_version?: string }).schema_version,
    is_v2: isFace02V2(schema),
    meta,
    realized_count: realized?.length ?? 0,
    generation_id: run.attempt?.generation_id ?? null,
    request_id: run.attempt?.call_trace?.meta?.generation_id ?? null,
  });
  console.log("REAL_MODEL_CALL_OK");
  console.log("LAB_PERSIST_OK");
  console.log("ok decision-report-v2 page02 lab-persist");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
