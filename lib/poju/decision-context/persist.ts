/**
 * C1 local snapshot / working-copy / commit / rollback + idempotency.
 * Phase 2: durable idempotency keys live on the session slice (survive reload);
 * blob writer is provided by session-manager (savePOJUSessionCore).
 * Restore trusts persisted DC as source of truth (ignores agent_v2 buffers).
 */

import type { DecisionContext } from "./types";

export class PersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistError";
  }
}

/** Control-plane subset that may change with a DC write (agent_v2 process state). */
export type ControlPlaneSlice = Record<string, unknown>;

export interface DcSessionSlice {
  /** Scopes process-local idempotency; must be set for cross-session isolation. */
  session_id?: string;
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[];
  /**
   * Completed DC persist op ids — durable in the encrypted session blob.
   * Required so reload / new JS heap still honors idempotency.
   */
  decision_context_idempotency_keys?: string[];
  /** Opaque control-plane fields (phase, agenda status, focus, stall, turn, …). */
  control_plane?: ControlPlaneSlice;
}

export interface PersistSnapshot {
  session: DcSessionSlice;
  taken_at: string;
}

export type PersistBlobWriter = (session: DcSessionSlice) => Promise<void> | void;

export interface BeginPersistOptions {
  idempotency_key: string;
  now?: string;
}

export interface PersistTransaction {
  readonly idempotency_key: string;
  readonly snapshot: PersistSnapshot;
  working: DcSessionSlice;
  /** Session-scoped process-local completed keys (also mirrored into durable slice on commit). */
  readonly completed_keys: Set<string>;
}

/**
 * Process-local completed keys scoped by session_id.
 * Never share keys across sessions — isolation is non-negotiable.
 * Missing session_id collapses to "__anon__" (unit-test / legacy only).
 */
const completedKeysBySession = new Map<string, Set<string>>();

function scopeSessionId(sessionId: string | undefined | null): string {
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "__anon__";
}

function getSessionCompletedKeys(sessionId: string | undefined | null): Set<string> {
  const id = scopeSessionId(sessionId);
  let set = completedKeysBySession.get(id);
  if (!set) {
    set = new Set<string>();
    completedKeysBySession.set(id, set);
  }
  return set;
}

function cloneSlice(session: DcSessionSlice): DcSessionSlice {
  return {
    session_id: session.session_id,
    decision_context: session.decision_context
      ? (JSON.parse(JSON.stringify(session.decision_context)) as DecisionContext)
      : session.decision_context === null
        ? null
        : undefined,
    decision_context_versions: session.decision_context_versions
      ? (JSON.parse(JSON.stringify(session.decision_context_versions)) as DecisionContext[])
      : undefined,
    decision_context_idempotency_keys: session.decision_context_idempotency_keys
      ? [...session.decision_context_idempotency_keys]
      : undefined,
    control_plane: session.control_plane
      ? (JSON.parse(JSON.stringify(session.control_plane)) as ControlPlaneSlice)
      : undefined,
  };
}

function hasCompletedKey(session: DcSessionSlice, key: string): boolean {
  if (getSessionCompletedKeys(session.session_id).has(key)) return true;
  return (session.decision_context_idempotency_keys ?? []).includes(key);
}

function stampDurableKey(session: DcSessionSlice, key: string): void {
  const next = new Set(session.decision_context_idempotency_keys ?? []);
  next.add(key);
  session.decision_context_idempotency_keys = Array.from(next);
}

/** Step 1 — snapshot memory before mutation. */
export function snapshotSession(session: DcSessionSlice, now?: string): PersistSnapshot {
  return {
    session: cloneSlice(session),
    taken_at: now ?? new Date().toISOString(),
  };
}

/**
 * Begin a C1 transaction. If idempotency_key already completed (session-scoped
 * process-local OR durable on the session slice), returns null — caller must no-op.
 */
export function beginPersistTransaction(
  current: DcSessionSlice,
  opts: BeginPersistOptions,
): PersistTransaction | null {
  if (hasCompletedKey(current, opts.idempotency_key)) {
    return null;
  }
  const snapshot = snapshotSession(current, opts.now);
  return {
    idempotency_key: opts.idempotency_key,
    snapshot,
    working: cloneSlice(current),
    completed_keys: getSessionCompletedKeys(current.session_id),
  };
}

/** Apply DC mutation on working copy only. */
export function applyDcToWorking(
  tx: PersistTransaction,
  dc: DecisionContext,
  versions?: DecisionContext[],
): void {
  tx.working.decision_context = dc;
  if (versions) {
    tx.working.decision_context_versions = versions;
  }
}

