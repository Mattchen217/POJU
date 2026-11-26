/**
 * M9 — shared server Session authority for both production chat entries.
 * Non-stream (POST /api/poju/chat) and stream (createPojuChatStreamResponse)
 * must use these same validation and write rules.
 *
 * The existing handleUserMessage() path remains the only Q&A state machine.
 * This module loads the authoritative Session, binds the new user turn, runs
 * handleUserMessage, and CAS-commits the result before the client is told
 * the turn completed.
 */

import { handleUserMessage } from "@/lib/poju/agent";
import { runWithMemorySessionPersist } from "@/lib/poju/session-authority/memory-persist";
import { runWithInProcessDecisionAuthority } from "@/lib/poju/decision-authority/server/in-process-transport";
import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import {
  getAuthoritativeChatTestHooks,
  getAuthoritativeCommitTestHook,
  noteAuthoritativeModelInputs,
  runWithLlmCapture,
} from "@/lib/poju/session-authority/chat-hooks";
import {
  getAuthoritativeRevisionAnchor,
  runWithAuthoritativeRevisionAnchor,
} from "@/lib/poju/session-authority/authoritative-revision-anchor";
import { adoptLedgerHeadIntoSessionIfAhead } from "@/lib/poju/session-authority/ledger-head-catchup";
import { resolveAuthoritativeChatProfileInputs } from "@/lib/poju/session-authority/chat-profile-inputs";
import { applyAuthoritativeFirstTurnDisplayTitle } from "@/lib/poju/session-list-label";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import {
  SessionAuthorityError,
  assertRecordAllowsIntake,
  bindAuthoritativeChatSession,
  commitAuthoritativeSessionUpdate,
  extractIncomingUserTurn,
  requireAuthoritativeSession,
  toAuthoritativeEnvelope,
} from "@/lib/poju/session-authority/lifecycle";
import type { AuthoritativeSessionEnvelope } from "@/lib/poju/session-authority/types";

export type AuthoritativeChatBody = {
  locale?: string;
  userProfile?: UserProfile | null;
  session?: POJUSessionState;
  profile?: UserProfile | null;
  base_analysis?: unknown | null;
  /** Local load attestation — must match authoritative Session binding when payloads are present. */
  claimed_stored_profile_id?: string | null;
  archive_data?: POJUActionRecommendationsData | null;
  tool_injection_context?: string | null;
  attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
  user_message?: string | null;
  client_turn_id?: string | null;
  expected_revision?: number | null;
};

export type AuthoritativeChatSuccess = {
  ok: true;
  idempotent: boolean;
  llm: POJULLMResponse;
  session: POJUSessionState;
  envelope: AuthoritativeSessionEnvelope;
  aborted: false;
};

export type AuthoritativeChatAbort = {
  ok: false;
  aborted: true;
  reason: "aborted";
};

export { runWithTestChatModel, getTestChatModel, captureAuthoritativeLlmResult } from "@/lib/poju/session-authority/chat-hooks";
export type { TestChatModel } from "@/lib/poju/session-authority/chat-hooks";

function requestedRevision(body: AuthoritativeChatBody): number | null {
  if (typeof body.expected_revision === "number" && Number.isFinite(body.expected_revision)) {
    return body.expected_revision;
  }
  const hint = body.session?.session_revision;
  if (typeof hint === "number" && Number.isFinite(hint)) return hint;
  return null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object" && (error as { name?: string }).name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("abort") || message.includes("AbortError");
}

/**
 * Shared production entry used by both chat routes.
 * On CAS conflict the model is not retried and the lost write is not applied.
 */
