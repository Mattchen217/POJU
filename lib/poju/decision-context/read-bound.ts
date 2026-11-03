/**
 * Product Stage 4 — resolve a frozen Decision Context for report binding.
 * Read-only: never mutates session DC, never calls persist/freeze/versioning writers.
 */

import { computeContentHash } from "./content-hash";
import type { DecisionContext, DecisionContextBinding } from "./types";

export const DC_REPORT_MISSING = "DC_REPORT_MISSING" as const;
export const DC_REPORT_NOT_FROZEN = "DC_REPORT_NOT_FROZEN" as const;
export const DC_REPORT_VERSION_MISS = "DC_REPORT_VERSION_MISS" as const;
export const DC_REPORT_HASH_MISMATCH = "DC_REPORT_HASH_MISMATCH" as const;
export const DC_REPORT_ID_MISMATCH = "DC_REPORT_ID_MISMATCH" as const;
export const DC_REPORT_AMBIGUOUS = "DC_REPORT_AMBIGUOUS" as const;
export const DC_REPORT_READONLY = "DC_REPORT_READONLY" as const;

export type DcReportErrorCode =
  | typeof DC_REPORT_MISSING
  | typeof DC_REPORT_NOT_FROZEN
  | typeof DC_REPORT_VERSION_MISS
  | typeof DC_REPORT_HASH_MISMATCH
  | typeof DC_REPORT_ID_MISMATCH
  | typeof DC_REPORT_AMBIGUOUS
  | typeof DC_REPORT_READONLY;

export class DcReportBindError extends Error {
  readonly code: DcReportErrorCode;

  constructor(code: DcReportErrorCode, message: string) {
    super(message);
    this.name = "DcReportBindError";
    this.code = code;
  }
}

export type DecisionContextSessionSlice = {
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[] | null;
};

