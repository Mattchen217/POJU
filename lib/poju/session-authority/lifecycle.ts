/**
 * M9 — create, read, validate, and CAS-commit the server-authoritative Session record.
 * Client-submitted Session fields cannot create or restore this record.
 */

import { randomUUID } from "node:crypto";

import { canonicalHash } from "@/lib/poju/decision-authority/hash";
import { readLedgerHead } from "@/lib/poju/decision-authority/server/ledger-store";
import { createNewCycle } from "@/lib/poju/cycle-manager";
import {
  getLocalIntakeTerminalReason,
} from "@/lib/poju/intake-terminal";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import {
  SessionPersistenceUnavailableError,
  SessionRecordIntegrityError,
  getSessionAuthorityStore,
} from "@/lib/poju/session-authority/store";
import {
  SERVER_SESSION_RECORD_VERSION,
  type AuthoritativeSessionEnvelope,
  type ServerSessionAssociations,
  type ServerSessionRecord,
  type SessionAuthorityConflictBody,
  type SessionAuthorityErrorCode,
  type SessionLifecycleStatus,
} from "@/lib/poju/session-authority/types";

export const SERVER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class SessionAuthorityError extends Error {
  readonly code: SessionAuthorityErrorCode;
  readonly recoverable: boolean;
  readonly session_id?: string;
  readonly current_revision?: number;
  readonly expected_revision?: number;
  readonly lifecycle_status?: SessionLifecycleStatus;

  constructor(
    code: SessionAuthorityErrorCode,
    message: string,
    opts?: {
      recoverable?: boolean;
      session_id?: string;
      current_revision?: number;
      expected_revision?: number;
      lifecycle_status?: SessionLifecycleStatus;
    },
  ) {
    super(message);
    this.name = "SessionAuthorityError";
    this.code = code;
    this.recoverable = opts?.recoverable ?? isRecoverable(code);
    this.session_id = opts?.session_id;
    this.current_revision = opts?.current_revision;
    this.expected_revision = opts?.expected_revision;
    this.lifecycle_status = opts?.lifecycle_status;
  }

  toBody(): SessionAuthorityConflictBody {
    return {
      error: "session_authority",
      code: this.code,
      recoverable: this.recoverable,
      message: this.message,
      ...(this.session_id ? { session_id: this.session_id } : {}),
      ...(this.current_revision != null ? { current_revision: this.current_revision } : {}),
      ...(this.expected_revision != null ? { expected_revision: this.expected_revision } : {}),
      ...(this.lifecycle_status ? { lifecycle_status: this.lifecycle_status } : {}),
    };
  }
}

function isRecoverable(code: SessionAuthorityErrorCode): boolean {
  return (
    code === "session_revision_conflict" ||
    code === "session_cas_conflict" ||
    code === "ledger_snapshot_changed" ||
    code === "session_snapshot_changed" ||
    code === "ledger_probe_incomplete"
  );
}

export function hashSessionSnapshot(snapshot: POJUSessionState): string {
  return canonicalHash(snapshot);
}

export function associationsFromSnapshot(snapshot: POJUSessionState): ServerSessionAssociations {
  const ledger = snapshot.dc_ledger?.head ?? null;
  const receipts = snapshot.dc_freeze_receipts ?? [];
  const latest = receipts.length > 0 ? receipts[receipts.length - 1] : null;
  return {
    dc_ledger_head_hash: ledger?.entry_hash ?? null,
    dc_ledger_commit_version: ledger?.commit_version ?? null,
    latest_freeze_receipt_id: latest && typeof latest.receipt_id === "string" ? latest.receipt_id : null,
    latest_freeze_id: latest && typeof latest.freeze_id === "string" ? latest.freeze_id : null,
  };
}

export function toAuthoritativeEnvelope(record: ServerSessionRecord): AuthoritativeSessionEnvelope {
  return {
    authority: "server",
    session_id: record.session_id,
    session_generation: record.session_generation,
    revision: record.revision,
    created_at: record.created_at,
    updated_at: record.updated_at,
    expires_at: record.expires_at,
    lifecycle_status: record.lifecycle_status,
    snapshot_hash: record.snapshot_hash,
    session: record.session_snapshot,
    dc_ledger_head_hash: record.dc_ledger_head_hash,
    dc_ledger_commit_version: record.dc_ledger_commit_version,
    latest_freeze_receipt_id: record.latest_freeze_receipt_id,
    latest_freeze_id: record.latest_freeze_id,
  };
}

