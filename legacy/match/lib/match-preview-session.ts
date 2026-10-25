import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

const STORAGE_KEY = "pojulife_match_preview_v1";

export type MatchUnlockStatus = "preview" | "unlocked";
export type MatchUnlockVia = "payment" | "code";

export type MatchPreviewSession = {
  preview_id: string;
  a_profile_id: string;
  b_profile_id: string;
  unlock_status: MatchUnlockStatus;
  unlock_via?: MatchUnlockVia;
  pending_question?: string;
  matrix_payload?: PojuMatrixPayload;
  matrix_payload_b?: PojuMatrixPayload;
  locale: string;
  created_at: string;
};

export function loadMatchPreviewSession(): MatchPreviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchPreviewSession;
  } catch {
    return null;
  }
}

export function saveMatchPreviewSession(session: MatchPreviewSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota
  }
}

export function patchMatchPreviewSession(patch: Partial<MatchPreviewSession>): MatchPreviewSession | null {
  const current = loadMatchPreviewSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveMatchPreviewSession(next);
  return next;
}

export function ensureMatchPreviewSession(input: {
  a_profile_id: string;
  b_profile_id: string;
  locale: string;
}): MatchPreviewSession {
  const existing = loadMatchPreviewSession();
  if (
    existing &&
    existing.a_profile_id === input.a_profile_id &&
    existing.b_profile_id === input.b_profile_id
  ) {
    return existing;
  }

  const session: MatchPreviewSession = {
    preview_id: safeRandomUUID(),
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    unlock_status: "preview",
    locale: input.locale,
    created_at: new Date().toISOString(),
  };
  saveMatchPreviewSession(session);
  return session;
}

export function clearMatchPreviewSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
