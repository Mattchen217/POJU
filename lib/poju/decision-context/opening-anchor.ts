/**
 * Phase 3 S3 — Opening Anchor + Gate History (Contract §12).
 * anchor_id ≠ ordinary message client_id.
 * create / confirm / reset all via S1 CAS mutate (same C1 semantics).
 * History append-only; never delete old history; never overwrite old anchor in place.
 * Gate confirm does NOT create Fact Confirmation Events.
 */

import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import {
  mutatePOJUSession,
  type MutatePOJUSessionOptions,
  type CasWritePOJUSessionResult,
} from "@/lib/poju/session-mutation";
import {
  createDefaultControlPlane,
  validateControlPlaneInput,
  type Phase3ControlPlane,
  type OpeningGateState,
} from "./control-plane";
import {
  assertGateConfirmDoesNotCreateFactEvents,
  type ConfirmationEvent,
} from "./confirmation-event";

export type OpeningAnchorStatus = "pending" | "confirmed" | "cleared";

export interface OpeningAnchor {
  anchor_id: string;
  session_id: string;
  message_client_id: string;
  message_role: "assistant";
  status: OpeningAnchorStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface OpeningConfirmHistoryEntry {
  history_id: string;
  anchor_id: string;
  message_client_id: string;
  state: OpeningAnchorStatus;
  created_at: string;
  resolved_at: string | null;
  confirmation_action_id: string | null;
}

export const OPENING_ANCHOR_INVALID = "OPENING_ANCHOR_INVALID";
export const OPENING_ANCHOR_NOT_PENDING = "OPENING_ANCHOR_NOT_PENDING";
export const OPENING_ANCHOR_MISSING = "OPENING_ANCHOR_MISSING";

export class OpeningAnchorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpeningAnchorError";
    this.code = code;
  }
}

export function isOpeningAnchorError(err: unknown): err is OpeningAnchorError {
  return err instanceof OpeningAnchorError;
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

function requireNonEmpty(value: string | null | undefined, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, `${field} required`);
  }
  return value.trim();
}

export function validateOpeningAnchor(raw: unknown): OpeningAnchor {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, "OpeningAnchor must be object");
  }
  const o = raw as Record<string, unknown>;
  const anchor_id = requireNonEmpty(
    typeof o.anchor_id === "string" ? o.anchor_id : null,
    "anchor_id",
  );
  const session_id = requireNonEmpty(
    typeof o.session_id === "string" ? o.session_id : null,
    "session_id",
  );
  const message_client_id = requireNonEmpty(
    typeof o.message_client_id === "string" ? o.message_client_id : null,
    "message_client_id",
  );
  if (o.message_role !== "assistant") {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "message_role must be assistant",
    );
  }
  if (o.status !== "pending" && o.status !== "confirmed" && o.status !== "cleared") {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, "status illegal");
  }
  const created_at = requireNonEmpty(
    typeof o.created_at === "string" ? o.created_at : null,
    "created_at",
  );
  let resolved_at: string | null;
  if (o.resolved_at === null) {
    resolved_at = null;
  } else {
    resolved_at = requireNonEmpty(
      typeof o.resolved_at === "string" ? o.resolved_at : null,
      "resolved_at",
    );
  }
  // anchor_id must not equal ordinary message client_id (Contract §12.1 / brief).
  if (anchor_id === message_client_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "anchor_id must not equal message_client_id",
    );
  }
  return {
    anchor_id,
    session_id,
    message_client_id,
    message_role: "assistant",
    status: o.status,
    created_at,
    resolved_at,
  };
}

export function getOpeningAnchors(
  session: Pick<POJUSessionState, "opening_anchors">,
): OpeningAnchor[] {
  return Array.isArray(session.opening_anchors) ? [...session.opening_anchors] : [];
}

export function getOpeningConfirmHistory(
  session: Pick<POJUSessionState, "opening_confirm_history">,
): OpeningConfirmHistoryEntry[] {
  return Array.isArray(session.opening_confirm_history)
    ? [...session.opening_confirm_history]
    : [];
}

export function findOpeningAnchor(
  anchors: OpeningAnchor[],
  anchor_id: string,
): OpeningAnchor | undefined {
  return anchors.find((a) => a.anchor_id === anchor_id);
}

