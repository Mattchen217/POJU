/**
 * V1 final → superseded; clone V2 draft (same context_id, version++).
 * V1 content_hash unchanged. Affected DIRs reaggregated after supplements.
 */

import { reaggregateDirs } from "./dir-aggregator";
import type { DecisionContext, RealityFact, Conflict } from "./types";
import { FreezeError } from "./freeze";

export class VersioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersioningError";
  }
}

export interface StartV2Options {
  now?: string;
  /** Fact / conflict patches to apply on the new draft. */
  add_facts?: RealityFact[];
  add_conflicts?: Conflict[];
  information_boundaries?: string[];
  /** DIR ids known to be affected by the supplement (marked for reaggregation). */
  affected_dir_ids?: string[];
}

export interface StartV2Result {
  /** Previous final, now superseded (hash unchanged). */
  superseded: DecisionContext;
  /** New draft V(n+1). */
  draft: DecisionContext;
}

function deepCloneBusiness(dc: DecisionContext): DecisionContext {
  return {
    ...dc,
    definition: { ...dc.definition, goal_priorities: [...dc.definition.goal_priorities], unacceptable_outcomes: [...dc.definition.unacceptable_outcomes] },
    reality_facts: dc.reality_facts.map((f) => ({
      ...f,
      fact_roles: f.fact_roles ? [...f.fact_roles] : undefined,
      related_dir_ids: f.related_dir_ids ? [...f.related_dir_ids] : undefined,
    })),
    constraints: dc.constraints.map((c) => ({ ...c })),
    hypotheses: dc.hypotheses.map((h) => ({
      ...h,
      supporting_evidence: [...h.supporting_evidence],
      counter_evidence: [...h.counter_evidence],
      related_dir_ids: [...h.related_dir_ids],
    })),
    dirs: dc.dirs.map((d) => ({
      ...d,
      required_fact_roles: [...d.required_fact_roles],
      agenda_item_ids: [...d.agenda_item_ids],
    })),
    conflicts: dc.conflicts.map((c) => ({
      ...c,
      fact_ids: [...c.fact_ids],
      statements_snapshot: [...c.statements_snapshot],
      source_refs: c.source_refs.map((r) => ({ ...r })),
      related_conflict_ids: c.related_conflict_ids
        ? [...c.related_conflict_ids]
        : undefined,
    })),
    information_boundaries: [...(dc.information_boundaries ?? [])],
  };
}

/**
 * User supplement on a final DC: mark V1 superseded (hash stable), open V2 draft.
 */
export function startV2FromFinal(
  finalDc: DecisionContext,
  opts: StartV2Options = {},
): StartV2Result {
  if (finalDc.status !== "final") {
    throw new VersioningError(
      `startV2FromFinal requires status=final, got ${finalDc.status}`,
    );
  }
  if (!finalDc.content_hash) {
    throw new VersioningError("final DecisionContext missing content_hash");
  }

  const now = opts.now ?? new Date().toISOString();
  const nextVersion = finalDc.version + 1;

  const superseded: DecisionContext = {
    ...finalDc,
    status: "superseded",
    // content_hash MUST remain unchanged
    content_hash: finalDc.content_hash,
    superseded_by: `${finalDc.context_id}@v${nextVersion}`,
    updated_at: now,
  };

  let draft = deepCloneBusiness(finalDc);
  draft = {
    ...draft,
    version: nextVersion,
    status: "draft",
    content_hash: null,
    created_at: now,
    updated_at: now,
    superseded_by: null,
    parent_version: finalDc.version,
    delivery_mode: null,
  };

  if (opts.add_facts?.length) {
    const ids = new Set(draft.reality_facts.map((f) => f.fact_id));
    for (const f of opts.add_facts) {
      if (ids.has(f.fact_id)) continue;
      draft.reality_facts.push(f);
      ids.add(f.fact_id);
    }
  }
  if (opts.add_conflicts?.length) {
    // Preserve history — never delete old conflicts; link related ids.
    for (const c of opts.add_conflicts) {
      draft.conflicts.push({
        ...c,
        related_conflict_ids: Array.from(
          new Set([
            ...(c.related_conflict_ids ?? []),
            ...finalDc.conflicts.map((x) => x.conflict_id),
          ]),
        ),
      });
    }
  }
  if (opts.information_boundaries) {
    draft.information_boundaries = [
      ...(draft.information_boundaries ?? []),
      ...opts.information_boundaries,
    ];
  }

  draft.dirs = reaggregateDirs(
    draft.dirs,
    draft.reality_facts,
    draft.conflicts,
  );

  // Touch affected dirs' satisfaction note for observability
  if (opts.affected_dir_ids?.length) {
    const aff = new Set(opts.affected_dir_ids);
    draft.dirs = draft.dirs.map((d) =>
      aff.has(d.dir_id)
        ? { ...d, satisfaction: `reaggregated_after_v${nextVersion}_supplement` }
        : d,
    );
  }

  return { superseded, draft };
}

export function assertNotMutatingFinal(dc: DecisionContext): void {
  if (dc.status === "final" || dc.status === "superseded") {
    throw new FreezeError(
      `Cannot mutate ${dc.status} DecisionContext; open a new version instead`,
    );
  }
}
