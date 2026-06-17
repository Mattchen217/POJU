import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { getActivePOJUSessionsByDevice } from "@/lib/poju/session-manager";

export type ActivePojuSessionPickerRow = {
  session_id: string;
  original_question: string;
  expires_at: string;
  last_interaction_at: string;
  days_left: number;
};

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Fast picker list — uses indexed DB row fields only (no per-session decrypt). */
export async function listActivePojuSessionsForPicker(): Promise<ActivePojuSessionPickerRow[]> {
  const deviceId = getPojuDeviceId();
  const rows = await getActivePOJUSessionsByDevice(deviceId);
  const now = Date.now();
  const out: ActivePojuSessionPickerRow[] = [];

  for (const row of rows) {
    const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
    if (expiresAt.getTime() <= now) continue;

    const lastInteraction =
      row.last_interaction_at instanceof Date
        ? row.last_interaction_at.toISOString()
        : String(row.last_interaction_at);

    out.push({
      session_id: row.session_id,
      original_question: row.original_question,
      expires_at: expiresAt.toISOString(),
      last_interaction_at: lastInteraction,
      days_left: daysLeft(expiresAt.toISOString()),
    });
  }

  out.sort(
    (a, b) => new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime(),
  );
  return out;
}
