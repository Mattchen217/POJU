/**
 * Execute one lab step using production generators.
 */

import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  DELIVERY_TASKS,
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_DISPATCH_WRITE_CHUNK_SIZE } from "@/lib/llm/pro/delivery/dispatch/types";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildCategoryTokenSetsFromStructured } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import {
  chunkPaths,
  runDeepEvidenceAssignCall,
  type DeepEvidenceAssignment,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { runDeepEvidenceWriteChunk } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-write";
import { assessDeepEvidenceQuality } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import { preallocateChartPrimaries } from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { runPageSchemaFill } from "@/lib/llm/pro/delivery/page-schema/fill-call";
import { runMarkDeliveryTask } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import {
  buildLabPromptOpts,
  labSyntheticFinalize,
} from "@/lib/llm/pro/delivery/lab/build-context";
import { saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import {
  LAB_STEP_DEFS,
  labStepDef,
  type DeliveryLabSession,
  type LabAttempt,
  type LabGateVerdict,
  type LabStepDef,
} from "@/lib/llm/pro/delivery/lab/types";

function taskForKey(key: DeliverySegmentKey) {
  return DELIVERY_TASKS.find((t) => t.paths[0] === key) ?? {
    name: `deliver_${key}`,
    paths: [key] as const,
  };
}

function ensurePage(
  lab: DeliveryLabSession,
  page: DeliverySegmentKey,
): NonNullable<DeliveryLabSession["artifacts"]["by_page"][DeliverySegmentKey]> {
  if (!lab.artifacts.by_page[page]) lab.artifacts.by_page[page] = {};
  return lab.artifacts.by_page[page]!;
}

function evidenceTreeFromPlan(
  key: DeliverySegmentKey,
  plan: DeepEvidencePlan,
): DeliveryArgumentTree {
  return {
    [key]: plan.units.map((u) => ({
      body: String(u.evidence ?? "").trim() || "(empty)",
      title: u.path,
    })),
  };
}

export type LabRunResult =
  | { ok: true; lab: DeliveryLabSession; attempt: LabAttempt }
  | { ok: false; reason: string; lab: DeliveryLabSession; attempt?: LabAttempt };

function canRunStep(lab: DeliveryLabSession, step_key: string): string | null {
  const idx = LAB_STEP_DEFS.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return "unknown_step";
  // May run cursor step, or re-run any already-reached step (≤ cursor)
  if (idx > lab.cursor_index) return "step_locked_approve_prior";
  const rec = lab.steps[step_key];
  if (rec?.status === "running") return "step_already_running";
  return null;
}

export async function runLabStep(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<LabRunResult> {
  const def = labStepDef(step_key);
  if (!def) return { ok: false, reason: "unknown_step", lab };

  const lock = canRunStep(lab, step_key);
  if (lock) return { ok: false, reason: lock, lab };

  const rec = lab.steps[step_key] ?? {
    step_key,
    status: "idle" as const,
    attempts: [],
  };
  rec.status = "running";
  lab.steps[step_key] = rec;
  await saveDeliveryLab(lab);

  const t0 = Date.now();
  const attempt_number = rec.attempts.length + 1;
  try {
    const result = await executeKind(lab, def);
    const attempt: LabAttempt = {
      attempt_number,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      generation_id: result.generation_id ?? null,
      tokens_used: result.tokens_used,
      input_payload: result.input_payload,
      raw_model_output: result.raw_model_output,
      processing_actions: result.processing_actions,
      gate_verdict: result.gate_verdict,
      output_to_next_stage: result.output_to_next_stage,
      error: result.error,
    };
    rec.attempts.push(attempt);
    rec.status = result.gate_verdict.passed && !result.error ? "done" : "failed";
    lab.steps[step_key] = rec;
    await saveDeliveryLab(lab);
    if (result.error || !result.gate_verdict.passed) {
      return {
        ok: false,
        reason: result.error ?? result.gate_verdict.failed_rule ?? "step_failed",
        lab,
        attempt,
      };
    }
    return { ok: true, lab, attempt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const attempt: LabAttempt = {
      attempt_number,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      input_payload: { step_key },
      raw_model_output: null,
      processing_actions: [],
      gate_verdict: { passed: false, failed_rule: "exception", detail: msg },
      output_to_next_stage: null,
      error: msg,
    };
    rec.attempts.push(attempt);
    rec.status = "failed";
    lab.steps[step_key] = rec;
    await saveDeliveryLab(lab);
    return { ok: false, reason: msg, lab, attempt };
  }
}

type ExecOut = {
  input_payload: unknown;
  raw_model_output: unknown;
  processing_actions: Array<{ action: string; detail?: string }>;
  gate_verdict: LabGateVerdict;
  output_to_next_stage: unknown;
  tokens_used?: number;
  generation_id?: string | null;
  error?: string;
};

async function executeKind(lab: DeliveryLabSession, def: LabStepDef): Promise<ExecOut> {
  const session_id = pojuCacheSessionId(lab.source.session_id ?? lab.lab_id);
  const page = def.page;

  if (def.kind === "bootstrap") {
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    const q = lab.source.original_question?.trim() ?? "";
    const passed = Boolean(structured) && q.length >= 2;
    return {
      input_payload: {
        has_base_analysis: lab.source.base_analysis != null,
        question_len: q.length,
        locale: lab.source.locale,
      },
      raw_model_output: null,
      processing_actions: [
        {
          action: "validate_structured",
          detail: structured ? "structured_ok" : "missing_structured",
        },
      ],
      gate_verdict: {
        passed,
        failed_rule: passed ? undefined : "bootstrap_invalid",
        detail: passed
          ? "盘 structured + 问题就绪"
          : "需要完整 base_analysis.structured 与 original_question",
      },
      output_to_next_stage: { structured_present: Boolean(structured), question: q },
    };
  }

  if (def.kind === "thesis") {
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    if (!structured) {
      return {
        input_payload: {},
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "no_structured" },
        output_to_next_stage: null,
        error: "no_structured",
      };
    }
    const agenda = [
      lab.source.original_question,
      ...(lab.source.covered_agenda ?? []).map(
        (a) => `${a.label}${a.answer ? `：${a.answer}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1200);
    const thesis = buildChartThesisFromStructured(structured, agenda || null);
    lab.artifacts.thesis = thesis;
    return {
      input_payload: {
        fingerprint: thesis.structured_fingerprint,
        agenda_len: agenda.length,
      },
      raw_model_output: thesis,
      processing_actions: [{ action: "buildChartThesisFromStructured" }],
      gate_verdict: {
        passed: thesis.dimensions.length >= 1,
        failed_rule: thesis.dimensions.length >= 1 ? undefined : "thesis_empty",
        detail: `dims=${thesis.dimensions.length}`,
      },
      output_to_next_stage: thesis,
    };
  }

  if (def.kind === "prealloc") {
    const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
    const sets = buildCategoryTokenSetsFromStructured(structured);
    const map = preallocateChartPrimaries({
      category_token_sets: sets,
      eastern_calc_slice_by_key: { metaphysics_action: null },
    });
    lab.artifacts.prealloc = map;
    return {
      input_payload: { unique: map.unique_strong_primaries },
      raw_model_output: map,
      processing_actions: [{ action: "preallocateChartPrimaries" }],
      gate_verdict: {
        passed: map.deep_slots_allocated > 0,
        detail: `allocated=${map.deep_slots_allocated} reuse_cap=${map.reuse_cap}`,
      },
      output_to_next_stage: map,
    };
  }

  if (!page) {
    if (def.kind === "assemble") {
      const lines: string[] = ["# Lab assemble preview", ""];
      for (const [k, v] of Object.entries(lab.artifacts.by_page)) {
        lines.push(`## ${k}`);
        if (v?.page_schema) {
          lines.push("```json");
          lines.push(JSON.stringify(v.page_schema, null, 2).slice(0, 8000));
          lines.push("```");
        } else {
          lines.push("(no page_schema)");
        }
        lines.push("");
      }
      const preview = lines.join("\n");
      lab.artifacts.assemble_preview = preview;
      return {
        input_payload: { pages: Object.keys(lab.artifacts.by_page) },
        raw_model_output: preview,
        processing_actions: [{ action: "assemble_preview" }],
        gate_verdict: { passed: true },
        output_to_next_stage: preview,
      };
    }
    return {
      input_payload: {},
      raw_model_output: null,
      processing_actions: [],
      gate_verdict: { passed: false, failed_rule: "missing_page" },
      output_to_next_stage: null,
      error: "missing_page",
    };
  }

  const { opts, p3_body_excerpt } = await buildLabPromptOpts(lab, page);

  if (def.kind === "assign") {
    const assigned = await runDeepEvidenceAssignCall({
      key: page,
      opts,
      session_id,
      timeout_ms: PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
      dispatch_attempt: 1,
    });
    if (!assigned.ok) {
      return {
        input_payload: { key: page, opts_keys: Object.keys(opts) },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: assigned.reason },
        output_to_next_stage: null,
        tokens_used: assigned.tokens_used,
        error: assigned.reason,
      };
    }
    ensurePage(lab, page).assignment = assigned.assignment;
    return {
      input_payload: {
        key: page,
        units_planned: assigned.assignment.units.length,
        chart_thesis: Boolean(opts.chart_thesis_block),
      },
      raw_model_output: assigned.assignment,
      processing_actions: [{ action: "runDeepEvidenceAssignCall" }],
      gate_verdict: {
        passed: assigned.assignment.units.length > 0,
        detail: `units=${assigned.assignment.units.length}`,
      },
      output_to_next_stage: assigned.assignment,
      tokens_used: assigned.tokens_used,
    };
  }

  if (def.kind === "write") {
    const assignment = ensurePage(lab, page).assignment as DeepEvidenceAssignment | undefined;
    if (!assignment?.units?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_assignment" },
        output_to_next_stage: null,
        error: "missing_assignment",
      };
    }
    const chunks = chunkPaths(assignment.units, DELIVERY_DISPATCH_WRITE_CHUNK_SIZE);
    const allUnits: DeepEvidenceUnit[] = [];
    let tokens = 0;
    const actions: Array<{ action: string; detail?: string }> = [];
    const rawChunks: unknown[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkUnits = chunks[i]!;
      const written = await runDeepEvidenceWriteChunk({
        key: page,
        opts,
        chunk: chunkUnits,
        session_id,
        timeout_ms: PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
        dispatch_attempt: 1,
      });
      tokens += written.tokens_used;
      actions.push({
        action: "write_chunk",
        detail: written.ok ? `c${i}:ok` : `c${i}:${written.reason}`,
      });
      if (!written.ok) {
        return {
          input_payload: { key: page, chunk: i, units: chunkUnits.length },
          raw_model_output: { chunks: rawChunks },
          processing_actions: actions,
          gate_verdict: { passed: false, failed_rule: written.reason },
          output_to_next_stage: null,
          tokens_used: tokens,
          error: written.reason,
        };
      }
      rawChunks.push(written.units);
      allUnits.push(...written.units);
    }
    ensurePage(lab, page).write_units = allUnits;
    return {
      input_payload: { key: page, chunks: chunks.length, units: assignment.units.length },
      raw_model_output: allUnits,
      processing_actions: actions,
      gate_verdict: { passed: allUnits.length > 0, detail: `units=${allUnits.length}` },
      output_to_next_stage: allUnits,
      tokens_used: tokens,
    };
  }

  if (def.kind === "write_merge") {
    const assignment = ensurePage(lab, page).assignment as DeepEvidenceAssignment | undefined;
    const write_units = (ensurePage(lab, page).write_units ?? []) as DeepEvidenceUnit[];
    if (!assignment || write_units.length === 0) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_write_units" },
        output_to_next_stage: null,
        error: "missing_write_units",
      };
    }
    const plan: DeepEvidencePlan = {
      page,
      units: write_units.map((u) => ({
        ...u,
        chart_anchors: u.chart_anchors?.length
          ? u.chart_anchors
          : assignment.units.find((a) => a.path === u.path)?.chart_anchors ?? [],
        moat_class:
          u.moat_class ??
          assignment.units.find((a) => a.path === u.path)?.moat_class ??
          null,
        calc_cite:
          u.calc_cite ??
          assignment.units.find((a) => a.path === u.path)?.calc_cite,
        unit_claim:
          u.unit_claim ??
          assignment.units.find((a) => a.path === u.path)?.unit_claim,
      })),
    };
    const quality = assessDeepEvidenceQuality(page, plan, {
      eastern_calc_slice: opts.eastern_calc_slice,
      prior_chart_anchors: opts.prior_chart_anchors,
      primary_reuse_cap: opts.primary_reuse_cap,
    });
    if (!quality.ok) {
      return {
        input_payload: { key: page, units: plan.units.length },
        raw_model_output: { plan, quality },
        processing_actions: [{ action: "assessDeepEvidenceQuality", detail: quality.reason }],
        gate_verdict: {
          passed: false,
          failed_rule: quality.reason,
          detail: quality.notes?.slice(0, 12).join(" | "),
        },
        output_to_next_stage: null,
        error: quality.reason,
      };
    }
    ensurePage(lab, page).plan = plan;
    return {
      input_payload: { key: page, units: plan.units.length },
      raw_model_output: { plan, notes: quality.notes },
      processing_actions: [{ action: "assessDeepEvidenceQuality", detail: "pass" }],
      gate_verdict: { passed: true, detail: quality.notes?.slice(0, 8).join(" | ") },
      output_to_next_stage: plan,
    };
  }

  if (def.kind === "fill") {
    const plan = ensurePage(lab, page).plan as DeepEvidencePlan | undefined;
    const finalize = labSyntheticFinalize(lab);
    const filled = await runPageSchemaFill({
      key: page,
      finalize,
      locale: lab.source.locale || "zh",
      session_id,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      thinking_effort: "high",
      question_expectation: opts.question_expectation,
      eastern_calc_slice: opts.eastern_calc_slice,
      risk_calc_slice: opts.risk_calc_slice,
      page_plan_slice: opts.page_plan_slice,
      reality_constraints: opts.reality_constraints,
      foundation_surface_feed: opts.foundation_surface_feed,
      science_means_feed: opts.science_means_feed,
      metaphysics_moat_feed: opts.metaphysics_moat_feed,
      risk_fuse_feed: opts.risk_fuse_feed,
      close_ritual_feed: opts.close_ritual_feed,
      prior_chart_anchors: opts.prior_chart_anchors,
      category_token_sets: opts.category_token_sets,
      structured_inventory: opts.structured_inventory,
      fill_mode: plan ? "compress" : "full",
      deep_evidence_plan: plan ?? null,
      p3_body_excerpt,
      primary_backup_hint: undefined,
    });
    if (!filled.ok) {
      return {
        input_payload: {
          key: page,
          fill_mode: plan ? "compress" : "full",
          has_plan: Boolean(plan),
        },
        raw_model_output: null,
        processing_actions: [{ action: "runPageSchemaFill", detail: filled.reason }],
        gate_verdict: { passed: false, failed_rule: filled.reason },
        output_to_next_stage: null,
        tokens_used: filled.tokens_used,
        error: filled.reason,
      };
    }
    ensurePage(lab, page).page_schema = filled.page;
    if (plan) {
      ensurePage(lab, page).evidence = evidenceTreeFromPlan(page, plan);
    }
    return {
      input_payload: {
        key: page,
        fill_mode: plan ? "compress" : "full",
        core: finalize[page]?.core_conclusion?.slice(0, 200),
      },
      raw_model_output: filled.page,
      processing_actions: [
        { action: "runPageSchemaFill", detail: `attempts=${filled.attempts}` },
        ...(filled.truncated ? [{ action: "truncated", detail: "true" }] : []),
      ],
      gate_verdict: { passed: true, detail: `attempts=${filled.attempts}` },
      output_to_next_stage: filled.page,
      tokens_used: filled.tokens_used,
    };
  }

  if (def.kind === "mark") {
    const evidence =
      (ensurePage(lab, page).evidence as DeliveryArgumentTree | undefined) ??
      (ensurePage(lab, page).plan
        ? evidenceTreeFromPlan(page, ensurePage(lab, page).plan as DeepEvidencePlan)
        : null);
    if (!evidence || !evidence[page]?.length) {
      return {
        input_payload: { key: page },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: { passed: false, failed_rule: "missing_evidence" },
        output_to_next_stage: null,
        error: "missing_evidence",
      };
    }
    const marked = await runMarkDeliveryTask(
      taskForKey(page),
      evidence,
      lab.source.locale || "zh",
      {
        session_id,
        original_question: lab.source.original_question,
        timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      },
    );
    if (!marked.ok) {
      return {
        input_payload: { key: page, evidence_args: evidence[page]?.length },
        raw_model_output: null,
        processing_actions: [{ action: "runMarkDeliveryTask", detail: marked.reason }],
        gate_verdict: { passed: false, failed_rule: marked.reason },
        output_to_next_stage: null,
        tokens_used: marked.tokens_used,
        error: marked.reason,
      };
    }
    ensurePage(lab, page).marked = marked.value;
    return {
      input_payload: { key: page, evidence_args: evidence[page]?.length },
      raw_model_output: marked.value,
      processing_actions: [
        { action: "runMarkDeliveryTask", detail: `mode=${marked.mode}` },
        { action: "polish+encode", detail: "inside mark task" },
      ],
      gate_verdict: { passed: true },
      output_to_next_stage: marked.value,
      tokens_used: marked.tokens_used,
    };
  }

  return {
    input_payload: { kind: def.kind },
    raw_model_output: null,
    processing_actions: [],
    gate_verdict: { passed: false, failed_rule: "unimplemented_kind" },
    output_to_next_stage: null,
    error: "unimplemented_kind",
  };
}