function snapshotAppearsFrozen(session: POJUSessionState): boolean {
  return getLocalIntakeTerminalReason(session) === "context_frozen";
}

function snapshotAppearsTerminated(session: POJUSessionState): boolean {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  return messages.some((message) => {
    const meta = message.meta;
    return Boolean(meta?.refund_pass || meta?.wipe_after_ms || meta?.escalation_lock);
  });
}

const STATUS_RANK: Record<SessionLifecycleStatus, number> = {
  active: 0,
  expired: 1,
  frozen: 2,
  terminated: 3,
};

export function mergeLifecycleStatus(
  current: SessionLifecycleStatus,
  next: SessionLifecycleStatus,
): SessionLifecycleStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

export async function deriveEffectiveLifecycle(
  record: ServerSessionRecord,
  now = Date.now(),
): Promise<SessionLifecycleStatus> {
  let status = record.lifecycle_status;
  const expiry = Date.parse(record.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) {
    status = mergeLifecycleStatus(status, "expired");
  }
  if (snapshotAppearsFrozen(record.session_snapshot)) {
    status = mergeLifecycleStatus(status, "frozen");
  }
  if (snapshotAppearsTerminated(record.session_snapshot)) {
    status = mergeLifecycleStatus(status, "terminated");
  }
  try {
    const head = await readLedgerHead(record.session_id);
    if (head && (head.change_type === "freeze" || head.dc_status === "final")) {
      status = mergeLifecycleStatus(status, "frozen");
    }
  } catch {
    // Ledger read failure is handled by the caller when Intake is requested.
    // A failed probe must not downgrade an already terminal status.
  }
  return status;
}

export function applyServerExpiryToSnapshot(
  snapshot: POJUSessionState,
  record: Pick<ServerSessionRecord, "session_id" | "expires_at" | "created_at" | "revision" | "session_generation">,
): POJUSessionState {
  return {
    ...snapshot,
    session_id: record.session_id,
    expires_at: record.expires_at,
    created_at: snapshot.created_at || record.created_at,
    session_revision: record.revision,
  };
}

export function buildInitialAuthoritativeSnapshot(input: {
  session_id: string;
  original_question: string;
  device_id: string;
  selected_stored_profile_id?: string | null;
  created_at: string;
  expires_at: string;
}): POJUSessionState {
  const storedId =
    typeof input.selected_stored_profile_id === "string" &&
    input.selected_stored_profile_id.trim().length > 0
      ? input.selected_stored_profile_id.trim()
      : null;
  const firstCycle = createNewCycle({
    original_question: input.original_question,
    cycle_index: 1,
  });
  return {
    session_id: input.session_id,
    session_revision: 0,
    dc_write_revision: 0,
    device_id: input.device_id,
    original_question: input.original_question,
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
    created_at: input.created_at,
    last_interaction_at: input.created_at,
    expires_at: input.expires_at,
    unlock_status: "preview",
    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
    confirmation_events: [],
    opening_anchors: [],
    opening_confirm_history: [],
  };
}

function normalizeProposedSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 8 ? trimmed : null;
}

export async function initializeAuthoritativeSession(input: {
  session_id?: string | null;
  original_question?: string;
  device_id?: string;
  selected_stored_profile_id?: string | null;
  now?: Date;
}): Promise<ServerSessionRecord> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const sessionId = normalizeProposedSessionId(input.session_id) ?? randomUUID();
  const expiresAt = new Date(now.getTime() + SERVER_SESSION_TTL_MS).toISOString();
  const originalQuestion =
    typeof input.original_question === "string" ? input.original_question.trim() : "";
  const deviceId = typeof input.device_id === "string" && input.device_id.trim() ? input.device_id.trim() : "server";
  const snapshot = buildInitialAuthoritativeSnapshot({
    session_id: sessionId,
    original_question: originalQuestion,
    device_id: deviceId,
    selected_stored_profile_id: input.selected_stored_profile_id,
    created_at: nowIso,
    expires_at: expiresAt,
  });
  const record: ServerSessionRecord = {
    v: SERVER_SESSION_RECORD_VERSION,
    session_id: sessionId,
    session_generation: 1,
    revision: 0,
    created_at: nowIso,
    updated_at: nowIso,
    expires_at: expiresAt,
    lifecycle_status: "active",
    snapshot_hash: hashSessionSnapshot(snapshot),
    session_snapshot: snapshot,
    last_committed_turn_id: null,
    ...associationsFromSnapshot(snapshot),
  };
  let created: boolean;
  try {
    created = await getSessionAuthorityStore().createNx(record);
  } catch (error) {
    if (error instanceof SessionPersistenceUnavailableError) {
      throw new SessionAuthorityError("server_persistence_unavailable", error.message);
    }
    throw new SessionAuthorityError(
      "server_persistence_unavailable",
      error instanceof Error ? error.message : "session init failed",
    );
  }
  if (!created) {
    throw new SessionAuthorityError(
      "session_already_exists",
      `server session already exists for ${sessionId}`,
      { session_id: sessionId, recoverable: false },
    );
  }
  return record;
}

