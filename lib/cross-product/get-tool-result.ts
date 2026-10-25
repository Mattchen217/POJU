import type { ToolName } from "@/lib/poju/types";
import { extractGlyphSummary } from "@/lib/poju/tool-result-summary";
import { readStashedToolResult } from "@/lib/cross-product/from-tool-pending";

/**
 * Glyph / Match / Syncro session stores are quarantined.
 * Only a result stashed in this browser session can still be handed to POJU.
 */
export async function getToolResult(
  tool: ToolName,
  resultId: string,
): Promise<Record<string, unknown> | null> {
  return readStashedToolResult(tool, resultId);
}

/** Rebuild full glyph summary when draw session + reading content are available in memory. */
export function getGlyphToolResultFromReading(input: Parameters<typeof extractGlyphSummary>[0]) {
  return extractGlyphSummary(input);
}

/** Lightweight summary for archive / previews. */
export async function getToolResultSummary(
  tool: ToolName,
  resultId: string,
): Promise<Record<string, unknown> | null> {
  return getToolResult(tool, resultId);
}
