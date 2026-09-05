/**
 * Unified log point for every reasoning-effort / architecture downgrade in delivery.
 * Every degrade path (xhigh→high internal retry, deep-evidence→full-fill fallback,
 * segment2 dims xhigh retry, compress→narrative architecture swap, etc.) MUST call
 * this — do not console.warn ad hoc.
 * Grep tag: [delivery/effort-downgrade]
 */

export type EffortDowngradeEvent = {
  job_id?: string;
  session_id?: string;
  /** Which pipeline call degraded, e.g. "deep_evidence", "segment2_multi_dim", "compress_fill". */
  call_site: string;
  /** Page/segment key if applicable (e.g. "risk_guard", "metaphysics_action"). */
  key?: string;
  from_effort: "xhigh" | "high";
  /**
   * "high" = effort step-down (or architecture swap that keeps high).
   * "full_fill_fallback" = abandon deep-evidence architecture → legacy single fill.
   */
  to_effort: "high" | "full_fill_fallback";
  /** Root cause: "timeout" | "abort" | "empty_response" | "parse_fail" | "shape_fail" | other. */
  reason: string;
  attempt: number;
  elapsed_ms: number;
  timeout_ms_used: number;
};

export function logEffortDowngrade(event: EffortDowngradeEvent): void {
  console.warn("[delivery/effort-downgrade]", {
    ...event,
    // Explicit human-readable summary — greppable without JSON parsing.
    summary: `${event.call_site}${event.key ? `(${event.key})` : ""}: ${event.from_effort} → ${event.to_effort} due to ${event.reason} (attempt ${event.attempt}, ${event.elapsed_ms}ms/${event.timeout_ms_used}ms budget)`,
  });
}

/** Classify transport / abort errors for EffortDowngradeEvent.reason. */
export function classifyEffortDowngradeReason(err: unknown, fallback = "llm_error"): string {
  if (err == null) return fallback;
  if (typeof err === "string") {
    if (/abort/i.test(err)) return "abort";
    if (/timeout/i.test(err)) return "timeout";
    return fallback;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || /abort/i.test(err.message)) return "abort";
    if (/timeout/i.test(err.message) || /timeout/i.test(err.name)) return "timeout";
    return fallback;
  }
  return fallback;
}
