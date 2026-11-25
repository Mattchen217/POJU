/**
 * Injectable wall clock for lease boundary tests (MemoryKv).
 * Redis Lua uses redis.call("TIME") — never client-supplied nowMs for authority.
 *
 * Note: Redis Lua sandbox has no `os` library — never call os.time/os.date in Lua.
 * Authoritative lease field on Redis path is numeric `lease_expires_ms`.
 */

let nowMsOverride: number | null = null;

export function setBatch3NowMsForTests(ms: number | null): void {
  nowMsOverride = ms;
}

export function batch3NowMs(): number {
  return nowMsOverride ?? Date.now();
}

export function batch3NowIso(): string {
  return new Date(batch3NowMs()).toISOString();
}

/**
 * Sets `__now_ms` from redis.call('TIME') (seconds + microseconds → epoch ms).
 * Embed at the start of Batch3 Lua scripts that need authoritative wall time.
 */
export const REDIS_TIME_LUA_SNIPPET = `
do
  local __t = redis.call("TIME")
  __now_ms = tonumber(__t[1]) * 1000 + math.floor(tonumber(__t[2]) / 1000)
end
`;

/**
 * True when task lease absent or expired vs `__now_ms`.
 * Prefers numeric lease_expires_ms (required on Redis path). ISO string is ignored
 * in Lua (no os.*); MemoryKv parses ISO in TypeScript.
 */
export const REDIS_LEASE_EXPIRED_LUA_SNIPPET = `
local function __batch3_lease_expired(task, now_ms)
  if type(task) ~= "table" then return true end
  local exp_ms = task.lease_expires_ms
  if exp_ms == nil or exp_ms == cjson.null then return true end
  exp_ms = tonumber(exp_ms)
  if not exp_ms then return true end
  return now_ms >= exp_ms
end
`;

/**
 * Display-only ISO helpers — Redis Lua has no os.*; callers MUST pass
 * ARGV display ISO strings. Authority remains lease_expires_ms from TIME.
 */
export const REDIS_MS_TO_ISO_LUA_SNIPPET = `
local function __batch3_ms_to_iso(_ms)
  return tostring(_ms)
end
`;
