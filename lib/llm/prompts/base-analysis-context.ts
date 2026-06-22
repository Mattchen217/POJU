import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";

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

/** Recursively sort object keys for byte-stable JSON in prompts. */
function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = stableSortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function stableJsonStringify(value: unknown, indent = 2): string {
  return JSON.stringify(stableSortKeys(value), null, indent);
}

/** Downstream injection banner — neutral base must not be read as scenario typing. */
export const BASE_ANALYSIS_DOWNSTREAM_BANNER_ZH =
  "(以下为中立能量底座，供下游做场景投射；不含且不应推断具体职业/关系/事件。)";

export const BASE_ANALYSIS_DOWNSTREAM_BANNER_EN =
  "(Neutral energy base below—for downstream scenario projection only; must not infer specific career, relationship, or events from it.)";

/** LLM context: structured (精确术语) + display_text (中立元报告白榜). Legacy content-only still supported. */
export function formatBaseAnalysisForPrompt(baseAnalysis: unknown, locale?: string): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);

  if (!hasBaseAnalysisPayload(bundle)) {
    return "(中立能量元报告尚未生成，可依据 structured / 四柱与日主做下游推演。)";
  }

  const banner = locale?.startsWith("zh")
    ? BASE_ANALYSIS_DOWNSTREAM_BANNER_ZH
    : BASE_ANALYSIS_DOWNSTREAM_BANNER_EN;

  const parts: string[] = [];

  if (bundle.structured) {
    parts.push(`## 能量底座·结构数据（内部精确，术语数据）

\`\`\`json
${stableJsonStringify(bundle.structured)}
\`\`\``);
  }

  const displayText = bundle.display_text?.trim();

  const legacyJsonOnly =
    !bundle.display_text?.trim() &&
    bundle.content != null &&
    typeof bundle.content === "object";

  if (displayText && !legacyJsonOnly) {
    parts.push(`## 中立能量元报告（用户向白榜）

${banner}

${stripGlossTokensForPrompt(displayText)}`);
  } else if (legacyJsonOnly) {
    parts.push(`## 命主基础分析（legacy JSON · 场景化内容可能过时）

${banner}

\`\`\`json
${stableJsonStringify(bundle.content)}
\`\`\``);
  } else if (typeof bundle.content === "string" && bundle.content.trim()) {
    parts.push(`## 中立能量元报告（用户向白榜）

${banner}

${bundle.content.trim()}`);
  }

  if (parts.length === 0) {
    return "(中立能量元报告尚未生成，可依据 structured / 四柱与日主做下游推演。)";
  }

  return applyMaxChars(parts.join("\n\n"));
}
