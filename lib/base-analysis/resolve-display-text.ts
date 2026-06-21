import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";

/** Decode common HTML entities if storage/API ever escaped marked text. */
export function decodeMarkedDisplayText(text: string): string {
  if (!text.includes("&")) return text;
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/** Raw LLM marked markdown for delivery UI — never strip markers or HTML-escape. */
export function resolveMarkedBaseAnalysisText(input: {
  content?: unknown;
  display_text?: string | null;
  raw_text?: string | null;
}): string {
  const display = input.display_text?.trim();
  if (display) return decodeMarkedDisplayText(display);

  const raw = input.raw_text?.trim();
  if (raw) return decodeMarkedDisplayText(raw);

  if (typeof input.content === "string" && input.content.trim()) {
    return decodeMarkedDisplayText(input.content.trim());
  }

  return "";
}

export function markedTextFromStoredBaseAnalysis(
  baseAnalysis: unknown,
): string | null {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);
  if (!hasBaseAnalysisPayload(bundle)) return null;
  const text = resolveMarkedBaseAnalysisText(bundle);
  return text.trim() ? text : null;
}
