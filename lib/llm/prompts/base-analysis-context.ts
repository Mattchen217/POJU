import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { formatBaseAnalysisForDisplay } from "@/lib/profile/format-base-analysis-zh";

/** Normalized base_analysis payload for prompts + local calculations. */
export type BaseAnalysisBundle = {
  structured?: ProfileStructured;
  display_text?: string;
  content?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Accepts StoredProfileBaseAnalysis row, legacy content JSON, markdown string, or bundle.
 */
export function normalizeBaseAnalysisInput(input: unknown): BaseAnalysisBundle {
  if (input == null) return {};

  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? { content: trimmed, display_text: trimmed } : {};
  }

  if (!isRecord(input)) {
    return { content: input };
  }

  const structured = input.structured as ProfileStructured | undefined;
  const display_text =
    typeof input.display_text === "string" ? input.display_text.trim() : undefined;
  const content = input.content;

  if (structured || display_text || "content" in input) {
    return { structured, display_text, content };
  }

  // Legacy v3: whole object is LLM JSON content
  return { content: input };
}

export function hasBaseAnalysisPayload(bundle: BaseAnalysisBundle): boolean {
  if (bundle.structured) return true;
  if (bundle.display_text?.trim()) return true;
  if (bundle.content == null) return false;
  if (typeof bundle.content === "string") return bundle.content.trim().length > 0;
  return true;
}

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

function applyMaxChars(text: string): string {
  const max = getBaseAnalysisContextMaxChars();
  if (max > 0 && text.length > max) {
    return `${text.slice(0, max)}\n\n…(命主基础分析已截断：全文约 ${text.length} 字，仅保留前 ${max} 字。)`;
  }
  return text;
}

/** LLM context: structured (精确术语) + display_text (白榜). Legacy content-only still supported. */
export function formatBaseAnalysisForPrompt(baseAnalysis: unknown): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);

  if (!hasBaseAnalysisPayload(bundle)) {
    return "(命主基础分析尚未生成，可依据四柱与日主做推演。)";
  }

  const parts: string[] = [];

  if (bundle.structured) {
    parts.push(`## 性格结构数据（内部精确，术语数据）

\`\`\`json
${JSON.stringify(bundle.structured, null, 2)}
\`\`\``);
  }

  const displayText =
    bundle.display_text?.trim() ||
    formatBaseAnalysisForDisplay({
      content: bundle.content,
      display_text: bundle.display_text,
    });

  const legacyJsonOnly =
    !bundle.display_text?.trim() &&
    bundle.content != null &&
    typeof bundle.content === "object";

  if (displayText && !legacyJsonOnly) {
    parts.push(`## 性格画像分析（用户向白榜）

${displayText}`);
  } else if (legacyJsonOnly) {
    parts.push(`## 命主基础分析（legacy JSON）

\`\`\`json
${JSON.stringify(bundle.content, null, 2)}
\`\`\``);
  } else if (typeof bundle.content === "string" && bundle.content.trim()) {
    parts.push(`## 性格画像分析（用户向白榜）

${bundle.content.trim()}`);
  }

  if (parts.length === 0) {
    return "(命主基础分析尚未生成，可依据四柱与日主做推演。)";
  }

  return applyMaxChars(parts.join("\n\n"));
}