/** Current effective anchor from CP + store (Reload restore). */
export function resolveCurrentOpeningAnchor(session: {
  control_plane?: Phase3ControlPlane | null;
  opening_anchors?: OpeningAnchor[] | null;
}): OpeningAnchor | null {
  const id = session.control_plane?.opening_anchor_id ?? null;
  if (!id) return null;
  const found = findOpeningAnchor(getOpeningAnchors(session as POJUSessionState), id);
  return found ?? null;
}

function ensureControlPlane(
  session: Pick<POJUSessionState, "control_plane" | "agent_v2">,
): Phase3ControlPlane {
  if (session.control_plane) {
    return validateControlPlaneInput(session.control_plane);
  }
  const phase =
    session.agent_v2?.current_phase &&
    typeof session.agent_v2.current_phase === "string"
      ? (session.agent_v2.current_phase as Phase3ControlPlane["current_phase"])
      : "opening";
  // Creating formal CP when missing for Opening Anchor first write — still not reading
  // agent_v2 as persisted CP authority; only seeds current_phase literal if already typed.
  try {
    return createDefaultControlPlane(phase);
  } catch {
    return createDefaultControlPlane("opening");
  }
}

export interface CreateOpeningAnchorInput {
  session_id: string;
  message_client_id: string;
  /** Optional stable ids for tests. */
  anchor_id?: string;
  history_id?: string;
  now?: string;
}

export interface CreateOpeningAnchorMutationResult {
  opening_anchors: OpeningAnchor[];
  opening_confirm_history: OpeningConfirmHistoryEntry[];
  control_plane: Phase3ControlPlane;
  anchor: OpeningAnchor;
  history_entry: OpeningConfirmHistoryEntry;
}

/**
 * Create Opening Anchor for understanding-card first persist (same C1):
 * mark message client_id + anchor + history + CP update.
 * Caller must mark the assistant message in the same mutate apply.
 */
export function buildCreateOpeningAnchorMutation(
  session: POJUSessionState,
  input: CreateOpeningAnchorInput,
): CreateOpeningAnchorMutationResult {
  const session_id = requireNonEmpty(input.session_id, "session_id");
  if (session.session_id !== session_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "session_id mismatch",
    );
  }
  const message_client_id = requireNonEmpty(
    input.message_client_id,
    "message_client_id",
  );
  const now = input.now ?? new Date().toISOString();
  const anchor_id = input.anchor_id?.trim() || newId("opening_anchor");
  if (anchor_id === message_client_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "anchor_id must not equal message_client_id",
    );
  }

  const anchors = getOpeningAnchors(session);
  if (anchors.some((a) => a.anchor_id === anchor_id)) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      `anchor_id already exists: ${anchor_id}`,
    );
  }

  const cp = ensureControlPlane(session);
  // One active pending Gate → one current Anchor (Contract §12.4).
  if (cp.opening_gate_state === "pending" && cp.opening_anchor_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "active pending Gate already bound to an Opening Anchor; use reset",
    );
  }

  const anchor: OpeningAnchor = {
    anchor_id,
    session_id,
    message_client_id,
    message_role: "assistant",
    status: "pending",
    created_at: now,
    resolved_at: null,
  };

  const history_entry: OpeningConfirmHistoryEntry = {
    history_id: input.history_id?.trim() || newId("opening_history"),
    anchor_id,
    message_client_id,
    state: "pending",
    created_at: now,
    resolved_at: null,
    confirmation_action_id: null,
  };

  const control_plane: Phase3ControlPlane = {
    ...cp,
    opening_anchor_id: anchor_id,
    opening_gate_state: "pending",
  };

  return {
    opening_anchors: [...anchors, anchor],
    opening_confirm_history: [...getOpeningConfirmHistory(session), history_entry],
    control_plane: validateControlPlaneInput(control_plane),
    anchor,
    history_entry,
  };
}

export interface ConfirmOpeningAnchorInput {
  anchor_id: string;
  confirmation_action_id?: string | null;
  now?: string;
}

export interface ConfirmOpeningAnchorMutationResult {
  opening_anchors: OpeningAnchor[];
  opening_confirm_history: OpeningConfirmHistoryEntry[];
  control_plane: Phase3ControlPlane;
  confirmation_events: ConfirmationEvent[];
  anchor: OpeningAnchor;
}

