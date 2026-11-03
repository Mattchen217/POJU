/**
 * Phase 3 S2 — Generation identity / Registry / Binding / TaskContext types.
 * Authority: Final Engineering Contract §4–§6, §9 (field names verbatim).
 * Mapping `base_revision` ≡ Contract `generation_base_revision` — Contract name only.
 */

export type GenerationType = "call_a_hypothesis" | "call_b_dir";

/** Contract §5.1 — completed-only Registry entry. */
export interface GenerationRegistryEntry {
  session_id: string;
  generation_type: GenerationType;
  generation_id: string;
  client_task_id: string;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  job_id: string | null;
  sync_task_id: string | null;

  status: "completed";
  result_marker: string;
  committed_session_revision: number;
  committed_dc_write_revision: number;
  committed_context_id: string;
  committed_context_version: number;
  committed_context_hash: string | null;

  completed_at: string;
}

/** Contract §5.2 */
export interface GenerationOperationBinding {
  session_id: string;
  idempotency_key: string;

  generation_type: GenerationType;
  generation_id: string;
  client_task_id: string;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  result_marker: string;
  committed_dc_write_revision: number;
  committed_at: string;
}

/** Contract §6.1 — status machine exactly; no invented states. */
export type GenerationTaskStatus =
  | "pending_create"
  | "running"
  | "result_received"
  | "committing"
  | "completed"
  | "failed_retryable"
  | "failed_terminal"
  | "recovery_required"
  | "abandoned";

export interface GenerationTaskContext {
  session_id: string;
  client_task_id: string;

  generation_type: GenerationType;
  generation_id: string | null;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  job_id: string | null;
  sync_task_id: string | null;

  status: GenerationTaskStatus;

  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
}

/** Contract §9.2 */
export interface GenerationReplayResult {
  outcome: "already_committed";
  original_committed_session_revision: number;
  original_committed_dc_write_revision: number;
  original_context_id: string;
  original_context_version: number;
  original_context_hash: string | null;

  current_session_revision: number;
  current_dc_write_revision: number;
  current_context_id: string | null;
  current_context_version: number | null;
  current_context_hash: string | null;

  original_result_is_current: boolean;
}

export type GenerationCommitPath = "A" | "B" | "C";

export const EMPTY_GENERATION_RESULT = "EMPTY_GENERATION_RESULT";
export const GENERATION_IDENTITY_COLLISION = "GENERATION_IDENTITY_COLLISION";
export const GENERATION_FIELD_INCOMPLETE = "GENERATION_FIELD_INCOMPLETE";
export const INVALID_GENERATION_SESSION_ID = "INVALID_GENERATION_SESSION_ID";
export const INVALID_TASK_TRANSITION = "INVALID_TASK_TRANSITION";
export const GENERATION_HARD_FAIL = "GENERATION_HARD_FAIL";
export const GENERATION_STATE_INCONSISTENT = "GENERATION_STATE_INCONSISTENT";

export class GenerationError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "GenerationError";
    this.code = code;
  }
}

export function isGenerationError(err: unknown): err is GenerationError {
  return err instanceof GenerationError;
}

/** Contract §6.2 legal transitions (happy path + failure branches). */
export const LEGAL_TASK_TRANSITIONS: Readonly<
  Record<GenerationTaskStatus, readonly GenerationTaskStatus[]>
> = {
  pending_create: ["running", "failed_retryable", "recovery_required", "abandoned"],
  running: ["result_received", "failed_retryable", "failed_terminal", "abandoned"],
  result_received: ["committing", "failed_retryable", "abandoned"],
  committing: ["completed", "recovery_required"],
  completed: [],
  failed_retryable: ["pending_create", "abandoned"],
  failed_terminal: ["abandoned"],
  recovery_required: ["running", "abandoned"],
  abandoned: [],
};

export function assertLegalTaskTransition(
  from: GenerationTaskStatus,
  to: GenerationTaskStatus,
): void {
  const allowed = LEGAL_TASK_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new GenerationError(
      INVALID_TASK_TRANSITION,
      `illegal GenerationTaskContext transition ${from} -> ${to}`,
    );
  }
}
