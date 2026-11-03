/**
 * Generation TaskContext <-> Registry consistency validator (Contract §9.4 / §9.5).
 * P3-99 / P3-100 — hard-fail at product runtime boundaries; never auto-fix or delete.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type { GenerationRegistryEntry, GenerationTaskContext, GenerationType } from "./types";
import {
  GenerationError,
  GENERATION_STATE_INCONSISTENT,
} from "./types";
import { findRegistryEntry } from "./registry";

export type GenerationConsistencyBoundary =
  | "job_reload"
  | "task_context_restore"
  | "path_b_replay"
  | "path_c_register"
  | "formal_result_read"
  | "formal_result_commit";

export type GenerationConsistencyCase =
  | "A_TASK_COMPLETED_REGISTRY_MISSING_OR_INCOMPLETE"
  | "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED";

export interface GenerationConsistencyDiagnosis {
  code: typeof GENERATION_STATE_INCONSISTENT;
  case: GenerationConsistencyCase;
  boundary: GenerationConsistencyBoundary;
  session_id: string;
  client_task_id: string;
  generation_type: GenerationType | null;
  generation_id: string | null;
  task_status: string | null;
  registry_status: string | null;
  detail: string;
}

export class GenerationStateInconsistentError extends GenerationError {
  readonly diagnosis: GenerationConsistencyDiagnosis;
  constructor(diagnosis: GenerationConsistencyDiagnosis) {
    super(
      GENERATION_STATE_INCONSISTENT,
      `[${diagnosis.case}@${diagnosis.boundary}] ${diagnosis.detail}`,
    );
    this.name = "GenerationStateInconsistentError";
    this.diagnosis = diagnosis;
  }
}

export function isGenerationStateInconsistentError(
  err: unknown,
): err is GenerationStateInconsistentError {
  return err instanceof GenerationStateInconsistentError;
}

function findTaskContextLocal(
  tasks: readonly GenerationTaskContext[] | undefined | null,
  client_task_id: string,
): GenerationTaskContext | undefined {
  return (tasks ?? []).find((t) => t.client_task_id === client_task_id);
}

function findRegistryForTask(
  registry: readonly GenerationRegistryEntry[] | undefined | null,
  task: GenerationTaskContext,
): GenerationRegistryEntry | undefined {
  if (task.generation_type && task.generation_id) {
    const byId = findRegistryEntry(registry, task.generation_type, task.generation_id);
    if (byId) return byId;
  }
  return (registry ?? []).find((e) => e.client_task_id === task.client_task_id);
}

function findTaskForRegistry(
  tasks: readonly GenerationTaskContext[] | undefined | null,
  entry: GenerationRegistryEntry,
): GenerationTaskContext | undefined {
  const byClient = findTaskContextLocal(tasks, entry.client_task_id);
  if (byClient) return byClient;
  return (tasks ?? []).find(
    (t) =>
      t.generation_id === entry.generation_id &&
      t.generation_type === entry.generation_type,
  );
}

function throwInconsistent(
  diagnosis: Omit<GenerationConsistencyDiagnosis, "code">,
): never {
  const full: GenerationConsistencyDiagnosis = {
    code: GENERATION_STATE_INCONSISTENT,
    ...diagnosis,
  };
  console.error("[generation-consistency]", JSON.stringify(full));
  throw new GenerationStateInconsistentError(full);
}

export interface AssertGenerationConsistencyInput {
  session_id: string;
  client_task_id: string;
  boundary: GenerationConsistencyBoundary;
  generation_task_contexts?: readonly GenerationTaskContext[] | null;
  generation_registry?: readonly GenerationRegistryEntry[] | null;
  generation_type?: GenerationType;
  generation_id?: string | null;
}

/**
 * Unified TaskContext <-> Registry consistency check.
 * Case A: TaskContext completed but Registry missing / not completed.
 * Case B: Registry completed but TaskContext missing / not completed.
 * Does not mutate session state.
 */
export function assertGenerationTaskRegistryConsistency(
  input: AssertGenerationConsistencyInput,
): void {
  const client_task_id = input.client_task_id?.trim();
  if (!client_task_id) {
    throw new GenerationError(
      GENERATION_STATE_INCONSISTENT,
      "client_task_id required for consistency check",
    );
  }

  const tasks = input.generation_task_contexts ?? [];
  const registry = input.generation_registry ?? [];
  const task = findTaskContextLocal(tasks, client_task_id);

  let reg: GenerationRegistryEntry | undefined;
  if (task) {
    reg = findRegistryForTask(registry, task);
  }
  if (!reg && input.generation_type && input.generation_id) {
    reg = findRegistryEntry(registry, input.generation_type, input.generation_id);
  }
  if (!reg) {
    reg = registry.find((e) => e.client_task_id === client_task_id);
  }

  if (task && task.status === "completed") {
    if (!reg || reg.status !== "completed") {
      throwInconsistent({
        case: "A_TASK_COMPLETED_REGISTRY_MISSING_OR_INCOMPLETE",
        boundary: input.boundary,
        session_id: input.session_id,
        client_task_id,
        generation_type: task.generation_type ?? input.generation_type ?? null,
        generation_id: task.generation_id ?? input.generation_id ?? null,
        task_status: task.status,
        registry_status: reg?.status ?? null,
        detail:
          "TaskContext.status=completed but Registry missing or not completed; refusing Generation use",
      });
    }
  }

  if (reg && reg.status === "completed") {
    const taskForReg = task ?? findTaskForRegistry(tasks, reg);
    if (!taskForReg || taskForReg.status !== "completed") {
      throwInconsistent({
        case: "B_REGISTRY_COMPLETED_TASK_NOT_COMPLETED",
        boundary: input.boundary,
        session_id: input.session_id,
        client_task_id: reg.client_task_id || client_task_id,
        generation_type: reg.generation_type,
        generation_id: reg.generation_id,
        task_status: taskForReg?.status ?? null,
        registry_status: reg.status,
        detail:
          "Registry.status=completed but TaskContext missing or not completed; refusing to treat as normal completion",
      });
    }
  }
}

export function assertSessionGenerationConsistency(
  session: Pick<
    POJUSessionState,
    "session_id" | "generation_task_contexts" | "generation_registry"
  >,
  client_task_id: string,
  boundary: GenerationConsistencyBoundary,
  identity?: { generation_type?: GenerationType; generation_id?: string | null },
): void {
  assertGenerationTaskRegistryConsistency({
    session_id: session.session_id,
    client_task_id,
    boundary,
    generation_task_contexts: session.generation_task_contexts,
    generation_registry: session.generation_registry,
    generation_type: identity?.generation_type,
    generation_id: identity?.generation_id,
  });
}

export function assertFormalGenerationResultReadable(
  session: Pick<
    POJUSessionState,
    "session_id" | "generation_task_contexts" | "generation_registry"
  >,
  client_task_id: string,
  identity?: { generation_type?: GenerationType; generation_id?: string | null },
): void {
  assertSessionGenerationConsistency(
    session,
    client_task_id,
    "formal_result_read",
    identity,
  );
}
