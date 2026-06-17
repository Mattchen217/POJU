import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

const STORAGE_KEY = "pojulife_syncro_preview_v1";

export type SyncroUnlockStatus = "preview" | "unlocked";
export type SyncroUnlockVia = "payment" | "code";

export type SyncroPreviewSession = {
  preview_id: string;
  profile_id: string;
  unlock_status: SyncroUnlockStatus;
  unlock_via?: SyncroUnlockVia;
  matrix_payload?: PojuMatrixPayload;
  locale: string;
  created_at: string;
};

export function loadSyncroPreviewSession(): SyncroPreviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncroPreviewSession;
  } catch {
    return null;
  }
}

export function saveSyncroPreviewSession(session: SyncroPreviewSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota
  }
}

export function patchSyncroPreviewSession(
  patch: Partial<SyncroPreviewSession>,
): SyncroPreviewSession | null {
  const current = loadSyncroPreviewSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveSyncroPreviewSession(next);
  return next;
}

export function ensureSyncroPreviewSession(input: {
  profile_id: string;
  locale: string;
}): SyncroPreviewSession {
  const existing = loadSyncroPreviewSession();
  if (existing && existing.profile_id === input.profile_id) {
    return existing;
  }

  const session: SyncroPreviewSession = {
    preview_id: safeRandomUUID(),
    profile_id: input.profile_id,
    unlock_status: "preview",
    locale: input.locale,
    created_at: new Date().toISOString(),
  };
  saveSyncroPreviewSession(session);
  return session;
}

export function clearSyncroPreviewSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
