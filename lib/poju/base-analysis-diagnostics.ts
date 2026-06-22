import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export type BaseAnalysisPayloadSummary = {
  present: boolean;
  has_structured: boolean;
  display_text_len: number;
  computation_version?: string;
};

export function summarizeBaseAnalysisPayload(
  base_analysis: unknown | null | undefined,
): BaseAnalysisPayloadSummary {
  const bundle = normalizeBaseAnalysisInput(base_analysis ?? null);
  const display_text_len =
    bundle.display_text?.length ??
    (typeof bundle.content === "string" ? bundle.content.trim().length : 0);
  return {
    present: base_analysis != null,
    has_structured: Boolean(bundle.structured),
    display_text_len,
    computation_version: isRecord(base_analysis)
      ? typeof base_analysis.computation_version === "string"
        ? base_analysis.computation_version
        : undefined
      : undefined,
  };
}

/** Client + server: log whether chat payload includes full base_analysis (structured + display). */
export function logBaseAnalysisPayload(
  tag: string,
  base_analysis: unknown | null | undefined,
  extra?: Record<string, unknown>,
): void {
  console.log(
    `[poju-diag] ${tag}`,
    JSON.stringify({ ...summarizeBaseAnalysisPayload(base_analysis), ...extra }),
  );
}

/** Rough char → token estimate for system prompt size checks (~3.5 chars/token for mixed zh/en). */
export function estimatePromptTokens(charCount: number): number {
  return Math.ceil(charCount / 3.5);
}

export function logPojuError(tag: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[poju-diag] ${tag}`, error.message, error.stack ?? "(no stack)");
    return;
  }
  console.error(`[poju-diag] ${tag}`, String(error));
}
