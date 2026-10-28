/**
 * Upstash fixed-plan ceiling. When this trips, every command fails — including GET —
 * so async xhigh jobs cannot be created or polled until the database is upgraded
 * or the bandwidth window resets.
 *
 * Live production string (2026-10-28):
 * `ERR This database has reached current Fixed plan limits. ... command was: [["get",...]]`
 */
export function isUpstashPlanLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    msg.includes("reached current Fixed plan limits") ||
    msg.includes("max requests limit exceeded") ||
    msg.includes("DB capacity quota exceeded")
  );
}

/**
 * Plan-limit plus transport failures from the Redis client.
 * Status polls must turn these into a terminal payload, not an uncaught 500.
 */
export function isKvStoreOutage(error: unknown): boolean {
  if (isUpstashPlanLimitError(error)) return true;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /upstash|redis|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|socket hang up|MaxRetriesPerRequest/i.test(
    msg,
  );
}
