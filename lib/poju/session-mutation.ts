/**
 * Phase 3 S1 — Session CAS Foundation.
 *
 * Authority: PHASE3-FINAL-ENG-CONTRACT §3 + §7 (highest).
 * Mapping §3 is a pointer; Contract wording wins on conflict.
 *
 * All production writes to `pojuSessionRecords.encrypted_data` must go through
 * `casWritePOJUSession` / `mutatePOJUSession` (or create-if-absent init).
 * Web Crypto encrypt stays OUTSIDE the Dexie transaction (Contract §7.5).
 */

import { encryptJson, decryptJson } from "@/lib/crypto";
import { getPojuDb, type POJUSessionRecord } from "@/lib/db/poju-db";
import {
  POJU_SESSION_CORE_TABLES,
  syncSessionCyclesToDbWithDb,
} from "@/lib/poju/cycle-db-sync";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { isRowOwnedBy, resolveLocalOwnerKey } from "@/lib/storage/local-owner";
import type { POJUMessage, POJUSessionState, PojuV4StateHint } from "@/lib/poju/types";

const SESSION_SECRET = "pojulife_v4_poju_session"; // legacy encryptJson arg; not a security boundary

/** Contract §3.4 / §7 — row/blob revision mirror hard-fail. */
export const REVISION_MIRROR_MISMATCH = "REVISION_MIRROR_MISMATCH";
/** Session CAS expected revision did not match latest row. */
export const SESSION_CAS_CONFLICT = "SESSION_CAS_CONFLICT";
/** Create-if-absent refused because a row already exists. */
export const SESSION_CREATE_EXISTS = "SESSION_CREATE_EXISTS";
/** Same client_id, different message content (Contract §7.7). */
export const MESSAGE_CLIENT_ID_CONFLICT = "MESSAGE_CLIENT_ID_CONFLICT";
/** Generation DC base stale — reserved for S2; exported for typing only. */
export const GENERATION_BASE_STALE = "GENERATION_BASE_STALE";

export type SessionMutationKind =
  | "message_append"
  | "session_patch"
  | "control_plane_patch"
  | "dc_generation";

/**
 * Contract §7.7 — stable operation identity + pure replayable apply.
 * `apply` must not call model/network/payment or other external side effects.
 */
export interface SessionMutation {
  operation_id: string;
  kind: SessionMutationKind;
  apply: (latest: POJUSessionState) => POJUSessionState;
  /**
   * DC revision policy for this mutation:
   * - `auto` (default): bump dc_write_revision only when formal DC content changes
   * - `true`: force bump (caller asserts DC content change)
   * - `false`: never bump (Path C / non-DC)
   */
  bump_dc?: boolean | "auto";
  /**
   * Phase 3 S2 — Path A / pending_create DC base gate (Contract §6.3 step 8 / §7.3).
   * Passed through to casWritePOJUSession; mismatch → GENERATION_BASE_STALE.
   */
  generation_base_revision?: number;
}

export class SessionCasError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "SessionCasError";
    this.code = code;
  }
}

export function isSessionCasError(err: unknown): err is SessionCasError {
  return err instanceof SessionCasError;
}

function isNonNegativeSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

type RevisionPair = { session_revision: number; dc_write_revision: number };

/**
 * Resolve logical revisions from row + decrypted blob.
 * - Both absent → treat as 0 (no silent write; Contract §3.4 migration view)
 * - One-sided / mismatch / illegal type → REVISION_MIRROR_MISMATCH
 */
