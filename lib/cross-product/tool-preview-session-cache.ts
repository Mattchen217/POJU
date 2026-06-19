import type { ToolPreviewResult } from "@/lib/cross-product/finalize-tool-preview";

const GLYPH_PREFIX = "glyph_tool_preview_v1:";
const MATCH_PREFIX = "match_tool_preview_v1:";

type StoredPreview = ToolPreviewResult & { saved_at: number };

function readStored(raw: string | null): StoredPreview | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPreview;
    if (!parsed.matrix_payload || typeof parsed.saved_at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGlyphToolPreviewSession(profileId: string, result: ToolPreviewResult): void {
  if (typeof window === "undefined") return;
  const payload: StoredPreview = { ...result, saved_at: Date.now() };
  sessionStorage.setItem(`${GLYPH_PREFIX}${profileId}`, JSON.stringify(payload));
}

/** Read once — removes entry so draw page does not skip LLM on refresh/back. */
export function consumeGlyphToolPreviewSession(profileId: string): ToolPreviewResult | null {
  if (typeof window === "undefined") return null;
  const key = `${GLYPH_PREFIX}${profileId}`;
  const stored = readStored(sessionStorage.getItem(key));
  sessionStorage.removeItem(key);
  if (!stored) return null;
  return {
    matrix_payload: stored.matrix_payload,
    matrix_payload_b: stored.matrix_payload_b,
    narrative: stored.narrative,
  };
}

export function saveMatchToolPreviewSession(
  aProfileId: string,
  bProfileId: string,
  result: ToolPreviewResult,
): void {
  if (typeof window === "undefined") return;
  const payload: StoredPreview = { ...result, saved_at: Date.now() };
  sessionStorage.setItem(`${MATCH_PREFIX}${aProfileId}:${bProfileId}`, JSON.stringify(payload));
}

export function consumeMatchToolPreviewSession(
  aProfileId: string,
  bProfileId: string,
): ToolPreviewResult | null {
  if (typeof window === "undefined") return null;
  const key = `${MATCH_PREFIX}${aProfileId}:${bProfileId}`;
  const stored = readStored(sessionStorage.getItem(key));
  sessionStorage.removeItem(key);
  if (!stored) return null;
  return {
    matrix_payload: stored.matrix_payload,
    matrix_payload_b: stored.matrix_payload_b,
    narrative: stored.narrative,
  };
}
