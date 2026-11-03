/**
 * Call A breakthrough_core → formal Hypothesis[] in DC (Contract §14.2).
 * Consumes Normalized Object only (via prepare/normalize). NEVER creates RealityFact/Constraint.
 * Phase 3 S4: same Normalized Object feeds Fingerprint and this Mapper (GI-23).
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { Hypothesis, HypothesisState } from "./types";
import {
  normalizeCallAInput,
  type NormalizedActionFrame,
  type NormalizedCallAInput,
} from "./normalize-call-a";

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

function nonNullStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (v != null && v.length > 0) out.push(v);
  }
  return out;
}

function joinNonNull(
  parts: Array<string | null | undefined>,
  sep: string,
): string | null {
  const xs = nonNullStrings(parts);
  return xs.length ? xs.join(sep) : null;
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
    statement,
    supporting_evidence: evidence,
    counter_evidence: [],
    validation_need,
    state,
    related_dir_ids: [],
    source_ref,
    updated_at: now,
  };
}

function stateFromNeedsValidation(
  needs_validation: string | null,
): HypothesisState {
  return needs_validation ? "pending_validation" : "proposed";
}

function evidenceFromFrame(frame: NormalizedActionFrame): string[] {
  return nonNullStrings([
    frame.structural_basis,
    ...frame.chart_anchors,
  ]);
}

/**
 * Map Normalized Call A Object → Hypothesis[].
 * MUST NOT re-normalize, re-trim, filter-renumber frames, or create Facts/Constraints.
 * modern_action_frames keep original indices in stable hypothesis slot ids.
 */
export function hypothesesFromNormalizedCallA(
  normalized: NormalizedCallAInput,
  opts: HypothesisFromCoreOptions,
): Hypothesis[] {
  const now = opts.now ?? new Date().toISOString();
  const out: Hypothesis[] = [];
  const seen = new Set<string>();

  // Same source_ref re-submit: drop prior rows for this generation identity, then replace.
  for (const prev of opts.existing ?? []) {
    if (prev.source_ref !== opts.source_ref) {
      pushHypothesis(out, seen, prev);
    }
  }

  if (normalized.situation_conclusion) {
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        normalized.situation_conclusion,
        null,
        opts.source_ref,
        "situation",
        "proposed",
        now,
        nonNullStrings([normalized.energy_structure]),
      ),
    );
  }

  const kc = normalized.key_crossroads;
  if (kc?.real_fork) {
    const stmt = joinNonNull(
      [kc.real_fork, kc.path_costs, kc.decision_traits],
      " | ",
    )!;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        stmt,
        kc.needs_validation,
        opts.source_ref,
        "key_crossroads",
        stateFromNeedsValidation(kc.needs_validation),
        now,
        nonNullStrings([kc.structural_basis]),
      ),
    );
  }

  // Preserve original indices — do NOT compact null slots before assigning slot ids.
  normalized.modern_action_frames.forEach((frame, i) => {
    if (!frame?.direction) return;
    const stmt = joinNonNull([frame.direction, frame.why_fits], " — ")!;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        stmt,
        frame.needs_validation,
        opts.source_ref,
        `modern_action_${i + 1}`,
        stateFromNeedsValidation(frame.needs_validation),
        now,
        evidenceFromFrame(frame),
      ),
    );
  });

  if (normalized.primary_path?.direction) {
    const frame = normalized.primary_path;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        joinNonNull([frame.direction, frame.why_fits], " — ")!,
        frame.needs_validation,
        opts.source_ref,
        "primary_path",
        stateFromNeedsValidation(frame.needs_validation),
        now,
        evidenceFromFrame(frame),
      ),
    );
  }

  if (normalized.backup_path?.direction) {
    const frame = normalized.backup_path;
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        joinNonNull([frame.direction, frame.why_fits], " — ")!,
        frame.needs_validation,
        opts.source_ref,
        "backup_path",
        stateFromNeedsValidation(frame.needs_validation),
        now,
        evidenceFromFrame(frame),
      ),
    );
  }

  const er = normalized.energy_retune_frame;
  if (er?.direction_fit) {
    pushHypothesis(
      out,
      seen,
      frameToHypothesis(
        joinNonNull(
          [er.direction_fit, er.timing_ripeness, er.daily_retune],
          " | ",
        )!,
        er.needs_validation,
        opts.source_ref,
        "energy_retune",
        stateFromNeedsValidation(er.needs_validation),
        now,
        nonNullStrings([er.structural_basis]),
      ),
    );
  }

  return out;
}

/**
 * Compat entry: Validate → Normalize once → Mapper.
 * Prefer prepareCallAGeneration + hypothesesFromNormalizedCallA at Generation paths
 * so Fingerprint and Mapper share one Normalized Object explicitly.
 */
export function hypothesesFromBreakthroughCore(
  core: BreakthroughCore | null | undefined,
  opts: HypothesisFromCoreOptions,
): Hypothesis[] {
  if (!core) return opts.existing ? [...opts.existing] : [];
  const normalized = normalizeCallAInput(core);
  return hypothesesFromNormalizedCallA(normalized, opts);
}

/** Apply into a DC draft (returns new DC; does not mutate). */
export function applyHypothesesFromCoreToDc<
  T extends { hypotheses: Hypothesis[]; updated_at: string },
>(
  dc: T,
  core: BreakthroughCore | null | undefined,
  opts: HypothesisFromCoreOptions,
): T {
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

/** Apply Normalized Object into a DC draft. */
export function applyHypothesesFromNormalizedCallAToDc<
  T extends { hypotheses: Hypothesis[]; updated_at: string },
>(dc: T, normalized: NormalizedCallAInput, opts: HypothesisFromCoreOptions): T {
  const hypotheses = hypothesesFromNormalizedCallA(normalized, {
    ...opts,
    existing: dc.hypotheses,
  });
  return {
    ...dc,
    hypotheses,
    updated_at: opts.now ?? new Date().toISOString(),
  };
}