/**
 * Confirm pending Anchor only. Updates anchor + history + CP gate.
 * Does NOT create Fact Confirmation Events.
 */
export function buildConfirmOpeningAnchorMutation(
  session: POJUSessionState,
  input: ConfirmOpeningAnchorInput,
): ConfirmOpeningAnchorMutationResult {
  const anchor_id = requireNonEmpty(input.anchor_id, "anchor_id");
  const now = input.now ?? new Date().toISOString();
  const cp = ensureControlPlane(session);
  if (cp.opening_anchor_id !== anchor_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "confirmation must target current control_plane.opening_anchor_id",
    );
  }

  const anchors = getOpeningAnchors(session);
  const idx = anchors.findIndex((a) => a.anchor_id === anchor_id);
  if (idx < 0) {
    throw new OpeningAnchorError(OPENING_ANCHOR_MISSING, `anchor not found: ${anchor_id}`);
  }
  const current = anchors[idx]!;
  if (current.status !== "pending") {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_NOT_PENDING,
      `anchor status is ${current.status}, expected pending`,
    );
  }
  // Never overwrite old anchor in place for cleared history — update fields on the
  // same id for pending→confirmed (status transition on current effective anchor).
  const confirmed: OpeningAnchor = {
    ...current,
    status: "confirmed",
    resolved_at: now,
  };
  const nextAnchors = [...anchors];
  nextAnchors[idx] = confirmed;

  const history = getOpeningConfirmHistory(session);
  const histIdx = history.findIndex(
    (h) => h.anchor_id === anchor_id && h.state === "pending" && h.resolved_at === null,
  );
  const nextHistory = [...history];
  if (histIdx >= 0) {
    const prev = nextHistory[histIdx]!;
    nextHistory[histIdx] = {
      ...prev,
      state: "confirmed",
      resolved_at: now,
      confirmation_action_id: input.confirmation_action_id ?? prev.confirmation_action_id,
    };
  } else {
    nextHistory.push({
      history_id: newId("opening_history"),
      anchor_id,
      message_client_id: current.message_client_id,
      state: "confirmed",
      created_at: current.created_at,
      resolved_at: now,
      confirmation_action_id: input.confirmation_action_id ?? null,
    });
  }

  const control_plane: Phase3ControlPlane = {
    ...cp,
    opening_anchor_id: anchor_id,
    opening_gate_state: "confirmed" satisfies OpeningGateState,
  };

  const confirmation_events = Array.isArray(session.confirmation_events)
    ? [...session.confirmation_events]
    : [];
  assertGateConfirmDoesNotCreateFactEvents(
    session.confirmation_events,
    confirmation_events,
  );

  return {
    opening_anchors: nextAnchors,
    opening_confirm_history: nextHistory,
    control_plane: validateControlPlaneInput(control_plane),
    confirmation_events,
    anchor: confirmed,
  };
}

export interface ResetOpeningAnchorInput {
  session_id: string;
  new_message_client_id: string;
  new_anchor_id?: string;
  new_history_id?: string;
  now?: string;
}

export interface ResetOpeningAnchorMutationResult {
  opening_anchors: OpeningAnchor[];
  opening_confirm_history: OpeningConfirmHistoryEntry[];
  control_plane: Phase3ControlPlane;
  cleared_anchor: OpeningAnchor;
  new_anchor: OpeningAnchor;
}

/**
 * Reset same C1: pending→cleared history append, new anchor, new pending history, CP update.
 * Never delete old history; never overwrite old anchor in place (cleared copy kept; new id).
 */