/** Apply control-plane sync on working copy (never formal Fact authority). */
export function applyControlPlaneToWorking(
  tx: PersistTransaction,
  patch: ControlPlaneSlice,
): void {
  tx.working.control_plane = {
    ...(tx.working.control_plane ?? {}),
    ...patch,
  };
}

export interface CommitPersistResult {
  session: DcSessionSlice;
  committed: boolean;
  rolled_back: boolean;
  error?: string;
}

/**
 * Steps 2–5: require DC + control plane working state, then blob write.
 * On any failure → restore memory from snapshot; do not mark success.
 * Successful commit stamps the idempotency key into the durable key list
 * before the blob write so a reload can recover it.
 */
export async function commitPersistTransaction(
  tx: PersistTransaction,
  writeBlob: PersistBlobWriter,
  opts?: {
    /** When false, skip control-plane presence check (DC-only ops). */
    require_control_plane?: boolean;
  },
): Promise<CommitPersistResult> {
  if (hasCompletedKey(tx.snapshot.session, tx.idempotency_key)) {
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: false,
      error: "idempotent_skip",
    };
  }

  try {
    if (tx.working.decision_context === undefined) {
      throw new PersistError("DC working copy missing decision_context");
    }
    if (opts?.require_control_plane !== false) {
      if (tx.working.control_plane === undefined) {
        throw new PersistError("Control plane sync missing on working copy");
      }
    }

    stampDurableKey(tx.working, tx.idempotency_key);
    await writeBlob(cloneSlice(tx.working));
    getSessionCompletedKeys(tx.working.session_id ?? tx.snapshot.session.session_id).add(
      tx.idempotency_key,
    );
    return {
      session: cloneSlice(tx.working),
      committed: true,
      rolled_back: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: true,
      error: message,
    };
  }
}

/** Explicit rollback helper (memory ← snapshot). */
export function rollbackToSnapshot(snapshot: PersistSnapshot): DcSessionSlice {
  return cloneSlice(snapshot.session);
}

/**
 * Restore authority: persisted DC wins; agent_v2 buffers must not overwrite DC.
 */
export function restoreDecisionContextAuthority(input: {
  /** Required for correct session-scoped hydrate; omit only in anon unit tests. */
  session_id?: string;
  persisted_dc?: DecisionContext | null;
  persisted_versions?: DecisionContext[];
  persisted_idempotency_keys?: string[];
  /** Ignored for formal authority — buffers only. */
  agent_v2_buffers?: {
    core_dilemma?: unknown;
    desired_direction?: unknown;
    breakthrough_core?: unknown;
    context_collected?: unknown;
  };
}): {
  decision_context: DecisionContext | null | undefined;
  decision_context_versions: DecisionContext[] | undefined;
  decision_context_idempotency_keys: string[] | undefined;
  ignored_buffers: boolean;
} {
  if (input.persisted_idempotency_keys?.length) {
    hydratePersistIdempotencyFromKeys(input.session_id, input.persisted_idempotency_keys);
  }
  return {
    decision_context: input.persisted_dc,
    decision_context_versions: input.persisted_versions,
    decision_context_idempotency_keys: input.persisted_idempotency_keys
      ? [...input.persisted_idempotency_keys]
      : undefined,
    ignored_buffers: Boolean(input.agent_v2_buffers),
  };
}

/**
 * Rehydrate session-scoped process-local idempotency registry from durable keys.
 * Only the given session_id's bucket is updated — never a process-global dump.
 */
export function hydratePersistIdempotencyFromKeys(
  sessionId: string | undefined | null,
  keys: string[] | undefined | null,
): void {
  const set = getSessionCompletedKeys(sessionId);
  for (const key of keys ?? []) {
    if (typeof key === "string" && key.trim()) {
      set.add(key);
    }
  }
}

/** Test helper — clear all session-scoped process-local idempotency registries. */
export function __resetPersistIdempotencyForTests(): void {
  completedKeysBySession.clear();
}

/** Extract DC persist slice from a session-shaped object (no agent buffer authority). */
export function extractDcSessionSlice(session: {
  session_id?: string;
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[];
  decision_context_idempotency_keys?: string[];
  agent_v2?: { current_phase?: string } | null;
  /** Optional explicit control plane already prepared by caller. */
  control_plane?: ControlPlaneSlice;
}): DcSessionSlice {
  const control_plane =
    session.control_plane ??
    (session.agent_v2
      ? ({ current_phase: session.agent_v2.current_phase } as ControlPlaneSlice)
      : undefined);
  return cloneSlice({
    session_id: session.session_id,
    decision_context: session.decision_context,
    decision_context_versions: session.decision_context_versions,
    decision_context_idempotency_keys: session.decision_context_idempotency_keys,
    control_plane,
  });
}
