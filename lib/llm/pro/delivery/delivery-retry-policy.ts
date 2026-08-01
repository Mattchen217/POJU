/**
 * Phase 4 delivery retry policy.
 *
 * Hard rule: one chain, one chance. Success advances; failure STOPs.
 * No app re-prompts, no transport multi-attempt, no stale-resume, no inline
 * continue fallback. Do not flip retries on to paper over pipeline bugs.
 */

/** Master switch — must stay false (delivery = fail-fast only). */
export const DELIVERY_ENABLE_RETRIES = false;

/** App-level loops (JSON parse / purity / incomplete keys) around one LLM call. */
export function deliveryAppMaxAttempts(): number {
  return DELIVERY_ENABLE_RETRIES ? 3 : 1;
}

/**
 * OpenRouter transport attempts for delivery callLLM.
 * `undefined` = provider default (only when retries enabled).
 */
export function deliveryTransportMaxAttempts(): number | undefined {
  return DELIVERY_ENABLE_RETRIES ? undefined : 1;
}

/** Self-fetch /continue schedule attempts. */
export function deliveryContinueFetchAttempts(): number {
  return DELIVERY_ENABLE_RETRIES ? 3 : 1;
}

export function deliveryFailFastEnabled(): boolean {
  return !DELIVERY_ENABLE_RETRIES;
}
