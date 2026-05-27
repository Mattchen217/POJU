import type { MatrixCell, SyncroMatrixMetadata } from "@/lib/syncro/calculate-matrix";
import type { UserProfile } from "@/lib/profile/types";

/** Client-only: batch LLM needs local cells with `_internal` (not stored in public matrix). */
export type SyncroLlmContext = {
  profile_id: string;
  task_description: string;
  user_location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  locale: string;
  user_profile: UserProfile;
  base_analysis: unknown;
  local_matrix: Record<string, MatrixCell>;
  compute_started_at: string;
  true_solar?: SyncroMatrixMetadata;
};

function storageKey(sessionId: string): string {
  return `syncro_llm_ctx_${sessionId}`;
}

export function saveSyncroLlmContext(sessionId: string, ctx: SyncroLlmContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(sessionId), JSON.stringify(ctx));
  } catch (e) {
    console.warn("[syncro-llm-ctx] save failed:", e);
  }
}

export function loadSyncroLlmContext(sessionId: string): SyncroLlmContext | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncroLlmContext;
  } catch {
    return null;
  }
}

export function clearSyncroLlmContext(sessionId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(sessionId));
}
