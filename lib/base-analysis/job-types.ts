import type { BaseAnalysisProgressStage } from "@/lib/base-analysis/progress-stages";

export type BaseAnalysisJobStatus = "pending" | "streaming" | "completed" | "failed";

export type BaseAnalysisJobKind = "base_analysis" | "base_analysis_v2";

export interface BaseAnalysisJob {
  job_id: string;
  profile_id: string;
  locale: string;

  /** v1 stream vs v2 three-call orchestrate. Default / omitted = base_analysis. */
  kind?: BaseAnalysisJobKind;

  status: BaseAnalysisJobStatus;

  /** Streamed LLM content (markdown narrative). */
  accumulated_content: string;

  /** Latest wait-UI progress stage (SSE + poll). */
  progress_stage?: BaseAnalysisProgressStage;
  progress_updated_at?: number;

  /** Parsed from trailing `---META---` JSON block. */
  meta?: {
    day_master_element?: string;
    favorable_elements?: string[];
    unfavorable_elements?: string[];
    [key: string]: unknown;
  };

  error?: string;
  error_detail?: string;

  created_at: number;
  updated_at: number;
  completed_at?: number;

  local_data: {
    structured: import("@/lib/calculations/build-profile-structured").ProfileStructured;
    output_language: "zh" | "en";
  };
}

export function generateJobId(profile_id: string): string {
  return `ba_${profile_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function jobKey(job_id: string): string {
  return `base-analysis:job:${job_id}`;
}

export function profileLockKey(profile_id: string): string {
  return `base-analysis:lock:${profile_id}`;
}

export function profileLatestKey(profile_id: string): string {
  return `base-analysis:latest:${profile_id}`;
}
