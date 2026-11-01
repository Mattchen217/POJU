/**
 * Lab / delivery-lab macro: one HTTP `/run` owns at most one LLM provider call
 * and the full ~300s Vercel function budget.
 *
 * Soft chunk / mark chunk / fill chunk already follow this (client/production
 * continuation for multi-pass). BookJudgment is one-shot ONLY (Max lock
 * 2026-11-01) — no two-shot / book_judgment_shot_continue / timeout-degrade.
 */

/** Hard ceiling: provider admits per Lab `/run` (or one production V3 step hop). */
export const LAB_MAX_PROVIDER_CALLS_PER_HTTP = 1;

/**
 * OpenRouter transport attempts inside one Lab/delivery-lab provider call.
 * Always 1 — supplier blips use provider_escape / new POST, not a second
 * main_delivery under the same 300s window.
 */
export function deliveryLabTransportMaxAttempts(): number {
  return LAB_MAX_PROVIDER_CALLS_PER_HTTP;
}
