/**
 * Generation TaskContext API — Contract §6.
 * pending_create CAS (session+1, dc unchanged) with dc-base recheck (§6.3 step 8).
 * Reload restore keeps original client_task_id / generation_base_revision / fingerprint / job_id.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  mutatePOJUSession,
  type MutatePOJUSessionOptions,
  type CasWritePOJUSessionResult,
} from "@/lib/poju/session-mutation";
import {
  assertLegalTaskTransition,
  GenerationError,
  GENERATION_FIELD_INCOMPLETE,
  type GenerationTaskContext,
  type GenerationTaskStatus,
  type GenerationType,
} from "./types";
import { assertValidProductionSessionId } from "./session-id";
import { assertSessionGenerationConsistency } from "./consistency";
import { defaultLoadForGeneration } from "./task-context-load";

export function generateClientTaskId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `ctask_${rand.slice(0, 24)}`;
}

export function findTaskContext(
  tasks: readonly GenerationTaskContext[] | undefined | null,
  client_task_id: string,
): GenerationTaskContext | undefined {
  return (tasks ?? []).find((t) => t.client_task_id === client_task_id);
}

export function listTaskContexts(
  session: Pick<POJUSessionState, "generation_task_contexts">,
): GenerationTaskContext[] {
  return [...(session.generation_task_contexts ?? [])];
}

/**
 * Reload restore — Contract §6.4.
 * Returns the persisted task verbatim; NEVER regenerates identity fields.
 */
export function restoreTaskContextOnReload(
  session: Pick<
    POJUSessionState,
    "generation_task_contexts" | "generation_registry" | "session_id"
  >,
  client_task_id: string,
  opts?: { boundary?: "job_reload" | "task_context_restore" },
): GenerationTaskContext | null {
  assertValidProductionSessionId(session.session_id, "reload");
  const task = findTaskContext(session.generation_task_contexts, client_task_id);
  if (!task) return null;
  if (task.session_id !== session.session_id) {
    throw new GenerationError(
      "GENERATION_IDENTITY_COLLISION",
      "TaskContext session_id does not match session",
    );
  }
  // P3-99/100 — hard-block inconsistent TaskContext/Registry on reload/restore.
  assertSessionGenerationConsistency(
    session,
    client_task_id,
    opts?.boundary ?? "task_context_restore",
    {
      generation_type: task.generation_type,
      generation_id: task.generation_id,
    },
  );
  return { ...task };
}

/**
 * Job Reload / Recovery entry — same restore, explicit job_reload boundary (P3-99/100).
 */
export function restoreGenerationOnJobReload(
  session: Pick<
    POJUSessionState,
    "generation_task_contexts" | "generation_registry" | "session_id"
  >,
  client_task_id: string,
): GenerationTaskContext | null {
  return restoreTaskContextOnReload(session, client_task_id, {
    boundary: "job_reload",
  });
}

function upsertTask(
  tasks: readonly GenerationTaskContext[] | undefined | null,
  next: GenerationTaskContext,
): GenerationTaskContext[] {
  const list = [...(tasks ?? [])];
  const idx = list.findIndex((t) => t.client_task_id === next.client_task_id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return list;
}

export interface CreatePendingTaskInput {
  session_id: string;
  generation_type: GenerationType;
  fingerprint: string;
  fingerprint_version: string;
  /** When re-entering an existing pending identity (retry), pass the original. */
  client_task_id?: string;
  now?: string;
}

/**
 * Contract §6.3 phase 1 — local pre-register pending_create via Session CAS.
 * session_revision +1, dc_write_revision unchanged.
 * CAS rechecks row.dc_write_revision === generation_base_revision (§6.3 step 8).
 */
export async function createPendingGenerationTaskContext(
  input: CreatePendingTaskInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<{ task: GenerationTaskContext; write: CasWritePOJUSessionResult }> {
  const session_id = assertValidProductionSessionId(input.session_id, "pending_create");
  if (!input.fingerprint?.trim() || !input.fingerprint_version?.trim()) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "fingerprint required");
  }
  const client_task_id = input.client_task_id?.trim() || generateClientTaskId();
  const now = input.now ?? new Date().toISOString();

  const load = opts.load ?? defaultLoadForGeneration;
  const loaded = await load(session_id);
  if (!loaded) {
    throw new GenerationError("SESSION_CAS_CONFLICT", "session not found");
  }
  const d0 = loaded.state.dc_write_revision ?? 0;

  let createdTask: GenerationTaskContext | null = null;

  const write = await mutatePOJUSession(
    session_id,
    {
      operation_id: `gen_pending_create:${client_task_id}`,
      kind: "session_patch",
      bump_dc: false,
      generation_base_revision: d0,
      apply: (latest) => {
        const existing = findTaskContext(latest.generation_task_contexts, client_task_id);
        if (existing) {
          if (
            existing.fingerprint !== input.fingerprint ||
            existing.fingerprint_version !== input.fingerprint_version ||
            existing.generation_type !== input.generation_type
          ) {
            throw new GenerationError(
              "GENERATION_IDENTITY_COLLISION",
              "client_task_id already bound to different fingerprint/type",
            );
          }
          // Keep original identity — never rebase / regenerate.
          createdTask = existing;
          return latest;
        }
        const task: GenerationTaskContext = {
          session_id,
          client_task_id,
          generation_type: input.generation_type,
          generation_id: null,
          generation_base_revision: d0,
          fingerprint: input.fingerprint,
          fingerprint_version: input.fingerprint_version,
          job_id: null,
          sync_task_id: null,
          status: "pending_create",
          created_at: now,
          updated_at: now,
          completed_at: null,
          error_code: null,
        };
        createdTask = task;
        return {
          ...latest,
          generation_task_contexts: upsertTask(latest.generation_task_contexts, task),
        };
      },
    },
    { ...opts, load },
  );

  if (!createdTask) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "pending_create produced no task");
  }
  return { task: createdTask, write };
}