function deepFreezeClone(dc: DecisionContext): DecisionContext {
  const clone: DecisionContext = {
    ...dc,
    definition: {
      ...dc.definition,
      goal_priorities: [...dc.definition.goal_priorities],
      unacceptable_outcomes: [...dc.definition.unacceptable_outcomes],
    },
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
  return Object.freeze(clone);
}

export function bindingFromDecisionContext(
  dc: DecisionContext,
): DecisionContextBinding {
  if (!dc.content_hash) {
    throw new DcReportBindError(
      DC_REPORT_HASH_MISMATCH,
      "DecisionContext missing content_hash for report binding",
    );
  }
  return {
    context_id: dc.context_id,
    context_version: dc.version,
    context_hash: dc.content_hash,
  };
}

export function assertFrozenDcIntegrity(dc: DecisionContext): void {
  if (dc.status !== "final" && dc.status !== "superseded") {
    throw new DcReportBindError(
      DC_REPORT_NOT_FROZEN,
      `DecisionContext status=${dc.status} is not frozen (need final|superseded)`,
    );
  }
  if (!dc.content_hash || dc.content_hash.length !== 64) {
    throw new DcReportBindError(
      DC_REPORT_HASH_MISMATCH,
      "Frozen DecisionContext missing valid content_hash",
    );
  }
  const recomputed = computeContentHash(dc);
  if (recomputed !== dc.content_hash) {
    throw new DcReportBindError(
      DC_REPORT_HASH_MISMATCH,
      `content_hash mismatch: stored=${dc.content_hash} recomputed=${recomputed}`,
    );
  }
}

function collectCandidates(
  slice: DecisionContextSessionSlice,
  opts?: { context_id?: string; version?: number },
): DecisionContext[] {
  const pool: DecisionContext[] = [];
  if (slice.decision_context) pool.push(slice.decision_context);
  for (const v of slice.decision_context_versions ?? []) {
    if (v) pool.push(v);
  }
  const filtered = pool.filter((dc) => {
    if (opts?.context_id && dc.context_id !== opts.context_id) return false;
    if (opts?.version != null && dc.version !== opts.version) return false;
    return true;
  });
  // Dedupe identical context_id@version (current + versions[] snapshot).
  const byKey = new Map<string, DecisionContext>();
  for (const dc of filtered) {
    const key = `${dc.context_id}@v${dc.version}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, dc);
      continue;
    }
    // Prefer final over superseded/draft for the same version key.
    if (prev.status !== "final" && dc.status === "final") {
      byKey.set(key, dc);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Resolve a frozen DC for report generation.
 * Prefer explicit context_id + version; otherwise use current final if unique.
 */
export function resolveDecisionContextForReport(
  slice: DecisionContextSessionSlice,
  opts?: {
    context_id?: string;
    version?: number;
    expected_hash?: string;
  },
): { snapshot: DecisionContext; binding: DecisionContextBinding } {
  const candidates = collectCandidates(slice, {
    context_id: opts?.context_id,
    version: opts?.version,
  });

  if (candidates.length === 0) {
    if (opts?.context_id != null || opts?.version != null) {
      throw new DcReportBindError(
        DC_REPORT_VERSION_MISS,
        `No DecisionContext for id=${opts?.context_id ?? "?"} v=${opts?.version ?? "?"}`,
      );
    }
    throw new DcReportBindError(
      DC_REPORT_MISSING,
      "Session has no DecisionContext for report binding",
    );
  }

  // Prefer exact version match; else unique final; else unique superseded snapshot.
  let chosen: DecisionContext | null = null;
  if (opts?.version != null) {
    if (candidates.length !== 1) {
      throw new DcReportBindError(
        DC_REPORT_AMBIGUOUS,
        `Ambiguous DecisionContext for version ${opts.version}`,
      );
    }
    chosen = candidates[0]!;
  } else {
    const finals = candidates.filter((c) => c.status === "final");
    if (finals.length === 1) {
      chosen = finals[0]!;
    } else if (finals.length > 1) {
      throw new DcReportBindError(
        DC_REPORT_AMBIGUOUS,
        "Multiple final DecisionContext rows — pass context_id + version",
      );
    } else {
      const frozen = candidates.filter(
        (c) => c.status === "final" || c.status === "superseded",
      );
      if (frozen.length === 1) {
        chosen = frozen[0]!;
      } else if (frozen.length === 0) {
        throw new DcReportBindError(
          DC_REPORT_NOT_FROZEN,
          "No frozen DecisionContext (final|superseded) available",
        );
      } else {
        throw new DcReportBindError(
          DC_REPORT_AMBIGUOUS,
          "Multiple frozen DecisionContext snapshots — pass context_id + version",
        );
      }
    }
  }

  if (opts?.context_id && chosen.context_id !== opts.context_id) {
    throw new DcReportBindError(
      DC_REPORT_ID_MISMATCH,
      `context_id mismatch: expected=${opts.context_id} got=${chosen.context_id}`,
    );
  }

  assertFrozenDcIntegrity(chosen);

  if (opts?.expected_hash && opts.expected_hash !== chosen.content_hash) {
    throw new DcReportBindError(
      DC_REPORT_HASH_MISMATCH,
      `expected_hash mismatch: expected=${opts.expected_hash} got=${chosen.content_hash}`,
    );
  }

  const snapshot = deepFreezeClone(chosen);
  return { snapshot, binding: bindingFromDecisionContext(snapshot) };
}

/** Verify a caller-supplied snapshot matches its binding triple (no session needed). */
export function assertSnapshotMatchesBinding(
  snapshot: DecisionContext,
  binding: DecisionContextBinding,
): void {
  assertFrozenDcIntegrity(snapshot);
  if (snapshot.context_id !== binding.context_id) {
    throw new DcReportBindError(
      DC_REPORT_ID_MISMATCH,
      `binding context_id mismatch: ${binding.context_id} vs ${snapshot.context_id}`,
    );
  }
  if (snapshot.version !== binding.context_version) {
    throw new DcReportBindError(
      DC_REPORT_VERSION_MISS,
      `binding version mismatch: ${binding.context_version} vs ${snapshot.version}`,
    );
  }
  if (snapshot.content_hash !== binding.context_hash) {
    throw new DcReportBindError(
      DC_REPORT_HASH_MISMATCH,
      `binding hash mismatch: ${binding.context_hash} vs ${snapshot.content_hash}`,
    );
  }
}
