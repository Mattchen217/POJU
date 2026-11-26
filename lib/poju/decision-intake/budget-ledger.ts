/**
 * Core / clarification budget ledger — pure helpers (no KV).
 *
 * SEND_SITE_INVENTORY: user-visible DI2 sends must go through
 * attachAuthorizedAssistantQuestion in adaptive-turn.ts (see guard there).
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  AdaptiveQuestionPlan,
  AnswerClass,
  SessionBudgetSnapshot,
} from "./types";
import type {
  IntakeComplexityDecision,
} from "./report-information-needs.v1";

export const GLOBAL_CORE_SPENT_CEILING = 12;
export const CLARIFICATION_ALLOWANCE = 3;

const NON_MATERIAL_ANSWER: Set<AnswerClass> = new Set([
  "unknown",
  "declined",
  "off_topic",
  "invalid_input",
]);

const BOUNDARY_FACT_STATUSES = new Set([
  "unknown",
  "declined",
  "not_applicable",
  "unverified",
]);

export type MaterialDcWriteInput = {
  fact_ids_written: string[];
  constraint_ids_written: string[];
  session: { decision_context?: DecisionContext | null };
  answer?: { classification?: AnswerClass };
};

export function isMaterialDcWrite(applied: MaterialDcWriteInput): boolean {
  const { fact_ids_written, constraint_ids_written, session, answer } = applied;
  if (!fact_ids_written.length && !constraint_ids_written.length) return false;
  if (answer?.classification && NON_MATERIAL_ANSWER.has(answer.classification)) {
    return false;
  }
  const dc = session.decision_context;
  if (!dc) return false;

  let hasSubstance = false;
  for (const factId of fact_ids_written) {
    const fact = dc.reality_facts.find((f) => f.fact_id === factId);
    if (!fact) continue;
    if (BOUNDARY_FACT_STATUSES.has(fact.status)) continue;
    if (fact.statement?.trim()) {
      hasSubstance = true;
      break;
    }
  }
  if (!hasSubstance) {
    for (const cId of constraint_ids_written) {
      const cst = dc.constraints.find((c) => c.constraint_id === cId);
      if (!cst) continue;
      // Same core-round eligibility as RealityFact: unverified-only is non-material.
      if (BOUNDARY_FACT_STATUSES.has(cst.status)) continue;
      if (cst.statement?.trim()) {
        hasSubstance = true;
        break;
      }
    }
  }
  if (!hasSubstance) return false;

  const allFactsBoundaryOnly =
    fact_ids_written.length > 0 &&
    fact_ids_written.every((id) => {
      const f = dc.reality_facts.find((x) => x.fact_id === id);
      return !f || BOUNDARY_FACT_STATUSES.has(f.status);
    });
  const allCstsBoundaryOnly =
    constraint_ids_written.length > 0 &&
    constraint_ids_written.every((id) => {
      const c = dc.constraints.find((x) => x.constraint_id === id);
      return !c || BOUNDARY_FACT_STATUSES.has(c.status);
    });
  if (
    fact_ids_written.length > 0 &&
    constraint_ids_written.length === 0 &&
    allFactsBoundaryOnly
  ) {
    return false;
  }
  if (
    constraint_ids_written.length > 0 &&
    fact_ids_written.length === 0 &&
    allCstsBoundaryOnly
  ) {
    return false;
  }
  if (allFactsBoundaryOnly && allCstsBoundaryOnly) return false;

  return hasSubstance;
}

function ledgerTurnIds(budget: SessionBudgetSnapshot): string[] {
  return [...(budget.core_counted_source_turn_ids ?? [])];
}

function ledgerEventIds(budget: SessionBudgetSnapshot): string[] {
  return [...(budget.core_counted_answer_event_ids ?? [])];
}

function counterLedgerConsistent(budget: SessionBudgetSnapshot): boolean {
  const core = budget.core_effective_answer_rounds ?? 0;
  const turns = ledgerTurnIds(budget);
  const expected = Math.min(turns.length, GLOBAL_CORE_SPENT_CEILING);
  if (core !== expected) return false;
  return true;
}

function materialTurnIdsFromDc(dc: DecisionContext): string[] {
  const ids = new Set<string>();
  for (const f of dc.reality_facts) {
    if (!f.source_turn_id) continue;
    if (BOUNDARY_FACT_STATUSES.has(f.status)) continue;
    if (!f.statement?.trim()) continue;
    ids.add(f.source_turn_id);
  }
  for (const c of dc.constraints) {
    if (!c.source_turn_id) continue;
    // Align with RealityFact: unverified / unknown / declined / not_applicable
    // do not reconstruct a material core turn.
    if (BOUNDARY_FACT_STATUSES.has(c.status)) continue;
    if (!c.statement?.trim()) continue;
    ids.add(c.source_turn_id);
  }
  return [...ids];
}

function orphanMaterialWithoutTurnIds(dc: DecisionContext): boolean {
  const hasOrphanFact = dc.reality_facts.some(
    (f) =>
      !f.source_turn_id &&
      !BOUNDARY_FACT_STATUSES.has(f.status) &&
      Boolean(f.statement?.trim()),
  );
  const hasOrphanCst = dc.constraints.some(
    (c) =>
      !c.source_turn_id &&
      !BOUNDARY_FACT_STATUSES.has(c.status) &&
      Boolean(c.statement?.trim()),
  );
  return hasOrphanFact || hasOrphanCst;
}

export type SessionBudgetMigrationHints = {
  /** Ignored for DIR-based heuristics — material turns come from DC only. */
  session_asked_count?: number;
};

