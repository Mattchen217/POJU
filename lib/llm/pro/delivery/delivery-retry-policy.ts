/**
 * Phase 4 delivery retry policy.
 *
 * Product rule (anti infinite-call):
 * - Per generation unit: 1 primary + 1 retry max (=2), then hard stop.
 * - Layers do NOT multiply: outer soft-wall is for clock handoff only;
 *   inner loops fix JSON/sanitize once — failed quality does not soft-yield
 *   into another full inner budget.
 * - Job-level fuse (wall + continue hops) is the last backstop independent
 *   of any per-phase counter.
 *
 * Prefer first-shot quality (feeds + prompts) over retry thrash.
 */

import { OPENROUTER_MAX_ATTEMPTS } from "@/lib/llm/openrouter-retry";

/** Canonical generation budget: 1 primary + 1 corrective. Never 3+. */
export const DELIVERY_GEN_ATTEMPTS_MAX = 2;

/** Master switch for app-level re-prompts beyond the 1+1 budget. Keep false. */
export const DELIVERY_ENABLE_RETRIES = false;

/**
 * Per-segment transport / failed-phase soft-retries before interrupt (user Continue).
 * 2 = primary admit + one retry — never thrash the same phase.
 */
export const DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS = DELIVERY_GEN_ATTEMPTS_MAX;

/**
 * Soft-wall /continue hops per segment (clock handoff only).
 * Job-level continue hop fuse is the absolute backstop across pages.
 */
export const DELIVERY_SEGMENT_SOFT_HOP_MAX = 8;

/**
 * LLM admits per phase key (start / deep_assigned / evidence_done / narrative_done).
 * 2 = one primary call + one retry (clock soft-wall re-entry counts).
 */
export const DELIVERY_PHASE_LLM_ATTEMPTS_MAX = DELIVERY_GEN_ATTEMPTS_MAX;

/**
 * Absolute job wall from created_at — trips even with live heartbeat / soft-wall ok:true.
 * Normal full book (finalize + 6 pages) should finish well under this.
 */
export const DELIVERY_JOB_MAX_WALL_MS = 40 * 60_000;

/**
 * Absolute /continue hop count for one job (any stage).
 * Caps silent soft-wall thrash that never increments a phase failure counter.
 */
export const DELIVERY_JOB_MAX_CONTINUE_HOPS = 18;

/** App-level loops around one LLM call (JSON parse / purity). Fail-fast = 1. */
export function deliveryAppMaxAttempts(): number {
  return DELIVERY_ENABLE_RETRIES ? DELIVERY_GEN_ATTEMPTS_MAX : 1;
}

/**
 * OpenRouter transport attempts for delivery callLLM.
 * Cap at 2 under fail-fast so supplier blips do not multiply into hour-long stacks.
 */
export function deliveryTransportMaxAttempts(): number | undefined {
  if (DELIVERY_ENABLE_RETRIES) return undefined;
  return Math.min(DELIVERY_GEN_ATTEMPTS_MAX, OPENROUTER_MAX_ATTEMPTS);
}

/** Self-fetch /continue schedule attempts (infrastructure only). */
export function deliveryContinueFetchAttempts(): number {
  return 3;
}

export function deliveryFailFastEnabled(): boolean {
  return !DELIVERY_ENABLE_RETRIES;
}

export function isDeliveryJobWallExceeded(
  created_at: number,
  now_ms: number = Date.now(),
): boolean {
  return Number.isFinite(created_at) && now_ms - created_at > DELIVERY_JOB_MAX_WALL_MS;
}

export function isDeliveryJobContinueHopExceeded(hops: number): boolean {
  return hops > DELIVERY_JOB_MAX_CONTINUE_HOPS;
}

/** Reasons that must interrupt and never auto-resume /continue thrash. */
export function isDeliveryBudgetExhaustedReason(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    r.includes("phase_budget_exhausted") ||
    r.includes("soft_hop_budget_exhausted") ||
    r.includes("job_time_budget_exhausted") ||
    r.includes("job_continue_budget_exhausted") ||
    r.includes("refuse_narrative_fallback") ||
    r.includes("missing_page_schema_refuse_ready")
  );
}

/** True for supplier timeout / busy — soft-retry segment until transport max, then interrupt. */
export function isDeliverySegmentTransportRetryable(reason: string): boolean {
  const r = reason.toLowerCase();
  if (!r) return false;
  if (isDeliveryBudgetExhaustedReason(r)) return false;
  if (r.includes("missing_finalize") || r.includes("missing_upstream")) return false;
  if (r.includes("segment_missing_key")) return false;
  if (r.includes("evidence_incomplete")) return false;
  if (r.includes("narrative_incomplete") || r.includes("json_parse_failed")) return false;
  if (
    r.includes("mark_adjacent_gold") ||
    r.includes("mark_adjacent_soft_gold") ||
    r.includes("mark_template_leak") ||
    r.includes("soft_glued_element") ||
    r.includes("soft_element_echo") ||
    r.includes("mark_incomplete")
  ) {
    return true;
  }
  if (r.includes("evidence_coverage")) return true;
  return (
    r.includes("llm_timeout") ||
    r.includes("timeout") ||
    r.includes("fill_soft_wall_start") ||
    r.includes("soft_hop") ||
    r.includes("provider_busy") ||
    r.includes("provider_queue") ||
    r.includes("429") ||
    r.includes("503") ||
    r.includes("502") ||
    r.includes("504") ||
    r.includes("call_error") ||
    r.includes("econnreset") ||
    r.includes("fetch failed")
  );
}

/** Soft-wall yield after an LLM fail is only for clock/abort — not quality/sanitize thrash. */
export function isDeliverySoftWallRetryableFail(reason: string): boolean {
  const r = reason.toLowerCase();
  if (!r) return false;
  if (isDeliveryBudgetExhaustedReason(r)) return false;
  return (
    r.includes("timeout") ||
    r.includes("aborted") ||
    r.includes("abort") ||
    r.includes("llm_timeout") ||
    r.includes("provider_busy") ||
    r.includes("429") ||
    r.includes("503")
  );
}
