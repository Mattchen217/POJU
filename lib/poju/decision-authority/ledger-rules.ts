/**
 * M4 — DC ledger migration rules (pure; run by the server on every append).
 *
 * The ledger accepts only transitions the DecisionContext lifecycle allows:
 *  - genesis: first commit of a session, draft only;
 *  - draft → draft: same context, dc_version never decreases (a draft's version is a
 *    local edit counter; one device write may carry several bumps — the ledger's own
 *    commit_version + hash chain is the continuous sequence);
 *  - final → draft: V2 open only (dc_version + 1, parent_version = frozen version);
 *  - never a client-written final / superseded head (Freeze is sealed server-side);
 *  - every fact / constraint that newly carries user confirmation must be backed by a
 *    structurally valid user Confirmation Event in the same request — model output
 *    cannot promote anything to user-confirmed.
 */

import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import { deriveUserConfirmedFromEvents } from "@/lib/poju/decision-context/confirmation-event";
import { isLegalFactCombination } from "@/lib/poju/decision-context/fact-combination";
import type { Constraint, DecisionContext, RealityFact } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";
import type { DcLedgerChangeType, DcLedgerEntry } from "./types";

export class DcLedgerRuleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DcLedgerRuleError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new DcLedgerRuleError(code, message);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
}

/** Shape guard for a DecisionContext arriving over the wire. */
export function assertDcSnapshotShape(dc: unknown): asserts dc is DecisionContext {
  const d = dc as Partial<DecisionContext> | null;
  if (!d || typeof d !== "object") fail("DC_LEDGER_SNAPSHOT_INVALID", "snapshot must be an object");
  if (typeof d.context_id !== "string" || !d.context_id.trim()) {
    fail("DC_LEDGER_SNAPSHOT_INVALID", "snapshot.context_id required");
  }
  if (!isPositiveInt(d.version)) fail("DC_LEDGER_SNAPSHOT_INVALID", "snapshot.version must be a positive integer");
  if (d.status !== "draft" && d.status !== "final" && d.status !== "superseded") {
    fail("DC_LEDGER_SNAPSHOT_INVALID", "snapshot.status invalid");
  }
  if (!d.definition || typeof d.definition !== "object") {
    fail("DC_LEDGER_SNAPSHOT_INVALID", "snapshot.definition required");
  }
  for (const key of ["reality_facts", "constraints", "hypotheses", "dirs", "conflicts"] as const) {
    if (!Array.isArray(d[key])) fail("DC_LEDGER_SNAPSHOT_INVALID", `snapshot.${key} must be an array`);
  }
}

function isStructurallyValidUserEvent(e: ConfirmationEvent): boolean {
  if (!e || typeof e !== "object") return false;
  if (e.actor !== "user" || e.event_version !== 1) return false;
  if (typeof e.event_id !== "string" || !e.event_id) return false;
  if (typeof e.source_turn_id !== "string" || !e.source_turn_id) return false;
  if (e.target_type === "fact") return e.event_type === "confirm_fact" && typeof e.fact_id === "string" && !!e.fact_id;
  if (e.target_type === "constraint") {
    return e.event_type === "confirm_constraint" && typeof e.constraint_id === "string" && !!e.constraint_id;
  }
  return false;
}

type Confirmable = Pick<RealityFact, "status" | "verification_level" | "user_confirmed" | "statement" | "source_turn_id">;

function needsBacking(next: Confirmable, prev: Confirmable | undefined): boolean {
  const claimsUser =
    next.user_confirmed === true || (next.status === "confirmed" && next.verification_level === "user_asserted");
  if (!claimsUser) return false;
  if (!prev) return true;
  const prevClaimed =
    prev.user_confirmed === true || (prev.status === "confirmed" && prev.verification_level === "user_asserted");
  if (!prevClaimed) return true;
  // Same claim carried forward unchanged needs no new event.
  return prev.statement !== next.statement || (prev.source_turn_id ?? null) !== (next.source_turn_id ?? null);
}

function backedByEvent(
  item: Confirmable,
  target: { type: "fact"; fact_id: string } | { type: "constraint"; constraint_id: string },
  events: ConfirmationEvent[],
): boolean {
  return deriveUserConfirmedFromEvents({
    status: item.status,
    verification_level: item.verification_level,
    events,
    target,
    source_turn_id: item.source_turn_id,
  });
}

export type LedgerTransitionVerdict = {
  change_type: DcLedgerChangeType;
  promoted_fact_ids: string[];
  promoted_constraint_ids: string[];
  /** Only the events that back a promotion in this commit (stored as provenance). */
  backing_events: ConfirmationEvent[];
};

/**
 * Validate one append. `prev` is the current server head (null for genesis).
 * `snapshotChanged` / `blueprintChanged` are computed by the store from hashes.
 */
