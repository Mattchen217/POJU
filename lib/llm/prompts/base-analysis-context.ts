/**
 * How much Step 7 JSON to inject into chat system prompts.
 * Default: full JSON (0 = no truncate). Set POJU_BASE_ANALYSIS_CONTEXT_MAX_CHARS to cap.
 */
export function getBaseAnalysisContextMaxChars(): number {
  const raw = process.env.POJU_BASE_ANALYSIS_CONTEXT_MAX_CHARS?.trim();
  if (!raw || raw === "0") return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatBaseAnalysisForPrompt(baseAnalysis: unknown): string {
  if (baseAnalysis === undefined || baseAnalysis === null) {
    return "(命主基础分析尚未生成，可依据四柱与日主做推演。)";
  }

  const text = typeof baseAnalysis === "string" ? baseAnalysis : JSON.stringify(baseAnalysis, null, 2);
  const max = getBaseAnalysisContextMaxChars();
  if (max > 0 && text.length > max) {
    return `${text.slice(0, max)}\n\n…(命主基础分析已截断：全文约 ${text.length} 字，仅保留前 ${max} 字。请优先依据保留部分与四柱。)`;
  }
  return text;
}
