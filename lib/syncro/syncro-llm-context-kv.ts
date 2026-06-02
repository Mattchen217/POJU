import { kv } from "@/lib/kv/client";
import type { SyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";

const TTL = 86400;

function isKvConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim(),
  );
}

function ctxKey(sessionId: string): string {
  return `syncro:llm_ctx:${sessionId}`;
}

export async function setSyncroLlmContextKv(
  sessionId: string,
  ctx: SyncroLlmContext,
): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.set(ctxKey(sessionId), ctx, { ex: TTL });
  } catch (e) {
    console.warn("[syncro-llm-context-kv] set failed:", e);
  }
}

export async function getSyncroLlmContextKv(
  sessionId: string,
): Promise<SyncroLlmContext | null> {
  if (!isKvConfigured()) return null;
  try {
    return (await kv.get<SyncroLlmContext>(ctxKey(sessionId))) ?? null;
  } catch (e) {
    console.warn("[syncro-llm-context-kv] get failed:", e);
    return null;
  }
}
