import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { getPojuDb } from "@/lib/db/poju-db";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import {
  POJU_SESSION_CORE_TABLES,
  syncSessionCyclesToDb,
  syncSessionCyclesToDbWithDb,
} from "@/lib/poju/cycle-db-sync";
import { createNewCycle, ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { syncPojuSessionVaultArchive } from "@/lib/archive/poju-session-vault";
import { syncPojuSessionReportsToStoredProfiles } from "@/lib/profile/sync-poju-base-analysis";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import { isRowOwnedBy, resolveLocalOwnerKey } from "@/lib/storage/local-owner";
import type { POJUSessionState, PojuV4StateHint } from "@/lib/poju/types";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import type { DecisionContext } from "@/lib/poju/decision-context";
import {
  applyControlPlaneToWorking,
  applyDcToWorking,
  beginPersistTransaction,
  commitPersistTransaction,
  extractDcSessionSlice,
  hydratePersistIdempotencyFromKeys,
  restoreDecisionContextAuthority,
  type CommitPersistResult,
  type ControlPlaneSlice,
  type PersistTransaction,
} from "@/lib/poju/decision-context/persist";

const SESSION_SECRET = "pojulife_v4_poju_session"; // legacy encryptJson arg; not a security boundary (local plaintext phase)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function notifySessionListUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
}

function isLikelyStoredProfileId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

function deepCloneSession(state: POJUSessionState): POJUSessionState {
  return JSON.parse(JSON.stringify(state)) as POJUSessionState;
}

/**
 * Apply restore authority: persisted DC wins; agent_v2 buffers never overwrite DC.
 * Also hydrates durable idempotency keys into the process registry.
 */
export function applyDecisionContextRestore(state: POJUSessionState): POJUSessionState {
  const restored = restoreDecisionContextAuthority({
    persisted_dc: state.decision_context,
    persisted_versions: state.decision_context_versions,
    persisted_idempotency_keys: state.decision_context_idempotency_keys,
    agent_v2_buffers: state.agent_v2
      ? {
          core_dilemma: state.agent_v2.core_dilemma,
          desired_direction: state.agent_v2.desired_direction,
          breakthrough_core: state.agent_v2.breakthrough_core,
          context_collected: state.context_collected,
        }
      : state.context_collected
        ? { context_collected: state.context_collected }
        : undefined,
  });

  return {
    ...state,
    decision_context: restored.decision_context,
    decision_context_versions: restored.decision_context_versions,
    decision_context_idempotency_keys: restored.decision_context_idempotency_keys,
  };
}

/** Merge DC persist slice + optional agent_v2 control patch into a full session. */
export function mergeDcPersistSliceIntoSession(
  base: POJUSessionState,
  slice: {
    decision_context?: DecisionContext | null;
    decision_context_versions?: DecisionContext[];
    decision_context_idempotency_keys?: string[];
    control_plane?: ControlPlaneSlice;
  },
): POJUSessionState {
  const next = deepCloneSession(base);
  next.decision_context = slice.decision_context;
  if (slice.decision_context_versions !== undefined) {
    next.decision_context_versions = slice.decision_context_versions;
  }
  if (slice.decision_context_idempotency_keys !== undefined) {
    next.decision_context_idempotency_keys = slice.decision_context_idempotency_keys;
  }

  const plane = slice.control_plane;
  if (plane && Object.keys(plane).length > 0) {
    const prev = next.agent_v2;
    const patch: Partial<POJUAgentState> = {};
    if (typeof plane.current_phase === "string") {
      (patch as { current_phase?: POJUAgentState["current_phase"] }).current_phase =
        plane.current_phase as POJUAgentState["current_phase"];
    }
    // Control-plane only — never copy dilemma/direction/breakthrough_core from plane into authority.
    if (prev) {
      next.agent_v2 = { ...prev, ...patch };
    } else if (Object.keys(patch).length > 0) {
      // Avoid inventing a full agent_v2; only attach phase marker when already present elsewhere.
      next.agent_v2 = patch as POJUAgentState;
    }
  }

  return next;
}

