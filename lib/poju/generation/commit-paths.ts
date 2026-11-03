/**
 * Path A / B / C commit infrastructure (generation_guarded).
 * Contract §5.3 / §8 / §9. Mapping §4.5–§4.6.
 *
 * Phase 2 `idempotent_first` remains on beginPersistTransaction/commitPersistTransaction.
 * Generation MUST use this independent path — collision checks BEFORE any key skip.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ControlPlaneSlice } from "@/lib/poju/decision-context/persist";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  mutatePOJUSession,
  GENERATION_BASE_STALE,
  type MutatePOJUSessionOptions,
  type CasWritePOJUSessionResult,
} from "@/lib/poju/session-mutation";
import {
  checkGenerationCollision,
  type GenerationIdentityProbe,
} from "./collision";
import { appendRegistryEntry } from "./registry";
import { appendOperationBinding } from "./binding";
import { findTaskContext } from "./task-context";
import { defaultLoadForGeneration } from "./task-context-load";
import {
  EMPTY_GENERATION_RESULT,
  GenerationError,
  GENERATION_HARD_FAIL,
  type GenerationCommitPath,
  type GenerationReplayResult,
  type GenerationRegistryEntry,
  type GenerationTaskContext,
} from "./types";
import { assertValidProductionSessionId } from "./session-id";
import { assertLegalTaskTransition } from "./types";

export interface GenerationDcMutation {
  decision_context: DecisionContext;
  decision_context_versions?: DecisionContext[];
  /** ControlPlane update if present — Contract §8.1 item 3. */
  control_plane?: ControlPlaneSlice;
  result_marker: string;
  context_hash?: string | null;
}

export interface GenerationGuardedCommitInput {
  probe: GenerationIdentityProbe;
  /**
   * Path A formal DC write payload.
   * Omit / null / empty_result → EMPTY_GENERATION_RESULT (must not fake completed).
   */
  dc_mutation?: GenerationDcMutation | null;
  /** Explicit empty mapper output. */
  empty_result?: boolean;
  now?: string;
}

export type GenerationGuardedCommitResult =
  | {
      path: "A";
      outcome: "committed";
      write: CasWritePOJUSessionResult;
      registry_entry: GenerationRegistryEntry;
    }
  | {
      path: "B";
      outcome: "already_committed";
      replay: GenerationReplayResult;
      /** Additive Mapping §4.5 diagnostics (non-authoritative). */
      diagnostics?: {
        generation_id: string;
        fingerprint: string;
        fingerprint_version: string;
        generation_base_revision: number;
        result_marker: string;
      };
    }
  | {
      path: "C";
      outcome: "same_generation_new_operation_key";
      dc_mutation_applied: false;
      write: CasWritePOJUSessionResult;
    };

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

function stampIdempotencyKey(keys: string[] | undefined, key: string): string[] {
  const set = new Set(keys ?? []);
  set.add(key);
  return Array.from(set);
}

function buildReplay(
  registry: GenerationRegistryEntry,
  current: POJUSessionState,
): GenerationReplayResult {
  const current_context_id = current.decision_context?.context_id ?? null;
  const current_context_version =
    typeof current.decision_context?.version === "number"
      ? current.decision_context.version
      : null;
  const current_context_hash =
    (current.decision_context as { content_hash?: string | null } | null | undefined)
      ?.content_hash ?? null;

  const original_result_is_current =
    current_context_id === registry.committed_context_id &&
    current_context_version === registry.committed_context_version &&
    (current_context_hash ?? null) === (registry.committed_context_hash ?? null);

  return {
    outcome: "already_committed",
    original_committed_session_revision: registry.committed_session_revision,
    original_committed_dc_write_revision: registry.committed_dc_write_revision,
    original_context_id: registry.committed_context_id,
    original_context_version: registry.committed_context_version,
    original_context_hash: registry.committed_context_hash,
    current_session_revision: current.session_revision ?? 0,
    current_dc_write_revision: current.dc_write_revision ?? 0,
    current_context_id,
    current_context_version,
    current_context_hash,
    original_result_is_current,
  };
}

/**
 * generation_guarded commit entry — Contract §5.3 → §9.
 * Collision / Path judgment BEFORE any idempotent skip.
 */