export function migrateSessionBudget(
  budget: SessionBudgetSnapshot,
  dc: DecisionContext | null | undefined,
  _hints?: SessionBudgetMigrationHints,
): SessionBudgetSnapshot {
  const base: SessionBudgetSnapshot = {
    ...budget,
    clarification_allowance: budget.clarification_allowance ?? CLARIFICATION_ALLOWANCE,
    clarification_rounds: budget.clarification_rounds ?? 0,
    clarification_claims: budget.clarification_claims
      ? [...budget.clarification_claims]
      : [],
  };

  if (
    base.budget_migration_version === "1" &&
    counterLedgerConsistent(base)
  ) {
    const core = Math.min(
      GLOBAL_CORE_SPENT_CEILING,
      base.core_effective_answer_rounds ?? 0,
    );
    return {
      ...base,
      core_effective_answer_rounds: core,
    };
  }

  if (!dc) {
    const counterOnly = base.core_effective_answer_rounds;
    if (counterOnly != null && counterOnly > 0 && !ledgerTurnIds(base).length) {
      return {
        ...base,
        core_effective_answer_rounds: Math.min(
          GLOBAL_CORE_SPENT_CEILING,
          counterOnly,
        ),
        budget_migration_version: "1",
        budget_migration_evidence: "incomplete_legacy_budget_ledger",
        core_counted_source_turn_ids: ledgerTurnIds(base),
      };
    }
    return {
      ...base,
      core_effective_answer_rounds: base.core_effective_answer_rounds ?? 0,
      core_counted_source_turn_ids: ledgerTurnIds(base),
      core_counted_answer_event_ids: ledgerEventIds(base),
    };
  }

  const materialTurns = materialTurnIdsFromDc(dc);
  const hasLedger = ledgerTurnIds(base).length > 0;
  const counterOnly =
    base.core_effective_answer_rounds != null &&
    base.core_effective_answer_rounds > 0 &&
    !hasLedger;

  if (counterOnly) {
    const reconciled = repairCoreLedgerFromDc(base, dc);
    if (!counterLedgerConsistent(reconciled)) {
      const maxCredible = Math.min(
        GLOBAL_CORE_SPENT_CEILING,
        Math.max(
          base.core_effective_answer_rounds ?? 0,
          materialTurns.length,
        ),
      );
      return {
        ...reconciled,
        core_effective_answer_rounds: maxCredible,
        budget_migration_version: "1",
        budget_migration_evidence: "incomplete_legacy_budget_ledger",
      };
    }
    return {
      ...reconciled,
      budget_migration_version: "1",
      budget_migration_evidence:
        reconciled.budget_migration_evidence ?? "reconciled_legacy_counter",
    };
  }

  if (orphanMaterialWithoutTurnIds(dc)) {
    return {
      ...base,
      core_effective_answer_rounds: GLOBAL_CORE_SPENT_CEILING,
      budget_migration_version: "1",
      budget_migration_evidence: "uncertain_orphan_facts_fail_closed",
      core_counted_source_turn_ids: materialTurns,
    };
  }

  const core = Math.min(GLOBAL_CORE_SPENT_CEILING, materialTurns.length);
  return {
    ...base,
    core_effective_answer_rounds: core,
    core_counted_source_turn_ids: materialTurns,
    budget_migration_version: "1",
    budget_migration_evidence: "material_source_turn_ids",
  };
}

