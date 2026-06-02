import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import {
  cleanupExpiredSyncroSessions,
  loadSyncroSession,
  type SyncroSessionListItem,
} from "@/lib/syncro/syncro-session";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import { getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import type { SyncroSession } from "@/lib/syncro/types";

export type SyncroSessionSummary = SyncroSessionListItem & {
  task_description: string;
  hours_ready: number;
  hours_total: number;
  locale: string;
};

function countReadyHours(session: SyncroSession): number {
  const sequence = getOrderedHourPeriodsFromSession(session);
  let ready = 0;
  for (const hourId of sequence) {
    if (isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta)) ready++;
  }
  return ready;
}

/** Non-expired Syncro sessions on this device, newest first, with copy progress. */
export async function listActiveSyncroSessionSummariesForDevice(): Promise<
  SyncroSessionSummary[]
> {
  await cleanupExpiredSyncroSessions();

  const deviceId = getPojuDeviceId();
  const records = await getPojuDb().syncro_sessions.where("device_id").equals(deviceId).toArray();
  const now = Date.now();

  const sorted = [...records].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const summaries: SyncroSessionSummary[] = [];

  for (const record of sorted) {
    if (new Date(record.expires_at).getTime() <= now) continue;

    const session = await loadSyncroSession(record.session_id);
    if (!session || Object.keys(session.matrix).length === 0) continue;

    const sequence = getOrderedHourPeriodsFromSession(session);
    summaries.push({
      session_id: session.session_id,
      profile_id: session.profile_id,
      created_at: session.created_at,
      expires_at: session.expires_at,
      is_expired: false,
      task_description: session.task_description,
      hours_ready: countReadyHours(session),
      hours_total: sequence.length || 12,
      locale: session.locale,
    });
  }

  return summaries;
}
