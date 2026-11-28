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
 * Fields that alone never imply private browser content.
 * Audited against `POJUSessionState` in types.ts (Unit A-R2).
 * Anything else with a meaningful value is treated as private (fail-closed).
 */
export const NON_PRIVATE_SESSION_KEYS = new Set<string>([
  // Identity / CAS mirrors
  "session_id",
  "session_revision",
  "dc_write_revision",
  "device_id",
  // Timestamps / expiry
  "created_at",
  "last_interaction_at",
  "expires_at",
  // Lifecycle / entitlement counters (no conversation bodies)
  "tokens_used",
  "abuse_metrics",
  "main_delivery_done",
  "profile_skipped",
  "unlock_status",
  "unlock_via",
  // Opaque structural pointers without payload bodies
  "active_cycle_id",
  // Catalog / provider locks (not user narrative content)
  "topic_catalog_version",
  "locked_provider",
  "locked_output_locale",
  // Boolean UI defaults that are not user narrative
  "question_briefing_dismissed",
  "joint_decision",
  "understanding_confirm_held_for_dyad",
  // Enum defaults — only non-default values are checked separately as private state
  "dyad_offer_status",
  "partner_bazi",
  "pivot_chart_path",
  "pending_segment2_stage",
  // Intentionally retained on durable shells; not a private-content signal.
  "pending_decision_report_job_id",
]);

/**
 * Local continuity / association pointers: a non-empty value means the original
 * browser holds private session state that a server shell must not wipe.
 * Note: `pending_decision_report_job_id` stays on the durable shell and is
 * merged in decideAuthoritativeMirror — it must NOT appear here, or shells
 * with that pointer would fail `isServerSessionContentShell`.
 */
const PRIVATE_ASSOCIATION_KEYS = [
  "pending_delivery_job_id",
  "pending_synthesis_job_id",
  "pending_segment2_job_id",
  "joint_decision_id",
  "joint_pass_ref",
  "action_plan_archive_id",
  "selected_stored_profile_id",
  "partner_profile_id",
  "charts_locked_at",
] as const;

/**
 * Explicit private content / private interaction-state payloads on POJUSessionState.
 * Audited from types.ts; fail-closed unknown keys cover future additions.
 */
const PRIVATE_CONTENT_KEYS = [
  "original_question",
  "pending_question",
  "messages",
  "context_collected",
  "shared_context",
  "actions",
  "main_delivery",
  "agent_v2",
  "situation_analysis_by_fingerprint",
  "cycles",
  "dyad_compat_summary",
  "dyad_matrix_pack",
  "matrix_payload",
  "deliverable_html",
  "decision_context",
  "decision_context_versions",
  "decision_context_idempotency_keys",
  "decision_blueprint",
  "decision_blueprint_history",
  "blueprint_change_log",
  "decision_understanding",
  "adaptive_ask_plan",
  "pending_answer_resolution",
  "pending_intake_control",
  "intake_ask_plan",
  "intake_answer_sources",
  "intake_protection",
  "last_answer_event",
  "personal_analysis_profile",
  "personal_analysis_records",
  "freeze_bound_report_jobs",
  "last_delivery_context_binding",
  "dc_ledger",
  "dc_freeze_receipts",
  "dc_profile_receipts",
  "generation_task_contexts",
  "generation_registry",
  "generation_operation_bindings",
  "control_plane",
  "confirmation_events",
  "na_declaration_actions",
  "topic_applicability_evals",
  "opening_anchors",
  "opening_confirm_history",
] as const;

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
    // Explicit clears for Unit A-R2 private payloads (omit from durable shell).
    personal_analysis_profile: undefined,
    decision_understanding: null,
    adaptive_ask_plan: null,
    pending_answer_resolution: null,
    pending_intake_control: null,
    intake_ask_plan: null,
    intake_answer_sources: [],
    decision_blueprint_history: [],
    blueprint_change_log: [],
    last_answer_event: null,
    control_plane: undefined,
    intake_protection: undefined,
    pending_delivery_job_id: null,
    pending_synthesis_job_id: null,
    pending_segment2_job_id: null,
    pending_segment2_stage: null,
    joint_decision_id: null,
    joint_pass_ref: null,
    action_plan_archive_id: null,
    personal_analysis_records: [],
    freeze_bound_report_jobs: [],
    last_delivery_context_binding: null,
    decision_context_idempotency_keys: [],
  };
}

/**
 * True when the value carries content that must not be ignored for privacy.
 * Finite numbers (including 0) are meaningful — structural counters/versions
 * must be allowlisted at the Session top level, not silently dropped here.
 */
export function hasMeaningfulValue(value: unknown): boolean {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry));
  }
  return true;
}

function hasMeaningfulString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function definitionHasPrivateContent(definition: unknown): boolean {
  if (definition == null || typeof definition !== "object" || Array.isArray(definition)) return false;
  const d = definition as Record<string, unknown>;
  if (Object.keys(d).length === 0) return false;
  for (const key of ["concrete_event", "stakes", "desired_outcome", "decision_question"] as const) {
    if (hasMeaningfulString(d[key])) return true;
  }
  for (const key of ["goal_priorities", "unacceptable_outcomes"] as const) {
    const arr = d[key];
    if (Array.isArray(arr) && arr.some((entry) => hasMeaningfulString(entry))) return true;
  }
  return false;
}

/**
 * Schema-aware: null / {} / version-only stubs are not private;
 * populated Decision Context narrative or structure is.
 */
