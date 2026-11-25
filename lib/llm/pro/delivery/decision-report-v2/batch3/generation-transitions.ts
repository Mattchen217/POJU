/**
 * Generation status transition table — single source for Memory + Lua callers.
 */

import type { GenerationStatus } from "./types";

export const GENERATION_TERMINAL: ReadonlySet<GenerationStatus> = new Set([
  "completed",
  "failed",
  "superseded",
  "cancelled",
]);

/** Allowed edges: from → to[] */
const ALLOWED: Record<GenerationStatus, readonly GenerationStatus[]> = {
  pending: ["active", "failed", "cancelled"],
  active: ["finalizing", "superseded", "failed", "cancelled"],
  finalizing: ["completed", "delivery_failed"],
  delivery_failed: ["finalizing"],
  completed: [],
  superseded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionGeneration(
  from: GenerationStatus,
  to: GenerationStatus,
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function transitionGenerationStatus(
  from: GenerationStatus,
  to: GenerationStatus,
): { ok: true } | { ok: false; detail: string } {
  if (canTransitionGeneration(from, to)) return { ok: true };
  return {
    ok: false,
    detail: `illegal generation transition ${from} → ${to}`,
  };
}

export function isGenerationTerminal(status: GenerationStatus): boolean {
  return GENERATION_TERMINAL.has(status);
}

/** Fence status transitions. */
export type FenceStatus = "open" | "claimed" | "committed" | "stale";

const FENCE_ALLOWED: Record<FenceStatus, readonly FenceStatus[]> = {
  open: ["claimed", "stale"],
  claimed: ["committed", "stale"],
  committed: ["stale"],
  stale: ["open"],
};

export function canTransitionFence(
  from: FenceStatus,
  to: FenceStatus,
): boolean {
  if (from === to) return true;
  return (FENCE_ALLOWED[from] ?? []).includes(to);
}
