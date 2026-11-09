/**
 * M2.2-R3 — Atomic claim compare-and-delete (fail closed).
 * Shared by server claim ops and tests; no server-only import.
 */

export class ClaimCasUnavailableError extends Error {
  readonly code = "CLAIM_CAS_UNAVAILABLE" as const;
  constructor(
    message = "Atomic compare-and-delete unavailable; refusing non-atomic claim release",
  ) {
    super(message);
    this.name = "ClaimCasUnavailableError";
  }
}

export type FreezeReportClaimCasStore = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  compareAndDelete?: (key: string, expectedToken: string) => Promise<boolean>;
  eval?: (
    script: string,
    keys: string[],
    args: string[],
  ) => Promise<unknown>;
};

export const CAS_DELETE_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then
  raw = tostring(raw)
end
if raw == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
local ok, obj = pcall(cjson.decode, raw)
if ok and type(obj) == 'table' and tostring(obj['token']) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * Token-checked compare-and-delete.
 * Never silently downgrades to GET+DEL when atomic CAS is unavailable.
 */
export async function compareAndDeleteClaim(
  store: FreezeReportClaimCasStore,
  key: string,
  token: string,
): Promise<boolean> {
  if (typeof store.compareAndDelete === "function") {
    return store.compareAndDelete(key, token);
  }
  if (typeof store.eval === "function") {
    const result = await store.eval(CAS_DELETE_LUA, [key], [token]);
    return result === 1 || result === true;
  }
  throw new ClaimCasUnavailableError(
    `compareAndDeleteClaim: store provides neither compareAndDelete nor eval for key ${key}`,
  );
}
