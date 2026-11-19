/**
 * Authoritative-chat profile / base_analysis intake.
 *
 * The browser may supply locally stored personal-analysis payloads as model
 * inputs. Binding and lifecycle authority always come from the server Session
 * snapshot — never from client-supplied profile flags or forged ids.
 *
 * Identity comparison is exact (no trim / rewrite):
 *   profile.id === claimed_stored_profile_id === authoritativeBoundProfileId(server)
 */

import type { UserProfile } from "@/lib/profile/types";
import type { POJUSessionState } from "@/lib/poju/types";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { SessionAuthorityError } from "@/lib/poju/session-authority/lifecycle";

/** Soft caps — fail closed on oversized forged payloads. */
export const AUTHORITATIVE_CHAT_MAX_PROFILE_BYTES = 96_000;
export const AUTHORITATIVE_CHAT_MAX_BASE_ANALYSIS_BYTES = 1_500_000;

export type AuthoritativeChatProfileInputs = {
  profile: UserProfile | null;
  base_analysis: unknown | null;
  claimed_stored_profile_id: string | null;
};

function utf8JsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    throw new SessionAuthorityError(
      "invalid_session_request",
      "profile payload is not JSON-serializable",
    );
  }
}

function assertPayloadSize(label: string, value: unknown, maxBytes: number): void {
  if (value == null) return;
  const bytes = utf8JsonBytes(value);
  if (bytes > maxBytes) {
    throw new SessionAuthorityError(
      "invalid_session_request",
      `${label} exceeds maximum size (${bytes} > ${maxBytes})`,
    );
  }
}

/**
 * Exact Session binding id for identity comparison — no trim / rewrite.
 * Legacy non-canonical values fail closed at comparison time.
 */
function authoritativeBoundProfileId(session: POJUSessionState): string | null {
  const selected = session.selected_stored_profile_id;
  if (typeof selected === "string" && selected.length > 0) return selected;
  const agent = session.agent_v2?.selected_profile_id;
  if (typeof agent === "string" && agent.length > 0) return agent;
  return null;
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function isLikelyUserProfile(value: unknown): value is UserProfile {
  if (!isPlainJsonObject(value)) return false;
  const p = value as Record<string, unknown>;
  // id must be a non-empty string; exact value is compared later without trim.
  if (typeof p.id !== "string" || p.id.length === 0) return false;
  if (!p.birth || typeof p.birth !== "object" || Array.isArray(p.birth)) return false;
  if (!p.bazi || typeof p.bazi !== "object" || Array.isArray(p.bazi)) return false;
  if (!p.diagnosis || typeof p.diagnosis !== "object" || Array.isArray(p.diagnosis)) return false;
  return true;
}

/**
 * Fail-closed structural gate for persisted Base Analysis payloads.
 * Accepts plain objects only (legacy DeepSeek / Layer-1 / stream shapes).
 * Does not invent fields or replace invalid payloads with `{}`.
 */
function assertBaseAnalysisShape(value: unknown): void {
  if (value == null) return;
  if (!isPlainJsonObject(value)) {
    throw new SessionAuthorityError(
      "invalid_session_request",
      "base_analysis must be a plain JSON object",
    );
  }
}

/**
 * Read claimed id without normalizing. Whitespace-padded values are kept as-is
 * for exact comparison; whitespace-only values are rejected when supplied.
 */
function readClaimedStoredProfileId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new SessionAuthorityError(
      "invalid_session_request",
      "claimed_stored_profile_id must be a string when supplied",
    );
  }
  if (value.length === 0) return null;
  // Detect whitespace-only without rewriting the comparison value.
  if (value.trim().length === 0) {
    throw new SessionAuthorityError(
      "invalid_session_request",
      "claimed_stored_profile_id must not be whitespace-only",
    );
  }
  return value;
}

/**
 * Validate client-supplied personal-analysis inputs against the authoritative
 * Session binding. Returns normalized inputs for `server_invoke`.
 *
 * Required identity when a profile payload is present (exact string equality):
 *   profile.id === claimed_stored_profile_id === authoritativeBoundProfileId(server)
 */
export function resolveAuthoritativeChatProfileInputs(input: {
  serverSnapshot: POJUSessionState;
  profile?: unknown;
  userProfile?: unknown;
  base_analysis?: unknown;
  claimed_stored_profile_id?: unknown;
}): AuthoritativeChatProfileInputs {
  const rawProfile = input.profile !== undefined ? input.profile : input.userProfile;
  const rawBase = input.base_analysis === undefined ? null : input.base_analysis;
  const claimed = readClaimedStoredProfileId(input.claimed_stored_profile_id);

  assertBaseAnalysisShape(rawBase);
  assertPayloadSize("profile", rawProfile, AUTHORITATIVE_CHAT_MAX_PROFILE_BYTES);
  assertPayloadSize("base_analysis", rawBase, AUTHORITATIVE_CHAT_MAX_BASE_ANALYSIS_BYTES);

  const server = input.serverSnapshot;
  const boundId = authoritativeBoundProfileId(server);
  const skipped = server.profile_skipped === true;
  const hasBinding =
    Boolean(boundId) ||
    server.birth_submitted_in_session === true ||
    resolveSessionHasProfile(server);

  const hasAnyPayload = rawProfile != null || rawBase != null || claimed != null;

  if (skipped) {
    if (hasAnyPayload) {
      throw new SessionAuthorityError(
        "invalid_session_request",
        "profile inputs are not permitted when the Session is profile_skipped",
      );
    }
    return { profile: null, base_analysis: null, claimed_stored_profile_id: null };
  }

  if (!hasBinding) {
    if (hasAnyPayload) {
      throw new SessionAuthorityError(
        "invalid_session_request",
        "profile inputs require an authoritative Session profile binding",
      );
    }
    return { profile: null, base_analysis: null, claimed_stored_profile_id: null };
  }

  if (rawProfile != null && !isLikelyUserProfile(rawProfile)) {
    throw new SessionAuthorityError(
      "invalid_session_request",
      "profile payload shape is invalid",
    );
  }

  const profile = rawProfile == null ? null : (rawProfile as UserProfile);

  if (rawProfile != null || rawBase != null) {
    if (!claimed) {
      throw new SessionAuthorityError(
        "invalid_session_request",
        "claimed_stored_profile_id is required when profile or base_analysis is supplied",
      );
    }
  }

  if (claimed) {
    if (!boundId || claimed !== boundId) {
      throw new SessionAuthorityError(
        "invalid_session_request",
        "profile binding does not match the authoritative Session",
      );
    }
  }

  // Exact identity — do not trim, pad-strip, or silently rewrite any id.
  if (profile != null) {
    if (!claimed || !boundId || profile.id !== claimed || claimed !== boundId) {
      throw new SessionAuthorityError(
        "invalid_session_request",
        "profile.id must equal claimed_stored_profile_id and the authoritative Session binding",
      );
    }
  }

  return {
    profile,
    base_analysis: rawBase,
    claimed_stored_profile_id: claimed,
  };
}
