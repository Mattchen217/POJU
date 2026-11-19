/**
 * Browser transport for the server-authoritative DI2 chat path.
 * The UI must not run Answer Interpretation / adaptive planning locally.
 */

import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { PojuChatAttachment } from "@/lib/poju/attachments/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import type {
  AuthoritativeSessionEnvelope,
  SessionAuthorityConflictBody,
  SessionAuthorityErrorCode,
} from "@/lib/poju/session-authority/types";
import { ClientSessionAuthorityError } from "@/lib/poju/session-authority/client";

export const AUTHORITATIVE_CHAT_ROUTE = "/api/poju/chat";

export type AuthoritativeChatClientInput = {
  session: POJUSessionState;
  user_message: string;
  client_turn_id: string;
  expected_revision: number;
  locale: string;
  profile?: UserProfile | null;
  userProfile?: UserProfile | null;
  base_analysis?: unknown | null;
  /**
   * Attests which local stored-profile row the browser loaded.
   * Required when profile or base_analysis is supplied; must match the
   * authoritative Session binding on the server.
   */
  claimed_stored_profile_id?: string | null;
  archive_data?: POJUActionRecommendationsData | null;
  tool_injection_context?: string | null;
  attachment?: PojuChatAttachment | null;
  signal?: AbortSignal;
};

export type AuthoritativeChatClientSuccess = {
  ok: true;
  session: POJUSessionState;
  envelope: AuthoritativeSessionEnvelope;
  session_revision: number;
  turn_idempotent: boolean;
  response: string;
};

function isAuthoritativeEnvelope(value: unknown): value is AuthoritativeSessionEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const env = value as Record<string, unknown>;
  return (
    env.authority === "server" &&
    typeof env.session_id === "string" &&
    typeof env.revision === "number" &&
    !!env.session &&
    typeof env.session === "object"
  );
}

/**
 * Submit one user turn to `/api/poju/chat`. The server loads its own Session
 * snapshot, runs `executeAuthoritativeChatTurn`, CAS-commits, then returns the
 * committed envelope. Client session state never replaces server authority.
 */
export async function submitAuthoritativeChatTurn(
  input: AuthoritativeChatClientInput,
): Promise<AuthoritativeChatClientSuccess> {
  const body = {
    // Client snapshot is only for turn identity / revision hint. The server
    // loads its own stored Session and binds the turn onto that snapshot.
    session: {
      ...input.session,
      session_revision: input.expected_revision,
    },
    user_message: input.user_message,
    client_turn_id: input.client_turn_id,
    expected_revision: input.expected_revision,
    locale: input.locale,
    profile: input.profile ?? input.userProfile ?? null,
    userProfile: input.userProfile ?? input.profile ?? null,
    base_analysis: input.base_analysis ?? null,
    claimed_stored_profile_id: input.claimed_stored_profile_id ?? null,
    archive_data: input.archive_data ?? null,
    tool_injection_context: input.tool_injection_context ?? null,
    attachment: input.attachment ?? null,
  };

  const response = await fetch(AUTHORITATIVE_CHAT_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const data = raw as {
    authoritative_session?: POJUSessionState;
    session_authority?: AuthoritativeSessionEnvelope;
    session_revision?: number;
    turn_idempotent?: boolean;
    response?: string;
    reply?: string;
    error?: string;
    message?: string;
    code?: string;
  };

  const errorCode = typeof raw.error === "string" ? raw.error : undefined;

  if (
    errorCode === "openrouter_provider_queue" ||
    (!response.ok && response.status === 503 && errorCode !== "session_authority")
  ) {
    const err = new Error("openrouter_provider_queue");
    err.name = "OpenRouterProviderQueueError";
    throw err;
  }

  if (!response.ok) {
    if (errorCode === "session_authority") {
      throw new ClientSessionAuthorityError(data as SessionAuthorityConflictBody);
    }
    const err = new Error(
      data.message || errorCode || `/api/poju/chat returned HTTP ${response.status}`,
    );
    if (typeof data.code === "string") {
      (err as Error & { code?: string }).code = data.code;
      err.name = "SessionAuthorityError";
    }
    throw err;
  }

  if (errorCode && errorCode !== "session_authority") {
    throw new Error(errorCode);
  }

  const envelope = data.session_authority;
  const authoritative = data.authoritative_session;
  if (!isAuthoritativeEnvelope(envelope) || !authoritative || typeof authoritative !== "object") {
    throw new Error(
      "authoritative chat response missing authoritative_session / session_authority",
    );
  }
  if (envelope.session_id !== input.session.session_id) {
    throw new Error("authoritative chat response session_id mismatch");
  }
  if (typeof data.session_revision !== "number" || !Number.isFinite(data.session_revision)) {
    throw new Error("authoritative chat response missing session_revision");
  }

  const text =
    typeof data.response === "string"
      ? data.response
      : typeof data.reply === "string"
        ? data.reply
        : "";

  return {
    ok: true,
    session: {
      ...authoritative,
      session_revision: data.session_revision,
    },
    envelope,
    session_revision: data.session_revision,
    turn_idempotent: data.turn_idempotent === true,
    response: text,
  };
}

export function isRecoverableSessionAuthorityCode(
  code: SessionAuthorityErrorCode | string | undefined,
): boolean {
  return (
    code === "session_revision_conflict" ||
    code === "session_cas_conflict" ||
    code === "ledger_integrity_failure" ||
    code === "ledger_probe_incomplete" ||
    code === "ledger_snapshot_changed" ||
    code === "session_snapshot_changed"
  );
}