export function resolveRevisionMirror(
  row: Pick<POJUSessionRecord, "session_revision" | "dc_write_revision"> | null | undefined,
  blob: Pick<POJUSessionState, "session_revision" | "dc_write_revision"> | null | undefined,
): RevisionPair {
  const rowS = row?.session_revision;
  const rowD = row?.dc_write_revision;
  const blobS = blob?.session_revision;
  const blobD = blob?.dc_write_revision;

  const rowHasS = rowS !== undefined && rowS !== null;
  const rowHasD = rowD !== undefined && rowD !== null;
  const blobHasS = blobS !== undefined && blobS !== null;
  const blobHasD = blobD !== undefined && blobD !== null;

  // Illegal types when present
  if (rowHasS && !isNonNegativeSafeInt(rowS)) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "row.session_revision illegal");
  }
  if (rowHasD && !isNonNegativeSafeInt(rowD)) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "row.dc_write_revision illegal");
  }
  if (blobHasS && !isNonNegativeSafeInt(blobS)) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "blob.session_revision illegal");
  }
  if (blobHasD && !isNonNegativeSafeInt(blobD)) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "blob.dc_write_revision illegal");
  }

  const anyS = rowHasS || blobHasS;
  const anyD = rowHasD || blobHasD;

  // One-sided presence is FAIL (Contract §3.4)
  if (rowHasS !== blobHasS) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "session_revision one-sided");
  }
  if (rowHasD !== blobHasD) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "dc_write_revision one-sided");
  }

  if (!anyS && !anyD) {
    return { session_revision: 0, dc_write_revision: 0 };
  }

  // If only one pair family is present, still require mirrors for that family;
  // missing family defaults to 0 only when BOTH sides lack it (already checked).
  const session_revision = anyS ? (rowS as number) : 0;
  const dc_write_revision = anyD ? (rowD as number) : 0;

  if (anyS && rowS !== blobS) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "session_revision row/blob mismatch");
  }
  if (anyD && rowD !== blobD) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "dc_write_revision row/blob mismatch");
  }

  return { session_revision, dc_write_revision };
}

/** Stable JSON compare for formal DC content (versions array included). */
export function didDecisionContextChange(
  prev: POJUSessionState,
  next: POJUSessionState,
): boolean {
  const a = {
    decision_context: prev.decision_context ?? null,
    decision_context_versions: prev.decision_context_versions ?? [],
  };
  const b = {
    decision_context: next.decision_context ?? null,
    decision_context_versions: next.decision_context_versions ?? [],
  };
  return JSON.stringify(a) !== JSON.stringify(b);
}

function messageContentKey(msg: POJUMessage): string {
  return JSON.stringify({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    is_rejected: msg.is_rejected ?? false,
    rejection_type: msg.rejection_type ?? null,
  });
}

/**
 * Contract §7.7 message client_id dedupe against latest messages.
 * Returns next messages array, or throws MESSAGE_CLIENT_ID_CONFLICT.
 * Identical client_id + content → idempotent (unchanged array / treat applied).
 */
export function mergeMessageByClientId(
  messages: POJUMessage[],
  incoming: POJUMessage,
): { messages: POJUMessage[]; already_applied: boolean } {
  const clientId = typeof incoming.client_id === "string" ? incoming.client_id.trim() : "";
  if (!clientId) {
    return { messages: [...messages, incoming], already_applied: false };
  }
  const existing = messages.find((m) => m.client_id === clientId);
  if (!existing) {
    return { messages: [...messages, incoming], already_applied: false };
  }
  if (messageContentKey(existing) === messageContentKey(incoming)) {
    return { messages, already_applied: true };
  }
  throw new SessionCasError(
    MESSAGE_CLIENT_ID_CONFLICT,
    `client_id=${clientId} content mismatch`,
  );
}

