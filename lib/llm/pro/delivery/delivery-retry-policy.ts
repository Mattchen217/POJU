/**
 * Phase 4 delivery retry policy.
 *
 * While the pipeline is being stabilized: fail fast — no application-level
 * re-prompts, no transport multi-attempt. Surface the first failure so we can
 * fix root causes. Flip `DELIVERY_ENABLE_RETRIES` to true only after the path
 * is rarely failing; retries are a safety net, not a substitute for correctness.
 */

/** Master switch — keep false until delivery is stable in production. */
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
