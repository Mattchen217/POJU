/**
 * M5-R1-FU3 — owner-checked session lock for Decision Intake 2.0 reports (server).
 *
 * One lock per session (same key as the generic xhigh lock), but the value names its
 * holder instead of a bare timestamp:
 *
 *   holder "start"  a report start inside its critical window — authorization pre-check,
 *                   job create / reuse, charge, refusal abort. Idle (untouched) longer than
 *                   `REPORT_START_LOCK_IDLE_MS` → its request died; another start may take
 *                   it over by CAS on the exact record.
 *   holder "job"    execution handed to `job_id` after its charge was authorized; released
 *                   by that job's lifetime (runner end, relay stop, stale status) only.
 *
 * Every write is a compare-and-set / compare-and-delete on the exact record read, so a
 * request can only touch, hand off or release the lock it still owns (`lock_token` +
 * `owner_attempt_id` + `session_id`), and a late cleanup can never delete a lock taken by a
 * later request. Read or CAS unavailability throws: callers fail closed (no job, no charge,
 * no dispatch, no delete). Other xhigh phases keep the generic lock API.
 */

import { kv, KV_TTL } from "@/lib/kv/client";
import { xhighSessionLockKey } from "@/lib/poju/xhigh-job-types";

/** Same window as an abandoned charge claim: a start silent this long has died. */
export const REPORT_START_LOCK_IDLE_MS = 60_000;
/** Pre-FU3 lock values (bare timestamps): reclaimable only when no job is live and this old. */
export const LEGACY_REPORT_LOCK_ORPHAN_MS = 2 * 60_000;

const LOCK_TTL = KV_TTL.POJU_XHIGH_LOCK;

export type ReportLockHolder = "start" | "job";

export type ReportSessionLock = {
  version: 1;
  session_id: string;
  lock_token: string;
  owner_attempt_id: string;
  holder: ReportLockHolder;
  /** Bound once the start created / reused its job; the job's id after hand-off. */
  job_id: string | null;
  created_at: number;
  touched_at: number;
};

export type ReportLockOwner = Pick<ReportSessionLock, "session_id" | "lock_token" | "owner_attempt_id">;

export type ReportLockRead =
  | { kind: "absent" }
  | { kind: "owned"; lock: ReportSessionLock; raw: unknown }
  /** Pre-FU3 value: a bare acquisition timestamp, owner unknown. */
  | { kind: "legacy"; at: number; raw: unknown }
  /** Unrecognised value: never deleted or overwritten (fail closed). */
  | { kind: "invalid"; raw: unknown };

export class ReportLockUnavailableError extends Error {
  readonly code = "REPORT_LOCK_UNAVAILABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "ReportLockUnavailableError";
  }
}

type LockKv = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => Promise<"OK" | null | unknown>;
  compareAndSetExact?: (key: string, expectedJson: string | null, next: unknown, opts?: { ex?: number }) => Promise<boolean>;
  compareAndDeleteExact?: (key: string, expectedJson: string) => Promise<boolean>;
  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;
};

/** Lua: SET only when the current raw value equals ARGV[1]. */
const CAS_SET_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then raw = tostring(raw) end
if raw ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