/** Pure helper: append message with §7.7 dedupe rules. */
export function applyMessageAppend(
  latest: POJUSessionState,
  message: POJUMessage,
): POJUSessionState {
  const { messages, already_applied } = mergeMessageByClientId(latest.messages ?? [], message);
  if (already_applied) return latest;
  return {
    ...latest,
    messages,
    last_interaction_at: message.timestamp || latest.last_interaction_at,
  };
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

export interface CasWritePOJUSessionInput {
  /** Candidate session AFTER mutation; revisions will be overwritten by CAS. */
  candidate: POJUSessionState;
  /** Expected session_revision from the read that produced the mutation base. */
  expected_session_revision: number;
  /** When true, dc_write_revision becomes expected_dc + 1; else kept. */
  bump_dc_write_revision: boolean;
  /** Expected dc_write_revision at mutation base (for computing next). */
  expected_dc_write_revision: number;
  /**
   * S2 Path A optional extra check inside the Dexie tx.
   * When set, row.dc_write_revision must equal this or abort with GENERATION_BASE_STALE.
   * S1 callers leave undefined.
   */
  generation_base_revision?: number;
  owner_key?: string;
}

export interface CasWritePOJUSessionResult {
  state: POJUSessionState;
  session_revision: number;
  dc_write_revision: number;
}

/**
 * Unified CAS write (Contract §7.4–7.5).
 * Encrypts outside the Dexie transaction; aborts cleanly on any check failure.
 */
export async function casWritePOJUSession(
  input: CasWritePOJUSessionInput,
): Promise<CasWritePOJUSessionResult> {
  const sessionId = input.candidate.session_id;
  if (!sessionId || sessionId.trim().length < 8) {
    throw new SessionCasError("INVALID_SESSION_ID", "session_id missing or too short");
  }

  const nextSessionRevision = input.expected_session_revision + 1;
  const nextDcWriteRevision = input.bump_dc_write_revision
    ? input.expected_dc_write_revision + 1
    : input.expected_dc_write_revision;

  if (!isNonNegativeSafeInt(nextSessionRevision) || !isNonNegativeSafeInt(nextDcWriteRevision)) {
    throw new SessionCasError(REVISION_MIRROR_MISMATCH, "computed revision illegal");
  }

  const committedState: POJUSessionState = {
    ...input.candidate,
    session_revision: nextSessionRevision,
    dc_write_revision: nextDcWriteRevision,
  };

  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction
  const payload = await encryptJson(SESSION_SECRET, committedState);

  const db = getPojuDb();
  const ownerKey = input.owner_key ?? (await resolveLocalOwnerKey());
  const lastInteraction = new Date(committedState.last_interaction_at);
  const expiresAt = new Date(committedState.expires_at);
  const turnCount = countUserTurns(committedState);
  const hint = getCurrentStateHint(committedState);

  const run = async () => {
    // §7.5 steps 8–11
    const row = await db.pojuSessionRecords.get(sessionId);
    if (!row) {
      throw new SessionCasError(SESSION_CAS_CONFLICT, `session row missing: ${sessionId}`);
    }
    if (!isRowOwnedBy(row, ownerKey)) {
      throw new SessionCasError(SESSION_CAS_CONFLICT, "owner partition mismatch");
    }

    // Mirror check against row fields alone for CAS gate; blob mirror was
    // validated on the pre-tx read. Re-decrypt inside tx is avoided (crypto).
    const rowS = row.session_revision;
    const rowD = row.dc_write_revision;
    const logicalS =
      rowS === undefined || rowS === null
        ? 0
        : isNonNegativeSafeInt(rowS)
          ? rowS
          : null;
    const logicalD =
      rowD === undefined || rowD === null
        ? 0
        : isNonNegativeSafeInt(rowD)
          ? rowD
          : null;
    if (logicalS === null || logicalD === null) {
      throw new SessionCasError(REVISION_MIRROR_MISMATCH, "row revision illegal in tx");
    }

    // One-sided: row has one family but not the other (partial write residue)
    const rowHasS = rowS !== undefined && rowS !== null;
    const rowHasD = rowD !== undefined && rowD !== null;
    if (rowHasS !== rowHasD) {
      throw new SessionCasError(REVISION_MIRROR_MISMATCH, "row revision one-sided in tx");
    }

    if (logicalS !== input.expected_session_revision) {
      throw new SessionCasError(
        SESSION_CAS_CONFLICT,
        `expected session_revision=${input.expected_session_revision} got ${logicalS}`,
      );
    }

    if (
      input.generation_base_revision !== undefined &&
      logicalD !== input.generation_base_revision
    ) {
      throw new SessionCasError(
        GENERATION_BASE_STALE,
        `dc_write_revision=${logicalD} != generation_base_revision=${input.generation_base_revision}`,
      );
    }

    // §7.5 step 12 — atomic blob + mirrors + indexes
    const updated = await db.pojuSessionRecords.update(sessionId, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,
      original_question: committedState.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: committedState.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: committedState.main_delivery_done,
      main_delivery_at: committedState.main_delivery_done ? new Date() : undefined,
      active_cycle_id: committedState.active_cycle_id,
    });
    if (updated !== 1) {
      throw new SessionCasError(
        SESSION_CAS_CONFLICT,
        `pojuSessionRecords.update expected 1 row, got ${updated}`,
      );
    }
    await syncSessionCyclesToDbWithDb(db, committedState, ownerKey);
  };

  if (typeof window !== "undefined" && typeof db.transaction === "function") {
    try {
      await db.transaction("rw", [...POJU_SESSION_CORE_TABLES], run);
    } catch (err) {
      if (isSessionCasError(err)) throw err;
      // Dexie wraps; unwrap SessionCasError if nested
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(REVISION_MIRROR_MISMATCH)) {
        throw new SessionCasError(REVISION_MIRROR_MISMATCH, msg);
      }
      if (msg.includes(SESSION_CAS_CONFLICT) || msg.includes(GENERATION_BASE_STALE)) {
        throw new SessionCasError(
          msg.includes(GENERATION_BASE_STALE) ? GENERATION_BASE_STALE : SESSION_CAS_CONFLICT,
          msg,
        );
      }
      throw err;
    }
  } else {
    await run();
  }

  return {
    state: committedState,
    session_revision: nextSessionRevision,
    dc_write_revision: nextDcWriteRevision,
  };
}

