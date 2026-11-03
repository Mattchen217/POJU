/**
 * S5 compatibility: require_decision_context is NOT global by default.
 *
 * Policy:
 * - Legacy sessions with no Decision Context → delivery allowed without DC.
 * - Sessions that already have a frozen (final|superseded) DC → always bind + hash-check.
 * - Sessions with draft DC that is sufficient → Freeze then bind (production soft path).
 * - Env `POJU_REQUIRE_DECISION_CONTEXT=1` → hard-require frozen DC for all new delivery jobs
 *   that opt in via request body OR when session explicitly sets require flag.
 * - Rollback: unset env; do not force-require on historical sessions without DC.
 */

import type { DecisionContext } from "./types";

export function isRequireDecisionContextEnvEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.POJU_REQUIRE_DECISION_CONTEXT ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Whether this delivery request must have a valid frozen DC binding.
 * Never auto-enable solely because env is on for sessions that never had a DC —
 * callers pass `sessionHasDecisionContext` from actual session fields.
 */
export function shouldRequireFrozenDecisionContext(input: {
  requestFlag?: boolean | null;
  envEnabled?: boolean;
  /** True when session already carries decision_context or versions[]. */
  sessionHasDecisionContext: boolean;
  /** True when session already has frozen final/superseded DC. */
  sessionHasFrozenDc: boolean;
}): boolean {
  if (input.requestFlag === true) return true;
  // Frozen DC present → always require consistent binding (no silent drop).
  if (input.sessionHasFrozenDc) return true;
  // Env hard mode only applies when the session already participates in DC.
  if (
    (input.envEnabled ?? isRequireDecisionContextEnvEnabled()) &&
    input.sessionHasDecisionContext
  ) {
    return true;
  }
  return false;
}

export function sessionHasDecisionContextSlice(input: {
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[] | null;
}): boolean {
  if (input.decision_context) return true;
  return (input.decision_context_versions?.length ?? 0) > 0;
}

export function sessionHasFrozenDecisionContext(input: {
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[] | null;
}): boolean {
  const pool = [
    ...(input.decision_context ? [input.decision_context] : []),
    ...(input.decision_context_versions ?? []),
  ];
  return pool.some((d) => d.status === "final" || d.status === "superseded");
}
