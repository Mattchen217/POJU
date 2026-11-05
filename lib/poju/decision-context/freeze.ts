/**
 * Freeze = Stage3 decision-sufficiency end (C2).
 * NOT purchase / report CTA / stall-as-sufficient.
 * Open Conflict → unresolved_in_final; never auto-clarified.
 *
 * Eng SoT Gate (no FAIL bypass via degraded / blanket allow):
 * - Unknown that does NOT affect P5 ranking → may Freeze with noted boundary
 * - Critical unknown that MAY change P5 ranking → hard block (not sufficient)
 * - Unresolved conflict that decides preferred path → hard block (not sufficient)
 * - Non-preferred-path open conflict → SoT-allowed Freeze → unresolved_in_final + degraded
 *
 * DIR reaggregation uses Intake resolver (R6) — never legacy OR-fallback.
 */

import { markOpenConflictsUnresolvedInFinal } from "./conflict-lifecycle";
import { computeContentHash } from "./content-hash";
import { reaggregateDirsIntake } from "./dir-aggregator-intake";
import type { NaValidationContext } from "./explicit-na-validate";
import { assertLegalFactCombination } from "./fact-combination";
import {
  assertNaValidationBoundToDc,
  naValidationForDcSnapshot,
} from "./na-validation-from-session";
import { evaluateDecisionSufficiency } from "./stop-criteria";
import type { DecisionContext } from "./types";

export class FreezeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreezeError";
  }
}

export interface FreezeOptions {
  now?: string;
  /**
   * Must be true: caller affirms Stage3 sufficiency-end path (not purchase/CTA).
   */
  stage3_sufficiency_end: boolean;
  /** Stall / MAX turns must not claim sufficiency (C3). */
  from_stall_or_max_turns?: boolean;
  /** Purchase / report CTA must not trigger Freeze. */
  from_purchase_or_report_cta?: boolean;
  /**
   * Required Intake N/A validation context from the authoritative Session.
   * Must not be emptyNaValidation() inventing PASS catalogs.
   */
  naValidation: NaValidationContext;
  /** When set, must equal naValidation.sessionId (Session-aware callers). */
  expectedSessionId?: string;
}

export interface FreezeResult {
  frozen: DecisionContext;
  /** Snapshot to append into decision_context_versions. */
  version_snapshot: DecisionContext;
}

export function freezeDecisionContext(
  dc: DecisionContext,
  opts: FreezeOptions,
): FreezeResult {
  if (opts.from_purchase_or_report_cta) {
    throw new FreezeError("Freeze must not be triggered by purchase/report CTA (C2)");
  }
  if (opts.from_stall_or_max_turns) {
    throw new FreezeError(
      "Freeze must not treat stall/MAX_COLLECTING_TURNS as sufficiency (C3)",
    );
  }
  if (!opts.stage3_sufficiency_end) {
    throw new FreezeError(
      "Freeze requires stage3_sufficiency_end=true (Stage3 sufficiency end path)",
    );
  }
  if (dc.status !== "draft") {
    throw new FreezeError(`Cannot freeze DecisionContext in status=${dc.status}`);
  }
  if (!opts.naValidation) {
    throw new FreezeError("Freeze requires naValidation from authoritative Session");
  }
  try {
    assertNaValidationBoundToDc(
      opts.naValidation,
      dc,
      opts.expectedSessionId ?? opts.naValidation.sessionId,
    );
  } catch (e) {
    throw new FreezeError(e instanceof Error ? e.message : String(e));
  }

  for (const f of dc.reality_facts) {
    assertLegalFactCombination(f.status, f.verification_level);
  }

  const sufficiency = evaluateDecisionSufficiency(dc);
  // Hard FAIL / continue_collecting: never Freeze, never bypass via degraded flag.
  if (!sufficiency.canStop) {
    throw new FreezeError(
      `Decision not sufficient to freeze: ${sufficiency.reasons.join("; ")}`,
    );
  }

  const now = opts.now ?? new Date().toISOString();
  const conflicts = markOpenConflictsUnresolvedInFinal(dc.conflicts, now);

  // Bind validation facts/constraints to the DC being frozen (post-conflict snapshot).
  const draftForAgg: DecisionContext = {
    ...dc,
    conflicts,
    updated_at: now,
  };
  const na = naValidationForDcSnapshot(opts.naValidation, draftForAgg);
  const dirs = reaggregateDirsIntake(
    dc.dirs,
    dc.reality_facts,
    conflicts,
    dc.constraints,
    dc.explicit_na_evidence ?? [],
    na,
  );

  const draftForHash: DecisionContext = {
    ...draftForAgg,
    dirs,
  };

  // Re-validate after conflict conversion + DIR reaggregation so aggregation-produced
  // blocking states (e.g. P5-affecting DIR conflict) cannot bypass the Freeze Gate.
  const postAggregation = evaluateDecisionSufficiency(draftForHash);
  if (!postAggregation.canStop) {
    throw new FreezeError(
      `Post-aggregation DecisionContext not sufficient to freeze: ${postAggregation.reasons.join("; ")}`,
    );
  }

  const content_hash = computeContentHash(draftForHash);

  // SoT-allowed degraded only: boundary unknowns / non-preferred unresolved conflicts.
  // Never rewrite hard FAIL into degraded success.
  // Use pre-conversion verdict for delivery_mode (non-preferred open → boundaries),
  // while postAggregation is the hard Gate on final aggregate state.
  const delivery_mode =
    sufficiency.verdict === "sufficient_with_boundaries"
      ? "degraded"
      : dc.delivery_mode ?? "normal";

  const frozen: DecisionContext = {
    ...draftForHash,
    status: "final",
    content_hash,
    updated_at: now,
    delivery_mode,
  };

  // Immutable snapshot for versions[]
  const version_snapshot: DecisionContext = {
    ...frozen,
    reality_facts: frozen.reality_facts.map((f) => ({ ...f })),
    constraints: frozen.constraints.map((c) => ({ ...c })),
    hypotheses: frozen.hypotheses.map((h) => ({ ...h })),
    dirs: frozen.dirs.map((d) => ({ ...d })),
    conflicts: frozen.conflicts.map((c) => ({ ...c })),
    definition: { ...frozen.definition },
    information_boundaries: [...(frozen.information_boundaries ?? [])],
    explicit_na_evidence: frozen.explicit_na_evidence
      ? frozen.explicit_na_evidence.map((e) => ({ ...e }))
      : undefined,
    explicit_na_classifications: frozen.explicit_na_classifications
      ? frozen.explicit_na_classifications.map((c) => ({ ...c }))
      : undefined,
  };

  return { frozen, version_snapshot };
}

/** Guard for production wiring (Phase 5): reject mutate on final. */
export function assertDcMutable(dc: DecisionContext): void {
  if (dc.status === "final" || dc.status === "superseded") {
    throw new FreezeError(
      `DecisionContext ${dc.context_id} v${dc.version} is ${dc.status} (read-only)`,
    );
  }
}