export async function createPOJUSession(input: {
  payment_id: string;
  original_question: string;
  /** When set, Step 8 can load Step 7 `base_analysis` from this `stored_profiles` row. */
  selected_stored_profile_id?: string | null;
  /** Joint decision: use server-issued pivot session id so pass_ref stays aligned. */
  session_id?: string | null;
}): Promise<string> {
  const db = getPojuDb();
  const deviceId = getPojuDeviceId();
  const ownerKey = await resolveLocalOwnerKey();
  const now = new Date();
  const override =
    typeof input.session_id === "string" && input.session_id.trim().length >= 8
      ? input.session_id.trim()
      : null;
  const sessionId = override ?? safeRandomUUID();
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
    dyad_offer_status: "none",
    partner_profile_id: null,
    partner_bazi: undefined,
    dyad_compat_summary: null,
    pivot_chart_path: null,
    charts_locked_at: null,
    dyad_matrix_pack: null,
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
    owner_key: ownerKey,
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
    notifySessionListUpdated();
  }

  return sessionId;
}

export async function loadPOJUSession(sessionId: string): Promise<POJUSessionState | null> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) return null;
  try {
    const raw = await decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row.iv,
      cipher: row.encrypted_data,
    });
    const withCycles = ensureSessionCycles(raw);
    // Phase 2 C1 restore: DC is authority; hydrate durable idempotency keys.
    return applyDecisionContextRestore(withCycles);
  } catch {
    return null;
  }
}

/**
 * C1 core persist: encrypted session blob + cycle index only.
 * Archive / profile sync are intentionally NOT here (post-commit side effects).
 */
export async function savePOJUSessionCore(state: POJUSessionState): Promise<void> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const payload = await encryptJson(SESSION_SECRET, state);
  const lastInteraction = new Date(state.last_interaction_at);
  const expiresAt = new Date(state.expires_at);
  const turnCount = countUserTurns(state);
  const hint = getCurrentStateHint(state);

  const run = async () => {
    await db.pojuSessionRecords.update(state.session_id, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      original_question: state.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: state.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: state.main_delivery_done,
      main_delivery_at: state.main_delivery_done ? new Date() : undefined,
      active_cycle_id: state.active_cycle_id,
    });
    await syncSessionCyclesToDbWithDb(db, state, ownerKey);
  };

  // Prefer one Dexie transaction for blob + cycle index (C1 core boundary).
  if (typeof window !== "undefined" && typeof db.transaction === "function") {
    await db.transaction("rw", [...POJU_SESSION_CORE_TABLES], run);
  } else {
    await run();
  }
}

/**
 * Post-commit side effects. Failures must NOT roll back an already-committed
 * core session blob (C1 / v1.3 Archive·Profile rule).
 */
export async function runPOJUSessionPostCommitSideEffects(state: POJUSessionState): Promise<void> {
  try {
    await syncPojuSessionVaultArchive(state);
  } catch (e) {
    console.error("[poju] Archive vault sync failed:", e);
    notifySessionListUpdated();
  }

  try {
    await syncPojuSessionReportsToStoredProfiles(state);
  } catch (e) {
    console.error("[poju] base analysis profile sync failed:", e);
  }
}

/**
 * Full save = core commit then post-commit side effects.
 * Side-effect failures do not throw (core already committed).
 */
export async function savePOJUSession(state: POJUSessionState): Promise<void> {
  await savePOJUSessionCore(state);
  await runPOJUSessionPostCommitSideEffects(state);
}

export interface CommitDecisionContextChangeInput {
  session: POJUSessionState;
  idempotency_key: string;
  /** Mutate DC (+ optional versions) on the working transaction. */
  apply: (tx: PersistTransaction) => void;
  /** Extra control-plane fields merged after `apply` (phase etc.). */
  control_plane_patch?: ControlPlaneSlice;
  require_control_plane?: boolean;
  now?: string;
  /**
   * Injected core writer for tests. Defaults to savePOJUSessionCore.
   * Must persist the full session (including DC fields + durable keys).
   */
  writeCore?: (state: POJUSessionState) => Promise<void>;
  /**
   * Injected post-commit side effects. Defaults to runPOJUSessionPostCommitSideEffects.
   * Failures here must not mark the DC op as rolled back.
   */
  afterCommit?: (state: POJUSessionState) => Promise<void>;
}

export interface CommitDecisionContextChangeResult {
  session: POJUSessionState;
  committed: boolean;
  rolled_back: boolean;
  idempotent_skip: boolean;
  error?: string;
  /** Underlying DC slice commit result (when a tx was opened). */
  slice?: CommitPersistResult;
}

/**
 * Phase 2 C1 entry: snapshot → DC/control working copy → core blob+cycle persist
 * → adopt memory only on success → post-commit side effects (non-rolling-back).
 *
 * Does NOT wire Opening / Gate / CallA / CallB / Collecting product paths.
 */
