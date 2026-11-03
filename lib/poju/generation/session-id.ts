/**
 * Contract §4.2 — Session ID validation for Generation APIs.
 * Production paths MUST reject missing/blank, length <8 or >128, bad charset, __anon__.
 */

import { GenerationError, INVALID_GENERATION_SESSION_ID } from "./types";

const SESSION_ID_RE = /^[A-Za-z0-9_-]+$/;

export function isValidProductionSessionId(sessionId: unknown): sessionId is string {
  if (typeof sessionId !== "string") return false;
  const id = sessionId.trim();
  if (!id) return false;
  if (id === "__anon__") return false;
  if (id.length < 8 || id.length > 128) return false;
  return SESSION_ID_RE.test(id);
}

export function assertValidProductionSessionId(sessionId: unknown, where?: string): string {
  if (!isValidProductionSessionId(sessionId)) {
    throw new GenerationError(
      INVALID_GENERATION_SESSION_ID,
      `invalid session_id${where ? ` at ${where}` : ""}`,
    );
  }
  return sessionId.trim();
}
