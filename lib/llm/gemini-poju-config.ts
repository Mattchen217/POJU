/**
 * POJU 专用 Gemini 配置（与全站 Oracle 的 GOOGLE_GENERATIVE_AI_MODEL 解耦）。
 * 默认：`gemini-3-flash-preview`；可用环境变量 `POJU_GEMINI_MODEL` 覆盖。
 *
 * 思考模式：在 `generationConfig` 中设置 `thinkingConfig.thinkingBudget = -1`（自动），
 * 与 Vertex / AI Studio 文档中 “Auto” 思考预算一致。
 */
export const POJU_GEMINI_MODEL = process.env.POJU_GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

/** 主对话 / 导航类回复：开启思考模式。 */
export function pojuMainGenerationConfig(params: {
  temperature: number;
  maxOutputTokens: number;
}): Record<string, unknown> {
  return {
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    thinkingConfig: {
      thinkingBudget: -1,
    },
  };
}

/** 漂移二次判别：短 JSON，不开启思考以降低延迟与费用。 */
export function pojuDriftGenerationConfig(params: {
  temperature: number;
  maxOutputTokens: number;
}): Record<string, unknown> {
  return {
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    responseMimeType: "application/json",
  };
}
