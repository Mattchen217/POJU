/**
 * Contract §5.3 collision check order — EXACTLY before any idempotent skip.
 *
 * 1 session identity
 * 2 field completeness
 * 3 read Registry
 * 4 generation_id collision
 * 5 client_task_id consistency
 * 6 fingerprint/version
 * 7 generation_base_revision
 * 8 Operation Binding
 * 9 Path A/B/C
 * 10 CAS path (caller)
 */

import type {
  GenerationCommitPath,
  GenerationOperationBinding,
  GenerationRegistryEntry,
  GenerationType,
} from "./types";
import {
  GenerationError,
  GENERATION_FIELD_INCOMPLETE,
  GENERATION_HARD_FAIL,
  GENERATION_IDENTITY_COLLISION,
} from "./types";
import { assertValidProductionSessionId } from "./session-id";
import { findRegistryEntry, assertRegistryIdentityConsistent } from "./registry";
import {
  findOperationBinding,
  assertBindingIdentityConsistent,
} from "./binding";

export interface GenerationIdentityProbe {
  session_id: string;
  idempotency_key: string;
  generation_type: GenerationType;
  generation_id: string;
  client_task_id: string;
  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;
  job_id: string | null;
  sync_task_id: string | null;
}

export interface CollisionCheckInput {
  probe: GenerationIdentityProbe;
  registry: readonly GenerationRegistryEntry[] | undefined | null;
  bindings: readonly GenerationOperationBinding[] | undefined | null;
}

export interface CollisionCheckResult {
  path: GenerationCommitPath;
  registry_entry?: GenerationRegistryEntry;
  binding?: GenerationOperationBinding;
  /** Ordered step names executed (for tests / audit). */
  steps: string[];
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, `missing ${field}`);
  }
  return value.trim();
}

function requireSafeInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, `invalid ${field}`);
  }
  return value;
}

/**
 * Run Contract §5.3 steps 1–9. Does NOT perform CAS (step 10 — caller).
 * Hard-fails §9.4 cases; never degrades them to Path C.
 */
export function checkGenerationCollision(input: CollisionCheckInput): CollisionCheckResult {
  const steps: string[] = [];
  const { probe } = input;

  // 1. Session identity
  steps.push("1_session_identity");
  const session_id = assertValidProductionSessionId(probe.session_id, "collision");

  // 2. Field completeness
  steps.push("2_field_completeness");
  const idempotency_key = requireNonEmpty(probe.idempotency_key, "idempotency_key");
  const generation_type = probe.generation_type;
  if (generation_type !== "call_a_hypothesis" && generation_type !== "call_b_dir") {
    throw new GenerationError(GENERATION_FIELD_INCOMPLETE, "invalid generation_type");
  }
  const generation_id = requireNonEmpty(probe.generation_id, "generation_id");
  const client_task_id = requireNonEmpty(probe.client_task_id, "client_task_id");
  const generation_base_revision = requireSafeInt(
    probe.generation_base_revision,
    "generation_base_revision",
  );
  const fingerprint = requireNonEmpty(probe.fingerprint, "fingerprint");
  const fingerprint_version = requireNonEmpty(probe.fingerprint_version, "fingerprint_version");
  // job_id / sync_task_id: at least one identity handle required for formal commit
  if (
    (probe.job_id == null || !String(probe.job_id).trim()) &&
    (probe.sync_task_id == null || !String(probe.sync_task_id).trim())
  ) {
    throw new GenerationError(
      GENERATION_FIELD_INCOMPLETE,
      "job_id or sync_task_id required for generation commit",
    );
  }

  // 3. Read Registry
  steps.push("3_read_registry");
  const registry_entry = findRegistryEntry(input.registry, generation_type, generation_id);

  // 4–7. Generation ID collision + identity consistency
  steps.push("4_generation_id_collision");
  if (registry_entry) {
    steps.push("5_client_task_id_consistency");
    steps.push("6_fingerprint_version");
    steps.push("7_generation_base_revision");
    try {
      assertRegistryIdentityConsistent(registry_entry, {
        session_id,
        client_task_id,
        generation_base_revision,
        fingerprint,
        fingerprint_version,
        job_id: probe.job_id,
        sync_task_id: probe.sync_task_id,
      });
    } catch (err) {
      // §9.4 — never degrade to Path C
      if (err instanceof GenerationError) throw err;
      throw err;
    }
  } else {
    steps.push("5_client_task_id_consistency");
    steps.push("6_fingerprint_version");
    steps.push("7_generation_base_revision");
  }

  // Also: same client_task_id must not map to a different generation_id in registry
  for (const e of input.registry ?? []) {
    if (e.session_id !== session_id) {
      throw new GenerationError(GENERATION_IDENTITY_COLLISION, "foreign session registry row");
    }
    if (e.client_task_id === client_task_id && e.generation_id !== generation_id) {
      throw new GenerationError(
        GENERATION_IDENTITY_COLLISION,
        "same client_task_id bound to different generation_id",
      );
    }
    if (e.generation_id === generation_id && e.client_task_id !== client_task_id) {
      throw new GenerationError(
        GENERATION_IDENTITY_COLLISION,
        "same generation_id bound to different client_task_id",
      );
    }
  }

  // 8. Operation Binding
  steps.push("8_operation_binding");
  const binding = findOperationBinding(input.bindings, idempotency_key);
  if (binding) {
    assertBindingIdentityConsistent(binding, {
      session_id,
      generation_type,
      generation_id,
      client_task_id,
      generation_base_revision,
      fingerprint,
      fingerprint_version,
    });
  }

  // Cross-check: any other binding with same generation but conflicting identity
  for (const b of input.bindings ?? []) {
    if (b.generation_type === generation_type && b.generation_id === generation_id) {
      if (b.client_task_id !== client_task_id) {
        throw new GenerationError(
          GENERATION_HARD_FAIL,
          "binding client_task_id conflicts with generation identity",
        );
      }
      if (b.generation_base_revision !== generation_base_revision) {
        throw new GenerationError(
          GENERATION_HARD_FAIL,
          "binding generation_base_revision conflicts (§9.4)",
        );
      }
      if (b.fingerprint !== fingerprint || b.fingerprint_version !== fingerprint_version) {
        throw new GenerationError(
          GENERATION_HARD_FAIL,
          "binding fingerprint conflicts (§9.4)",
        );
      }
    }
  }

  // 9. Path A / B / C (Contract §9.5 priority: B → C → A)
  steps.push("9_path_abc");
  let path: GenerationCommitPath;
  if (binding && registry_entry) {
    path = "B";
  } else if (registry_entry && !binding) {
    path = "C";
  } else if (!registry_entry && !binding) {
    path = "A";
  } else {
    // Binding without Registry completed — inconsistent
    throw new GenerationError(
      GENERATION_HARD_FAIL,
      "Operation Binding exists without completed Registry entry",
    );
  }

  return {
    path,
    registry_entry,
    binding,
    steps,
  };
}
