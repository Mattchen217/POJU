/**
 * Server-only assistant-history attestation for M8-R1-FU1-R2.
 *
 * Signatures are HMAC-SHA256 under the existing Decision Authority
 * server secret, domain-separated as `poju-assistant-history`. A client
 * cannot mint a valid signature without that secret. Role "assistant" is
 * never treated as proof of origin.
 */

import {
  applyAssistantHistoryProvenance,
  parseAssistantHistoryAttestation,
  type AssistantHistoryAttestation,
  type PromptHistoryTurn,
} from "@/lib/poju/shared/assistant-history-provenance";
import { AuthoritySigningUnavailableError, signAuthorityDomain, verifyAuthorityDomain } from "@/lib/poju/decision-authority/server/signing";
import type { POJUMessage } from "@/lib/poju/types";

export const ASSISTANT_HISTORY_ATTESTATION_DOMAIN = "poju-assistant-history";

function canonicalAssistantPayload(sessionId: string, content: string): string {
  return JSON.stringify({
    v: 1,
    session_id: sessionId,
    role: "assistant",
    content,
  });
}

export function signAssistantHistoryAttestation(
  sessionId: string,
  content: string,
): AssistantHistoryAttestation | null {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  try {
    return {
      v: 1,
      alg: "hmac-sha256",
      sig: signAuthorityDomain(
        ASSISTANT_HISTORY_ATTESTATION_DOMAIN,
        canonicalAssistantPayload(sessionId, content),
      ),
    };
  } catch (error) {
    if (error instanceof AuthoritySigningUnavailableError) return null;
    throw error;
  }
}

export function verifyAssistantHistoryAttestation(
  sessionId: string,
  content: string,
  signature: string,
): boolean {
  if (typeof sessionId !== "string" || typeof content !== "string" || typeof signature !== "string") {
    return false;
  }
  return verifyAuthorityDomain(
    ASSISTANT_HISTORY_ATTESTATION_DOMAIN,
    canonicalAssistantPayload(sessionId, content),
    signature,
  );
}

/** Attach a server attestation to an outbound chat payload, signing `response`. */
export function attestChatPayload(
  payload: Record<string, unknown>,
  sessionId: string,
): Record<string, unknown> {
  const content = typeof payload.response === "string" ? payload.response : "";
  const attestation = signAssistantHistoryAttestation(sessionId, content);
  if (!attestation) return payload;
  return { ...payload, assistant_history_attestation: attestation };
}

export function applyTrustedPromptHistory(
  session: { session_id: string; messages: POJUMessage[] },
  promptMessages: PromptHistoryTurn[],
): PromptHistoryTurn[] {
  return applyAssistantHistoryProvenance(
    session.session_id,
    Array.isArray(session.messages) ? session.messages : [],
    promptMessages,
    {
      available: true,
      verify: verifyAssistantHistoryAttestation,
    },
  );
}

export { parseAssistantHistoryAttestation };
