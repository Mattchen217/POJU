/**
 * Conflict lifecycle: open → clarified (user confirm only) |
 * Freeze: open → unresolved_in_final (never auto-clarified).
 */

import type { Conflict, ConflictSourceRef, RealityFact } from "./types";

export class ConflictLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictLifecycleError";
  }
}

export interface OpenConflictInput {
  conflict_id?: string;
  fact_ids: string[];
  conflict_field: string;
  facts: RealityFact[];
  now?: string;
  supersedes?: string | null;
  related_conflict_ids?: string[];
}

function newConflictId(factIds: string[]): string {
  const key = [...factIds].sort().join("+");
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `conflict_${key.slice(0, 48)}_${rand}`;
}

/** Open a conflict over ≥2 facts. Does not delete prior conflicts. */
export function openConflict(input: OpenConflictInput): Conflict {
  if (input.fact_ids.length < 2) {
    throw new ConflictLifecycleError("Conflict requires at least two fact_ids");
  }
  const factMap = new Map(input.facts.map((f) => [f.fact_id, f]));
  const statements_snapshot: string[] = [];
  const source_refs: ConflictSourceRef[] = [];
  for (const id of input.fact_ids) {
    const f = factMap.get(id);
    if (!f) {
      throw new ConflictLifecycleError(`Missing fact for conflict: ${id}`);
    }
    statements_snapshot.push(f.statement);
    source_refs.push({
      fact_id: id,
      source_stage: f.source_stage,
      source_turn_id: f.source_turn_id,
    });
  }
  const now = input.now ?? new Date().toISOString();
  return {
    conflict_id: input.conflict_id ?? newConflictId(input.fact_ids),
    fact_ids: [...input.fact_ids],
    conflict_field: input.conflict_field,
    statements_snapshot,
    source_refs,
    state: "open",
    resolution: null,
    user_confirmation: false,
    updated_at: now,
    supersedes: input.supersedes ?? null,
    related_conflict_ids: input.related_conflict_ids ?? [],
  };
}

/**
 * Clarify only with explicit user confirmation. Model may not self-clarify.
 */
export function clarifyConflict(
  conflict: Conflict,
  resolution: string,
  opts: { user_confirmation: boolean; now?: string },
): Conflict {
  if (!opts.user_confirmation) {
    throw new ConflictLifecycleError(
      "clarified requires user_confirmation=true; model may not self-clarify",
    );
  }
  if (conflict.state === "unresolved_in_final") {
    throw new ConflictLifecycleError(
      "Cannot clarify a conflict already frozen as unresolved_in_final",
    );
  }
  return {
    ...conflict,
    state: "clarified",
    resolution: resolution.trim(),
    user_confirmation: true,
    updated_at: opts.now ?? new Date().toISOString(),
  };
}

/** Freeze path: every still-open conflict → unresolved_in_final (preserve statements). */
export function markOpenConflictsUnresolvedInFinal(
  conflicts: Conflict[],
  now?: string,
): Conflict[] {
  const ts = now ?? new Date().toISOString();
  return conflicts.map((c) => {
    if (c.state !== "open") return c;
    return {
      ...c,
      state: "unresolved_in_final" as const,
      updated_at: ts,
      // Keep statements_snapshot / source_refs; do not clear or auto-clarify.
    };
  });
}

/** Idempotent: same fact_ids set should not open a duplicate open conflict. */
export function findOpenConflictByFacts(
  conflicts: Conflict[],
  factIds: string[],
): Conflict | undefined {
  const key = [...factIds].sort().join("|");
  return conflicts.find((c) => {
    if (c.state !== "open") return false;
    return [...c.fact_ids].sort().join("|") === key;
  });
}