export async function readAuthoritativeSession(
  sessionId: string,
  now = Date.now(),
): Promise<ServerSessionRecord | null> {
  if (typeof sessionId !== "string" || !sessionId.trim()) return null;
  let record: ServerSessionRecord | null;
  try {
    record = await getSessionAuthorityStore().get(sessionId.trim());
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      throw new SessionAuthorityError("invalid_session_record", error.message, {
        session_id: sessionId,
        recoverable: false,
      });
    }
    if (error instanceof SessionPersistenceUnavailableError) {
      throw new SessionAuthorityError("server_persistence_unavailable", error.message, {
        session_id: sessionId,
      });
    }
    throw new SessionAuthorityError(
      "server_persistence_unavailable",
      error instanceof Error ? error.message : "session read failed",
      { session_id: sessionId },
    );
  }
  if (!record) return null;
  const effective = await deriveEffectiveLifecycle(record, now);
  if (effective === record.lifecycle_status) return record;
  return { ...record, lifecycle_status: effective };
}

export async function requireAuthoritativeSession(
  sessionId: string,
  now = Date.now(),
): Promise<ServerSessionRecord> {
  const record = await readAuthoritativeSession(sessionId, now);
  if (!record) {
    throw new SessionAuthorityError("session_not_found", `server session not found: ${sessionId}`, {
      session_id: sessionId,
      recoverable: false,
    });
  }
  return record;
}

export async function assertRecordAllowsIntake(
  record: ServerSessionRecord,
  expectedRevision: number | null,
  now = Date.now(),
): Promise<SessionLifecycleStatus> {
  const status = await deriveEffectiveLifecycle(record, now);
  if (status === "terminated") {
    throw new SessionAuthorityError("session_terminated", "This session has been terminated.", {
      session_id: record.session_id,
      current_revision: record.revision,
      lifecycle_status: status,
    });
  }
  if (status === "expired") {
    throw new SessionAuthorityError("session_expired", "This session has expired.", {
      session_id: record.session_id,
      current_revision: record.revision,
      lifecycle_status: status,
    });
  }
  if (status === "frozen") {
    throw new SessionAuthorityError("session_frozen", "This session is frozen and cannot re-enter Intake.", {
      session_id: record.session_id,
      current_revision: record.revision,
      lifecycle_status: status,
    });
  }
  if (expectedRevision != null && expectedRevision !== record.revision) {
    throw new SessionAuthorityError(
      "session_revision_conflict",
      `stale session revision: client ${expectedRevision}, server ${record.revision}`,
      {
        session_id: record.session_id,
        current_revision: record.revision,
        expected_revision: expectedRevision,
        lifecycle_status: status,
        recoverable: true,
      },
    );
  }
  return status;
}

export type IncomingUserTurn = {
  client_turn_id: string;
  content: string;
  message: POJUMessage;
};