export function bumpCoreAfterMaterialWrite(
  budget: SessionBudgetSnapshot,
  ids: { source_turn_id?: string; answer_event_id?: string },
): SessionBudgetSnapshot {
  const turnId = ids.source_turn_id?.trim();
  const eventId = ids.answer_event_id?.trim();
  const turns = ledgerTurnIds(budget);
  const events = ledgerEventIds(budget);
  if (turnId && turns.includes(turnId)) {
    return budget;
  }
  if (eventId && events.includes(eventId)) {
    return budget;
  }
  const prevCore = budget.core_effective_answer_rounds ?? 0;
  if (prevCore >= GLOBAL_CORE_SPENT_CEILING) {
    return {
      ...budget,
      core_effective_answer_rounds: GLOBAL_CORE_SPENT_CEILING,
      core_counted_source_turn_ids: turnId ? [...turns, turnId] : turns,
      core_counted_answer_event_ids: eventId ? [...events, eventId] : events,
    };
  }
  return {
    ...budget,
    core_effective_answer_rounds: Math.min(
      GLOBAL_CORE_SPENT_CEILING,
      prevCore + 1,
    ),
    core_counted_source_turn_ids: turnId ? [...turns, turnId] : turns,
    core_counted_answer_event_ids: eventId ? [...events, eventId] : events,
  };
}

export function repairCoreLedgerFromDc(
  budget: SessionBudgetSnapshot,
  dc: DecisionContext,
): SessionBudgetSnapshot {
  const material = materialTurnIdsFromDc(dc);
  const existing = new Set(ledgerTurnIds(budget));
  const merged = [...existing];
  for (const id of material) {
    if (!existing.has(id)) merged.push(id);
  }
  const core = Math.min(GLOBAL_CORE_SPENT_CEILING, merged.length);
  return {
    ...budget,
    core_effective_answer_rounds: core,
    core_counted_source_turn_ids: merged,
  };
}

function activeClarificationClaims(
  budget: SessionBudgetSnapshot,
): number {
  return (budget.clarification_claims ?? []).filter(
    (c) => c.status === "claimed" || c.status === "confirmed",
  ).length;
}

export type ClaimClarificationResult = {
  ok: boolean;
  budget: SessionBudgetSnapshot;
  reason?: "already_confirmed" | "allowance_exhausted";
};

export function claimClarification(
  budget: SessionBudgetSnapshot,
  plan_id: string,
  now: string,
): ClaimClarificationResult {
  const claims = [...(budget.clarification_claims ?? [])];
  const existing = claims.find((c) => c.plan_id === plan_id);
  if (existing?.status === "confirmed") {
    return { ok: false, budget, reason: "already_confirmed" };
  }
  if (existing?.status === "claimed") {
    return { ok: true, budget };
  }
  const allowance = budget.clarification_allowance ?? CLARIFICATION_ALLOWANCE;
  if (activeClarificationClaims(budget) >= allowance) {
    return { ok: false, budget, reason: "allowance_exhausted" };
  }
  if (existing?.status === "released") {
    const idx = claims.indexOf(existing);
    claims[idx] = {
      plan_id,
      status: "claimed",
      claimed_at: now,
    };
  } else {
    claims.push({ plan_id, status: "claimed", claimed_at: now });
  }
  return {
    ok: true,
    budget: {
      ...budget,
      clarification_claims: claims,
      clarification_rounds: activeClarificationClaims({
        ...budget,
        clarification_claims: claims,
      }),
    },
  };
}

export function confirmClarification(
  budget: SessionBudgetSnapshot,
  plan_id: string,
  now: string,
  send_event_id?: string,
): SessionBudgetSnapshot {
  const claims = [...(budget.clarification_claims ?? [])];
  const idx = claims.findIndex((c) => c.plan_id === plan_id);
  if (idx >= 0 && claims[idx]!.status === "released") {
    // Stale confirm must not revive a released claim.
    return budget;
  }
  if (idx < 0) {
    claims.push({
      plan_id,
      status: "confirmed",
      claimed_at: now,
      confirmed_at: now,
      send_event_id,
    });
  } else if (claims[idx]!.status === "confirmed") {
    // Idempotent re-confirm: keep status; fill send_event_id if newly provided.
    if (send_event_id && !claims[idx]!.send_event_id) {
      claims[idx] = { ...claims[idx]!, send_event_id, confirmed_at: claims[idx]!.confirmed_at ?? now };
    } else {
      return budget;
    }
  } else {
    claims[idx] = {
      ...claims[idx]!,
      status: "confirmed",
      confirmed_at: now,
      send_event_id: send_event_id ?? claims[idx]!.send_event_id,
    };
  }
  const confirmed = claims.filter((c) => c.status === "confirmed").length;
  return {
    ...budget,
    clarification_claims: claims,
    clarification_rounds: confirmed,
  };
}

