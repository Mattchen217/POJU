/**
 * Generation Operation Binding helpers — Contract §5.2 / §8 / §9.
 */

import type { GenerationOperationBinding, GenerationType } from "./types";
import { GenerationError, GENERATION_HARD_FAIL, GENERATION_IDENTITY_COLLISION } from "./types";
import { assertValidProductionSessionId } from "./session-id";

export function findOperationBinding(
  bindings: readonly GenerationOperationBinding[] | undefined | null,
  idempotency_key: string,
): GenerationOperationBinding | undefined {
  return (bindings ?? []).find((b) => b.idempotency_key === idempotency_key);
}

export function assertBindingIdentityConsistent(
  existing: GenerationOperationBinding,
  probe: {
    session_id: string;
    generation_type: GenerationType;
    generation_id: string;
    client_task_id: string;
    generation_base_revision: number;
    fingerprint: string;
    fingerprint_version: string;
  },
): void {
  if (existing.session_id !== probe.session_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "binding session_id mismatch");
  }
  if (existing.generation_type !== probe.generation_type) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "binding generation_type mismatch");
  }
  if (existing.generation_id !== probe.generation_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "binding generation_id mismatch");
  }
  if (existing.client_task_id !== probe.client_task_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "binding client_task_id mismatch");
  }
  if (existing.generation_base_revision !== probe.generation_base_revision) {
    throw new GenerationError(
      GENERATION_IDENTITY_COLLISION,
      "binding generation_base_revision mismatch",
    );
  }
  if (existing.fingerprint !== probe.fingerprint) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "binding fingerprint mismatch");
  }
  if (existing.fingerprint_version !== probe.fingerprint_version) {
    throw new GenerationError(
      GENERATION_IDENTITY_COLLISION,
      "binding fingerprint_version mismatch",
    );
  }
}

/** Append a new binding; hard-fail if same key is bound to a different identity. */
export function appendOperationBinding(
  bindings: readonly GenerationOperationBinding[] | undefined | null,
  entry: GenerationOperationBinding,
): GenerationOperationBinding[] {
  assertValidProductionSessionId(entry.session_id, "binding.append");
  const existing = findOperationBinding(bindings, entry.idempotency_key);
  if (existing) {
    assertBindingIdentityConsistent(existing, entry);
    return [...(bindings ?? [])];
  }
  // Same generation may have multiple keys (Path C) — allowed.
  return [...(bindings ?? []), entry];
}

export function assertRegistryBindingConsistent(
  registryClientTaskId: string,
  bindingClientTaskId: string,
): void {
  if (registryClientTaskId !== bindingClientTaskId) {
    throw new GenerationError(
      GENERATION_HARD_FAIL,
      "TaskContext/Registry/Binding client_task_id conflict",
    );
  }
}
