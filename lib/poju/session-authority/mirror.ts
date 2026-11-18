/**
 * M9 — client-safe rules for treating IndexedDB as a mirror of the server Session.
 * Local stale snapshots must not overwrite a newer server version. Offline
 * cache may be shown, but must not be presented as already-committed authority.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AuthoritativeSessionEnvelope,
  SessionLifecycleStatus,
} from "@/lib/poju/session-authority/types";

export type MirrorAuthoritySync =
  | "server"
  | "offline_cache"
  | "server_missing"
  | "server_expired"
  | "server_frozen"
  | "server_terminated";

export type AuthoritativeMirrorResult = {
  session: POJUSessionState | null;
  lifecycle_status: SessionLifecycleStatus | "missing";
  authority_sync: MirrorAuthoritySync;
  revision: number | null;
  expires_at: string | null;
  server_envelope: AuthoritativeSessionEnvelope | null;
  used_offline_cache: boolean;
  message: string;
};

export type AuthorityFetchFailure = {
  kind: "offline" | "unavailable" | "not_found";
  message?: string;
};

export function decideAuthoritativeMirror(input: {
  local: POJUSessionState | null;
  server: AuthoritativeSessionEnvelope | null;
  fetchFailure?: AuthorityFetchFailure | null;
}): AuthoritativeMirrorResult {
  const local = input.local;
  const server = input.server;

  if (input.fetchFailure && !server) {
    if (input.fetchFailure.kind === "not_found") {
      return {
        session: local,
        lifecycle_status: "missing",
        authority_sync: "server_missing",
        revision: local?.session_revision ?? null,
        expires_at: local?.expires_at ?? null,
        server_envelope: null,
        used_offline_cache: false,
        message: "The server Session does not exist.",
      };
    }
    return {
      session: local,
      lifecycle_status: "active",
      authority_sync: "offline_cache",
      revision: local?.session_revision ?? null,
      expires_at: local?.expires_at ?? null,
      server_envelope: null,
      used_offline_cache: true,
      message:
        "Showing the local Session cache. Offline edits are not already-committed server authority.",
    };
  }

  if (!server) {
    return {
      session: local,
      lifecycle_status: "missing",
      authority_sync: "server_missing",
      revision: local?.session_revision ?? null,
      expires_at: local?.expires_at ?? null,
      server_envelope: null,
      used_offline_cache: false,
      message: "The server Session does not exist.",
    };
  }

  const syncByStatus: Record<SessionLifecycleStatus, MirrorAuthoritySync> = {
    active: "server",
    expired: "server_expired",
    frozen: "server_frozen",
    terminated: "server_terminated",
  };
  const messageByStatus: Record<SessionLifecycleStatus, string> = {
    active: "Restored the server-authoritative Session.",
    expired: "This Session has expired on the server. Intake cannot continue.",
    frozen: "This Session is frozen on the server. Intake cannot be reopened.",
    terminated: "This Session has been terminated on the server and cannot be cleared locally.",
  };

  return {
    session: server.session,
    lifecycle_status: server.lifecycle_status,
    authority_sync: syncByStatus[server.lifecycle_status],
    revision: server.revision,
    expires_at: server.expires_at,
    server_envelope: server,
    used_offline_cache: false,
    message: messageByStatus[server.lifecycle_status],
  };
}