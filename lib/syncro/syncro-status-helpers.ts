import { isSyncroHourKvComplete } from "@/lib/syncro/syncro-hour-kv-complete";
import { getSyncroHour } from "@/lib/syncro/syncro-status-kv";
import type { HourPeriod } from "@/lib/syncro/types";

export async function countCompletedInKv(
  sessionId: string,
  hourOrder: HourPeriod[],
): Promise<number> {
  let n = 0;
  for (const hourId of hourOrder) {
    const data = await getSyncroHour(sessionId, hourId);
    if (isSyncroHourKvComplete(data)) n++;
  }
  return n;
}