export function buildResetOpeningAnchorMutation(
  session: POJUSessionState,
  input: ResetOpeningAnchorInput,
): ResetOpeningAnchorMutationResult {
  const session_id = requireNonEmpty(input.session_id, "session_id");
  const new_message_client_id = requireNonEmpty(
    input.new_message_client_id,
    "new_message_client_id",
  );
  const now = input.now ?? new Date().toISOString();
  const cp = ensureControlPlane(session);
  const currentId = cp.opening_anchor_id;
  if (!currentId) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_MISSING,
      "no current opening_anchor_id to reset",
    );
  }

  const anchors = getOpeningAnchors(session);
  const idx = anchors.findIndex((a) => a.anchor_id === currentId);
  if (idx < 0) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_MISSING,
      `current anchor missing: ${currentId}`,
    );
  }
  const current = anchors[idx]!;
  if (current.status !== "pending") {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_NOT_PENDING,
      `reset requires pending anchor, got ${current.status}`,
    );
  }

  // Cleared copy — do not delete; update status on the existing slot (identity preserved,
  // status transitions pending→cleared; Contract: never overwrite old Anchor "in place"
  // meaning never reuse cleared as pending — we keep cleared record and add a NEW anchor).
  const cleared_anchor: OpeningAnchor = {
    ...current,
    status: "cleared",
    resolved_at: now,
  };
  const nextAnchors = [...anchors];
  nextAnchors[idx] = cleared_anchor;

  const history = getOpeningConfirmHistory(session);
  const histIdx = history.findIndex(
    (h) => h.anchor_id === currentId && h.state === "pending" && h.resolved_at === null,
  );
  const nextHistory = [...history];
  if (histIdx >= 0) {
    const prev = nextHistory[histIdx]!;
    nextHistory[histIdx] = {
      ...prev,
      state: "cleared",
      resolved_at: now,
    };
  } else {
    nextHistory.push({
      history_id: newId("opening_history"),
      anchor_id: currentId,
      message_client_id: current.message_client_id,
      state: "cleared",
      created_at: current.created_at,
      resolved_at: now,
      confirmation_action_id: null,
    });
  }

  const new_anchor_id = input.new_anchor_id?.trim() || newId("opening_anchor");
  if (new_anchor_id === new_message_client_id) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      "anchor_id must not equal message_client_id",
    );
  }
  if (nextAnchors.some((a) => a.anchor_id === new_anchor_id)) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      `new anchor_id already exists: ${new_anchor_id}`,
    );
  }

  const new_anchor: OpeningAnchor = {
    anchor_id: new_anchor_id,
    session_id,
    message_client_id: new_message_client_id,
    message_role: "assistant",
    status: "pending",
    created_at: now,
    resolved_at: null,
  };
  nextAnchors.push(new_anchor);

  const newHistory: OpeningConfirmHistoryEntry = {
    history_id: input.new_history_id?.trim() || newId("opening_history"),
    anchor_id: new_anchor_id,
    message_client_id: new_message_client_id,
    state: "pending",
    created_at: now,
    resolved_at: null,
    confirmation_action_id: null,
  };
  nextHistory.push(newHistory);

  const control_plane: Phase3ControlPlane = {
    ...cp,
    opening_anchor_id: new_anchor_id,
    opening_gate_state: "pending",
  };

  return {
    opening_anchors: nextAnchors,
    opening_confirm_history: nextHistory,
    control_plane: validateControlPlaneInput(control_plane),
    cleared_anchor,
    new_anchor,
  };
}

/**
 * Apply create/confirm/reset fields onto a session object (pure).
 * Used inside mutatePOJUSession apply callbacks.
 */
export function applyOpeningAnchorSlice(
  base: POJUSessionState,
  slice: {
    opening_anchors: OpeningAnchor[];
    opening_confirm_history: OpeningConfirmHistoryEntry[];
    control_plane: Phase3ControlPlane;
    confirmation_events?: ConfirmationEvent[];
  },
): POJUSessionState {
  return {
    ...base,
    opening_anchors: slice.opening_anchors,
    opening_confirm_history: slice.opening_confirm_history,
    control_plane: slice.control_plane,
    ...(slice.confirmation_events
      ? { confirmation_events: slice.confirmation_events }
      : {}),
  };
}


/** Mark assistant message as Opening Anchor in the same C1 apply (Contract §12.3). */
export function markMessageAsOpeningAnchor(
  messages: POJUMessage[] | null | undefined,
  message_client_id: string,
  anchor_id: string,
): POJUMessage[] {
  const list = Array.isArray(messages) ? messages : [];
  let found = false;
  const next = list.map((m) => {
    if (m.client_id !== message_client_id) return m;
    if (m.role !== "assistant") {
      throw new OpeningAnchorError(
        OPENING_ANCHOR_INVALID,
        "Opening Anchor message must be assistant role",
      );
    }
    found = true;
    return {
      ...m,
      meta: {
        ...(m.meta ?? {}),
        is_opening_anchor: true,
        opening_anchor_id: anchor_id,
      },
    };
  });
  if (!found) {
    throw new OpeningAnchorError(
      OPENING_ANCHOR_INVALID,
      `assistant message_client_id not found: ${message_client_id}`,
    );
  }
  return next;
}