export async function commitDecisionContextChange(
  input: CommitDecisionContextChangeInput,
): Promise<CommitDecisionContextChangeResult> {
  const memorySnapshot = deepCloneSession(input.session);
  hydratePersistIdempotencyFromKeys(input.session.decision_context_idempotency_keys);

  const slice = extractDcSessionSlice(input.session);
  const tx = beginPersistTransaction(slice, {
    idempotency_key: input.idempotency_key,
    now: input.now,
  });

  if (!tx) {
    return {
      session: memorySnapshot,
      committed: false,
      rolled_back: false,
      idempotent_skip: true,
      error: "idempotent_skip",
    };
  }

  try {
    input.apply(tx);
    if (input.control_plane_patch) {
      applyControlPlaneToWorking(tx, input.control_plane_patch);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      session: memorySnapshot,
      committed: false,
      rolled_back: true,
      idempotent_skip: false,
      error: message,
    };
  }

  let workingFull: POJUSessionState = memorySnapshot;

  const writeCore = input.writeCore ?? savePOJUSessionCore;
  const sliceResult = await commitPersistTransaction(
    tx,
    async (committedSlice) => {
      workingFull = mergeDcPersistSliceIntoSession(memorySnapshot, committedSlice);
      workingFull.last_interaction_at = input.now ?? new Date().toISOString();
      await writeCore(workingFull);
    },
    { require_control_plane: input.require_control_plane },
  );

  if (!sliceResult.committed) {
    return {
      session: memorySnapshot,
      committed: false,
      rolled_back: sliceResult.rolled_back,
      idempotent_skip: sliceResult.error === "idempotent_skip",
      error: sliceResult.error,
      slice: sliceResult,
    };
  }

  // Core succeeded — run post-commit side effects without rolling back memory.
  const afterCommit = input.afterCommit ?? runPOJUSessionPostCommitSideEffects;
  try {
    await afterCommit(workingFull);
  } catch (e) {
    console.error("[poju] DC post-commit side effects failed (core kept):", e);
  }

  return {
    session: workingFull,
    committed: true,
    rolled_back: false,
    idempotent_skip: false,
    slice: sliceResult,
  };
}

/**
 * Helper for UI: core persist first, then confirm memory, then side effects.
 * Use for non-DC session updates that must not leave half-applied UI on IDB failure.
 */
export async function confirmSessionAfterCorePersist(
  state: POJUSessionState,
  adopt: (next: POJUSessionState) => void,
  opts?: {
    writeCore?: (s: POJUSessionState) => Promise<void>;
    afterCommit?: (s: POJUSessionState) => Promise<void>;
  },
): Promise<void> {
  const writeCore = opts?.writeCore ?? savePOJUSessionCore;
  await writeCore(state);
  adopt(state);
  const afterCommit = opts?.afterCommit ?? runPOJUSessionPostCommitSideEffects;
  void afterCommit(state).catch((e) => {
    console.error("[poju] post-commit side effects failed (core kept):", e);
  });
}

export async function getActivePOJUSessionsByDevice(deviceId: string) {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  return db.pojuSessionRecords
    .where("owner_key")
    .equals(ownerKey)
    .and((s) => s.status === "active" && s.device_id === deviceId)
    .toArray();
}

function getCurrentStateHint(state: POJUSessionState): PojuV4StateHint {
  if (state.main_delivery_done) return "tracking";
  const phase = state.agent_v2?.current_phase;
  if (phase === "awaiting_confirmation") return "analyzing";
  if (phase === "awaiting_understanding_confirm") return "opening";
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
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  const state = await loadPOJUSession(sessionId);
  if (!row || !state || row.status !== "active") return null;
  if (!isRowOwnedBy(row, ownerKey)) return null;
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
  const ownerKey = await resolveLocalOwnerKey();
  return db.pojuSessionRecords
    .where("owner_key")
    .equals(ownerKey)
    .and((s) => s.device_id === deviceId)
    .toArray();
}

export async function getPOJUSessionRecord(sessionId: string) {
  if (typeof window === "undefined") return undefined;
  const ownerKey = await resolveLocalOwnerKey();
  const row = await getPojuDb().pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) return undefined;
  return row;
}

/** Remove unused session row from this device (e.g. after refund). */
export async function deletePOJUSession(sessionId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row) return;
  if (!isRowOwnedBy(row, ownerKey)) return;
  if (getPojuDeviceId() !== row.device_id) return;
  await db.pojuSessionRecords.delete(sessionId);
}

// Re-export apply helpers so Call sites can use one module for DC session commits.
export { applyDcToWorking, applyControlPlaneToWorking };
