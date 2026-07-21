/**
 * Base-analysis wait UI progress stages (SSE `progress` + i18n `wait_ritual.progress.*`).
 * Keys are SSOT for v1 mapping today and v2 three-call pipeline later.
 */
export type BaseAnalysisProgressStage =
  | "chart_ready"
  | "v2_compute"
  | "v2_compute_wait"
  | "v2_narrative"
  | "v2_evidence"
  | "v2_translate"
  | "streaming"
  | "repair";

export type ProgressPayload = {
  stage: BaseAnalysisProgressStage;
  /** Wall time since stream job started (optional). */
  elapsed_ms?: number;
  attempt?: number;
};

export const BASE_ANALYSIS_PROGRESS_STAGES = [
  "chart_ready",
  "v2_compute",
  "v2_compute_wait",
  "v2_narrative",
  "v2_evidence",
  "v2_translate",
  "streaming",
  "repair",
] as const satisfies readonly BaseAnalysisProgressStage[];

export function isBaseAnalysisProgressStage(value: unknown): value is BaseAnalysisProgressStage {
  return (
    typeof value === "string" &&
    (BASE_ANALYSIS_PROGRESS_STAGES as readonly string[]).includes(value)
  );
}
