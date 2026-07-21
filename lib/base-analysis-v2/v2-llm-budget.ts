/**
 * V2 LLM budgets — max_tokens is a ceiling only (model stops when done).
 * Hard retries: transport / empty / truncated / JSON parse — never quality critique.
 */
export const V2_OUTPUT_MAX_TOKENS = 16_000;

/** Empty body, finish_reason=length, JSON parse, OpenRouter call errors. */
export const V2_HARD_MAX_ATTEMPTS = 3;

export function isV2HardRetryReason(reason: string): boolean {
  return (
    reason === "empty_response" ||
    reason === "json_parse_failed" ||
    reason === "truncated" ||
    reason === "openrouter_empty" ||
    reason === "not_object" ||
    reason === "missing_narrative" ||
    reason === "missing_evidence" ||
    reason.startsWith("call_error:") ||
    reason.startsWith("schema_invalid:")
  );
}