export async function approveLabStep(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  const idx = LAB_STEP_DEFS.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  if (idx !== lab.cursor_index) return { ok: false, reason: "not_current_cursor", lab };

  const rec = lab.steps[step_key];
  if (!rec || rec.attempts.length === 0) {
    return { ok: false, reason: "run_step_first", lab };
  }
  const last = rec.attempts[rec.attempts.length - 1]!;
  if (!last.gate_verdict.passed || last.error) {
    return { ok: false, reason: "gate_not_passed", lab };
  }
  rec.status = "approved";
  rec.approved_attempt = last.attempt_number;
  lab.steps[step_key] = rec;
  if (!lab.approved_order.includes(step_key)) lab.approved_order.push(step_key);
  if (lab.cursor_index < LAB_STEP_DEFS.length - 1) {
    lab.cursor_index += 1;
  }
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}

/** Allow re-run of current or earlier step; mark downstream approved as stale. */
export async function prepareLabRerun(
  lab: DeliveryLabSession,
  step_key: string,
): Promise<{ ok: true; lab: DeliveryLabSession } | { ok: false; reason: string; lab: DeliveryLabSession }> {
  const idx = LAB_STEP_DEFS.findIndex((s) => s.step_key === step_key);
  if (idx < 0) return { ok: false, reason: "unknown_step", lab };
  if (idx > lab.cursor_index) return { ok: false, reason: "step_locked", lab };

  lab.cursor_index = idx;
  for (let i = idx; i < LAB_STEP_DEFS.length; i++) {
    const key = LAB_STEP_DEFS[i]!.step_key;
    const rec = lab.steps[key];
    if (!rec) continue;
    if (rec.status === "approved" || rec.status === "done") {
      rec.status = i === idx ? "idle" : "stale";
      rec.approved_attempt = undefined;
      lab.steps[key] = rec;
    }
  }
  lab.approved_order = lab.approved_order.filter((k) => {
    const i = LAB_STEP_DEFS.findIndex((s) => s.step_key === k);
    return i >= 0 && i < idx;
  });
  await saveDeliveryLab(lab);
  return { ok: true, lab };
}
