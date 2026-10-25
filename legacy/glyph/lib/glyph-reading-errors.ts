/** Map technical glyph-reading errors to stable codes for UI copy. */
export type GlyphReadingErrorCode =
  | "transient"
  | "timeout"
  | "network"
  | "profile_not_ready"
  | "invalid_json"
  | "unknown";

export function classifyGlyphReadingError(message: string): GlyphReadingErrorCode {
  const m = message.toLowerCase();
  if (m.includes("openrouter_invalid_json") || m.includes("openrouter_http_5")) {
    return "transient";
  }
  if (m.includes("llm_timeout") || m.includes("glyph_reading_client_timeout")) {
    return "timeout";
  }
  if (m.includes("network_load_failed") || m.includes("failed to fetch")) {
    return "network";
  }
  if (m.includes("profile_not_ready") || m.includes("base_analysis")) {
    return "profile_not_ready";
  }
  if (m.includes("invalid_json") || m.includes("not valid json") || m.includes("missing required")) {
    return "invalid_json";
  }
  return "unknown";
}

export const GLYPH_READING_ERROR_I18N_KEY: Record<GlyphReadingErrorCode, string> = {
  transient: "reading_error_transient",
  timeout: "reading_error_timeout",
  network: "reading_error_network",
  profile_not_ready: "reading_profile_not_ready",
  invalid_json: "reading_error_invalid_json",
  unknown: "reading_error_unknown",
};
