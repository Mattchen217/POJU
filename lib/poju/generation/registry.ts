/**
 * Generation Registry helpers — append only on successful Path A commits.
 * Contract §5.1 / §8.1 / §9.4.
 */

import type { GenerationRegistryEntry, GenerationType } from "./types";
import { GenerationError, GENERATION_HARD_FAIL, GENERATION_IDENTITY_COLLISION } from "./types";
import { assertValidProductionSessionId } from "./session-id";

export function findRegistryEntry(
  registry: readonly GenerationRegistryEntry[] | undefined | null,
  generation_type: GenerationType,
  generation_id: string,
): GenerationRegistryEntry | undefined {
  return (registry ?? []).find(
    (e) => e.generation_type === generation_type && e.generation_id === generation_id,
  );
}

export function assertRegistryIdentityConsistent(
  existing: GenerationRegistryEntry,
  probe: {
    session_id: string;
    client_task_id: string;
    generation_base_revision: number;
    fingerprint: string;
    fingerprint_version: string;
    job_id: string | null;
    sync_task_id: string | null;
  },
): void {
  if (existing.session_id !== probe.session_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "registry session_id mismatch");
  }
  if (existing.client_task_id !== probe.client_task_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "registry client_task_id mismatch");
  }
  if (existing.generation_base_revision !== probe.generation_base_revision) {
    throw new GenerationError(
      GENERATION_IDENTITY_COLLISION,
      "registry generation_base_revision mismatch",
    );
  }
  if (existing.fingerprint !== probe.fingerprint) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "registry fingerprint mismatch");
  }
  if (existing.fingerprint_version !== probe.fingerprint_version) {
    throw new GenerationError(
      GENERATION_IDENTITY_COLLISION,
      "registry fingerprint_version mismatch",
    );
  }
  if (existing.job_id !== probe.job_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "registry job_id mismatch");
  }
  if (existing.sync_task_id !== probe.sync_task_id) {
    throw new GenerationError(GENERATION_IDENTITY_COLLISION, "registry sync_task_id mismatch");
  }
  if (existing.status !== "completed") {
    throw new GenerationError(GENERATION_HARD_FAIL, "registry entry status must be completed");
  }
}

/** Append-only; never mutate prior completed rows. */
export function appendRegistryEntry(
  registry: readonly GenerationRegistryEntry[] | undefined | null,
  entry: GenerationRegistryEntry,
): GenerationRegistryEntry[] {
  assertValidProductionSessionId(entry.session_id, "registry.append");
  if (entry.status !== "completed") {
    throw new GenerationError(GENERATION_HARD_FAIL, "only completed registry entries may be appended");
  }
  const existing = findRegistryEntry(registry, entry.generation_type, entry.generation_id);
  if (existing) {
    assertRegistryIdentityConsistent(existing, entry);
    // Same completed identity — do not duplicate (Path C / replay).
    return [...(registry ?? [])];
  }
  return [...(registry ?? []), entry];
}