export function extractIncomingUserTurn(input: {
  serverSnapshot: POJUSessionState;
  clientSession?: POJUSessionState | null;
  user_message?: string | null;
  client_turn_id?: string | null;
}): IncomingUserTurn | { idempotent: true; client_turn_id: string } | null {
  const serverMessages = Array.isArray(input.serverSnapshot.messages)
    ? input.serverSnapshot.messages
    : [];
  const explicitTurnId =
    typeof input.client_turn_id === "string" && input.client_turn_id.trim()
      ? input.client_turn_id.trim()
      : null;
  const explicitContent =
    typeof input.user_message === "string" && input.user_message.trim()
      ? input.user_message
      : null;

  const clientMessages = Array.isArray(input.clientSession?.messages)
    ? input.clientSession!.messages
    : [];
  const clientUser = [...clientMessages]
    .reverse()
    .find((message) => message && message.role === "user" && typeof message.content === "string");

  const content = explicitContent ?? (clientUser ? clientUser.content : null);
  const turnId =
    explicitTurnId ??
    (typeof clientUser?.client_id === "string" && clientUser.client_id.trim()
      ? clientUser.client_id.trim()
      : null);

  if (!content || !content.trim()) return null;

  const client_turn_id = turnId ?? `turn_${hashSessionSnapshot({
    ...input.serverSnapshot,
    messages: [...serverMessages, { role: "user", content, timestamp: "" }],
  } as POJUSessionState).slice(0, 16)}`;

  const existing = serverMessages.find(
    (message) => typeof message.client_id === "string" && message.client_id === client_turn_id,
  );
  if (existing) {
    if (existing.role === "user" && existing.content === content) {
      return { idempotent: true, client_turn_id };
    }
    throw new SessionAuthorityError(
      "session_turn_conflict",
      `idempotency identity ${client_turn_id} is already bound to different content`,
      {
        session_id: input.serverSnapshot.session_id,
        recoverable: false,
      },
    );
  }

  const message: POJUMessage = {
    role: "user",
    content,
    timestamp:
      typeof clientUser?.timestamp === "string" && clientUser.timestamp
        ? clientUser.timestamp
        : new Date().toISOString(),
    client_id: client_turn_id,
    ...(clientUser?.meta ? { meta: clientUser.meta } : {}),
  };
  return { client_turn_id, content, message };
}

export function bindAuthoritativeChatSession(
  record: ServerSessionRecord,
  turn: IncomingUserTurn,
): POJUSessionState {
  const snapshot = applyServerExpiryToSnapshot(record.session_snapshot, record);
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  return {
    ...snapshot,
    messages: [...messages, turn.message],
  };
}

