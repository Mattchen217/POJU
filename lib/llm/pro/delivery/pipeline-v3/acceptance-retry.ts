/**
 * Pipeline v3 · acceptance 1+1 (stochastic buffer).
 *
 * After a parsed draft fails category/shape acceptance: one fresh invoke with a
 * category corrective hint, then hard-fail + report. Not a quality lottery chain.
 */

export type AcceptancePriorFail = {
  failed_rule?: string;
  detail?: string;
};

/**
 * Production polish thickness miss → one republish of the same step.
 * Lab must not emit this (quality auto-retry is a hard stop there).
 */
export const POLISH_ACCEPTANCE_CONTINUE_RULE = "polish_acceptance_continue";

/** Production-only 1+1 for `gate_polish_thin_synonym`. Second miss stays a hard fail. */
export function polishThicknessMayRetryOnce(input: {
  ops_user: string | null | undefined;
  acceptance_armed: boolean;
  failed_rule: string | null | undefined;
}): boolean {
  return (
    input.ops_user === "production" &&
    !input.acceptance_armed &&
    input.failed_rule === "gate_polish_thin_synonym"
  );
}

/**
 * Production-only 1+1 when polish still hits `gate_p4_body_quoted_script`.
 * Body defers this surface class; the second polish miss stays a hard fail.
 * Lab must not emit the continue.
 */
export function polishQuotedScriptMayRetryOnce(input: {
  ops_user: string | null | undefined;
  acceptance_armed: boolean;
  failed_rule: string | null | undefined;
}): boolean {
  return (
    input.ops_user === "production" &&
    !input.acceptance_armed &&
    input.failed_rule === "gate_p4_body_quoted_script"
  );
}

/**
 * Production content.body substance miss → one republish of the same step.
 * Covers `gate_p1_body_invented_number` and the other body category rulers.
 * Lab must not emit this. The second miss stays a hard fail.
 */
export const BODY_ACCEPTANCE_CONTINUE_RULE = "body_acceptance_continue";

/**
 * Production-only 1+1 for a content.body category-B miss.
 * Caller passes a `gateBodyCategoryB` rule. Transport, scare, and shape
 * misses stay on their own paths. Second miss stays a hard fail.
 */
export function bodySubstanceMayRetryOnce(input: {
  ops_user: string | null | undefined;
  acceptance_armed: boolean;
  failed_rule: string | null | undefined;
}): boolean {
  const rule = (input.failed_rule ?? "").trim();
  if (!rule.startsWith("gate_")) return false;
  return input.ops_user === "production" && !input.acceptance_armed;
}

/** Corrective block appended on attempt 2 only — category, never case-phrase bans. */
export function buildAcceptanceCorrectiveBlock(
  fail: AcceptancePriorFail | null | undefined,
): string {
  if (!fail?.failed_rule && !fail?.detail) return "";
  return [
    "## 纠错·验收未过（第2枪 · 封顶1+1）",
    fail.failed_rule ? `- rule: ${fail.failed_rule}` : "",
    fail.detail ? `- detail: ${String(fail.detail).slice(0, 280)}` : "",
    "按**类别**改正后整页重出合法 JSON；禁止只改个别字面躲正则。仍不过则本枪硬失败上报。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reportDeliveryAcceptanceExhausted(input: {
  phase: string;
  key?: string;
  failed_rule?: string;
  detail?: string;
}): void {
  console.error("[delivery/acceptance] exhausted 1+1 — hard fail (fix generation side)", {
    phase: input.phase,
    key: input.key ?? null,
    failed_rule: input.failed_rule ?? null,
    detail: input.detail?.slice(0, 200) ?? null,
  });
}
