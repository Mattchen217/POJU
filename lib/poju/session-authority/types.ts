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
  session_snapshot: POJUSessionState;
  last_committed_turn_id: string | null;
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
  | "session_turn_missing";

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
  session: POJUSessionState;
  dc_ledger_head_hash: string | null;
  dc_ledger_commit_version: number | null;
  latest_freeze_receipt_id: string | null;
  latest_freeze_id: string | null;
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