export async function executeAuthoritativeChatTurn(
  body: AuthoritativeChatBody,
  opts?: { signal?: AbortSignal },
): Promise<AuthoritativeChatSuccess | AuthoritativeChatAbort> {
  if (!body.session || typeof body.session !== "object" || typeof body.session.session_id !== "string") {
    throw new SessionAuthorityError("invalid_session_request", "v4 session required: send { session: POJUSessionState }");
  }

  const sessionId = body.session.session_id;
  const record = await requireAuthoritativeSession(sessionId);
  const incoming = extractIncomingUserTurn({
    serverSnapshot: record.session_snapshot,
    clientSession: body.session,
    user_message: body.user_message,
    client_turn_id: body.client_turn_id,
  });
  if (incoming != null && "idempotent" in incoming && incoming.idempotent) {
    return {
      ok: true,
      idempotent: true,
      llm: llmFromCommittedSession(record.session_snapshot),
      session: record.session_snapshot,
      envelope: toAuthoritativeEnvelope(record),
      aborted: false,
    };
  }
  const expectedRevision = requestedRevision(body);
  await assertRecordAllowsIntake(record, expectedRevision, Date.now());
  throwIfAborted(opts?.signal);

  if (!incoming || "idempotent" in incoming) {
    throw new SessionAuthorityError(
      "session_turn_missing",
      "a user turn bound to the current session is required",
      { session_id: sessionId, current_revision: record.revision },
    );
  }

  // Ledger may be ahead of Session Authority after an aborted/conflicted prior
  // turn. Adopt the durable head into the working snapshot before binding.
  const catchup = await adoptLedgerHeadIntoSessionIfAhead(record.session_snapshot);
  const serverSnapshotForTurn = catchup.session;
  const boundSession = bindAuthoritativeChatSession(
    { ...record, session_snapshot: serverSnapshotForTurn },
    incoming,
    body.session,
  );
  const profileInputs = resolveAuthoritativeChatProfileInputs({
    serverSnapshot: serverSnapshotForTurn,
    profile: body.profile,
    userProfile: body.userProfile,
    base_analysis: body.base_analysis,
    claimed_stored_profile_id: body.claimed_stored_profile_id,
  });
  noteAuthoritativeModelInputs({
    profile: profileInputs.profile,
    base_analysis: profileInputs.base_analysis,
    claimed_stored_profile_id: profileInputs.claimed_stored_profile_id,
    session_selected_stored_profile_id:
      serverSnapshotForTurn.selected_stored_profile_id?.trim() ||
      serverSnapshotForTurn.agent_v2?.selected_profile_id?.trim() ||
      null,
  });

  const {
    runWithClarificationClaimRequestScope,
    clearClarificationClaimsReservedThisRequest,
    listClarificationClaimsReservedThisRequest,
    releaseClarificationClaimCas,
    isDefiniteClarificationReleaseFailure,
  } = await import("@/lib/poju/decision-intake/clarification-claim-cas");

  const releaseReservedClaimsIfDefinite = async (
    working: POJUSessionState | undefined,
    cause: unknown,
  ): Promise<void> => {
    if (!isDefiniteClarificationReleaseFailure(cause) && cause !== "aborted") {
      return;
    }
    const planIds = listClarificationClaimsReservedThisRequest();
    if (!planIds.length) return;
    const now = new Date().toISOString();
    const base: POJUSessionState = working ?? {
      ...boundSession,
      session_id: sessionId,
    };
    for (const plan_id of planIds) {
      try {
        await releaseClarificationClaimCas({
          session: { ...base, session_id: sessionId },
          plan_id,
          now,
        });
      } catch (releaseError) {
        console.warn("[poju/chat] clarification claim durable release failed", {
          sessionId,
          plan_id,
          error:
            releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
    }
  };

  return runWithClarificationClaimRequestScope(async () => {
    const capture: { current?: POJULLMResponse } = {};
    let sessionOut: POJUSessionState | undefined;
    // Captured before leaving the ALS frame — memory bumps must not become CAS expected.
    let authoritativeExpectedRevision = record.revision;
    try {
      // Anchor starts at the turn-start Authority revision. Memory persist may
      // bump working session_revision; only a real server CAS (e.g. clarification
      // reserve) advances this anchor via noteAuthoritativeSessionCasRevision.
      sessionOut = await runWithAuthoritativeRevisionAnchor(record.revision, async () => {
        const out = await runWithInProcessDecisionAuthority(() =>
          runWithMemorySessionPersist(boundSession, () =>
            runWithLlmCapture(capture, () =>
              handleUserMessage({
                session: boundSession,
                userMessage: incoming.content,
                locale: String(body.locale ?? "en"),
                userAlreadyAppended: true,
                signal: opts?.signal,
                attachment: body.attachment ?? null,
                server_invoke: {
                  base_analysis: profileInputs.base_analysis,
                  profile: profileInputs.profile,
                },
                __testOnlyM1Hooks: getAuthoritativeChatTestHooks(),
              }),
            ),
          ),
        );
        authoritativeExpectedRevision =
          getAuthoritativeRevisionAnchor() ?? record.revision;
        return out;
      });
    } catch (error) {
      if (isAbortError(error) || opts?.signal?.aborted) {
        await releaseReservedClaimsIfDefinite(sessionOut, "aborted");
        return { ok: false, aborted: true, reason: "aborted" };
      }
      if (isDefiniteClarificationReleaseFailure(error)) {
        await releaseReservedClaimsIfDefinite(sessionOut, error);
      }
      throw error;
    }

    try {
      throwIfAborted(opts?.signal);
    } catch (error) {
      await releaseReservedClaimsIfDefinite(sessionOut, "aborted");
      return { ok: false, aborted: true, reason: "aborted" };
    }

    // Display title for a first real user turn must be CAS-committed — never
    // invented only in the browser after a successful authoritative response.
    sessionOut = applyAuthoritativeFirstTurnDisplayTitle(sessionOut, incoming.content);

    // Understanding / adaptive models already ran above. If Redis CAS times out,
    // retry ONLY the commit — never re-run the model (that was the user-visible
    // failure mode: OpenRouter had a valid JSON, the page still showed 连接异常).
    //
    // Final CAS expectedRevision is the authoritative anchor (turn-start revision,
    // or the head after a successful clarification reservation CAS) — never the
    // working_session_revision produced by request-scoped memory persist.
    const commitExpectedRevision = (): number => authoritativeExpectedRevision;
    const COMMIT_ATTEMPTS = 3;
    let committed: Awaited<ReturnType<typeof commitAuthoritativeSessionUpdate>> | null =
      null;
    let lastCommitError: unknown = null;
    for (let attempt = 1; attempt <= COMMIT_ATTEMPTS; attempt += 1) {
      try {
        throwIfAborted(opts?.signal);
      } catch {
        await releaseReservedClaimsIfDefinite(sessionOut, "aborted");
        return { ok: false, aborted: true, reason: "aborted" };
      }
      const expectedRevision = commitExpectedRevision();
      try {
        const { finalizeClarificationClaimsForDurableCommit } = await import(
          "@/lib/poju/decision-intake/adaptive-turn"
        );
        sessionOut = finalizeClarificationClaimsForDurableCommit(
          sessionOut,
          new Date().toISOString(),
        );
        const commitHook = getAuthoritativeCommitTestHook();
        if (commitHook) {
          await commitHook({
            sessionId,
            expectedRevision,
            session: sessionOut,
          });
        }
        throwIfAborted(opts?.signal);
        committed = await commitAuthoritativeSessionUpdate({
          sessionId,
          expectedRevision,
          expectedGeneration: record.session_generation,
          snapshot: sessionOut,
          last_committed_turn_id: incoming.client_turn_id,
        });
        lastCommitError = null;
        break;
      } catch (error) {
        lastCommitError = error;
        if (isAbortError(error) || opts?.signal?.aborted) {
          await releaseReservedClaimsIfDefinite(sessionOut, "aborted");
          return { ok: false, aborted: true, reason: "aborted" };
        }
        const timedOut =
          error instanceof SessionAuthorityError &&
          error.code === "server_persistence_unavailable" &&
          /timed out|BUSY|SCRIPT/i.test(error.message);
        if (!timedOut || attempt >= COMMIT_ATTEMPTS) {
          break;
        }
        console.warn(
          `[poju/chat] session CAS timed out after model success — commit-only retry ${attempt}/${COMMIT_ATTEMPTS}`,
          { sessionId, revision: expectedRevision },
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 80 * attempt));
      }
    }
    if (!committed) {
      const err =
        lastCommitError instanceof Error
          ? lastCommitError
          : new SessionAuthorityError(
              "server_persistence_unavailable",
              "session CAS failed after model success",
              { session_id: sessionId, expected_revision: commitExpectedRevision() },
            );
      // Uncertain persistence: keep claim for reconcile. Definite CAS/abort: release.
      if (isDefiniteClarificationReleaseFailure(err)) {
        await releaseReservedClaimsIfDefinite(sessionOut, err);
      }
      throw err;
    }

    clearClarificationClaimsReservedThisRequest();
    const llm = capture.current ?? llmFromCommittedSession(committed.session_snapshot);
    return {
      ok: true,
      idempotent: false,
      llm,
      session: committed.session_snapshot,
      envelope: toAuthoritativeEnvelope(committed),
      aborted: false,
    };
  });
}

function llmFromCommittedSession(session: POJUSessionState): POJULLMResponse {
  const last = [...(session.messages ?? [])].reverse().find((message) => message.role === "assistant");
  return {
    response: last?.content ?? "",
    model: typeof last?.meta?.llm_model === "string" ? last.meta.llm_model : "",
    tokens_used: typeof last?.meta?.tokens_used === "number" ? last.meta.tokens_used : 0,
    user_intent: last?.meta?.user_intent ?? "unclear",
    current_state: last?.meta?.current_state ?? "collecting_context",
    topic_drift_detected: Boolean(last?.meta?.topic_drift_detected),
    context_updates: {},
    contains_delivery: Boolean(last?.meta?.contains_delivery),
  };
}