export interface MutatePOJUSessionOptions {
  max_retries?: number;
  /** Injected for tests. */
  load?: (sessionId: string) => Promise<{
    row: POJUSessionRecord;
    state: POJUSessionState;
  } | null>;
  casWrite?: typeof casWritePOJUSession;
}

async function defaultLoad(
  sessionId: string,
): Promise<{ row: POJUSessionRecord; state: POJUSessionState } | null> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) return null;
  const state = await decryptJson<POJUSessionState>(SESSION_SECRET, {
    iv: row.iv,
    cipher: row.encrypted_data,
  });
  // Validate mirror on every mutate read — never silent-fix (Contract §3.4).
  resolveRevisionMirror(row, state);
  return { row, state };
}

/**
 * Contract §7.6–7.7 — apply pure mutation with CAS retry + stable operation_id.
 */
export async function mutatePOJUSession(
  sessionId: string,
  mutation: SessionMutation,
  opts: MutatePOJUSessionOptions = {},
): Promise<CasWritePOJUSessionResult> {
  if (!mutation.operation_id || !mutation.operation_id.trim()) {
    throw new SessionCasError("INVALID_OPERATION_ID", "operation_id required");
  }
  const maxRetries = opts.max_retries ?? 8;
  const load = opts.load ?? defaultLoad;
  const write = opts.casWrite ?? casWritePOJUSession;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    const loaded = await load(sessionId);
    if (!loaded) {
      throw new SessionCasError(SESSION_CAS_CONFLICT, `session not found: ${sessionId}`);
    }
    const mirror = resolveRevisionMirror(loaded.row, loaded.state);
    // Ensure blob in-memory carries logical revs for mutation purity.
    const base: POJUSessionState = {
      ...loaded.state,
      session_revision: mirror.session_revision,
      dc_write_revision: mirror.dc_write_revision,
    };

    const candidate = mutation.apply(base);
    if (candidate.session_id !== sessionId) {
      throw new SessionCasError("INVALID_SESSION_ID", "mutation changed session_id");
    }

    // Idempotent no-op: identical content → already applied (Contract §7.7).
    // Compare without revision mirrors so pure identity returns do not CAS-write.
    const stripRevs = (s: POJUSessionState) => {
      const { session_revision: _s, dc_write_revision: _d, ...rest } = s;
      return rest;
    };
    if (JSON.stringify(stripRevs(candidate)) === JSON.stringify(stripRevs(base))) {
      return {
        state: base,
        session_revision: mirror.session_revision,
        dc_write_revision: mirror.dc_write_revision,
      };
    }

    const bumpPolicy = mutation.bump_dc ?? "auto";
    const bumpDc =
      bumpPolicy === true
        ? true
        : bumpPolicy === false
          ? false
          : didDecisionContextChange(base, candidate);

    try {
      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
      });
    } catch (err) {
      if (isSessionCasError(err) && err.code === SESSION_CAS_CONFLICT && attempt <= maxRetries) {
        continue; // §7.6 re-read + replay same operation_id
      }
      throw err;
    }
  }
  throw new SessionCasError(SESSION_CAS_CONFLICT, "CAS retries exhausted");
}

