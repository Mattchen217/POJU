import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb } from "@/lib/db/poju-db";
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

const SYNCRO_LLM_CTX_SECRET = "pojulife_v5_syncro_llm_ctx";

function storageKey(sessionId: string): string {
  return `syncro_llm_ctx_${sessionId}`;
}

function dbCacheId(sessionId: string): string {
  return `llm_ctx_${sessionId}`;
}

export function saveSyncroLlmContext(sessionId: string, ctx: SyncroLlmContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(sessionId), JSON.stringify(ctx));
  } catch (e) {
    console.warn("[syncro-llm-ctx] sessionStorage save failed:", e);
  }
  void saveSyncroLlmContextToDb(sessionId, ctx);
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

export async function loadSyncroLlmContextFromDb(
  sessionId: string,
): Promise<SyncroLlmContext | null> {
  if (typeof window === "undefined") return null;
  try {
    const row = await getPojuDb().syncroCache.get(dbCacheId(sessionId));
    if (!row?.payload) return null;
    return await decryptJson<SyncroLlmContext>(SYNCRO_LLM_CTX_SECRET, row.payload);
  } catch (e) {
    console.warn("[syncro-llm-ctx] IndexedDB load failed:", e);
    return null;
  }
}

export async function saveSyncroLlmContextToDb(
  sessionId: string,
  ctx: SyncroLlmContext,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const payload = await encryptJson(SYNCRO_LLM_CTX_SECRET, ctx);
    const now = Date.now();
    await getPojuDb().syncroCache.put({
      id: dbCacheId(sessionId),
      payload,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    console.warn("[syncro-llm-ctx] IndexedDB save failed:", e);
  }
}

export async function resolveSyncroLlmContext(
  sessionId: string,
): Promise<SyncroLlmContext | null> {
  let ctx = loadSyncroLlmContext(sessionId);
  if (ctx) return ctx;

  ctx = await loadSyncroLlmContextFromDb(sessionId);
  if (ctx) {
    saveSyncroLlmContext(sessionId, ctx);
    return ctx;
  }

  return null;
}

export function clearSyncroLlmContext(sessionId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(sessionId));
  void getPojuDb().syncroCache.delete(dbCacheId(sessionId)).catch(() => {});
}