export function validateLedgerTransition(input: {
  session_id: string;
  prev: DcLedgerEntry | null;
  next: DecisionContext;
  blueprint: DecisionBlueprint | null;
  confirmation_events: ConfirmationEvent[];
  snapshotChanged: boolean;
  blueprintChanged: boolean;
}): LedgerTransitionVerdict {
  const { prev, next } = input;
  assertDcSnapshotShape(next);

  if (next.status !== "draft") {
    fail(
      "DC_LEDGER_STATUS_FORBIDDEN",
      `Only draft Decision Contexts are committed by the device (got ${next.status}); Freeze is sealed by the server`,
    );
  }

  if (input.blueprint) {
    const bp = input.blueprint;
    if (bp.context_id !== next.context_id || bp.session_id !== input.session_id) {
      fail("DC_LEDGER_BLUEPRINT_MISMATCH", "Blueprint does not belong to this session / Decision Context");
    }
    if (prev?.blueprint_version != null && typeof bp.blueprint_version === "number" && bp.blueprint_version < prev.blueprint_version) {
      fail("DC_LEDGER_BLUEPRINT_REGRESSION", `blueprint_version ${bp.blueprint_version} < ${prev.blueprint_version}`);
    }
  }

  let change_type: DcLedgerChangeType;
  if (!prev) {
    change_type = "genesis";
  } else if (prev.dc_status === "final") {
    if (next.context_id !== prev.context_id) {
      fail("DC_LEDGER_CONTEXT_CHANGED", "A frozen context can only continue as its own next version");
    }
    if (next.version !== prev.dc_version + 1 || next.parent_version !== prev.dc_version) {
      fail(
        "DC_LEDGER_FROZEN_IMMUTABLE",
        `Frozen ${prev.context_id}@v${prev.dc_version} can only be followed by a V${prev.dc_version + 1} draft opened from it`,
      );
    }
    change_type = "version_open";
  } else {
    if (next.context_id !== prev.context_id) {
      fail("DC_LEDGER_CONTEXT_CHANGED", `context_id changed ${prev.context_id} → ${next.context_id}`);
    }
    if (next.version < prev.dc_version) {
      fail("DC_LEDGER_VERSION_REGRESSION", `dc_version ${next.version} < ${prev.dc_version}`);
    }
    if (
      next.parent_version != null &&
      prev.snapshot.parent_version != null &&
      next.parent_version !== prev.snapshot.parent_version
    ) {
      fail("DC_LEDGER_PARENT_CHANGED", `parent_version changed inside draft ${prev.context_id}`);
    }
    change_type = input.snapshotChanged ? "draft_update" : "blueprint_update";
  }

  for (const f of next.reality_facts) {
    if (!isLegalFactCombination(f.status, f.verification_level)) {
      fail("DC_LEDGER_ILLEGAL_FACT", `fact ${f.fact_id}: ${f.status}×${f.verification_level}`);
    }
  }

  const events = (input.confirmation_events ?? []).filter(isStructurallyValidUserEvent);
  const prevFacts = new Map((prev?.snapshot.reality_facts ?? []).map((f) => [f.fact_id, f]));
  const prevCons = new Map((prev?.snapshot.constraints ?? []).map((c) => [c.constraint_id, c]));
  const promoted_fact_ids: string[] = [];
  const promoted_constraint_ids: string[] = [];
  const used = new Set<string>();

  for (const f of next.reality_facts) {
    if (!needsBacking(f, prevFacts.get(f.fact_id))) continue;
    const target = { type: "fact" as const, fact_id: f.fact_id };
    if (!backedByEvent(f, target, events)) {
      fail("DC_LEDGER_UNBACKED_CONFIRMATION", `fact ${f.fact_id} claims user confirmation without a user Confirmation Event`);
    }
    promoted_fact_ids.push(f.fact_id);
    for (const e of events) if (e.target_type === "fact" && e.fact_id === f.fact_id) used.add(e.event_id);
  }
  for (const c of next.constraints as Constraint[]) {
    if (!needsBacking(c, prevCons.get(c.constraint_id))) continue;
    const target = { type: "constraint" as const, constraint_id: c.constraint_id };
    if (!backedByEvent(c, target, events)) {
      fail(
        "DC_LEDGER_UNBACKED_CONFIRMATION",
        `constraint ${c.constraint_id} claims user confirmation without a user Confirmation Event`,
      );
    }
    promoted_constraint_ids.push(c.constraint_id);
    for (const e of events) if (e.target_type === "constraint" && e.constraint_id === c.constraint_id) used.add(e.event_id);
  }

  if (change_type === "draft_update" && (promoted_fact_ids.length || promoted_constraint_ids.length)) {
    change_type = "user_confirm";
  }

  return {
    change_type,
    promoted_fact_ids,
    promoted_constraint_ids,
    backing_events: events.filter((e) => used.has(e.event_id)),
  };
}
