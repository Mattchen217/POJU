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

function deviceIdForDurableShell(snapshot: POJUSessionState): string {
  const id = typeof snapshot.device_id === "string" ? snapshot.device_id.trim() : "";
  return id.length > 0 ? id : "server";
}

/**
 * Strip private Intake content from a Session snapshot before durable server write.
 * Keeps structural / entitlement / lifecycle fields required for CAS and Intake gates.
 *
 * Association pointers (dc_ledger_head_hash, etc.) live on {@link ServerSessionRecord}
 * only — `dc_ledger` is cleared here so private writer tokens and content hashes are
 * not mirrored into the durable shell via spread.
 */
export function redactSessionSnapshotForServerDurable(
  snapshot: POJUSessionState,
): POJUSessionState {
  return {
    session_id: snapshot.session_id,
    session_revision: snapshot.session_revision,
    dc_write_revision: snapshot.dc_write_revision,
    device_id: deviceIdForDurableShell(snapshot),
    original_question: "",
    cycles: [],
    active_cycle_id: snapshot.active_cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: false,
    birth_submitted_in_session: false,
    profile_skipped: false,
    selected_stored_profile_id: null,
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
    dc_ledger: null,
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

/** True when empty arrays, objects, null, undefined, false, or "". */
export function hasMeaningfulValue(value: unknown): boolean {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return false;
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry));
  }
  return true;
}

function cycleCarriesPrivateContent(cycles: POJUSessionState["cycles"]): boolean {
  if (!Array.isArray(cycles) || cycles.length === 0) return false;
  return cycles.some((cycle) => {
    if (!cycle || typeof cycle !== "object") return false;
    return (
      hasMeaningfulValue(cycle.original_question) ||
      hasMeaningfulValue(cycle.current_summary) ||
      (Array.isArray(cycle.delivered_actions) && cycle.delivered_actions.length > 0)
    );
  });
}

function dcLedgerMirrorIsPrivate(ledger: POJUSessionState["dc_ledger"]): boolean {
  if (!ledger) return false;
  if (hasMeaningfulValue(ledger.writer_token)) return true;
  const head = ledger.head;
  if (!head) return false;
  return (
    hasMeaningfulValue(head.content_hash) ||
    hasMeaningfulValue(head.snapshot_hash) ||
    hasMeaningfulValue(head.blueprint_hash)
  );
}

export function sessionHasLocalPrivateContent(session: POJUSessionState | null | undefined): boolean {
  if (!session || typeof session !== "object") return false;

  if (Array.isArray(session.messages) && session.messages.length > 0) return true;
  if (hasMeaningfulValue(session.original_question)) return true;
  if (hasMeaningfulValue(session.pending_question)) return true;
  if (session.decision_context != null) return true;
  if (session.decision_blueprint != null) return true;
  if (Array.isArray(session.decision_context_versions) && session.decision_context_versions.length > 0) {
    return true;
  }
  if (hasMeaningfulValue(session.context_collected)) return true;
  if (hasMeaningfulValue(session.shared_context)) return true;
  if (session.agent_v2 != null && hasMeaningfulValue(session.agent_v2)) return true;
  if (hasMeaningfulValue(session.situation_analysis_by_fingerprint)) return true;
  if (cycleCarriesPrivateContent(session.cycles)) return true;
  if (session.dyad_compat_summary != null) return true;
  if (session.dyad_matrix_pack != null) return true;
  if (hasMeaningfulValue(session.partner_profile_id)) return true;
  if (session.matrix_payload != null && hasMeaningfulValue(session.matrix_payload)) return true;
  if (session.deliverable_html != null && hasMeaningfulValue(session.deliverable_html)) return true;
  if (Array.isArray(session.personal_analysis_records) && session.personal_analysis_records.length > 0) {
    return true;
  }
  if (Array.isArray(session.freeze_bound_report_jobs) && session.freeze_bound_report_jobs.length > 0) {
    return true;
  }
  if (session.main_delivery != null) return true;
  if (Array.isArray(session.confirmation_events) && session.confirmation_events.length > 0) return true;
  if (Array.isArray(session.na_declaration_actions) && session.na_declaration_actions.length > 0) {
    return true;
  }
  if (Array.isArray(session.opening_anchors) && session.opening_anchors.length > 0) return true;
  if (Array.isArray(session.opening_confirm_history) && session.opening_confirm_history.length > 0) {
    return true;
  }
  if (Array.isArray(session.actions) && session.actions.some((a) => hasMeaningfulValue(a))) return true;
  if (
    typeof session.selected_stored_profile_id === "string" &&
    session.selected_stored_profile_id.trim().length > 0
  ) {
    return true;
  }
  if (session.has_profile === true) return true;
  if (session.birth_submitted_in_session === true) return true;
  if (dcLedgerMirrorIsPrivate(session.dc_ledger)) return true;
  if (Array.isArray(session.dc_freeze_receipts) && session.dc_freeze_receipts.length > 0) return true;
  if (Array.isArray(session.dc_profile_receipts) && session.dc_profile_receipts.length > 0) return true;

  return false;
}

export function isServerSessionContentShell(snapshot: POJUSessionState | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== "object") return true;
  if (sessionHasLocalPrivateContent(snapshot)) return false;

  if (snapshot.has_profile === true) return false;
  if (snapshot.birth_submitted_in_session === true) return false;
  if (
    typeof snapshot.selected_stored_profile_id === "string" &&
    snapshot.selected_stored_profile_id.trim().length > 0
  ) {
    return false;
  }
  if (hasMeaningfulValue(snapshot.partner_profile_id)) return false;
  if (snapshot.dc_ledger != null) {
    if (dcLedgerMirrorIsPrivate(snapshot.dc_ledger)) return false;
    if (snapshot.dc_ledger.head != null) return false;
  }
  if (Array.isArray(snapshot.dc_freeze_receipts) && snapshot.dc_freeze_receipts.length > 0) return false;
  if (Array.isArray(snapshot.dc_profile_receipts) && snapshot.dc_profile_receipts.length > 0) return false;

  return true;
}

export function needsLegacySessionPrivacyMigration(record: ServerSessionRecord): boolean {
  if (record.content_policy !== SERVER_SESSION_CONTENT_POLICY) return true;
  return !isServerSessionContentShell(record.session_snapshot);
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