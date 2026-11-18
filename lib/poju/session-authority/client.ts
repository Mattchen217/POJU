/**
 * M9 — browser helpers for server Session init and authoritative restore.
 * This module only talks to the HTTP API; it does not import the KV store.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AuthoritativeSessionEnvelope,
  SessionAuthorityConflictBody,
} from "@/lib/poju/session-authority/types";
import {
  decideAuthoritativeMirror,
  type AuthoritativeMirrorResult,
} from "@/lib/poju/session-authority/mirror";

const SESSION_API = "/api/poju/session";

export class ClientSessionAuthorityError extends Error {
  readonly body: SessionAuthorityConflictBody;
  constructor(body: SessionAuthorityConflictBody) {
    super(body.message);
    this.name = "ClientSessionAuthorityError";
    this.body = body;
  }
}

async function parseEnvelope(response: Response): Promise<AuthoritativeSessionEnvelope> {
  const data = (await response.json().catch(() => ({}))) as
    | (AuthoritativeSessionEnvelope & { ok?: boolean })
    | SessionAuthorityConflictBody
    | { error?: string; message?: string };
  if (!response.ok) {
    if (data && typeof data === "object" && "error" in data && data.error === "session_authority") {
      throw new ClientSessionAuthorityError(data as SessionAuthorityConflictBody);
    }
    throw new Error(
      (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        `session API HTTP ${response.status}`,
    );
  }
  const envelope = data as AuthoritativeSessionEnvelope;
  if (envelope.authority !== "server" || typeof envelope.session_id !== "string" || !envelope.session) {
    throw new Error("session API did not return a server-authoritative envelope");
  }
  return envelope;
}

export async function initializeServerSessionFromClient(input: {
  session_id?: string | null;
  original_question: string;
  device_id?: string;
  selected_stored_profile_id?: string | null;
}): Promise<AuthoritativeSessionEnvelope> {
  const response = await fetch(SESSION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "init",
      session_id: input.session_id ?? null,
      original_question: input.original_question,
      device_id: input.device_id ?? null,
      selected_stored_profile_id: input.selected_stored_profile_id ?? null,
    }),
  });
  return parseEnvelope(response);
}

export async function fetchAuthoritativeSessionFromClient(
  sessionId: string,
): Promise<AuthoritativeSessionEnvelope> {
  const response = await fetch(SESSION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get", session_id: sessionId }),
  });
  return parseEnvelope(response);
}

export async function restoreAuthoritativeSessionFromClient(input: {
  sessionId: string;
  loadLocal: (sessionId: string) => Promise<POJUSessionState | null>;
  saveLocal: (session: POJUSessionState) => Promise<void>;
}): Promise<AuthoritativeMirrorResult> {
  const local = await input.loadLocal(input.sessionId);
  try {
    const server = await fetchAuthoritativeSessionFromClient(input.sessionId);
    const result = decideAuthoritativeMirror({ local, server });
    if (result.session && result.authority_sync !== "offline_cache") {
      await input.saveLocal(result.session);
    }
    return result;
  } catch (error) {
    if (error instanceof ClientSessionAuthorityError && error.body.code === "session_not_found") {
      return decideAuthoritativeMirror({
        local,
        server: null,
        fetchFailure: { kind: "not_found" },
      });
    }
    const offline =
      error instanceof TypeError ||
      (error instanceof Error && /fetch|network|offline|Failed to fetch/i.test(error.message));
    return decideAuthoritativeMirror({
      local,
      server: null,
      fetchFailure: { kind: offline ? "offline" : "unavailable", message: error instanceof Error ? error.message : String(error) },
    });
  }
}