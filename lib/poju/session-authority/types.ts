/**
 * M9 — server-authoritative Session record types.
 * Shared by the server store and the client mirror. This is not a second
 * Decision Context or fact store; DC remains the unique formal fact source.
 */

import type { POJUSessionState } from "@/lib/poju/types";

export const SERVER_SESSION_RECORD_VERSION = 1 as const;

export type SessionLifecycleStatus = "active" | "expired" | "frozen" | "terminated";

export type ServerSessionAssociations = {
  dc_ledger_head_hash: string | null;
  dc_ledger_commit_version: number | null;
  latest_freeze_receipt_id: string | null;
  latest_freeze_id: string | null;
};

export type ServerSessionRecord = ServerSessionAssociations & {
  v: typeof SERVER_SESSION_RECORD_VERSION;
  session_id: string;
  session_generation: number;
  revision: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  lifecycle_status: SessionLifecycleStatus;
  snapshot_hash: string;
  /**
   * Unit A: durable snapshot is a privacy shell (no chat/DC bodies).
   * Full private Session content lives in the original browser IndexedDB.
   */
  session_snapshot: POJUSessionState;
  last_committed_turn_id: string | null;
  /** Present on records written after Unit A; absent on legacy full snapshots. */
  content_policy?: "local_private" | "legacy_full";
};

export type SessionAuthorityErrorCode =
  | "session_not_found"
  | "session_expired"
  | "session_frozen"
  | "session_terminated"
  | "session_revision_conflict"
  | "session_cas_conflict"
  | "server_persistence_unavailable"
  | "session_already_exists"
  | "invalid_session_request"
  | "session_turn_missing"
  | "session_turn_conflict"
  | "invalid_session_record"
  | "ledger_integrity_failure"
  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed"
  | "session_snapshot_changed";

export const SESSION_AUTHORITY_KEY_PREFIX = "poju-auth:session:";

export function serverSessionKey(sessionId: string): string {
  return `${SESSION_AUTHORITY_KEY_PREFIX}${sessionId}`;
}

export type AuthoritativeSessionEnvelope = {
  authority: "server";
  session_id: string;
  session_generation: number;
  revision: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  lifecycle_status: SessionLifecycleStatus;
  snapshot_hash: string;
  /**
   * Unit A get/init durable view: privacy shell only. Chat responses still
   * return the full turn Session via `authoritative_session` (transient).
   */
  session: POJUSessionState;
  dc_ledger_head_hash: string | null;
  dc_ledger_commit_version: number | null;
  latest_freeze_receipt_id: string | null;
  latest_freeze_id: string | null;
  /** When true, `session` has no private conversation bodies — keep IndexedDB content. */
  content_local?: boolean;
};

export type SessionAuthorityConflictBody = {
  error: "session_authority";
  code: SessionAuthorityErrorCode;
  recoverable: boolean;
  session_id?: string;
  current_revision?: number;
  expected_revision?: number;
  lifecycle_status?: SessionLifecycleStatus;
  message: string;
};