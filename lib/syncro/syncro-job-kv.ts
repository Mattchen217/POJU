import { kv } from "@/lib/kv/client";

import type { HourPeriod } from "@/lib/syncro/types";

const TTL = 86400;

export type SyncroJobRecord = {
  session_id: string;
  profile_id: string;
  task_description: string;
  submission_anchor: HourPeriod;
  hour_order: HourPeriod[];
  created_at: number;
  updated_at: number;
};

function isKvConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim(),
  );
}

function jobKey(sessionId: string): string {
  return `syncro:job:${sessionId}`;
}

function deviceIndexKey(deviceId: string): string {
  return `syncro:jobs:device:${deviceId}`;
}

export async function setSyncroJob(record: SyncroJobRecord): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    await kv.set(jobKey(record.session_id), record, { ex: TTL });
  } catch (e) {
    console.warn("[syncro-job-kv] setSyncroJob failed:", e);
  }
}

export async function getSyncroJob(sessionId: string): Promise<SyncroJobRecord | null> {
  if (!isKvConfigured()) return null;
  try {
    return (await kv.get<SyncroJobRecord>(jobKey(sessionId))) ?? null;
  } catch (e) {
    console.warn("[syncro-job-kv] getSyncroJob failed:", e);
    return null;
  }
}

export async function touchSyncroJob(sessionId: string): Promise<void> {
  const job = await getSyncroJob(sessionId);
  if (!job) return;
  await setSyncroJob({ ...job, updated_at: Date.now() });
}

export async function indexSyncroJobForDevice(
  deviceId: string,
  sessionId: string,
): Promise<void> {
  if (!isKvConfigured() || !deviceId.trim()) return;
  try {
    const key = deviceIndexKey(deviceId);
    await kv.lpush(key, sessionId);
    await kv.ltrim(key, 0, 49);
    await kv.expire(key, TTL);
  } catch (e) {
    console.warn("[syncro-job-kv] index failed:", e);
  }
}

export async function listSyncroJobSessionIds(deviceId: string): Promise<string[]> {
  if (!isKvConfigured() || !deviceId.trim()) return [];
  try {
    const ids = await kv.lrange<string>(deviceIndexKey(deviceId), 0, 49);
    return ids ?? [];
  } catch (e) {
    console.warn("[syncro-job-kv] list failed:", e);
    return [];
  }
}
