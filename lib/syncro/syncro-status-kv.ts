import { kv } from "@/lib/kv/client";

const TTL_STATUS = 86400; // 24 hours

export type SyncroHourAdviceCell = {
  short_advice: string;
  detailed_advice: string;
  rationale: string;
};

export type SyncroStatus = {
  total: number;
  completed: number;
  current_hour: string | null;
  failed_hours: string[];
  hour_order: string[];
  started_at: number;
  updated_at: number;
  done: boolean;
};

export type SyncroHourData = {
  advice: Record<string, SyncroHourAdviceCell>;
  completed_at: number;
};

export function isSyncroKvConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim(),
  );
}

function isKvConfigured(): boolean {
  return isSyncroKvConfigured();
}

function statusKey(sessionId: string): string {
  return `syncro:status:${sessionId}`;
}

function hourKey(sessionId: string, hourId: string): string {
  return `syncro:hour:${sessionId}:${hourId}`;
}

export async function setSyncroStatus(sessionId: string, status: SyncroStatus): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    await kv.set(statusKey(sessionId), status, { ex: TTL_STATUS });
  } catch (e) {
    console.warn("[syncro-status-kv] setSyncroStatus failed:", e);
  }
}

export async function getSyncroStatus(sessionId: string): Promise<SyncroStatus | null> {
  if (!isKvConfigured()) return null;

  try {
    return (await kv.get<SyncroStatus>(statusKey(sessionId))) ?? null;
  } catch (e) {
    console.warn("[syncro-status-kv] getSyncroStatus failed:", e);
    return null;
  }
}

export async function setSyncroHour(
  sessionId: string,
  hourId: string,
  data: SyncroHourData,
): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    await kv.set(hourKey(sessionId, hourId), data, { ex: TTL_STATUS });
  } catch (e) {
    console.warn("[syncro-status-kv] setSyncroHour failed:", e);
  }
}

export async function getSyncroHour(
  sessionId: string,
  hourId: string,
): Promise<SyncroHourData | null> {
  if (!isKvConfigured()) return null;

  try {
    return (await kv.get<SyncroHourData>(hourKey(sessionId, hourId))) ?? null;
  } catch (e) {
    console.warn("[syncro-status-kv] getSyncroHour failed:", e);
    return null;
  }
}

export async function incrementSyncroStatus(
  sessionId: string,
  completedHourId: string,
  nextHourId: string | null,
): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    const status = await getSyncroStatus(sessionId);
    if (!status) {
      console.warn("[syncro-status-kv] incrementSyncroStatus: no status for", sessionId);
      return;
    }

    const completed = status.completed + 1;
    const done = completed >= status.total;
    const next: SyncroStatus = {
      ...status,
      completed,
      current_hour: done ? null : nextHourId,
      updated_at: Date.now(),
      done,
    };

    await kv.set(statusKey(sessionId), next, { ex: TTL_STATUS });
    void completedHourId;
  } catch (e) {
    console.warn("[syncro-status-kv] incrementSyncroStatus failed:", e);
  }
}

export async function markSyncroHourFailed(sessionId: string, hourId: string): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    const status = await getSyncroStatus(sessionId);
    if (!status) {
      console.warn("[syncro-status-kv] markSyncroHourFailed: no status for", sessionId);
      return;
    }

    const failed_hours = status.failed_hours.includes(hourId)
      ? status.failed_hours
      : [...status.failed_hours, hourId];

    const next: SyncroStatus = {
      ...status,
      failed_hours,
      updated_at: Date.now(),
    };

    await kv.set(statusKey(sessionId), next, { ex: TTL_STATUS });
  } catch (e) {
    console.warn("[syncro-status-kv] markSyncroHourFailed failed:", e);
  }
}

export async function getAllSyncroHours(
  sessionId: string,
  hourOrder: string[],
): Promise<Record<string, SyncroHourData | null>> {
  const result: Record<string, SyncroHourData | null> = {};

  if (!isKvConfigured()) {
    for (const hourId of hourOrder) result[hourId] = null;
    return result;
  }

  try {
    const entries = await Promise.all(
      hourOrder.map(async (hourId) => {
        const data = await getSyncroHour(sessionId, hourId);
        return [hourId, data] as const;
      }),
    );
    for (const [hourId, data] of entries) {
      result[hourId] = data;
    }
  } catch (e) {
    console.warn("[syncro-status-kv] getAllSyncroHours failed:", e);
    for (const hourId of hourOrder) {
      if (!(hourId in result)) result[hourId] = null;
    }
  }

  return result;
}

export async function clearSyncroState(sessionId: string): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    const status = await getSyncroStatus(sessionId);
    const hourIds = status?.hour_order?.length ? status.hour_order : [];

    const keys = [statusKey(sessionId), ...hourIds.map((hourId) => hourKey(sessionId, hourId))];

    if (keys.length > 0) await kv.del(...keys);
  } catch (e) {
    console.warn("[syncro-status-kv] clearSyncroState failed:", e);
  }
}
