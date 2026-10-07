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
