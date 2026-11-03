/**
 * Persist cycle index rows for Tool Linking (encrypted payload remains source of truth).
 * Phase 2 C1: cycle index is part of the *core* persist boundary with the session blob
 * (see savePOJUSessionCore). Archive/profile sync stays post-commit side effects.
 */

import { getPojuDb, type PojuDb } from "@/lib/db/poju-db";
import type { POJUSessionState } from "@/lib/poju/types";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

async function writeCycleIndexRows(
  db: PojuDb,
  state: POJUSessionState,
  ownerKey: string,
): Promise<void> {
  const cycles = state.cycles;
  if (!cycles?.length) return;

  const sessionId = state.session_id;
  const deviceId = state.device_id;

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

export async function syncSessionCyclesToDb(state: POJUSessionState): Promise<void> {
  if (typeof window === "undefined") return;
  const cycles = state.cycles;
  if (!cycles?.length) return;

  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  await writeCycleIndexRows(db, state, ownerKey);
}

/**
 * Same cycle-index write, intended to run inside a Dexie transaction that also
 * updates `pojuSessionRecords` (C1 core boundary = blob + cycle index).
 */
export async function syncSessionCyclesToDbWithDb(
  db: PojuDb,
  state: POJUSessionState,
  ownerKey: string,
): Promise<void> {
  await writeCycleIndexRows(db, state, ownerKey);
}

/** Table names participating in the C1 core Dexie transaction. */
export const POJU_SESSION_CORE_TABLES = [
  "pojuSessionRecords",
  "poju_cycles",
  "poju_tool_suggestions",
] as const;
