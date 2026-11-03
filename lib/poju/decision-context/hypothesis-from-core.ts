/**
 * Call A breakthrough_core (temporary I/O) → formal Hypothesis[] in DC.
 * NEVER creates RealityFact. Formal Hypothesis exists only after this write.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { Hypothesis, HypothesisState } from "./types";

export interface HypothesisFromCoreOptions {
  /** Stable idempotency / provenance (session_id + job_id / core_generation_id). */
  source_ref: string;
  now?: string;
  /** Existing hypotheses for idempotent merge by source_ref / hypothesis_id. */
  existing?: Hypothesis[];
}

function newHypId(source_ref: string, slot: string): string {
  const safe = source_ref.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `hyp_${safe}_${slot}`;
}

function pushHypothesis(
  out: Hypothesis[],
  seen: Set<string>,
  h: Hypothesis,
): void {
  if (seen.has(h.hypothesis_id)) return;
  seen.add(h.hypothesis_id);
  out.push(h);
}

function frameToHypothesis(
  statement: string,
  validation_need: string | null,
  source_ref: string,
  slot: string,
  state: HypothesisState,
  now: string,
  evidence: string[],
): Hypothesis {
  return {
    hypothesis_id: newHypId(source_ref, slot),
    statement: statement.trim(),
    supporting_evidence: evidence.filter((e) => e.trim().length > 0),
    counter_evidence: [],
    validation_need: validation_need?.trim() ? validation_need.trim() : null,
    state,
    related_dir_ids: [],
    source_ref,
    updated_at: now,
  };
}

/**
 * Map BreakthroughCore skeleton frames → Hypothesis[].
 * breakthrough_core remains temporary process I/O; DC is the only formal home.
 */
export function hypothesesFromBreakthroughCore(
  core: BreakthroughCore | null | undefined,
  opts: HypothesisFromCoreOptions,
): Hypothesis[] {
  if (!core) return opts.existing ? [...opts.existing] : [];
  const now = opts.now ?? new Date().toISOString();
  const out: Hypothesis[] = [];
  const seen = new Set<string>();

  // Idempotency: keep existing with same source_ref, then add/overwrite slots for this ref.
  for (const prev of opts.existing ?? []) {
    if (prev.source_ref !== opts.source_ref) {
      pushHypothesis(out, seen, prev);
    }
  }

  if (core.situation_conclusion?.trim()) {
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        core.situation_conclusion,
        null,
        opts.source_ref,
        "situation",
        "proposed",
        now,
        core.energy_structure ? [core.energy_structure] : [],
      ),
    );
  }

  const kc = core.key_crossroads;
  if (kc?.real_fork?.trim()) {
    const stmt = [kc.real_fork, kc.path_costs, kc.decision_traits]
      .filter((x) => x?.trim())
      .join(" | ");
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        stmt,
        kc.needs_validation ?? null,
        opts.source_ref,
        "key_crossroads",
        kc.needs_validation?.trim() ? "pending_validation" : "proposed",
        now,
        [kc.structural_basis].filter(Boolean),
      ),
    );
  }

  (core.modern_action_frames ?? []).forEach((frame, i) => {
    if (!frame?.direction?.trim()) return;
    const stmt = [frame.direction, frame.why_fits].filter((x) => x?.trim()).join(" — ");
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        stmt,
        frame.needs_validation ?? null,
        opts.source_ref,
        `modern_action_${i + 1}`,
        frame.needs_validation?.trim() ? "pending_validation" : "proposed",
        now,
        [frame.structural_basis, ...(frame.chart_anchors ?? [])].filter(Boolean),
      ),
    );
  });

  if (core.primary_path?.direction?.trim()) {
    const frame = core.primary_path;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        [frame.direction, frame.why_fits].filter(Boolean).join(" — "),
        frame.needs_validation ?? null,
        opts.source_ref,
        "primary_path",
        frame.needs_validation?.trim() ? "pending_validation" : "proposed",
        now,
        [frame.structural_basis].filter(Boolean),
      ),
    );
  }

  if (core.backup_path?.direction?.trim()) {
    const frame = core.backup_path;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        [frame.direction, frame.why_fits].filter(Boolean).join(" — "),
        frame.needs_validation ?? null,
        opts.source_ref,
        "backup_path",
        frame.needs_validation?.trim() ? "pending_validation" : "proposed",
        now,
        [frame.structural_basis].filter(Boolean),
      ),
    );
  }

  const er = core.energy_retune_frame;
  if (er?.direction_fit?.trim()) {
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        [er.direction_fit, er.timing_ripeness, er.daily_retune]
          .filter((x) => x?.trim())
          .join(" | "),
        er.needs_validation ?? null,
        opts.source_ref,
        "energy_retune",
        er.needs_validation?.trim() ? "pending_validation" : "proposed",
        now,
        [er.structural_basis].filter(Boolean),
      ),
    );
  }

  return out;
}

/** Apply into a DC draft (returns new DC; does not mutate). */
export function applyHypothesesFromCoreToDc<
  T extends { hypotheses: Hypothesis[]; updated_at: string },
>(dc: T, core: BreakthroughCore | null | undefined, opts: HypothesisFromCoreOptions): T {
  const hypotheses = hypothesesFromBreakthroughCore(core, {
    ...opts,
    existing: dc.hypotheses,
  });
  return {
    ...dc,
    hypotheses,
    updated_at: opts.now ?? new Date().toISOString(),
  };
}
