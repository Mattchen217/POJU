/**
 * Phase 4 delivery retry policy.
 *
 * App-level (JSON parse / incomplete keys / purity): fail-fast — one chance.
 * Transport-level (OpenRouter 429/503/5xx + StreamLake UnaccessibleUser 400):
 * use default OpenRouter backoff — these are supplier blips, not our prompt bugs.
 *
 * Segment-chain transport timeouts: soft-retry the **same segment** up to
 * DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS (siblings keep running), then
 * interrupt the job (retryable) so the user can Continue from checkpoint.
 */

import { OPENROUTER_MAX_ATTEMPTS } from "@/lib/llm/openrouter-retry";

/** Master switch for app-level re-prompts. Keep false. */
export const DELIVERY_ENABLE_RETRIES = false;

/**
 * Per-segment transport/timeout failures before pausing the job for user Continue.
 * Counts soft-wall continue hops that re-enter the same failed phase.
 */
export const DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS = 3;

/** App-level loops (JSON parse / purity / incomplete keys) around one LLM call. */
export function deliveryAppMaxAttempts(): number {
  return DELIVERY_ENABLE_RETRIES ? 3 : 1;
}

/**
 * OpenRouter transport attempts for delivery callLLM.
 * Always allow supplier-blip backoff (incl. transient provider 400), even when
 * app-level fail-fast is on. `undefined` = OPENROUTER_MAX_ATTEMPTS default.
 */
export function deliveryTransportMaxAttempts(): number | undefined {
  if (DELIVERY_ENABLE_RETRIES) return undefined;
  return OPENROUTER_MAX_ATTEMPTS;
}

/**
 * Self-fetch /continue schedule attempts (infrastructure retry).
 * Always 3 — independent of DELIVERY_ENABLE_RETRIES. Vercel self-fetch
 * regularly hits ECONNRESET/429; this only retries the handoff HTTP trigger,
 * not model/JSON generation. Quality retries stay gated by the master switch.
 */
export function deliveryContinueFetchAttempts(): number {
  return 3;
}

export function deliveryFailFastEnabled(): boolean {
  return !DELIVERY_ENABLE_RETRIES;
}

/** True for supplier timeout / busy — retry segment, do not kill sibling tasks.
 *  Also soft-retry mark connective slot gates (then interrupt after max attempts).
 */
export function isDeliverySegmentTransportRetryable(reason: string): boolean {
  const r = reason.toLowerCase();
  if (!r) return false;
  if (r.includes("missing_finalize") || r.includes("missing_upstream")) return false;
  if (r.includes("segment_missing_key")) return false;
  if (r.includes("evidence_incomplete")) return false;
  if (r.includes("narrative_incomplete") || r.includes("json_parse_failed")) return false;
  // Connective slot gate — soft-retry then interrupt (keep prior ready pages).
  if (r.includes("mark_adjacent_gold") || r.includes("mark_incomplete")) return true;
  // Evidence coverage miss — soft-retry then interrupt so user Continue resumes (P1-3).
  if (r.includes("evidence_coverage")) return true;
  return (
    r.includes("llm_timeout") ||
    r.includes("timeout") ||
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
