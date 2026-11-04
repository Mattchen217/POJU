const fs = require("fs");
const path = require("path");

const root = "D:\\POJU\\pojulife";

const persistPath = path.join(root, "lib\\poju\\decision-context\\persist.ts");
let persist = fs.readFileSync(persistPath, "utf8");

// Replace global Set with session-scoped Map and update related helpers/API.
const oldBlock = `const globalCompletedKeys = new Set<string>();

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
    decision_context_idempotency_keys: session.decision_context_idempotency_keys
      ? [...session.decision_context_idempotency_keys]
      : undefined,
    control_plane: session.control_plane
      ? (JSON.parse(JSON.stringify(session.control_plane)) as ControlPlaneSlice)
      : undefined,
  };
}

function hasCompletedKey(session: DcSessionSlice, key: string): boolean {
  if (globalCompletedKeys.has(key)) return true;
  return (session.decision_context_idempotency_keys ?? []).includes(key);
}`;

const newBlock = `/**
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
}`;

if (!persist.includes("const globalCompletedKeys = new Set<string>();")) {
  throw new Error("persist.ts: expected globalCompletedKeys block not found");
}
persist = persist.replace(oldBlock, newBlock);

// Add session_id to DcSessionSlice interface
persist = persist.replace(
  `export interface DcSessionSlice {
  decision_context?: DecisionContext | null;`,
  `export interface DcSessionSlice {
  /** Scopes process-local idempotency; must be set for cross-session isolation. */
  session_id?: string;
  decision_context?: DecisionContext | null;`
);

// Update PersistTransaction comment + beginPersistTransaction completed_keys
persist = persist.replace(
  `  /** Process-local completed keys (also mirrored into durable slice on commit). */
  readonly completed_keys: Set<string>;
}`,
  `  /** Session-scoped process-local completed keys (also mirrored into durable slice on commit). */
  readonly completed_keys: Set<string>;
}`
);

persist = persist.replace(
  `/**
 * Begin a C1 transaction. If idempotency_key already completed (process-local
 * OR durable on the session slice), returns null — caller must no-op.
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
    completed_keys: globalCompletedKeys,
  };
}`,
  `/**
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
}`
);

persist = persist.replace(
  `  if (hasCompletedKey(tx.snapshot.session, tx.idempotency_key) || globalCompletedKeys.has(tx.idempotency_key)) {
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: false,
      error: "idempotent_skip",
    };
  }`,
  `  if (hasCompletedKey(tx.snapshot.session, tx.idempotency_key)) {
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: false,
      error: "idempotent_skip",
    };
  }`
);

persist = persist.replace(
  `    stampDurableKey(tx.working, tx.idempotency_key);
    await writeBlob(cloneSlice(tx.working));
    globalCompletedKeys.add(tx.idempotency_key);`,
  `    stampDurableKey(tx.working, tx.idempotency_key);
    await writeBlob(cloneSlice(tx.working));
    getSessionCompletedKeys(tx.working.session_id ?? tx.snapshot.session.session_id).add(
      tx.idempotency_key,
    );`
);

persist = persist.replace(
  `export function restoreDecisionContextAuthority(input: {
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
    hydratePersistIdempotencyFromKeys(input.persisted_idempotency_keys);
  }`,
  `export function restoreDecisionContextAuthority(input: {
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
  }`
);

persist = persist.replace(
  `/** Rehydrate process-local idempotency registry from a durable session field. */
export function hydratePersistIdempotencyFromKeys(keys: string[] | undefined | null): void {
  for (const key of keys ?? []) {
    if (typeof key === "string" && key.trim()) {
      globalCompletedKeys.add(key);
    }
  }
}

/** Test helper — clear process-local idempotency registry. */
export function __resetPersistIdempotencyForTests(): void {
  globalCompletedKeys.clear();
}

/** Extract DC persist slice from a session-shaped object (no agent buffer authority). */
export function extractDcSessionSlice(session: {
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
    decision_context: session.decision_context,
    decision_context_versions: session.decision_context_versions,
    decision_context_idempotency_keys: session.decision_context_idempotency_keys,
    control_plane,
  });
}`,
  `/**
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
}`
);

if (persist.includes("globalCompletedKeys")) {
  throw new Error("persist.ts still references globalCompletedKeys after patch");
}
fs.writeFileSync(persistPath, persist);
console.log("patched persist.ts");

// session-manager.ts updates
const smPath = path.join(root, "lib\\poju\\session-manager.ts");
let sm = fs.readFileSync(smPath, "utf8");
const smOldHydrate = `  hydratePersistIdempotencyFromKeys(input.session.decision_context_idempotency_keys);`;
const smNewHydrate = `  hydratePersistIdempotencyFromKeys(
    input.session.session_id,
    input.session.decision_context_idempotency_keys,
  );`;
if (!sm.includes(smOldHydrate)) throw new Error("session-manager hydrate call not found");
sm = sm.replace(smOldHydrate, smNewHydrate);

const smOldRestore = `  const restored = restoreDecisionContextAuthority({
    persisted_dc: state.decision_context,
    persisted_versions: state.decision_context_versions,
    persisted_idempotency_keys: state.decision_context_idempotency_keys,`;
const smNewRestore = `  const restored = restoreDecisionContextAuthority({
    session_id: state.session_id,
    persisted_dc: state.decision_context,
    persisted_versions: state.decision_context_versions,
    persisted_idempotency_keys: state.decision_context_idempotency_keys,`;
if (!sm.includes(smOldRestore)) throw new Error("session-manager restore call not found");
sm = sm.replace(smOldRestore, smNewRestore);
fs.writeFileSync(smPath, sm);
console.log("patched session-manager.ts");
