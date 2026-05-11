import { GoogleGenerativeAI } from "@google/generative-ai";

/** 与 Glyph（`/api/oracle/full-reading`）一致：主模型 + 回退链 + 环境变量。 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

export function isGeminiConfigured(): boolean {
  return getGeminiClient() !== null;
}

export function normalizeGeminiModelId(modelId: string): string {
  const normalized = modelId.trim();
  if (normalized === "gemini-3-flash") return "gemini-3-flash-preview";
  return normalized;
}

export const GEMINI_PRIMARY_MODEL = normalizeGeminiModelId(
  process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-3-flash-preview",
);

export const GEMINI_FALLBACK_MODELS = [
  "gemini-3-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export function formatGeminiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export type GenerateGeminiTextOptions = {
  systemInstruction: string;
  userText: string;
  temperature: number;
  maxOutputTokens: number;
};

/**
 * 与 Oracle full-reading 相同策略：按主模型 → 回退列表依次尝试，仅对「模型不存在」类错误继续下一个。
 */
export async function generateGeminiText(
  options: GenerateGeminiTextOptions,
): Promise<{ text: string; modelUsed: string }> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error("missing_gemini_api_key");
  }
  const candidateModels = Array.from(new Set([GEMINI_PRIMARY_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: options.systemInstruction,
      });
      const res = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: options.userText }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
        },
      });
      const text = res.response.text().trim();
      return { text, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      const message = formatGeminiError(err);
      const isModelNotFound =
        /models\/[\w.-]+ is not found|not supported for generateContent|404|NOT_FOUND/i.test(message) ||
        /Requested entity was not found/i.test(message);
      if (!isModelNotFound) throw err;
    }
  }

  throw (
    lastError ??
    new Error(`No available Gemini model. Tried: ${candidateModels.join(", ")}`)
  );
}
