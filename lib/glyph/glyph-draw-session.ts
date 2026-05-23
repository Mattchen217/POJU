import type { SignData } from "@/types/oracle";

const STORAGE_PREFIX = "pojulife_glyph_reading_v1_";

export type GlyphDrawSessionPayload = {
  reading_id: string;
  profile_id: string;
  question: string;
  session_type: "free" | "paid";
  locale: string;
  sign: SignData;
  created_at: string;
};

export function saveGlyphDrawSession(payload: GlyphDrawSessionPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${payload.reading_id}`, JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

export function loadGlyphDrawSession(readingId: string): GlyphDrawSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${readingId}`);
    if (!raw) return null;
    return JSON.parse(raw) as GlyphDrawSessionPayload;
  } catch {
    return null;
  }
}
