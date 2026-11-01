/**
 * Lab / delivery-lab macro: one HTTP `/run` owns at most one LLM provider call
 * and the full ~300s Vercel function budget.
 *
 * Dual-gun / multi-pass / transport fallback that would chain `callLLM` (or
 * OpenRouter main_delivery) in-process must become a client/production
 * continuation (new POST / continue hop) — never stacked under one maxDuration.
 *
 * Soft chunk / mark chunk / fill chunk already follow this. BookJudgment
 * prefers one-shot dual-track; degrade → two-shot (`book_judgment_shot_continue`)
 * ONLY on true ~300s wall / maxDuration / llm_timeout — NOT on early stream_stall
 * / OR 499 / zombie SSE chunk cancel (those hard-fail so Lab can diagnose) — not on
 * quality / validate / coerce failures (those hard-fail; fix prompts after Lab).
 */

/** Hard ceiling: provider admits per Lab `/run` (or one production V3 step hop). */
export const LAB_MAX_PROVIDER_CALLS_PER_HTTP = 1;

/**
 * Gate rule the Lab UI + production V3 continue fuse recognize.
 * Client re-POSTs the same step_key; each hop gets a fresh 300s + one gun.
 */
export const BOOK_JUDGMENT_SHOT_CONTINUE_RULE = "book_judgment_shot_continue";

/** Which BookJudgment gun this Lab hop should fire. */
export type BookJudgmentLabShotPhase = "one" | "two_destiny" | "two_science";

/**
 * OpenRouter transport attempts inside one Lab/delivery-lab provider call.
 * Always 1 — supplier blips use provider_escape / new POST, not a second
 * main_delivery under the same 300s window.
 */
export function deliveryLabTransportMaxAttempts(): number {
  return LAB_MAX_PROVIDER_CALLS_PER_HTTP;
}

export function isBookJudgmentShotContinueRule(
  rule: string | null | undefined,
): boolean {
  return (rule ?? "").trim() === BOOK_JUDGMENT_SHOT_CONTINUE_RULE;
}