export async function commitGenerationGuarded(
  input: GenerationGuardedCommitInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<GenerationGuardedCommitResult> {
  const session_id = assertValidProductionSessionId(input.probe.session_id, "generation_guarded");
  const load = opts.load ?? defaultLoadForGeneration;
  const loaded = await load(session_id);
  if (!loaded) {
    throw new GenerationError("SESSION_CAS_CONFLICT", "session not found");
  }
  const latest = {
    ...loaded.state,
    session_revision: loaded.state.session_revision ?? 0,
    dc_write_revision: loaded.state.dc_write_revision ?? 0,
    generation_task_contexts: loaded.state.generation_task_contexts ?? [],
    generation_registry: loaded.state.generation_registry ?? [],
    generation_operation_bindings: loaded.state.generation_operation_bindings ?? [],
    decision_context_idempotency_keys: loaded.state.decision_context_idempotency_keys ?? [],
  };

  // Steps 1–9 BEFORE any key-only skip (§5.3).
  const collision = checkGenerationCollision({
    probe: input.probe,
    registry: latest.generation_registry,
    bindings: latest.generation_operation_bindings,
  });

  const now = input.now ?? new Date().toISOString();

  // Path B — replay, no DC rewrite, no rev bump (§9.2).
  if (collision.path === "B") {
    if (!collision.registry_entry || !collision.binding) {
      throw new GenerationError(GENERATION_HARD_FAIL, "Path B missing registry/binding");
    }
    return {
      path: "B",
      outcome: "already_committed",
      replay: buildReplay(collision.registry_entry, latest),
      diagnostics: {
        generation_id: collision.registry_entry.generation_id,
        fingerprint: collision.registry_entry.fingerprint,
        fingerprint_version: collision.registry_entry.fingerprint_version,
        generation_base_revision: collision.registry_entry.generation_base_revision,
        result_marker: collision.registry_entry.result_marker,
      },
    };
  }

  // EMPTY — must not fake completed (§9.1).
  if (collision.path === "A" && (input.empty_result || !input.dc_mutation)) {
    throw new GenerationError(
      EMPTY_GENERATION_RESULT,
      "Mapper produced no formal generation result",
    );
  }

  // Path C — new key, session+1, dc unchanged, no DC rewrite, no duplicate Registry (§9.3).
  if (collision.path === "C") {
    const reg = collision.registry_entry!;
    const write = await mutatePOJUSession(
      session_id,
      {
        operation_id: `gen_path_c:${input.probe.idempotency_key}`,
        kind: "session_patch",
        bump_dc: false,
        apply: (base) => {
          const binding = {
            session_id,
            idempotency_key: input.probe.idempotency_key,
            generation_type: input.probe.generation_type,
            generation_id: input.probe.generation_id,
            client_task_id: input.probe.client_task_id,
            generation_base_revision: input.probe.generation_base_revision,
            fingerprint: input.probe.fingerprint,
            fingerprint_version: input.probe.fingerprint_version,
            result_marker: reg.result_marker,
            committed_dc_write_revision: reg.committed_dc_write_revision,
            committed_at: now,
          };
          // Re-check collision against latest base (no Path C on §9.4).
          const again = checkGenerationCollision({
            probe: input.probe,
            registry: base.generation_registry,
            bindings: base.generation_operation_bindings,
          });
          if (again.path !== "C" && again.path !== "B") {
            throw new GenerationError(
              GENERATION_HARD_FAIL,
              `Path C expected, got Path ${again.path} on latest`,
            );
          }
          if (again.path === "B") {
            // Concurrent Path B won — treat as no-op identity (caller can re-enter).
            return base;
          }
          const task = findTaskContext(base.generation_task_contexts, input.probe.client_task_id);
          let tasks = base.generation_task_contexts ?? [];
          if (task && task.status !== "completed") {
            assertLegalTaskTransition(task.status, "completed");
            tasks = upsertTask(tasks, {
              ...task,
              status: "completed",
              updated_at: now,
              completed_at: now,
              error_code: null,
            });
          }
          return {
            ...base,
            generation_operation_bindings: appendOperationBinding(
              base.generation_operation_bindings,
              binding,
            ),
            // Registry unchanged — no duplicate.
            generation_registry: base.generation_registry ?? [],
            generation_task_contexts: tasks,
            decision_context_idempotency_keys: stampIdempotencyKey(
              base.decision_context_idempotency_keys,
              input.probe.idempotency_key,
            ),
          };
        },
      },
      { ...opts, load },
    );

    return {
      path: "C",
      outcome: "same_generation_new_operation_key",
      dc_mutation_applied: false,
      write,
    };
  }

  // Path A — first formal DC write (§9.1 / §8.1 / §7.3 dual check).
  const pathA: GenerationCommitPath = "A";
  void pathA;
  const mutation = input.dc_mutation!;
  const write = await mutatePOJUSession(
    session_id,
    {
      operation_id: `gen_path_a:${input.probe.idempotency_key}`,
      kind: "dc_generation",
      bump_dc: true,
      generation_base_revision: input.probe.generation_base_revision,
      apply: (base) => {
        // Re-run collision on latest — never skip past §9.4.
        const again = checkGenerationCollision({
          probe: input.probe,
          registry: base.generation_registry,
          bindings: base.generation_operation_bindings,
        });
        if (again.path === "B") {
          return base; // concurrent Path B — no rewrite
        }
        if (again.path !== "A") {
          throw new GenerationError(
            GENERATION_HARD_FAIL,
            `Path A expected, got Path ${again.path} on latest`,
          );
        }

        // Dual check also via mutate → casWrite generation_base_revision.
        // If base.dc already moved vs probe base → GENERATION_BASE_STALE from CAS;
        // also hard-fail early here for clearer code.
        const currentDc = base.dc_write_revision ?? 0;
        if (currentDc !== input.probe.generation_base_revision) {
          throw new GenerationError(
            GENERATION_BASE_STALE,
            `dc_write_revision=${currentDc} != generation_base_revision=${input.probe.generation_base_revision}`,
          );
        }

        const nextSessionRev = (base.session_revision ?? 0) + 1;
        const nextDcRev = currentDc + 1;

        const registry_entry: GenerationRegistryEntry = {
          session_id,
          generation_type: input.probe.generation_type,
          generation_id: input.probe.generation_id,
          client_task_id: input.probe.client_task_id,
          generation_base_revision: input.probe.generation_base_revision,
          fingerprint: input.probe.fingerprint,
          fingerprint_version: input.probe.fingerprint_version,
          job_id: input.probe.job_id,
          sync_task_id: input.probe.sync_task_id,
          status: "completed",
          result_marker: mutation.result_marker,
          committed_session_revision: nextSessionRev,
          committed_dc_write_revision: nextDcRev,
          committed_context_id: mutation.decision_context.context_id,
          committed_context_version: mutation.decision_context.version,
          committed_context_hash: mutation.context_hash ?? null,
          completed_at: now,
        };

        const binding = {
          session_id,
          idempotency_key: input.probe.idempotency_key,
          generation_type: input.probe.generation_type,
          generation_id: input.probe.generation_id,
          client_task_id: input.probe.client_task_id,
          generation_base_revision: input.probe.generation_base_revision,
          fingerprint: input.probe.fingerprint,
          fingerprint_version: input.probe.fingerprint_version,
          result_marker: mutation.result_marker,
          committed_dc_write_revision: nextDcRev,
          committed_at: now,
        };

        const task = findTaskContext(base.generation_task_contexts, input.probe.client_task_id);
        let tasks = base.generation_task_contexts ?? [];
        if (task) {
          // Allow result_received|committing|running → completed within C1.
          if (task.status !== "completed") {
            const from =
              task.status === "running" || task.status === "result_received"
                ? task.status
                : task.status === "committing"
                  ? "committing"
                  : task.status;
            if (from === "pending_create") {
              throw new GenerationError(
                GENERATION_HARD_FAIL,
                "cannot complete Path A from pending_create without job bind",
              );
            }
            // Drive through committing if needed for legal machine.
            let cur = task;
            if (cur.status === "running") {
              assertLegalTaskTransition("running", "result_received");
              cur = { ...cur, status: "result_received", updated_at: now };
            }
            if (cur.status === "result_received") {
              assertLegalTaskTransition("result_received", "committing");
              cur = { ...cur, status: "committing", updated_at: now };
            }
            assertLegalTaskTransition(cur.status, "completed");
            tasks = upsertTask(tasks, {
              ...cur,
              generation_id: input.probe.generation_id,
              job_id: input.probe.job_id,
              sync_task_id: input.probe.sync_task_id,
              status: "completed",
              updated_at: now,
              completed_at: now,
              error_code: null,
            });
          }
        } else {
          // Allow Path A when TaskContext was completed mid-flight in same blob shape;
          // still record a completed TaskContext for audit.
          tasks = upsertTask(tasks, {
            session_id,
            client_task_id: input.probe.client_task_id,
            generation_type: input.probe.generation_type,
            generation_id: input.probe.generation_id,
            generation_base_revision: input.probe.generation_base_revision,
            fingerprint: input.probe.fingerprint,
            fingerprint_version: input.probe.fingerprint_version,
            job_id: input.probe.job_id,
            sync_task_id: input.probe.sync_task_id,
            status: "completed",
            created_at: now,
            updated_at: now,
            completed_at: now,
            error_code: null,
          });
        }

        return {
          ...base,
          decision_context: mutation.decision_context,
          decision_context_versions:
            mutation.decision_context_versions ?? base.decision_context_versions,
          // control_plane: S3 product wiring deferred; accept opaque slice if provided.
          ...(mutation.control_plane
            ? {
                // Keep agent_v2 mirror only as compatibility — do not invent Phase3ControlPlane.
              }
            : {}),
          generation_registry: appendRegistryEntry(base.generation_registry, registry_entry),
          generation_operation_bindings: appendOperationBinding(
            base.generation_operation_bindings,
            binding,
          ),
          generation_task_contexts: tasks,
          decision_context_idempotency_keys: stampIdempotencyKey(
            base.decision_context_idempotency_keys,
            input.probe.idempotency_key,
          ),
        };
      },
    },
    { ...opts, load },
  );

  const committedReg = (write.state.generation_registry ?? []).find(
    (e) =>
      e.generation_type === input.probe.generation_type &&
      e.generation_id === input.probe.generation_id,
  );
  if (!committedReg) {
    // Concurrent Path B may have no-op'd apply — surface as replay if registry present on load.
    const existing = (latest.generation_registry ?? []).find(
      (e) =>
        e.generation_type === input.probe.generation_type &&
        e.generation_id === input.probe.generation_id,
    );
    if (existing) {
      return {
        path: "B",
        outcome: "already_committed",
        replay: buildReplay(existing, write.state),
      };
    }
    throw new GenerationError(GENERATION_HARD_FAIL, "Path A commit missing registry entry");
  }

  return {
    path: "A",
    outcome: "committed",
    write,
    registry_entry: committedReg,
  };
}
