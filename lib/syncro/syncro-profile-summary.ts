import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";

const MAX_PROFILE_CHARS = 4000;

/** Prefer structured base_analysis JSON (language-neutral) over display_text prose. */
export function buildSyncroProfileSummary(baseAnalysis: unknown, fallback = ""): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);

  if (bundle.structured) {
    try {
      return JSON.stringify(bundle.structured).slice(0, MAX_PROFILE_CHARS);
    } catch {
      return fallback;
    }
  }

  if (typeof baseAnalysis === "string") {
    return baseAnalysis.slice(0, MAX_PROFILE_CHARS);
  }

  if (baseAnalysis != null) {
    try {
      return JSON.stringify(baseAnalysis).slice(0, MAX_PROFILE_CHARS);
    } catch {
      return fallback;
    }
  }

  return fallback.slice(0, MAX_PROFILE_CHARS);
}

export function buildSyncroProfileIsolationBlock(outputLanguage: string, isZhOutput: boolean): string {
  if (isZhOutput) {
    return `# 命局数据语言隔离

命局结构数据仅供你内部分析，可能含中文字段；
你的输出文案（short / detailed / rationale）必须全部使用 **${outputLanguage}**，不受数据语言影响。`;
  }

  return `# PROFILE DATA LANGUAGE ISOLATION

The profile structural data is for your internal analysis only and may contain Chinese characters;
your output (short / detailed / rationale) MUST be in **${outputLanguage}** regardless of the data language.`;

}