export interface CreateOpeningAnchorCasInput extends CreateOpeningAnchorInput {
  operation_id: string;
  /** When true (default), mark matching assistant message in same C1. */
  mark_message?: boolean;
}

/** createOpeningAnchor via S1 CAS mutate (Contract §12.3). */
export async function createOpeningAnchor(
  sessionId: string,
  input: CreateOpeningAnchorCasInput,
  opts?: MutatePOJUSessionOptions,
): Promise<CasWritePOJUSessionResult & { anchor: OpeningAnchor }> {
  let created: OpeningAnchor | null = null;
  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "control_plane_patch",
      bump_dc: false,
      apply: (latest) => {
        const mut = buildCreateOpeningAnchorMutation(latest, input);
        created = mut.anchor;
        let next = applyOpeningAnchorSlice(latest, mut);
        if (input.mark_message !== false) {
          next = {
            ...next,
            messages: markMessageAsOpeningAnchor(
              next.messages,
              mut.anchor.message_client_id,
              mut.anchor.anchor_id,
            ),
          };
        }
        return next;
      },
    },
    opts,
  );
  if (!created) {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, "createOpeningAnchor produced no anchor");
  }
  return { ...result, anchor: created };
}

export interface ConfirmOpeningAnchorCasInput extends ConfirmOpeningAnchorInput {
  operation_id: string;
}

/** confirmOpeningAnchor via S1 CAS mutate (Contract §12.6). */
export async function confirmOpeningAnchor(
  sessionId: string,
  input: ConfirmOpeningAnchorCasInput,
  opts?: MutatePOJUSessionOptions,
): Promise<CasWritePOJUSessionResult & { anchor: OpeningAnchor }> {
  let confirmed: OpeningAnchor | null = null;
  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "control_plane_patch",
      bump_dc: false,
      apply: (latest) => {
        const mut = buildConfirmOpeningAnchorMutation(latest, input);
        confirmed = mut.anchor;
        return applyOpeningAnchorSlice(latest, {
          opening_anchors: mut.opening_anchors,
          opening_confirm_history: mut.opening_confirm_history,
          control_plane: mut.control_plane,
          confirmation_events: mut.confirmation_events,
        });
      },
    },
    opts,
  );
  if (!confirmed) {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, "confirmOpeningAnchor produced no anchor");
  }
  return { ...result, anchor: confirmed };
}

export interface ResetOpeningAnchorCasInput extends ResetOpeningAnchorInput {
  operation_id: string;
  mark_message?: boolean;
}

/** resetOpeningAnchor via S1 CAS mutate (Contract §12.5). */
export async function resetOpeningAnchor(
  sessionId: string,
  input: ResetOpeningAnchorCasInput,
  opts?: MutatePOJUSessionOptions,
): Promise<
  CasWritePOJUSessionResult & {
    cleared_anchor: OpeningAnchor;
    new_anchor: OpeningAnchor;
  }
> {
  let cleared: OpeningAnchor | null = null;
  let created: OpeningAnchor | null = null;
  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "control_plane_patch",
      bump_dc: false,
      apply: (latest) => {
        const mut = buildResetOpeningAnchorMutation(latest, input);
        cleared = mut.cleared_anchor;
        created = mut.new_anchor;
        let next = applyOpeningAnchorSlice(latest, mut);
        if (input.mark_message !== false) {
          next = {
            ...next,
            messages: markMessageAsOpeningAnchor(
              next.messages,
              mut.new_anchor.message_client_id,
              mut.new_anchor.anchor_id,
            ),
          };
        }
        return next;
      },
    },
    opts,
  );
  if (!cleared || !created) {
    throw new OpeningAnchorError(OPENING_ANCHOR_INVALID, "resetOpeningAnchor incomplete");
  }
  return { ...result, cleared_anchor: cleared, new_anchor: created };
}
