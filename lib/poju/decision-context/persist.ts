/**
 * C1 local snapshot / working-copy / commit / rollback + idempotency.
 * Phase 1: in-memory API only — does NOT wire session-manager / Gate / Opening.
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
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[];
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
  /** Completed keys in this process (idempotent no-op on retry). */
  readonly completed_keys: Set<string>;
}

const globalCompletedKeys = new Set<string>();

function cloneSlice(session: DcSessionSlice): DcSessionSlice {
  return {
    decision_context: session.decision_context
      ? (JSON.parse(JSON.stringify(session.decision_context)) as DecisionContext)
      : session.decision_context === null
        ? null
        : undefined,
    decision_context_versions: session.decision_context_versions
      ? (JSON.parse(JSON.stringify(session.decision_context_versions)) as DecisionContext[])
      : undefined,
    control_plane: session.control_plane
      ? (JSON.parse(JSON.stringify(session.control_plane)) as ControlPlaneSlice)
      : undefined,
  };
}

/** Step 1 — snapshot memory before mutation. */
export function snapshotSession(session: DcSessionSlice, now?: string): PersistSnapshot {
  return {
    session: cloneSlice(session),
    taken_at: now ?? new Date().toISOString(),
  };
}

/**
 * Begin a C1 transaction. If idempotency_key already completed, returns null
 * (caller should no-op — do not duplicate Fact/Hypothesis/DIR/advance).
 */
export function beginPersistTransaction(
  current: DcSessionSlice,
  opts: BeginPersistOptions,
): PersistTransaction | null {
  if (globalCompletedKeys.has(opts.idempotency_key)) {
    return null;
  }
  const snapshot = snapshotSession(current, opts.now);
  return {
    idempotency_key: opts.idempotency_key,
    snapshot,
    working: cloneSlice(current),
    completed_keys: globalCompletedKeys,
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
 */
export async function commitPersistTransaction(
  tx: PersistTransaction,
  writeBlob: PersistBlobWriter,
  opts?: {
    /** When false, skip control-plane presence check (DC-only ops). */
    require_control_plane?: boolean;
  },
): Promise<CommitPersistResult> {
  if (globalCompletedKeys.has(tx.idempotency_key)) {
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
      // Control plane may be empty object but should be defined if required.
      if (tx.working.control_plane === undefined) {
        throw new PersistError("Control plane sync missing on working copy");
      }
    }

    await writeBlob(cloneSlice(tx.working));
    globalCompletedKeys.add(tx.idempotency_key);
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
  persisted_dc?: DecisionContext | null;
  persisted_versions?: DecisionContext[];
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
  ignored_buffers: boolean;
} {
  return {
    decision_context: input.persisted_dc,
    decision_context_versions: input.persisted_versions,
    ignored_buffers: Boolean(input.agent_v2_buffers),
  };
}

/** Test helper — clear idempotency registry. */
export function __resetPersistIdempotencyForTests(): void {
  globalCompletedKeys.clear();
}
