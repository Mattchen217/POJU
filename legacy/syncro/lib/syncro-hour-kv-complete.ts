import type { SyncroHourData } from "@/lib/syncro/syncro-status-kv";

/** True when KV has full advice for one hour (8 direction cells with short copy). */
export function isSyncroHourKvComplete(data: SyncroHourData | null | undefined): boolean {
  if (!data?.advice) return false;
  const cells = Object.values(data.advice);
  if (cells.length < 8) return false;
  return cells.every((c) => Boolean(c.short_advice?.trim()));
}
