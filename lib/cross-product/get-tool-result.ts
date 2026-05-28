import { loadGlyphDrawSession } from "@/lib/glyph/glyph-draw-session";
import { loadMatchSession } from "@/lib/match/match-session";
import type { ToolName } from "@/lib/poju/types";
import {
  extractGlyphSummary,
  extractMatchSummary,
  extractSyncroSummary,
} from "@/lib/poju/tool-result-summary";
import { loadSyncroSession } from "@/lib/syncro/syncro-session";
import { readStashedToolResult } from "@/lib/cross-product/from-tool-pending";

export async function getToolResult(
  tool: ToolName,
  resultId: string,
): Promise<Record<string, unknown> | null> {
  const stashed = readStashedToolResult(tool, resultId);
  if (stashed) return stashed;

  switch (tool) {
    case "match": {
      const session = await loadMatchSession(resultId);
      return session ? extractMatchSummary(session) : null;
    }
    case "syncro": {
      const session = await loadSyncroSession(resultId);
      return session ? extractSyncroSummary(session) : null;
    }
    case "glyph": {
      const draw = loadGlyphDrawSession(resultId);
      if (!draw) return null;
      return {
        reading_id: resultId,
        question: draw.question,
        sign_number: draw.sign.sign_number,
        glyph_level: draw.sign.level,
      };
    }
    default:
      return null;
  }
}

/** Rebuild full glyph summary when draw session + reading content are available in memory. */
export function getGlyphToolResultFromReading(input: Parameters<typeof extractGlyphSummary>[0]) {
  return extractGlyphSummary(input);
}
