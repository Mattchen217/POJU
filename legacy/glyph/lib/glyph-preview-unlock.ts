import type { GlyphDrawSessionPayload } from "@/lib/glyph/glyph-draw-session";

export function getGlyphUnlockStatus(session: GlyphDrawSessionPayload): "preview" | "unlocked" {
  if (session.unlock_status === "unlocked") return "unlocked";
  if (session.unlock_status === "preview") return "preview";
  // Legacy paid sessions created before hook flow.
  if (session.session_type === "paid") return "unlocked";
  return "preview";
}

export function isGlyphPreviewSession(session: GlyphDrawSessionPayload): boolean {
  return getGlyphUnlockStatus(session) === "preview";
}

export function resolveGlyphQuestion(session: GlyphDrawSessionPayload): string {
  return session.pending_question?.trim() || session.question.trim();
}
