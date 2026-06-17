import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { syncSessionCyclesToDb } from "@/lib/poju/cycle-db-sync";
import { createNewCycle, ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { syncPojuSessionVaultArchive } from "@/lib/archive/poju-session-vault";
import type { POJUSessionState, PojuV4StateHint } from "@/lib/poju/types";

const SESSION_SECRET = "pojulife_v4_poju_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isLikelyStoredProfileId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

export async function createPOJUSession(input: {
  payment_id: string;
  original_question: string;
  /** When set, Step 8 can load Step 7 `base_analysis` from this `stored_profiles` row. */
  selected_stored_profile_id?: string | null;
}): Promise<string> {
  const db = getPojuDb();
  const deviceId = getPojuDeviceId();
  const now = new Date();
  const sessionId = safeRandomUUID();
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS);

  const storedId =
    typeof input.selected_stored_profile_id === "string" && isLikelyStoredProfileId(input.selected_stored_profile_id)
      ? input.selected_stored_profile_id.trim()
      : null;

  const firstCycle = createNewCycle({
    original_question: input.original_question,
    cycle_index: 1,
  });

  const sessionState: POJUSessionState = {
    session_id: sessionId,
    device_id: deviceId,
    original_question: input.original_question.trim(),
    cycles: [firstCycle],
    active_cycle_id: firstCycle.cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: Boolean(storedId),
    birth_submitted_in_session: false,
    profile_skipped: false,
    selected_stored_profile_id: storedId,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now.toISOString(),
    last_interaction_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    unlock_status: "preview",
  };

  const payload = await encryptJson(SESSION_SECRET, sessionState);
  await db.pojuSessionRecords.put({
    session_id: sessionId,
    device_id: deviceId,
    encrypted_data: payload.cipher,
    iv: payload.iv,
    status: "active",
    original_question: sessionState.original_question,
    created_at: now,
    last_interaction_at: now,
    expires_at: expiresAt,
    payment_id: input.payment_id,
    payment_processor: "dodopayments",
    renewals: [],
    tokens_used: 0,
    turn_count: 0,
    current_state_hint: "opening",
    main_delivery_done: false,
    active_cycle_id: firstCycle.cycle_id,
  });

  await syncSessionCyclesToDb(sessionState);

  try {
    await syncPojuSessionVaultArchive(sessionState);
  } catch (e) {
    console.error("[poju] Initial archive vault sync failed:", e);
  }

  return sessionId;
}

export async function loadPOJUSession(sessionId: string): Promise<POJUSessionState | null> {
  const db = getPojuDb();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row) return null;
  try {
    const raw = await decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row.iv,
      cipher: row.encrypted_data,
    });
    return ensureSessionCycles(raw);
  } catch {
    return null;
  }
}

export async function savePOJUSession(state: POJUSessionState): Promise<void> {
  const db = getPojuDb();
  const payload = await encryptJson(SESSION_SECRET, state);
  await db.pojuSessionRecords.update(state.session_id, {
    encrypted_data: payload.cipher,
    iv: payload.iv,
    last_interaction_at: new Date(state.last_interaction_at),
    expires_at: new Date(state.expires_at),
    tokens_used: state.tokens_used,
    turn_count: state.messages.filter((m) => m.role !== "system").length,
    current_state_hint: getCurrentStateHint(state),
    main_delivery_done: state.main_delivery_done,
    main_delivery_at: state.main_delivery_done ? new Date() : undefined,
    active_cycle_id: state.active_cycle_id,
  });
  await syncSessionCyclesToDb(state);

  try {
    await syncPojuSessionVaultArchive(state);
  } catch (e) {
    console.error("[poju] Archive vault sync failed:", e);
  }
}

export async function getActivePOJUSessionsByDevice(deviceId: string) {
  const db = getPojuDb();
  return db.pojuSessionRecords
    .where("device_id")
    .equals(deviceId)
    .and((s) => s.status === "active")
    .toArray();
}

function getCurrentStateHint(state: POJUSessionState): PojuV4StateHint {
  if (state.main_delivery_done) return "tracking";
  const phase = state.agent_v2?.current_phase;
  if (phase === "awaiting_confirmation") return "analyzing";
  if (phase === "opening") return "opening";
  if (state.messages.length === 0) return "opening";
  if (resolveSessionHasProfile(state)) return "collecting_context";
  return "collecting_context";
}

/** Extend active session by 30 days after a paid renewal. */
export async function extendPOJUV4Session(
  sessionId: string,
  paymentId: string,
): Promise<POJUSessionState | null> {
  const db = getPojuDb();
  const row = await db.pojuSessionRecords.get(sessionId);
  const state = await loadPOJUSession(sessionId);
  if (!row || !state || row.status !== "active") return null;
  if (getPojuDeviceId() !== state.device_id) return null;
  if (!paymentId.trim()) return null;

  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const next: POJUSessionState = {
    ...state,
    expires_at: exp.toISOString(),
    last_interaction_at: now.toISOString(),
  };

  await db.pojuSessionRecords.update(sessionId, {
    expires_at: exp,
    last_interaction_at: now,
    renewals: [
      ...row.renewals,
      { extended_at: now, reason: "paid_extension", payment_id: paymentId.trim() },
    ],
  });

  await savePOJUSession(next);
  return next;
}

export async function listPOJUV4SessionRowsForDevice(deviceId: string) {
  const db = getPojuDb();
  return db.pojuSessionRecords.where("device_id").equals(deviceId).toArray();
}

export async function getPOJUSessionRecord(sessionId: string) {
  if (typeof window === "undefined") return undefined;
  return getPojuDb().pojuSessionRecords.get(sessionId);
}

/** Remove unused session row from this device (e.g. after refund). */
export async function deletePOJUSession(sessionId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getPojuDb();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row) return;
  if (getPojuDeviceId() !== row.device_id) return;
  await db.pojuSessionRecords.delete(sessionId);
}
