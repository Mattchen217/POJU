import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { SignData } from "@/types/oracle";

const STORAGE_PREFIX = "pojulife_glyph_reading_v1_";

export type GlyphUnlockStatus = "preview" | "unlocked";
export type GlyphUnlockVia = "payment" | "code";

export type GlyphDrawSessionPayload = {
  reading_id: string;
  profile_id: string;
  question: string;
  /** @deprecated Hook flow uses unlock_status; kept for legacy archive rows. */
  session_type: "free" | "paid";
  locale: string;
  sign: SignData;
  created_at: string;
  unlock_status?: GlyphUnlockStatus;
  unlock_via?: GlyphUnlockVia;
  pending_question?: string;
  matrix_payload?: PojuMatrixPayload;
  /** Cached base-analysis display text after unlock depth①. */
  base_report_text?: string;
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

export function updateGlyphDrawSession(
  readingId: string,
  patch: Partial<GlyphDrawSessionPayload>,
): GlyphDrawSessionPayload | null {
  const current = loadGlyphDrawSession(readingId);
  if (!current) return null;
  const next = { ...current, ...patch };
  saveGlyphDrawSession(next);
  return next;
}
