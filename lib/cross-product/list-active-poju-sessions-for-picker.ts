import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { loadPOJUSession, getActivePOJUSessionsByDevice } from "@/lib/poju/session-manager";

export type ActivePojuSessionPickerRow = {
  session_id: string;
  original_question: string;
  expires_at: string;
  cycle_count: number;
  days_left: number;
};

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function listActivePojuSessionsForPicker(): Promise<ActivePojuSessionPickerRow[]> {
  const deviceId = getPojuDeviceId();
  const rows = await getActivePOJUSessionsByDevice(deviceId);
  const out: ActivePojuSessionPickerRow[] = [];

  for (const row of rows) {
    const state = await loadPOJUSession(row.session_id);
    const expires =
      state?.expires_at ?? (row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at));
    out.push({
      session_id: row.session_id,
      original_question: state?.original_question ?? row.original_question,
      expires_at: expires,
      cycle_count: state?.cycles?.length ?? 1,
      days_left: daysLeft(expires),
    });
  }

  out.sort((a, b) => b.days_left - a.days_left);
  return out;
}
