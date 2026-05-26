/**
 * Shared OpenRouter reasoning tier for 命主基础分析（JSON + SSE 一致）。
 * Production Vercel 上 high/xhigh 易超时；与 stream route 对齐为 medium。
 */
export function baseAnalysisReasoningEffort(): "low" | "medium" | "high" | "xhigh" {
  const raw = process.env.POJU_BASE_ANALYSIS_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") return raw;
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") return "medium";
  return "high";
}