export function decisionContextHasPrivateContent(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const dc = value as Record<string, unknown>;
  if (Object.keys(dc).length === 0) return false;
  if (hasMeaningfulString(dc.context_id)) return true;
  if (hasMeaningfulString(dc.content_hash)) return true;
  if (definitionHasPrivateContent(dc.definition)) return true;
  for (const key of [
    "reality_facts",
    "constraints",
    "hypotheses",
    "dirs",
    "conflicts",
    "information_boundaries",
  ] as const) {
    const arr = dc[key];
    if (Array.isArray(arr) && arr.length > 0) return true;
  }
  return false;
}

/**
 * Schema-aware: null / {} / numeric-version-only stubs are not private;
 * ids, question text, definition snapshot, or direction lists are.
 */
export function decisionBlueprintHasPrivateContent(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const bp = value as Record<string, unknown>;
  if (Object.keys(bp).length === 0) return false;
  for (const key of [
    "blueprint_id",
    "session_id",
    "context_id",
    "decision_question",
    "ddr_version",
    "dir_catalog_version",
  ] as const) {
    if (hasMeaningfulString(bp[key])) return true;
  }
  if (definitionHasPrivateContent(bp.definition_snapshot)) return true;
  for (const key of ["directions", "dir_ids", "ddr_ids", "topic_tags", "initial_seed_dir_ids"] as const) {
    const arr = bp[key];
    if (Array.isArray(arr) && arr.length > 0) return true;
  }
  return false;
}

/**
 * Schema-aware: null / {} / blank-string stubs are not private;
 * any non-empty delivery field is.
 */
export function mainDeliveryHasPrivateContent(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  if (Object.keys(d).length === 0) return false;
  for (const key of ["delivered_at", "language", "full_text"] as const) {
    if (hasMeaningfulString(d[key])) return true;
  }
  return false;
}

function cycleCarriesPrivateContent(cycles: POJUSessionState["cycles"]): boolean {
  if (!Array.isArray(cycles) || cycles.length === 0) return false;
  return cycles.some((cycle) => {
    if (!cycle || typeof cycle !== "object") return false;
    return (
      hasMeaningfulValue(cycle.original_question) ||
      hasMeaningfulValue(cycle.current_summary) ||
      (Array.isArray(cycle.delivered_actions) && cycle.delivered_actions.length > 0) ||
      (Array.isArray(cycle.tool_suggestions) && cycle.tool_suggestions.length > 0)
    );
  });
}

function dcLedgerMirrorIsPrivate(ledger: POJUSessionState["dc_ledger"]): boolean {
  if (!ledger) return false;
  if (hasMeaningfulValue(ledger.writer_token)) return true;
  if (ledger.head != null) return true;
  return false;
}

function nonDefaultEnumPrivate(session: POJUSessionState): boolean {
  if (session.dyad_offer_status != null && session.dyad_offer_status !== "none") return true;
  if (session.partner_bazi != null) return true;
  if (session.pivot_chart_path != null) return true;
  if (session.pending_segment2_stage != null) return true;
  if (session.understanding_confirm_held_for_dyad === true) return true;
  if (session.joint_decision === true) return true;
  return false;
}

function privateContentKeyHasValue(session: POJUSessionState, key: string): boolean {
  const value = (session as Record<string, unknown>)[key];
  if (key === "cycles") return cycleCarriesPrivateContent(session.cycles);
  if (key === "dc_ledger") return dcLedgerMirrorIsPrivate(session.dc_ledger);
  if (key === "messages") return Array.isArray(session.messages) && session.messages.length > 0;
  if (value === undefined || value === null) return false;
  if (key === "decision_context") return decisionContextHasPrivateContent(value);
  if (key === "decision_blueprint") return decisionBlueprintHasPrivateContent(value);
  if (key === "main_delivery") return mainDeliveryHasPrivateContent(value);
  if (
    key === "dyad_compat_summary" ||
    key === "dyad_matrix_pack" ||
    key === "personal_analysis_profile" ||
    key === "control_plane" ||
    key === "intake_protection" ||
    key === "last_delivery_context_binding"
  ) {
    return value != null && hasMeaningfulValue(value);
  }
  return hasMeaningfulValue(value);
}

/**
 * Conservative local-private predicate for Unit A mirror protection.
 * Classification authority: complete {@link POJUSessionState} in types.ts.
 */
export function sessionHasLocalPrivateContent(session: POJUSessionState | null | undefined): boolean {
  if (!session || typeof session !== "object") return false;

  if (session.has_profile === true) return true;
  if (session.birth_submitted_in_session === true) return true;
  if (nonDefaultEnumPrivate(session)) return true;

  for (const key of PRIVATE_ASSOCIATION_KEYS) {
    if (hasMeaningfulValue((session as Record<string, unknown>)[key])) return true;
  }

  for (const key of PRIVATE_CONTENT_KEYS) {
    if (privateContentKeyHasValue(session, key)) return true;
  }

  // Fail-closed: any own key outside the non-private allowlist with meaningful
  // value is treated as private (covers future POJUSessionState fields).
  for (const key of Object.keys(session)) {
    if (NON_PRIVATE_SESSION_KEYS.has(key)) continue;
    if ((PRIVATE_CONTENT_KEYS as readonly string[]).includes(key)) continue;
    if ((PRIVATE_ASSOCIATION_KEYS as readonly string[]).includes(key)) continue;
    // Booleans already handled above when true; skip false/defaults.
    if (key === "has_profile" || key === "birth_submitted_in_session") continue;
    const value = (session as Record<string, unknown>)[key];
    if (hasMeaningfulValue(value)) return true;
  }

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
  if (snapshot.dc_ledger != null) return false;
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
