/**
 * Phase 4 delivery retry policy.
 *
 * App-level (JSON parse / incomplete keys / purity): fail-fast — one chance.
 * Transport-level (OpenRouter 429/503/5xx + StreamLake UnaccessibleUser 400):
 * use default OpenRouter backoff — these are supplier blips, not our prompt bugs.
 */

import { OPENROUTER_MAX_ATTEMPTS } from "@/lib/llm/openrouter-retry";

/** Master switch for app-level re-prompts. Keep false. */
export const DELIVERY_ENABLE_RETRIES = false;

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