export async function commitAuthoritativeSessionUpdate(input: {
  sessionId: string;
  expectedRevision: number;
  expectedGeneration?: number;
  snapshot: POJUSessionState;
  last_committed_turn_id: string | null;
  now?: Date;
}): Promise<ServerSessionRecord> {
  const current = await requireAuthoritativeSession(input.sessionId);
  if (current.session_id !== input.sessionId) {
    throw new SessionAuthorityError(
      "invalid_session_record",
      "authoritative session id does not match the commit request",
      { session_id: input.sessionId, recoverable: false },
    );
  }
  if (
    input.expectedGeneration != null &&
    current.session_generation !== input.expectedGeneration
  ) {
    throw new SessionAuthorityError(
      "session_cas_conflict",
      `CAS refused unexpected generation ${input.expectedGeneration}; server is ${current.session_generation}`,
      {
        session_id: input.sessionId,
        current_revision: current.revision,
        expected_revision: input.expectedRevision,
        lifecycle_status: current.lifecycle_status,
        recoverable: true,
      },
    );
  }
  const now = input.now ?? new Date();
  const status = await deriveEffectiveLifecycle(current, now.getTime());
  if (status === "terminated") {
    throw new SessionAuthorityError("session_terminated", "This session has been terminated.", {
      session_id: current.session_id,
      current_revision: current.revision,
      lifecycle_status: status,
    });
  }
  if (status === "expired") {
    throw new SessionAuthorityError("session_expired", "This session has expired.", {
      session_id: current.session_id,
      current_revision: current.revision,
      lifecycle_status: status,
    });
  }
  if (status === "frozen") {
    throw new SessionAuthorityError("session_frozen", "This session is frozen and cannot re-enter Intake.", {
      session_id: current.session_id,
      current_revision: current.revision,
      lifecycle_status: status,
    });
  }
  if (current.revision !== input.expectedRevision) {
    throw new SessionAuthorityError(
      "session_cas_conflict",
      `CAS refused stale revision ${input.expectedRevision}; server is ${current.revision}`,
      {
        session_id: input.sessionId,
        current_revision: current.revision,
        expected_revision: input.expectedRevision,
        lifecycle_status: status,
        recoverable: true,
      },
    );
  }
  // Commit only a still-active record. Never persist the model turn under a terminal status.
  const snapshot = applyServerExpiryToSnapshot(input.snapshot, {
    session_id: current.session_id,
    expires_at: current.expires_at,
    created_at: current.created_at,
    revision: current.revision + 1,
    session_generation: current.session_generation,
  });
  snapshot.session_id = current.session_id;
  snapshot.session_revision = current.revision + 1;
  snapshot.expires_at = current.expires_at;
  const next: ServerSessionRecord = {
    ...current,
    v: current.v,
    session_id: current.session_id,
    session_generation: current.session_generation,
    revision: current.revision + 1,
    updated_at: now.toISOString(),
    expires_at: current.expires_at,
    lifecycle_status: "active",
    snapshot_hash: hashSessionSnapshot(snapshot),
    session_snapshot: snapshot,
    last_committed_turn_id: input.last_committed_turn_id,
    ...associationsFromSnapshot(snapshot),
  };
  let result;
  try {
    result = await getSessionAuthorityStore().compareAndSetDetailed(
      input.sessionId,
      input.expectedRevision,
      next,
      { intakeCommit: true, nowIso: now.toISOString() },
    );
  } catch (error) {
    if (error instanceof SessionPersistenceUnavailableError) {
      throw new SessionAuthorityError("server_persistence_unavailable", error.message, {
        session_id: input.sessionId,
        expected_revision: input.expectedRevision,
      });
    }
    throw new SessionAuthorityError(
      "server_persistence_unavailable",
      error instanceof Error ? error.message : "session CAS failed",
      { session_id: input.sessionId, expected_revision: input.expectedRevision },
    );
  }
  if (!result.ok) {
    const winner = await readAuthoritativeSession(input.sessionId).catch(() => null);
    const lifecycle = winner?.lifecycle_status;
    if (result.reason === "expired") {
      throw new SessionAuthorityError("session_expired", "This session has expired.", {
        session_id: input.sessionId,
        current_revision: winner?.revision ?? current.revision,
        lifecycle_status: lifecycle ?? "expired",
      });
    }
    if (result.reason === "frozen") {
      throw new SessionAuthorityError("session_frozen", "This session is frozen and cannot re-enter Intake.", {
        session_id: input.sessionId,
        current_revision: winner?.revision ?? current.revision,
        lifecycle_status: lifecycle ?? "frozen",
      });
    }
    if (result.reason === "terminated") {
      throw new SessionAuthorityError("session_terminated", "This session has been terminated.", {
        session_id: input.sessionId,
        current_revision: winner?.revision ?? current.revision,
        lifecycle_status: lifecycle ?? "terminated",
      });
    }
    if (result.reason === "malformed") {
      throw new SessionAuthorityError(
        "invalid_session_record",
        "authoritative session record failed integrity checks during commit",
        { session_id: input.sessionId, recoverable: false },
      );
    }
    if (result.reason === "missing") {
      throw new SessionAuthorityError("session_not_found", `server session not found: ${input.sessionId}`, {
        session_id: input.sessionId,
        expected_revision: input.expectedRevision,
        recoverable: false,
      });
    }
    if (result.reason === "identity") {
      throw new SessionAuthorityError(
        "invalid_session_record",
        "authoritative session record failed identity or contract checks during commit",
        { session_id: input.sessionId, recoverable: false },
      );
    }
    if (result.reason === "ledger_integrity") {
      throw new SessionAuthorityError(
        "ledger_integrity_failure",
        "Decision Authority ledger data failed integrity checks during intake commit",
        { session_id: input.sessionId, recoverable: false },
      );
    }
    if (result.reason === "ledger_probe_incomplete") {
      throw new SessionAuthorityError(
        "ledger_probe_incomplete",
        "Decision Authority ledger probe could not establish the authoritative head within its limit",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    if (result.reason === "ledger_snapshot_changed") {
      throw new SessionAuthorityError(
        "ledger_snapshot_changed",
        "Decision Authority ledger changed during intake commit; retry is required",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    if (result.reason === "session_snapshot_changed") {
      throw new SessionAuthorityError(
        "session_snapshot_changed",
        "Authoritative session record changed during commit; retry is required",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    throw new SessionAuthorityError(
      "session_cas_conflict",
      `CAS conflict committing revision ${input.expectedRevision}`,
      {
        session_id: input.sessionId,
        current_revision: winner?.revision,
        expected_revision: input.expectedRevision,
        lifecycle_status: lifecycle,
        recoverable: true,
      },
    );
  }
  return next;
}

export function httpStatusForAuthorityError(error: SessionAuthorityError): number {
  if (error.code === "server_persistence_unavailable") return 503;
  if (error.code === "invalid_session_request" || error.code === "session_turn_missing") return 400;
  if (error.code === "session_already_exists") return 409;
  if (error.code === "session_turn_conflict" || error.code === "invalid_session_record") return 409;
  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete" || error.code === "ledger_snapshot_changed" || error.code === "session_snapshot_changed") return 409;
  return 409;
}