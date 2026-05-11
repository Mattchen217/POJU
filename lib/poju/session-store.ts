import { createClient, kv } from "@vercel/kv";
import type { SessionState } from "@/lib/poju/types";

type StoreGlobals = {
  __pojuSessions?: Map<string, SessionState>;
  __pojuArchived?: Map<string, SessionState>;
};

const storeGlobal = globalThis as StoreGlobals;
const sessions = storeGlobal.__pojuSessions ?? new Map<string, SessionState>();
const archived = storeGlobal.__pojuArchived ?? new Map<string, SessionState>();
storeGlobal.__pojuSessions = sessions;
storeGlobal.__pojuArchived = archived;

const K_SESSION = "poju:s:";
const K_ARCHIVED = "poju:a:";
const K_DEVICE = "poju:d:";
/** Rolling TTL so idle sessions are eventually evicted from Redis (state is best-effort after long dormancy). */
const SESSION_KV_TTL_SEC = 60 * 60 * 24 * 90;

export function isPojuSessionKvConfigured(): boolean {
  return !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

type RedisLike = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
  scanIterator: (opts?: { match?: string; count?: number }) => AsyncIterable<string>;
};

let upstashClient: RedisLike | null = null;

function getRedis(): RedisLike {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return kv as RedisLike;
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!upstashClient) {
      upstashClient = createClient({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }) as RedisLike;
    }
    return upstashClient;
  }
  throw new Error("poju: KV / Upstash Redis env vars are not set");
}

function memSave(session: SessionState): void {
  if (session.status === "archived") {
    sessions.delete(session.sessionId);
    archived.set(session.sessionId, session);
    return;
  }
  archived.delete(session.sessionId);
  sessions.set(session.sessionId, session);
}

function memLoad(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

function memArchive(sessionId: string): boolean {
  const hit = sessions.get(sessionId);
  if (!hit) return false;
  sessions.delete(sessionId);
  archived.set(sessionId, { ...hit, status: "archived" });
  return true;
}

function memRestore(sessionId: string): SessionState | null {
  const hit = archived.get(sessionId);
  if (!hit) return null;
  archived.delete(sessionId);
  const restored: SessionState = {
    ...hit,
    status: "active",
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    renewals: [...hit.renewals, { at: Date.now(), days: 30 }],
  };
  sessions.set(sessionId, restored);
  return restored;
}

function memGetActiveByDevice(deviceId: string): SessionState | null {
  for (const s of sessions.values()) {
    if (s.deviceId === deviceId && s.status === "active") return s;
  }
  return null;
}

function memAllSessions(): SessionState[] {
  return [...sessions.values()];
}

async function kvWriteArchived(redis: RedisLike, session: SessionState): Promise<void> {
  const sid = session.sessionId;
  await redis.set(`${K_ARCHIVED}${sid}`, session, { ex: SESSION_KV_TTL_SEC });
  await redis.del(`${K_SESSION}${sid}`);
  const devKey = `${K_DEVICE}${session.deviceId}`;
  const cur = await redis.get<string>(devKey);
  if (cur === sid) await redis.del(devKey);
}

async function kvArchiveExpiredActive(redis: RedisLike, s: SessionState): Promise<void> {
  const archivedState: SessionState = { ...s, status: "archived" };
  await kvWriteArchived(redis, archivedState);
}

export async function saveSession(session: SessionState): Promise<void> {
  if (!isPojuSessionKvConfigured()) {
    memSave(session);
    return;
  }
  const redis = getRedis();
  if (session.status === "archived") {
    await kvWriteArchived(redis, session);
    return;
  }
  await redis.set(`${K_SESSION}${session.sessionId}`, session, { ex: SESSION_KV_TTL_SEC });
  await redis.del(`${K_ARCHIVED}${session.sessionId}`);
  if (session.status === "active") {
    await redis.set(`${K_DEVICE}${session.deviceId}`, session.sessionId, { ex: SESSION_KV_TTL_SEC });
  } else {
    const devKey = `${K_DEVICE}${session.deviceId}`;
    const cur = await redis.get<string>(devKey);
    if (cur === session.sessionId) await redis.del(devKey);
  }
}

export async function loadSession(sessionId: string): Promise<SessionState | null> {
  if (!isPojuSessionKvConfigured()) {
    return memLoad(sessionId);
  }
  const redis = getRedis();
  const s = await redis.get<SessionState>(`${K_SESSION}${sessionId}`);
  if (!s) return null;
  if (s.status === "active" && s.expiresAt <= Date.now()) {
    await kvArchiveExpiredActive(redis, s);
    return null;
  }
  return s;
}

export async function archiveSession(sessionId: string): Promise<boolean> {
  if (!isPojuSessionKvConfigured()) {
    return memArchive(sessionId);
  }
  const redis = getRedis();
  const hit = await redis.get<SessionState>(`${K_SESSION}${sessionId}`);
  if (!hit) return false;
  await kvWriteArchived(redis, { ...hit, status: "archived" });
  return true;
}

export async function restoreSession(sessionId: string): Promise<SessionState | null> {
  if (!isPojuSessionKvConfigured()) {
    return memRestore(sessionId);
  }
  const redis = getRedis();
  const hit = await redis.get<SessionState>(`${K_ARCHIVED}${sessionId}`);
  if (!hit) return null;
  await redis.del(`${K_ARCHIVED}${sessionId}`);
  const restored: SessionState = {
    ...hit,
    status: "active",
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    renewals: [...hit.renewals, { at: Date.now(), days: 30 }],
  };
  await saveSession(restored);
  return restored;
}

export async function getActiveByDevice(deviceId: string): Promise<SessionState | null> {
  if (!isPojuSessionKvConfigured()) {
    return memGetActiveByDevice(deviceId);
  }
  const redis = getRedis();
  const sid = await redis.get<string>(`${K_DEVICE}${deviceId}`);
  if (!sid) return null;
  return await loadSession(sid);
}

export async function allSessions(): Promise<SessionState[]> {
  if (!isPojuSessionKvConfigured()) {
    return memAllSessions();
  }
  const redis = getRedis();
  const out: SessionState[] = [];
  for await (const key of redis.scanIterator({ match: `${K_SESSION}*`, count: 200 })) {
    const s = await redis.get<SessionState>(key);
    if (s) out.push(s);
  }
  return out;
}
