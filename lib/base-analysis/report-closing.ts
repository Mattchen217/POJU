/**
 * 个人能量分析报告 · 全文收尾句。
 *
 * 由 UI 固定渲染在五块分区之外（不进「依据与推理」）。
 * 模型若仍写出同义句，展示前剥掉，避免叠两句或误进折叠依据块。
 */

/** Canonical zh closing (also used to recognize model duplicates). */
export const BASE_ANALYSIS_CLOSING_ZH =
  "这是你的能量配置读数。怎么用它，取决于你自己。";

/** Canonical en closing. */
export const BASE_ANALYSIS_CLOSING_EN =
  "This is your energy-config readout. How you use it is up to you.";

const CLOSING_STRIP_PATTERNS: readonly RegExp[] = [
  // 完整规范句（含轻微标点变体）
  /这是你的能量配置读数[。.]?\s*怎么用它[，,]?\s*取决于你自己[。.]?/g,
  /这是你的能量配置读数[。.]?/g,
  /怎么用它[，,]?\s*取决于你自己[。.]?/g,
  // EN
  /This is your energy[- ]config readout[^.]*\.\s*How you use it[^.]*\./gi,
  /This is your energy[- ]config readout[^.]*\./gi,
  /How you use it (?:is yours|is up to you)[^.]*\./gi,
];

/** Remove model-written closing lines so the UI footer is the single source. */
export function stripBaseAnalysisClosingLines(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const re of CLOSING_STRIP_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, "");
  }
  return out
    .replace(/[^\S\r\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