/** Alias kept for call sites / docs that name the §6.3 step-8 gate explicitly. */
export const createPendingGenerationTaskContextGuarded = createPendingGenerationTaskContext;

export interface BindJobInput {
  session_id: string;
  client_task_id: string;
  job_id: string;
  generation_id?: string;
  sync_task_id?: string | null;
  now?: string;
}

/**
 * Contract §6.3 phase 2 — bind remote job_id onto original pending_create → running.
 * Never creates a new client_task_id.
 */
export async function bindJobToGenerationTaskContext(
  input: BindJobInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<{ task: GenerationTaskContext; write: CasWritePOJUSessionResult }> {
  const session_id = assertValidProductionSessionId(input.session_id, "bind_job");
  const client_task_id = input.client_task_id.trim();
  const job_id = input.job_id.trim();
  if (!client_task_id || !job_id) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "client_task_id and job_id required");
  }
  const now = input.now ?? new Date().toISOString();
  let bound: GenerationTaskContext | null = null;

  const write = await mutatePOJUSession(
    session_id,
    {
      operation_id: `gen_bind_job:${client_task_id}:${job_id}`,
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const existing = findTaskContext(latest.generation_task_contexts, client_task_id);
        if (!existing) {
          throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "TaskContext not found for bind");
        }
        if (existing.job_id && existing.job_id !== job_id) {
          throw new GenerationError(
            "GENERATION_IDENTITY_COLLISION",
            "job_id already bound and differs",
          );
        }
        if (existing.job_id === job_id && existing.status === "running") {
          bound = existing;
          return latest;
        }
        assertLegalTaskTransition(existing.status, "running");
        const next: GenerationTaskContext = {
          ...existing,
          job_id,
          generation_id: input.generation_id?.trim() || job_id,
          sync_task_id:
            input.sync_task_id !== undefined ? input.sync_task_id : existing.sync_task_id,
          status: "running",
          updated_at: now,
        };
        bound = next;
        return {
          ...latest,
          generation_task_contexts: upsertTask(latest.generation_task_contexts, next),
        };
      },
    },
    opts,
  );

  if (!bound) throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "bind produced no task");
  return { task: bound, write };
}

export async function transitionGenerationTaskContext(
  input: {
    session_id: string;
    client_task_id: string;
    to: GenerationTaskStatus;
    error_code?: string | null;
    generation_id?: string | null;
    now?: string;
  },
  opts: MutatePOJUSessionOptions = {},
): Promise<{ task: GenerationTaskContext; write: CasWritePOJUSessionResult }> {
  const session_id = assertValidProductionSessionId(input.session_id, "transition");
  const now = input.now ?? new Date().toISOString();
  let updated: GenerationTaskContext | null = null;

  const write = await mutatePOJUSession(
    session_id,
    {
      operation_id: `gen_transition:${input.client_task_id}:${input.to}:${now}`,
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const existing = findTaskContext(latest.generation_task_contexts, input.client_task_id);
        if (!existing) {
          throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "TaskContext not found");
        }
        if (existing.status === input.to) {
          updated = existing;
          return latest;
        }
        assertLegalTaskTransition(existing.status, input.to);
        const next: GenerationTaskContext = {
          ...existing,
          status: input.to,
          updated_at: now,
          error_code: input.error_code !== undefined ? input.error_code : existing.error_code,
          generation_id:
            input.generation_id !== undefined ? input.generation_id : existing.generation_id,
          completed_at: input.to === "completed" ? now : existing.completed_at,
        };
        updated = next;
        return {
          ...latest,
          generation_task_contexts: upsertTask(latest.generation_task_contexts, next),
        };
      },
    },
    opts,
  );

  if (!updated) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "transition produced no task");
  }
  return { task: updated, write };
}
