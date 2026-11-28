/**
 * Unit A — Local-First pre-report privacy boundary.
 *
 * Before the user explicitly starts report generation, the server may keep only an
 * orchestration shell (revision, lifecycle, turn binding, association pointers).
 * Chat text, Decision Context bodies, and interaction history stay on the original
 * browser. Report-start remains the first durable cloud write of private DC /
 * Freeze / Profile authority material.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type { ServerSessionRecord } from "@/lib/poju/session-authority/types";

/** Durable server Session records never store full private conversation content. */
export const SERVER_SESSION_CONTENT_POLICY = "local_private" as const;

export type ServerSessionContentPolicy = typeof SERVER_SESSION_CONTENT_POLICY | "legacy_full";

/**
 * Unit A: session-mutation must not append DC ledger entries during ordinary
 * Intake writes. Freeze / report-start call syncDcLedgerBeforeWrite directly.
 */
export const PRE_REPORT_DC_LEDGER_DEFERRED = true;

const EMPTY_ABUSE = {
  long_input_count: 0,
  jailbreak_attempts: 0,
  duplicate_attempts: 0,
};

/**
 * Strip private Intake content from a Session snapshot before durable server write.
 * Keeps structural / entitlement / lifecycle fields required for CAS and Intake gates.
 */
export function redactSessionSnapshotForServerDurable(
  snapshot: POJUSessionState,
): POJUSessionState {
  const storedId =
    typeof snapshot.selected_stored_profile_id === "string" &&
    snapshot.selected_stored_profile_id.trim().length > 0
      ? snapshot.selected_stored_profile_id.trim()
      : null;

  return {
    session_id: snapshot.session_id,
    session_revision: snapshot.session_revision,
    dc_write_revision: snapshot.dc_write_revision,
    device_id: snapshot.device_id,
    // Question text is private; durable shell keeps only the empty placeholder.
    original_question: "",
    cycles: [],
    active_cycle_id: snapshot.active_cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: snapshot.has_profile === true,
    birth_submitted_in_session: snapshot.birth_submitted_in_session === true,
    profile_skipped: snapshot.profile_skipped === true,
    selected_stored_profile_id: storedId,
    dyad_offer_status: "none",
    partner_profile_id: null,
    dyad_compat_summary: null,
    pivot_chart_path: null,
    charts_locked_at: null,
    dyad_matrix_pack: null,
    actions: [],
    main_delivery_done: snapshot.main_delivery_done === true,
    main_delivery: null,
    tokens_used: typeof snapshot.tokens_used === "number" ? snapshot.tokens_used : 0,
    abuse_metrics: snapshot.abuse_metrics ?? EMPTY_ABUSE,
    created_at: snapshot.created_at,
    last_interaction_at: snapshot.last_interaction_at,
    expires_at: snapshot.expires_at,
    unlock_status: snapshot.unlock_status,
    unlock_via: snapshot.unlock_via,
    pending_decision_report_job_id: snapshot.pending_decision_report_job_id ?? null,
    // Association mirrors only — never full DC / receipts payloads.
    dc_ledger: snapshot.dc_ledger?.head
      ? {
          schema_version: snapshot.dc_ledger.schema_version,
          writer_token: "",
          head: {
            ...snapshot.dc_ledger.head,
            // Head ref is non-content metadata used for intake/report gates.
          },
          synced_at: snapshot.dc_ledger.synced_at,
        }
      : null,
    dc_freeze_receipts: [],
    dc_profile_receipts: [],
    decision_context: null,
    decision_context_versions: [],
    decision_blueprint: null,
    agent_v2: undefined,
    situation_analysis_by_fingerprint: undefined,
    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
    confirmation_events: [],
    opening_anchors: [],
    opening_confirm_history: [],
    na_declaration_actions: [],
    topic_applicability_evals: [],
  };
}

export function isServerSessionContentShell(snapshot: POJUSessionState | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== "object") return true;
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  if (messages.length > 0) return false;
  if (snapshot.decision_context != null) return false;
  if (snapshot.decision_blueprint != null) return false;
  if (Array.isArray(snapshot.decision_context_versions) && snapshot.decision_context_versions.length > 0) {
    return false;
  }
  if (typeof snapshot.original_question === "string" && snapshot.original_question.trim().length > 0) {
    return false;
  }
  return true;
}

export function sessionHasLocalPrivateContent(session: POJUSessionState | null | undefined): boolean {
  if (!session || typeof session !== "object") return false;
  return !isServerSessionContentShell(session);
}

/** Server-owned fields that always win over a client-submitted Session body. */
export function applyServerOwnedSessionFields(
  content: POJUSessionState,
  record: Pick<
    ServerSessionRecord,
    "session_id" | "expires_at" | "created_at" | "revision" | "session_generation"
  >,
): POJUSessionState {
  return {
    ...content,
    session_id: record.session_id,
    expires_at: record.expires_at,
    created_at: content.created_at || record.created_at,
    session_revision: record.revision,
  };
}

/**
 * Build the in-memory working Session for a chat turn.
 * Private conversation content comes from the original browser; the server shell
 * supplies revision / expiry / unlock merge only.
 */
export function resolveWorkingSessionForChat(input: {
  serverSnapshot: POJUSessionState;
  clientSession?: POJUSessionState | null;
  record: Pick<
    ServerSessionRecord,
    "session_id" | "expires_at" | "created_at" | "revision" | "session_generation"
  >;
}): POJUSessionState {
  const client = input.clientSession;
  if (client && sessionHasLocalPrivateContent(client)) {
    return applyServerOwnedSessionFields(client, input.record);
  }
  if (sessionHasLocalPrivateContent(input.serverSnapshot)) {
    return applyServerOwnedSessionFields(input.serverSnapshot, input.record);
  }
  // Fresh session / shell-only: still prefer client seed fields (question, device).
  if (client) {
    return applyServerOwnedSessionFields(
      {
        ...input.serverSnapshot,
        original_question: client.original_question || input.serverSnapshot.original_question,
        device_id: client.device_id || input.serverSnapshot.device_id,
        cycles: client.cycles?.length ? client.cycles : input.serverSnapshot.cycles,
        active_cycle_id: client.active_cycle_id ?? input.serverSnapshot.active_cycle_id,
        selected_stored_profile_id:
          client.selected_stored_profile_id ?? input.serverSnapshot.selected_stored_profile_id,
        unlock_status: client.unlock_status ?? input.serverSnapshot.unlock_status,
        unlock_via: client.unlock_via ?? input.serverSnapshot.unlock_via,
        has_profile: client.has_profile ?? input.serverSnapshot.has_profile,
        messages: Array.isArray(client.messages) ? client.messages : [],
      },
      input.record,
    );
  }
  return applyServerOwnedSessionFields(input.serverSnapshot, input.record);
}
