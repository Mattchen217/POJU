/**
 * Shared OpenRouter reasoning tier for 命主基础分析（JSON + SSE 一致）。
 * Target: thinking=medium, max_tokens=8000 on all environments.
 */
export function baseAnalysisReasoningEffort(): "low" | "medium" | "high" | "xhigh" {
  const raw = process.env.POJU_BASE_ANALYSIS_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") return raw;
  return "medium";
}

export const BASE_ANALYSIS_MAX_TOKENS = 8000;
