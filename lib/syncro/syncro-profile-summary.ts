import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildSyncroBaziContext } from "@/lib/syncro/build-syncro-bazi-context";

const MAX_PROFILE_CHARS = 4000;

/** Prefer local SyncroBaziContext (language-neutral, no depth-① narrative). */
export function buildSyncroProfileSummary(baseAnalysis: unknown, fallback = ""): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);
  const baziContext = buildSyncroBaziContext(bundle.structured);

  if (baziContext) {
    try {
      return JSON.stringify(baziContext).slice(0, MAX_PROFILE_CHARS);
    } catch {
      return fallback;
    }
  }

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

本地结构化命局摘要仅供你内部分析（**非**深度① LLM 叙事报告），可能含中文字段；
你的输出文案（short / detailed / rationale / task_response）必须全部使用 **${outputLanguage}**，不受数据语言影响。`;
  }

  return `# PROFILE DATA LANGUAGE ISOLATION

The local structured profile summary is for your internal analysis only (not the depth-① LLM narrative report) and may contain Chinese characters;
your output (short / detailed / rationale / task_response) MUST be in **${outputLanguage}** regardless of the data language.`;

}