/** Lua: DEL only when the current raw value equals ARGV[1]. */
const CAS_DEL_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then raw = tostring(raw) end
if raw ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])
`;

function store(): LockKv {
  return kv as unknown as LockKv;
}

export function reportSessionLockKey(session_id: string): string {
  return xhighSessionLockKey("decision_report", session_id);
}

export function newReportLockOwner(session_id: string): ReportLockOwner {
  return { session_id, lock_token: crypto.randomUUID(), owner_attempt_id: crypto.randomUUID() };
}

export function isReportLockOwnedBy(lock: ReportSessionLock, owner: ReportLockOwner): boolean {
  return (
    lock.session_id === owner.session_id &&
    lock.lock_token === owner.lock_token &&
    lock.owner_attempt_id === owner.owner_attempt_id
  );
}

export function reportLockOwnerOf(lock: ReportSessionLock): ReportLockOwner {
  return { session_id: lock.session_id, lock_token: lock.lock_token, owner_attempt_id: lock.owner_attempt_id };
}

function parseLock(raw: unknown, session_id: string): ReportLockRead {
  if (raw == null) return { kind: "absent" };
  if (typeof raw === "number" && Number.isFinite(raw)) return { kind: "legacy", at: raw, raw };
  if (typeof raw === "string" && /^\d+$/.test(raw)) return { kind: "legacy", at: Number(raw), raw };
  if (typeof raw === "object") {
    const l = raw as Partial<ReportSessionLock>;
    if (
      l.version === 1 &&
      l.session_id === session_id &&
      typeof l.lock_token === "string" &&
      typeof l.owner_attempt_id === "string" &&
      (l.holder === "start" || l.holder === "job") &&
      typeof l.created_at === "number" &&
      typeof l.touched_at === "number"
    ) {
      return { kind: "owned", lock: { ...(l as ReportSessionLock), job_id: l.job_id ?? null }, raw };
    }
  }
  return { kind: "invalid", raw };
}

/** Throws when the store cannot be read (callers fail closed). */
export async function readReportSessionLock(session_id: string): Promise<ReportLockRead> {
  const raw = await store().get<unknown>(reportSessionLockKey(session_id));
  return parseLock(raw, session_id);
}

async function casReplace(session_id: string, expectedRaw: unknown, next: ReportSessionLock): Promise<boolean> {
  const s = store();
  const key = reportSessionLockKey(session_id);
  const expectedJson = JSON.stringify(expectedRaw);
  if (typeof s.compareAndSetExact === "function") {
    return s.compareAndSetExact(key, expectedJson, next, { ex: LOCK_TTL });
  }
  if (typeof s.eval === "function") {
    const r = await s.eval(CAS_SET_LUA, [key], [expectedJson, JSON.stringify(next), String(LOCK_TTL)]);
    return r === 1 || r === true;
  }
  throw new ReportLockUnavailableError(`report lock CAS unavailable for ${key}`);
}

async function casDelete(session_id: string, expectedRaw: unknown): Promise<boolean> {
  const s = store();
  const key = reportSessionLockKey(session_id);
  const expectedJson = JSON.stringify(expectedRaw);
  if (typeof s.compareAndDeleteExact === "function") return s.compareAndDeleteExact(key, expectedJson);
  if (typeof s.eval === "function") {
    const r = await s.eval(CAS_DEL_LUA, [key], [expectedJson]);
    return r === 1 || r === true;
  }
  throw new ReportLockUnavailableError(`report lock compare-and-delete unavailable for ${key}`);
}

function freshLock(owner: ReportLockOwner, holder: ReportLockHolder, job_id: string | null): ReportSessionLock {
  const now = Date.now();
  return {
    version: 1,
    session_id: owner.session_id,
    lock_token: owner.lock_token,
    owner_attempt_id: owner.owner_attempt_id,
    holder,
    job_id,
    created_at: now,
    touched_at: now,
  };
}

/** NX create. Null when any lock exists. */
export async function tryCreateReportLock(
  owner: ReportLockOwner,
  holder: ReportLockHolder,
  job_id: string | null,
): Promise<ReportSessionLock | null> {
  const lock = freshLock(owner, holder, job_id);
  const r = await store().set(reportSessionLockKey(owner.session_id), lock, { ex: LOCK_TTL, nx: true });
  return r === "OK" ? lock : null;
}

/**
 * Replace exactly the lock value read (`expectedRaw`) with one owned by `owner`. The caller
 * has decided that value is abandoned (idle start, terminal job, aged legacy timestamp) or
 * belongs to a job it supersedes; the CAS makes two takers exclusive.
 */
export async function takeOverReportLock(
  expectedRaw: unknown,
  owner: ReportLockOwner,
  holder: ReportLockHolder,
  job_id: string | null,
): Promise<ReportSessionLock | null> {
  const lock = freshLock(owner, holder, job_id);
  return (await casReplace(owner.session_id, expectedRaw, lock)) ? lock : null;
}

/**
 * Rewrite the lock this owner still holds (bind its job, hand it to the job, or just
 * refresh `touched_at`). Null when the lock is no longer this owner's.
 */
export async function updateOwnedReportLock(
  owner: ReportLockOwner,
  patch: { holder?: ReportLockHolder; job_id?: string | null } = {},
): Promise<ReportSessionLock | null> {
  for (let round = 0; round < 3; round++) {
    const cur = await readReportSessionLock(owner.session_id);
    if (cur.kind !== "owned" || !isReportLockOwnedBy(cur.lock, owner)) return null;
    const next: ReportSessionLock = {
      ...cur.lock,
      holder: patch.holder ?? cur.lock.holder,
      job_id: patch.job_id !== undefined ? patch.job_id : cur.lock.job_id,
      touched_at: Date.now(),
    };
    if (await casReplace(owner.session_id, cur.raw, next)) return next;
  }
  return null;
}

export type ReportLockRelease = "released" | "absent" | "not_owner";

/**
 * Owner-checked release: deletes only a lock whose token, attempt and session are this
 * owner's (compare-and-delete on the exact record). Never deletes another request's lock.
 */
export async function releaseOwnedReportLock(owner: ReportLockOwner): Promise<ReportLockRelease> {
  for (let round = 0; round < 3; round++) {
    const cur = await readReportSessionLock(owner.session_id);
    if (cur.kind === "absent") return "absent";
    if (cur.kind !== "owned" || !isReportLockOwnedBy(cur.lock, owner)) return "not_owner";
    if (await casDelete(owner.session_id, cur.raw)) return "released";
  }
  throw new ReportLockUnavailableError(`report lock release contended for ${owner.session_id}`);
}

/**
 * Job-lifetime release (runner end, relay stop, stale status, failed dispatch): deletes
 * only the lock handed to `job_id`. A start's lock — even one bound to this job before
 * hand-off — and any later lock are left alone.
 */
export async function releaseReportJobLock(session_id: string, job_id: string): Promise<ReportLockRelease> {
  for (let round = 0; round < 3; round++) {
    const cur = await readReportSessionLock(session_id);
    if (cur.kind === "absent") return "absent";
    if (cur.kind !== "owned" || cur.lock.holder !== "job" || cur.lock.job_id !== job_id) return "not_owner";
    if (await casDelete(session_id, cur.raw)) return "released";
  }
  throw new ReportLockUnavailableError(`report job lock release contended for ${session_id}`);
}
