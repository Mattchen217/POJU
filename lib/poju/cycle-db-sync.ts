/**
 * Persist cycle index rows for Tool Linking (encrypted payload remains source of truth).
 */

import { getPojuDb } from "@/lib/db/poju-db";
import type { POJUSessionState } from "@/lib/poju/types";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

export async function syncSessionCyclesToDb(state: POJUSessionState): Promise<void> {
  if (typeof window === "undefined") return;
  const cycles = state.cycles;
  if (!cycles?.length) return;

  const db = getPojuDb();
  const sessionId = state.session_id;
  const deviceId = state.device_id;
  const ownerKey = await resolveLocalOwnerKey();

  await db.poju_cycles.where("session_id").equals(sessionId).delete();

  const rows = cycles.map((c) => ({
    cycle_id: c.cycle_id,
    session_id: sessionId,
    device_id: deviceId,
    owner_key: ownerKey,
    cycle_index: c.cycle_index,
    is_active: c.cycle_id === state.active_cycle_id,
    is_delivered: c.is_delivered,
    started_at: new Date(c.started_at),
    delivery_completed_at: c.delivery_completed_at ? new Date(c.delivery_completed_at) : undefined,
  }));

  await db.poju_cycles.bulkPut(rows);

  await db.poju_tool_suggestions.where("session_id").equals(sessionId).delete();

  const suggestionRows = cycles.flatMap((c) =>
    c.tool_suggestions.map((s, idx) => ({
      suggestion_id: `${c.cycle_id}__${s.tool}__${idx}__${s.suggested_at}`,
      session_id: sessionId,
      cycle_id: c.cycle_id,
      owner_key: ownerKey,
      tool: s.tool,
      user_action: s.user_action,
      suggested_at: new Date(s.suggested_at),
      tool_completed_at: s.tool_completed_at ? new Date(s.tool_completed_at) : undefined,
    })),
  );

  if (suggestionRows.length > 0) {
    await db.poju_tool_suggestions.bulkPut(suggestionRows);
  }
}
