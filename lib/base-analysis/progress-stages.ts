/**
 * Base-analysis wait UI progress stages (phased client + i18n `wait_ritual.progress.*`).
 */
export type BaseAnalysisProgressStage =
  | "chart_ready"
  | "v2_compute"
  | "v2_compute_wait"
  | "v2_narrative"
  | "v2_evidence"
  | "v2_translate"
  | "v2_semantic_text"
  | "v2_final_audit"
  | "streaming"
  | "repair";

/** Document-artifact kinds shown on the wait ritual (zh=3, non-zh=4). */
export type BaseAnalysisArtifactKind = "compute" | "narrative" | "evidence" | "translate";

export type ProgressPayload = {
  stage: BaseAnalysisProgressStage;
  /** Fired when a phase document should appear on the wait desk. */
  artifact?: BaseAnalysisArtifactKind;
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
  "v2_semantic_text",
  "v2_final_audit",
  "streaming",
  "repair",
] as const satisfies readonly BaseAnalysisProgressStage[];

export const BASE_ANALYSIS_ARTIFACT_KINDS = [
  "compute",
  "narrative",
  "evidence",
  "translate",
] as const satisfies readonly BaseAnalysisArtifactKind[];

export function isBaseAnalysisProgressStage(value: unknown): value is BaseAnalysisProgressStage {
  return (
    typeof value === "string" &&
    (BASE_ANALYSIS_PROGRESS_STAGES as readonly string[]).includes(value)
  );
}

export function isBaseAnalysisArtifactKind(value: unknown): value is BaseAnalysisArtifactKind {
  return (
    typeof value === "string" &&
    (BASE_ANALYSIS_ARTIFACT_KINDS as readonly string[]).includes(value)
  );
}