export function releaseClarification(
  budget: SessionBudgetSnapshot,
  plan_id: string,
  now: string,
): SessionBudgetSnapshot {
  const claims = [...(budget.clarification_claims ?? [])];
  const idx = claims.findIndex((c) => c.plan_id === plan_id);
  if (idx >= 0 && claims[idx]!.status === "confirmed") {
    // Confirmed claims must not be released (allowance stays consumed).
    return budget;
  }
  if (idx >= 0 && claims[idx]!.status === "released") {
    // Idempotent release — do not mutate timestamps or recount.
    return budget;
  }
  if (idx < 0) {
    claims.push({
      plan_id,
      status: "released",
      claimed_at: now,
      released_at: now,
    });
  } else {
    claims[idx] = {
      ...claims[idx]!,
      status: "released",
      released_at: now,
    };
  }
  const active = claims.filter(
    (c) => c.status === "claimed" || c.status === "confirmed",
  ).length;
  return {
    ...budget,
    clarification_claims: claims,
    clarification_rounds: active,
  };
}

export function reconcileClarificationClaims(
  budget: SessionBudgetSnapshot,
  evidence: { sent_plan_ids: string[] },
  now: string,
): SessionBudgetSnapshot {
  const sent = new Set(evidence.sent_plan_ids);
  let next = budget;
  for (const claim of budget.clarification_claims ?? []) {
    if (claim.status !== "claimed") continue;
    if (sent.has(claim.plan_id) && claim.send_event_id) {
      next = confirmClarification(next, claim.plan_id, now, claim.send_event_id);
    }
  }
  for (const claim of budget.clarification_claims ?? []) {
    if (claim.status !== "claimed") continue;
    if (!sent.has(claim.plan_id)) {
      const ambiguous = true;
      if (ambiguous) {
        const claims = [...(next.clarification_claims ?? [])];
        const idx = claims.findIndex((c) => c.plan_id === claim.plan_id);
        if (idx >= 0) {
          claims[idx] = {
            ...claims[idx]!,
            boundary_reason:
              claims[idx]!.boundary_reason ?? "awaiting_send_confirmation",
          };
        }
        next = { ...next, clarification_claims: claims };
      }
    }
  }
  return next;
}

export function canAskOrdinary(budget: SessionBudgetSnapshot): boolean {
  const core = budget.core_effective_answer_rounds ?? 0;
  const cap = budget.core_round_hard_cap ?? 7;
  return core < cap;
}

const BAND_RANK: Record<"simple" | "medium" | "complex", number> = {
  simple: 0,
  medium: 1,
  complex: 2,
};

export function ensureComplexityBand(
  budget: SessionBudgetSnapshot,
  classification: IntakeComplexityDecision,
  now?: string,
): SessionBudgetSnapshot {
  const nextBand = classification.complexity;
  const prev = budget.complexity_band;
  let band = nextBand;
  if (prev && BAND_RANK[prev] > BAND_RANK[nextBand]) {
    band = prev;
  }
  const reasons = prev
    ? [...(budget.complexity_reasons ?? [])]
    : [...classification.reasons];
  if (prev && BAND_RANK[prev] > BAND_RANK[nextBand]) {
    reasons.push("complexity_band_locked_no_downgrade");
  } else if (!prev) {
    reasons.push(...classification.reasons);
  }
  const at = now ?? new Date().toISOString();
  let complexity_upgrade_events = [...(budget.complexity_upgrade_events ?? [])];
  if (prev && BAND_RANK[band] > BAND_RANK[prev]) {
    const dup = complexity_upgrade_events.some(
      (e) => e.from === prev && e.to === band,
    );
    if (!dup) {
      complexity_upgrade_events.push({
        from: prev,
        to: band,
        at,
        reasons: [...classification.reasons],
      });
    }
  }
  return {
    ...budget,
    complexity_band: band,
    core_round_hard_cap: classification.core_round_hard_cap,
    clarification_allowance:
      budget.clarification_allowance ?? classification.clarification_allowance,
    complexity_reasons: [...new Set(reasons)],
    complexity_upgrade_events,
  };
}

export function classifyCollectionMode(
  plan: Pick<
    AdaptiveQuestionPlan,
    "collection_mode" | "conflict_clarification" | "scoring_path"
  >,
): "ordinary" | "clarification" {
  if (plan.collection_mode === "ordinary" || plan.collection_mode === "clarification") {
    return plan.collection_mode;
  }
  if (plan.conflict_clarification) return "clarification";
  const path = String(plan.scoring_path ?? "");
  if (path.includes("pending_answer_resolution")) return "clarification";
  if (path.includes("pending_intake_control")) return "clarification";
  if (path.includes("conflict_clarification")) return "clarification";
  return "ordinary";
}