export interface CreateSessionCasRowInput {
  session_id: string;
  device_id: string;
  owner_key: string;
  state: POJUSessionState;
  payment_id: string;
  payment_processor?: "dodopayments" | "stripe";
  status?: POJUSessionRecord["status"];
  current_state_hint?: POJUSessionRecord["current_state_hint"];
}

/**
 * W1 create-if-absent: init dual revision 0 on row AND blob in one create flow.
 * Never overwrites an existing row (Contract §7.4 create exception).
 */
export async function createPOJUSessionRecordIfAbsent(
  input: CreateSessionCasRowInput,
): Promise<{ created: boolean }> {
  const db = getPojuDb();
  const state: POJUSessionState = {
    ...input.state,
    session_id: input.session_id,
    session_revision: 0,
    dc_write_revision: 0,
  };
  const payload = await encryptJson(SESSION_SECRET, state);
  const now = new Date(state.created_at);
  const expiresAt = new Date(state.expires_at);

  const row: POJUSessionRecord = {
    session_id: input.session_id,
    device_id: input.device_id,
    owner_key: input.owner_key,
    encrypted_data: payload.cipher,
    iv: payload.iv,
    session_revision: 0,
    dc_write_revision: 0,
    status: input.status ?? "active",
    original_question: state.original_question,
    created_at: now,
    last_interaction_at: new Date(state.last_interaction_at),
    expires_at: expiresAt,
    payment_id: input.payment_id,
    payment_processor: input.payment_processor ?? "dodopayments",
    renewals: [],
    tokens_used: state.tokens_used,
    turn_count: countUserTurns(state),
    current_state_hint: input.current_state_hint ?? "opening",
    main_delivery_done: state.main_delivery_done,
    active_cycle_id: state.active_cycle_id,
  };

  const run = async (): Promise<boolean> => {
    const existing = await db.pojuSessionRecords.get(input.session_id);
    if (existing) return false;
    await db.pojuSessionRecords.add(row);
    return true;
  };

  let created: boolean;
  if (typeof window !== "undefined" && typeof db.transaction === "function") {
    created = await db.transaction("rw", db.pojuSessionRecords, run);
  } else {
    created = await run();
  }
  return { created };
}

/**
 * Bridge for legacy whole-state Core saves: CAS using current row revision.
 * Prefer `mutatePOJUSession` for concurrent-safe patches (Contract §7.7).
 *
 * Stale snapshot detection: if `candidate.session_revision` is set and does not
 * match the latest mirrored revision, fail with SESSION_CAS_CONFLICT (no silent overwrite).
 */
export async function casWritePOJUSessionFromCandidate(
  candidate: POJUSessionState,
  opts?: { bump_dc?: boolean | "auto" },
): Promise<CasWritePOJUSessionResult> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(candidate.session_id);
  if (!row || !isRowOwnedBy(row, ownerKey)) {
    throw new Error(
      `pojuSessionRecords.update expected 1 row, got 0 (session_id=${candidate.session_id})`,
    );
  }
  const blob = await decryptJson<POJUSessionState>(SESSION_SECRET, {
    iv: row.iv,
    cipher: row.encrypted_data,
  });
  const mirror = resolveRevisionMirror(row, blob);

  if (
    candidate.session_revision !== undefined &&
    candidate.session_revision !== null &&
    candidate.session_revision !== mirror.session_revision
  ) {
    throw new SessionCasError(
      SESSION_CAS_CONFLICT,
      `stale candidate session_revision=${candidate.session_revision} latest=${mirror.session_revision}`,
    );
  }

  const bumpPolicy = opts?.bump_dc ?? "auto";
  const baseForDc: POJUSessionState = {
    ...blob,
    session_revision: mirror.session_revision,
    dc_write_revision: mirror.dc_write_revision,
  };
  const bumpDc =
    bumpPolicy === true
      ? true
      : bumpPolicy === false
        ? false
        : didDecisionContextChange(baseForDc, candidate);

  const result = await casWritePOJUSession({
    candidate,
    expected_session_revision: mirror.session_revision,
    expected_dc_write_revision: mirror.dc_write_revision,
    bump_dc_write_revision: bumpDc,
    owner_key: ownerKey,
  });

  // Keep caller's object in sync with committed mirrors (legacy Core API is void).
  candidate.session_revision = result.session_revision;
  candidate.dc_write_revision = result.dc_write_revision;
  return result;
}
