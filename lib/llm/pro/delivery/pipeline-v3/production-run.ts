/**
 * Production mount for pipeline v3.
 *
 * Live final-delivery does not read the Lab create flag. Unset env runs
 * judgment → body → gate → body_polish → evidence_soft via `runLabStepV3`,
 * one model call per worker so the 18-hop continue fuse stays untouched.
 * Page schemas land in the existing segment checkpoints. Assemble still
 * calls `mergeDeliveryToMarkdown`, and the shelf folds those v1 papers
 * onto faces 01–08 (07 from the topic slice, 03 from the appendix builder).
 *
 * Explicit rollback: `DELIVERY_PIPELINE=legacy` keeps assign/write/fill.
 * A missing page schema or marked evidence fails the job. It does not
 * switch the book back to the legacy DAG.
 */

import { kv } from "@/lib/kv/client";
import { deliveryDispatchTaskLeaseKey } from "@/lib/llm/pro/delivery/dispatch/task-store";
import {
  fillMissingDeliverySegments,
  type DeliveryArgument,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { deliverySectionHeading } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  saveDeliverySegmentProgress,
  saveDeliverySegmentReady,
  saveDeliveryStageCheckpoint,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  approveLabStepV3,
  runLabStepV3,
} from "@/lib/llm/pro/delivery/lab/run-step-v3";
import {
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import type { DeliveryLabSession, LabSource } from "@/lib/llm/pro/delivery/lab/types";
import {
  LAB_STEP_DEFS_V3,
  initLabStepsV3,
  type BodyPolishLocale,
} from "@/lib/llm/pro/delivery/lab/types-v3";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { DeliverySegmentReady, SegmentChainProgress } from "@/lib/llm/pro/delivery/run-segment-chain";
import { V1_DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/segment-key-alias";
import { failXhighJob, releaseXhighSessionLock, setXhighJobContent } from "@/lib/poju/xhigh-job-store";
import { POLISH_ACCEPTANCE_CONTINUE_RULE } from "@/lib/llm/pro/delivery/pipeline-v3/acceptance-retry";
import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

/** One in-flight v3 step. Reused so the task lease serializes workers. */
export const PRODUCTION_V3_TASK_ID = "v3.step";

const V3_CONTINUE_RULES = new Set([
  "write_dispatch_continue",
  "soft_dispatch_continue",
  POLISH_ACCEPTANCE_CONTINUE_RULE,
]);

const BOOK_ASSEMBLE_STEP = "book.assemble";

export type ProductionV3TaskOutcome =
  | { ok: true; next: "republish" | "wake_segments" }
  | { ok: false; reason: string };

export function isProductionV3Task(task_id: string): boolean {
  return task_id === PRODUCTION_V3_TASK_ID;
}

export function productionV3LabId(job_id: string): string {
  return `prodv3_${job_id}`;
}

export function productionPolishLocale(locale: string): BodyPolishLocale {
  const base = locale.trim().toLowerCase();
  if (base.startsWith("zh")) return "zh";
  if (base.startsWith("fr")) return "fr";
  if (base.startsWith("es")) return "es";
  return "en";
}

export function isV3DispatchContinue(rule: string | null | undefined): boolean {
  return V3_CONTINUE_RULES.has((rule ?? "").trim());
}

/** Content papers v3 must finish before `book.assemble`. Same list the shelf folds. */
export function productionV3ContentKeys(): readonly DeliverySegmentKey[] {
  const keys: DeliverySegmentKey[] = [];
  for (const def of LAB_STEP_DEFS_V3) {
    if (def.step_key === BOOK_ASSEMBLE_STEP) break;
    if (def.page && !keys.includes(def.page)) keys.push(def.page);
  }
  return keys;
}

export async function productionV3LeaseHeld(job_id: string): Promise<boolean> {
  const raw = await kv.get(deliveryDispatchTaskLeaseKey(job_id, PRODUCTION_V3_TASK_ID));
  return Boolean(raw);
}

function labSourceFromJob(input: FinalDeliveryJobInput): LabSource {
  const desired = input.agent_v2.context_collected?.desired_outcome;
  return {
    locale: input.locale,
    original_question: input.agent_v2.original_question,
    desired_outcome: typeof desired === "string" ? desired : undefined,
    base_analysis: input.base_analysis,
    breakthrough_core: input.breakthrough_core,
    covered_agenda: input.covered_agenda,
    session_id: input.session_id,
    question_category: input.agent_v2.question_category ?? null,
    pivot_chart_path: input.pivot_chart_path ?? null,
    partner_bazi: input.partner_bazi ?? null,
    dyad_compat_summary: input.dyad_compat_summary ?? null,
    dyad_matrix_pack: input.dyad_matrix_pack ?? null,
    joint_decision: input.joint_decision ?? null,
  };
}

export async function ensureProductionV3Lab(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<DeliveryLabSession> {
  const lab_id = productionV3LabId(job_id);
  const existing = await loadDeliveryLab(lab_id);
  if (existing?.pipeline === "v3_three_step") return existing;
  const now = Date.now();
  const session: DeliveryLabSession = {
    version: 1,
    lab_id,
    created_at: now,
    updated_at: now,
    ops_user: "production",
    source: labSourceFromJob(input),
    pipeline: "v3_three_step",
    cursor_index: 0,
    steps: initLabStepsV3(),
    artifacts: { by_page: {} },
    approved_order: [],
    mode: "delivery_only",
  };
  await saveDeliveryLab(session);
  return session;
}

function currentStep(lab: DeliveryLabSession) {
  return LAB_STEP_DEFS_V3[lab.cursor_index] ?? null;
}

/** Quality failure already stored on the cursor. Supply continues are not blocks. */
export function productionV3HardBlock(lab: DeliveryLabSession): string | null {
  if (lab.steps[BOOK_ASSEMBLE_STEP]?.status === "approved") return null;
  const def = currentStep(lab);
  if (!def || def.kind.startsWith("companion")) return "v3_cursor_past_book";
  const rec = lab.steps[def.step_key];
  if (rec?.status !== "failed") return null;
  const rule = rec.attempts[rec.attempts.length - 1]?.gate_verdict.failed_rule ?? "";
  if (isV3DispatchContinue(rule)) return null;
  return `v3_step_failed:${def.step_key}:${rule || "failed"}`;
}

function isPageData(value: unknown): value is DeliveryPageData {
  return Boolean(value) && typeof value === "object" && "page" in (value as object);
}

function argsForKey(tree: unknown, key: string): DeliveryArgument[] | null {
  if (!tree || typeof tree !== "object") return null;
  const row = (tree as Record<string, unknown>)[key];
  if (!Array.isArray(row) || row.length === 0) return null;
  const args: DeliveryArgument[] = [];
  for (const item of row) {
    if (!item || typeof item !== "object") return null;
    const body = (item as { body?: unknown }).body;
    if (typeof body !== "string" || !body.trim()) return null;
    const evidence = (item as { evidence?: unknown }).evidence;
    const anchors = (item as { chart_anchors?: unknown }).chart_anchors;
    const arg: DeliveryArgument = { body };
    if (typeof evidence === "string" && evidence.trim()) arg.evidence = evidence;
    if (Array.isArray(anchors)) {
      const cleaned = anchors.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
      if (cleaned.length) arg.chart_anchors = cleaned;
    }
    args.push(arg);
  }
  return args;
}

export type ProductionV3BookPlan =
  | {
      ok: true;
      narrative: DeliveryArgumentTree;
      marked: DeliveryArgumentTree;
      schemas: Partial<Record<DeliverySegmentKey, DeliveryPageData>>;
      tokens_used: number;
    }
  | { ok: false; reason: string };

/**
 * Build the trees assemble already merges. Missing schema or (except the
 * brief) missing soft-marked evidence is a hard fail — never a legacy fill.
 */
export function planProductionV3Book(lab: DeliveryLabSession): ProductionV3BookPlan {
  if (lab.steps[BOOK_ASSEMBLE_STEP]?.status !== "approved") {
    return { ok: false, reason: "v3_assemble_not_approved" };
  }
  const narrative: DeliveryArgumentTree = {};
  const marked: DeliveryArgumentTree = {};
  const schemas: Partial<Record<DeliverySegmentKey, DeliveryPageData>> = {};
  let tokens_used = 0;
  for (const rec of Object.values(lab.steps)) {
    for (const attempt of rec?.attempts ?? []) {
      if (typeof attempt.tokens_used === "number") tokens_used += attempt.tokens_used;
    }
  }

  for (const key of V1_DELIVERY_SEGMENT_KEYS) {
    const art = lab.artifacts.by_page[key];
    const schema = art?.page_schema;
    if (!isPageData(schema)) {
      return { ok: false, reason: `v3_missing_page_schema:${key}` };
    }
    let bodies: DeliveryArgument[];
    try {
      bodies = pageSchemaToArgumentBodies(schema);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: `v3_page_unreadable:${key}:${msg}` };
    }
    if (!bodies.length) {
      return { ok: false, reason: `v3_empty_page:${key}` };
    }
    narrative[key] = bodies;
    schemas[key] = schema;
    if (key === "decision_brief") continue;
    const evidence = argsForKey(art?.marked, key);
    if (!evidence) {
      return { ok: false, reason: `v3_missing_marked:${key}` };
    }
    marked[key] = evidence;
  }

  return { ok: true, narrative, marked, schemas, tokens_used };
}

export async function persistProductionV3Book(
  job_id: string,
  lab: DeliveryLabSession,
  locale: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const plan = planProductionV3Book(lab);
  if (!plan.ok) return plan;

  for (const key of V1_DELIVERY_SEGMENT_KEYS) {
    const schema = plan.schemas[key];
    if (!schema) return { ok: false, reason: `v3_missing_page_schema:${key}` };
    const bodies = plan.narrative[key] ?? [];
    const evidence = plan.marked[key] ?? [];
    const progress: SegmentChainProgress = {
      key,
      phase: "done",
      narrative: { [key]: bodies },
      marked: evidence.length ? { [key]: evidence } : undefined,
      page_schema: schema,
      tokens_used: 0,
    };
    await saveDeliverySegmentProgress(job_id, progress);
    const ready: DeliverySegmentReady = {
      key,
      heading: deliverySectionHeading(key, locale),
      body_markdown: bodies.map((arg) => arg.body).join("\n\n"),
      evidence_markdown: evidence
        .map((arg) => (arg.evidence ?? "").trim())
        .filter(Boolean)
        .join("\n\n"),
      page_schema: schema,
      evidence_ready: key === "decision_brief" || evidence.length > 0,
      locale,
    };
    await saveDeliverySegmentReady(job_id, ready);
  }

  await saveDeliveryStageCheckpoint(job_id, {
    stage: "finalize",
    value: fillMissingDeliverySegments({}),
    tokens_used: 0,
    model: "v3_three_step",
  });
  await saveDeliveryStageCheckpoint(job_id, {
    stage: "segments",
    value: plan.marked,
    narrative: plan.narrative,
    tokens_used: plan.tokens_used,
  });
  return { ok: true };
}

async function advanceToNextLlm(
  lab: DeliveryLabSession,
  polish_locale: BodyPolishLocale,
): Promise<
  | { kind: "llm"; lab: DeliveryLabSession; step_key: string }
  | { kind: "book"; lab: DeliveryLabSession }
  | { kind: "fail"; reason: string; lab: DeliveryLabSession }
> {
  for (let i = 0; i < 60; i++) {
    if (lab.steps[BOOK_ASSEMBLE_STEP]?.status === "approved") {
      return { kind: "book", lab };
    }
    const def = currentStep(lab);
    if (!def || def.kind.startsWith("companion")) {
      return { kind: "fail", reason: "v3_cursor_past_book", lab };
    }
    const rec = lab.steps[def.step_key];
    if (rec?.status === "running") {
      rec.status = "idle";
      lab.steps[def.step_key] = rec;
      await saveDeliveryLab(lab);
    }
    if (rec?.status === "failed") {
      const rule = rec.attempts[rec.attempts.length - 1]?.gate_verdict.failed_rule ?? "";
      if (!isV3DispatchContinue(rule)) {
        return {
          kind: "fail",
          reason: `v3_step_failed:${def.step_key}:${rule || "failed"}`,
          lab,
        };
      }
    }
    if (rec?.status === "done") {
      const last = rec.attempts[rec.attempts.length - 1];
      if (last?.gate_verdict.passed && !last.error) {
        const approved = await approveLabStepV3(lab, def.step_key);
        if (!approved.ok) {
          return { kind: "fail", reason: `v3_approve_failed:${def.step_key}:${approved.reason}`, lab: approved.lab };
        }
        lab = approved.lab;
        continue;
      }
    }
    if (!def.uses_llm) {
      const run = await runLabStepV3(lab, def.step_key, { polish_locale });
      if (!run.ok) {
        const rule = run.attempt?.gate_verdict.failed_rule ?? run.reason;
        return { kind: "fail", reason: `v3_step_failed:${def.step_key}:${rule}`, lab: run.lab };
      }
      const approved = await approveLabStepV3(run.lab, def.step_key);
      if (!approved.ok) {
        return { kind: "fail", reason: `v3_approve_failed:${def.step_key}:${approved.reason}`, lab: approved.lab };
      }
      lab = approved.lab;
      continue;
    }
    return { kind: "llm", lab, step_key: def.step_key };
  }
  return { kind: "fail", reason: "v3_local_drain_exceeded", lab };
}

/**
 * One worker invoke: drain local steps (bootstrap, thesis, prealloc, gate,
 * assemble), then at most one model call. Supply-side chunk/escape continues
 * republish the same task. A polish thickness miss arms one in-step
 * acceptance continue (`polish_acceptance_continue`); the second miss is
 * returned, not retried here.
 */
export async function runProductionV3Task(input: {
  job_id: string;
  jobInput: FinalDeliveryJobInput;
}): Promise<ProductionV3TaskOutcome> {
  const { job_id, jobInput } = input;
  const polish_locale = productionPolishLocale(jobInput.locale);
  let lab = await ensureProductionV3Lab(job_id, jobInput);
  const blocked = productionV3HardBlock(lab);
  if (blocked) return { ok: false, reason: blocked };

  const drained = await advanceToNextLlm(lab, polish_locale);
  lab = drained.lab;
  if (drained.kind === "fail") return { ok: false, reason: drained.reason };
  if (drained.kind === "book") {
    const saved = await persistProductionV3Book(job_id, lab, jobInput.locale);
    if (!saved.ok) return saved;
    logDeliveryStep({
      job_id,
      level: "ok",
      step: "v3 book persisted",
      detail: "segments checkpoint",
    });
    return { ok: true, next: "wake_segments" };
  }

  await setXhighJobContent(job_id, `v3_step:${drained.step_key}:${Date.now()}`).catch(() => undefined);
  const run = await runLabStepV3(lab, drained.step_key, { polish_locale });
  const rule = run.attempt?.gate_verdict.failed_rule ?? (run.ok ? "" : run.reason);
  if (isV3DispatchContinue(rule)) {
    logDeliveryStep({
      job_id,
      level: "hop",
      step: `v3 continue ${drained.step_key}`,
      detail: rule,
    });
    return { ok: true, next: "republish" };
  }
  if (!run.ok) {
    return { ok: false, reason: `v3_step_failed:${drained.step_key}:${run.reason}` };
  }
  const approved = await approveLabStepV3(run.lab, drained.step_key);
  if (!approved.ok) {
    return { ok: false, reason: `v3_approve_failed:${drained.step_key}:${approved.reason}` };
  }
  logDeliveryStep({
    job_id,
    level: "ok",
    step: `v3 ${drained.step_key}`,
    detail: "approved",
  });
  return { ok: true, next: "republish" };
}

export async function settleProductionV3Task(input: {
  job_id: string;
  session_id: string;
  outcome: ProductionV3TaskOutcome;
  republish: () => Promise<"published" | "failed">;
  wakeSegments: () => Promise<unknown>;
}): Promise<void> {
  if (!input.outcome.ok) {
    await failProductionV3Job({
      job_id: input.job_id,
      session_id: input.session_id,
      reason: input.outcome.reason,
    });
    return;
  }
  if (input.outcome.next === "wake_segments") {
    await input.wakeSegments();
    return;
  }
  const published = await input.republish();
  if (published !== "published") {
    await failProductionV3Job({
      job_id: input.job_id,
      session_id: input.session_id,
      reason: "v3_worker_republish_failed",
    });
  }
}

export async function failProductionV3Job(input: {
  job_id: string;
  session_id: string;
  reason: string;
}): Promise<void> {
  const where = "segments/v3.step";
  console.error("[final-delivery-STOP]", {
    job_id: input.job_id,
    stage: "segments",
    where,
    reason: input.reason,
    pipeline: "v3_three_step",
  });
  logDeliveryStep({
    job_id: input.job_id,
    level: "stop",
    step: "v3 step failed",
    detail: input.reason.slice(0, 180),
  });
  await failXhighJob(input.job_id, `STOP at ${where}: ${input.reason}`, {
    retryable: false,
    failure_reason: "v3_step_failed",
    current_stage: "segments",
    error_detail: JSON.stringify({
      stage: "segments",
      task: PRODUCTION_V3_TASK_ID,
      where,
      reason: input.reason,
      pipeline: "v3_three_step",
    }),
    accumulated_content: `failed:${where}:${input.reason}`.slice(0, 500),
  });
  await releaseXhighSessionLock("final_delivery", input.session_id);
}
