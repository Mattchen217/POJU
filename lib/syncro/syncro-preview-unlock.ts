import type { SyncroPreviewSession } from "@/lib/syncro/syncro-preview-session";

export function getSyncroUnlockStatus(session: SyncroPreviewSession): "preview" | "unlocked" {
  return session.unlock_status === "unlocked" ? "unlocked" : "preview";
}

export function isSyncroPreviewSession(session: SyncroPreviewSession): boolean {
  return getSyncroUnlockStatus(session) === "preview";
}
