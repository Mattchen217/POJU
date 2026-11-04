/**
 * Phase 3 S3 — Formal ControlPlane (Contract §10).
 * Authority: session.control_plane only.
 * agent_v2 may mirror FROM CP for UI; never overwrite CP from agent_v2.
 * Ban Record<string, unknown> as formal structure.
 */

import type { AgentPhase } from "@/lib/poju/agent-state";
import type {
  AgendaFrameKind,
  AgendaItem,
  AgendaItemStatus,
  AgendaRole,
} from "@/lib/poju/investigation-agenda";

export const UNKNOWN_CONTROL_PLANE_FIELD = "UNKNOWN_CONTROL_PLANE_FIELD";
export const INVALID_CONTROL_PLANE_FIELD = "INVALID_CONTROL_PLANE_FIELD";

export type OpeningGateState = "not_created" | "pending" | "confirmed" | "cleared";

export const AGENT_PHASE_LITERALS: readonly AgentPhase[] = [
  "opening",
  "awaiting_understanding_confirm",
  "collecting_context",
  "awaiting_confirmation",
  "delivered",
  "tracking",
] as const;

export const OPENING_GATE_STATES: readonly OpeningGateState[] = [
  "not_created",
  "pending",
  "confirmed",
  "cleared",
] as const;

export const AGENDA_ITEM_STATUSES: readonly AgendaItemStatus[] = [
  "unexplored",
  "partial",
  "covered",
] as const;

export const AGENDA_FRAME_KINDS: readonly AgendaFrameKind[] = [
  "key_crossroads",
  "modern_action",
  "energy_retune",
] as const;

export const AGENDA_ROLES: readonly AgendaRole[] = [
  "fill",
  "calibrate",
  "personalize",
] as const;

/** Contract §10.2 — formal ControlPlane. No Record<string, unknown>. */
export interface Phase3ControlPlane {
  current_phase: AgentPhase;
  investigation_agenda: AgendaItem[];
  active_agenda_item_id: string | null;
  opening_anchor_id: string | null;
  opening_gate_state: OpeningGateState;
  last_call_a_fingerprint: string | null;
  last_call_a_fingerprint_version: string | null;
  last_call_b_fingerprint: string | null;
  last_call_b_fingerprint_version: string | null;
}

/** Exact whitelist of top-level formal CP keys (Contract §10.3). */
export const CONTROL_PLANE_FIELD_WHITELIST = [
  "current_phase",
  "investigation_agenda",
  "active_agenda_item_id",
  "opening_anchor_id",
  "opening_gate_state",
  "last_call_a_fingerprint",
  "last_call_a_fingerprint_version",
  "last_call_b_fingerprint",
  "last_call_b_fingerprint_version",
] as const;

export type ControlPlaneFieldName = (typeof CONTROL_PLANE_FIELD_WHITELIST)[number];

/** AgendaItem optional keys legal on formal CP agenda entries. */
export const AGENDA_ITEM_OPTIONAL_WHITELIST = [
  "frame_kind",
  "frame_index",
  "supports",
  "captured_answer",
  "serves_page",
  "serves_path",
  "role",
  "collection_goal",
  "stale_turns",
  "unqualified_streak",
] as const;

export class ControlPlaneError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "ControlPlaneError";
    this.code = code;
    this.field = field;
  }
}

export function isControlPlaneError(err: unknown): err is ControlPlaneError {
  return err instanceof ControlPlaneError;
}

export function createDefaultControlPlane(
  phase: AgentPhase = "opening",
): Phase3ControlPlane {
  return {
    current_phase: phase,
    investigation_agenda: [],
    active_agenda_item_id: null,
    opening_anchor_id: null,
    opening_gate_state: "not_created",
    last_call_a_fingerprint: null,
    last_call_a_fingerprint_version: null,
    last_call_b_fingerprint: null,
    last_call_b_fingerprint_version: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new ControlPlaneError(
    INVALID_CONTROL_PLANE_FIELD,
    `ControlPlane field ${field} must be string | null`,
    field,
  );
}

/**
 * Runtime AgendaItem validation for formal CP.
 * Unknown fields must NOT spread into formal CP.
 */
export function validateAgendaItemForControlPlane(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
): AgendaItem {
  if (!isPlainObject(raw)) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `investigation_agenda[${index}] must be an object`,
      "investigation_agenda",
    );
  }

  for (const key of Object.keys(raw)) {
    if (
      key !== "id" &&
      key !== "label" &&
      key !== "critical" &&
      key !== "status" &&
      !(AGENDA_ITEM_OPTIONAL_WHITELIST as readonly string[]).includes(key)
    ) {
      throw new ControlPlaneError(
        UNKNOWN_CONTROL_PLANE_FIELD,
        `Unknown AgendaItem field "${key}" at investigation_agenda[${index}]`,
        `investigation_agenda[${index}].${key}`,
      );
    }
  }

  if (typeof raw.id !== "string" || !raw.id.trim()) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `investigation_agenda[${index}].id must be a non-empty string`,
      "investigation_agenda.id",
    );
  }
  const id = raw.id.trim();
  if (seenIds.has(id)) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `Duplicate AgendaItem id "${id}"`,
      "investigation_agenda.id",
    );
  }
  seenIds.add(id);

  if (typeof raw.label !== "string") {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `investigation_agenda[${index}].label must be a string`,
      "investigation_agenda.label",
    );
  }
  if (typeof raw.critical !== "boolean") {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `investigation_agenda[${index}].critical must be boolean`,
      "investigation_agenda.critical",
    );
  }
  if (
    typeof raw.status !== "string" ||
    !(AGENDA_ITEM_STATUSES as readonly string[]).includes(raw.status)
  ) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `investigation_agenda[${index}].status must be unexplored|partial|covered`,
      "investigation_agenda.status",
    );
  }

  const item: AgendaItem = {
    id,
    label: raw.label,
    critical: raw.critical,
    status: raw.status as AgendaItemStatus,
  };

  if (raw.frame_kind !== undefined) {
    if (
      typeof raw.frame_kind !== "string" ||
      !(AGENDA_FRAME_KINDS as readonly string[]).includes(raw.frame_kind)
    ) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].frame_kind illegal`,
        "investigation_agenda.frame_kind",
      );
    }
    item.frame_kind = raw.frame_kind as AgendaFrameKind;
  }
  if (raw.frame_index !== undefined) {
    if (typeof raw.frame_index !== "number" || !Number.isFinite(raw.frame_index)) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].frame_index must be number`,
        "investigation_agenda.frame_index",
      );
    }
    item.frame_index = raw.frame_index;
  }
  if (raw.supports !== undefined) {
    if (typeof raw.supports !== "string") {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].supports must be string`,
        "investigation_agenda.supports",
      );
    }
    item.supports = raw.supports;
  }
  if (raw.captured_answer !== undefined) {
    if (typeof raw.captured_answer !== "string") {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].captured_answer must be string`,
        "investigation_agenda.captured_answer",
      );
    }
    item.captured_answer = raw.captured_answer;
  }
  if (raw.serves_page !== undefined) {
    if (typeof raw.serves_page !== "string") {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].serves_page must be string`,
        "investigation_agenda.serves_page",
      );
    }
    item.serves_page = raw.serves_page;
  }
  if (raw.serves_path !== undefined) {
    if (
      raw.serves_path !== "primary" &&
      raw.serves_path !== "backup" &&
      raw.serves_path !== "both"
    ) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].serves_path illegal`,
        "investigation_agenda.serves_path",
      );
    }
    item.serves_path = raw.serves_path;
  }
  if (raw.role !== undefined) {
    if (
      typeof raw.role !== "string" ||
      !(AGENDA_ROLES as readonly string[]).includes(raw.role)
    ) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].role illegal`,
        "investigation_agenda.role",
      );
    }
    item.role = raw.role as AgendaRole;
  }
  if (raw.collection_goal !== undefined) {
    if (typeof raw.collection_goal !== "string") {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].collection_goal must be string`,
        "investigation_agenda.collection_goal",
      );
    }
    item.collection_goal = raw.collection_goal;
  }
  if (raw.stale_turns !== undefined) {
    if (typeof raw.stale_turns !== "number" || !Number.isFinite(raw.stale_turns)) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].stale_turns must be number`,
        "investigation_agenda.stale_turns",
      );
    }
    item.stale_turns = raw.stale_turns;
  }
  if (raw.unqualified_streak !== undefined) {
    if (
      typeof raw.unqualified_streak !== "number" ||
      !Number.isFinite(raw.unqualified_streak)
    ) {
      throw new ControlPlaneError(
        INVALID_CONTROL_PLANE_FIELD,
        `investigation_agenda[${index}].unqualified_streak must be number`,
        "investigation_agenda.unqualified_streak",
      );
    }
    item.unqualified_streak = raw.unqualified_streak;
  }

  return item;
}

/**
 * Input + output runtime validator (Contract §10.3).
 * Unknown top-level field → UNKNOWN_CONTROL_PLANE_FIELD.
 * Wrong type → hard fail (no coerce to empty defaults).
 */
export function validatePhase3ControlPlane(
  raw: unknown,
  opts?: { direction?: "input" | "output" },
): Phase3ControlPlane {
  const direction = opts?.direction ?? "input";
  if (!isPlainObject(raw)) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      `ControlPlane ${direction} must be a plain object`,
    );
  }

  for (const key of Object.keys(raw)) {
    if (!(CONTROL_PLANE_FIELD_WHITELIST as readonly string[]).includes(key)) {
      throw new ControlPlaneError(
        UNKNOWN_CONTROL_PLANE_FIELD,
        `Unknown ControlPlane field "${key}"`,
        key,
      );
    }
  }

  if (
    typeof raw.current_phase !== "string" ||
    !(AGENT_PHASE_LITERALS as readonly string[]).includes(raw.current_phase)
  ) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "current_phase must be an AgentPhase literal",
      "current_phase",
    );
  }

  if (!Array.isArray(raw.investigation_agenda)) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "investigation_agenda must be an array",
      "investigation_agenda",
    );
  }
  const seenIds = new Set<string>();
  const investigation_agenda = raw.investigation_agenda.map((item, i) =>
    validateAgendaItemForControlPlane(item, i, seenIds),
  );

  const active_agenda_item_id = assertNullableString(
    raw.active_agenda_item_id,
    "active_agenda_item_id",
  );
  const opening_anchor_id = assertNullableString(
    raw.opening_anchor_id,
    "opening_anchor_id",
  );

  if (
    typeof raw.opening_gate_state !== "string" ||
    !(OPENING_GATE_STATES as readonly string[]).includes(raw.opening_gate_state)
  ) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "opening_gate_state must be not_created|pending|confirmed|cleared",
      "opening_gate_state",
    );
  }

  return {
    current_phase: raw.current_phase as AgentPhase,
    investigation_agenda,
    active_agenda_item_id,
    opening_anchor_id,
    opening_gate_state: raw.opening_gate_state as OpeningGateState,
    last_call_a_fingerprint: assertNullableString(
      raw.last_call_a_fingerprint,
      "last_call_a_fingerprint",
    ),
    last_call_a_fingerprint_version: assertNullableString(
      raw.last_call_a_fingerprint_version,
      "last_call_a_fingerprint_version",
    ),
    last_call_b_fingerprint: assertNullableString(
      raw.last_call_b_fingerprint,
      "last_call_b_fingerprint",
    ),
    last_call_b_fingerprint_version: assertNullableString(
      raw.last_call_b_fingerprint_version,
      "last_call_b_fingerprint_version",
    ),
  };
}

export function validateControlPlaneInput(raw: unknown): Phase3ControlPlane {
  return validatePhase3ControlPlane(raw, { direction: "input" });
}

export function validateControlPlaneOutput(raw: unknown): Phase3ControlPlane {
  return validatePhase3ControlPlane(raw, { direction: "output" });
}

/** Deep-clone via validate so unknown fields never leak. */
export function cloneFormalControlPlane(cp: Phase3ControlPlane): Phase3ControlPlane {
  return validateControlPlaneOutput(JSON.parse(JSON.stringify(cp)));
}

/**
 * Replace formal CP from a validated value (no opaque merge of unknowns).
 * Partial patches are not accepted — callers must supply a full formal plane
 * or compose one explicitly before calling.
 */

/**
 * Merge a whitelist patch onto an existing formal CP (or defaults).
 * Unknown fields → UNKNOWN_CONTROL_PLANE_FIELD.
 * Wrong types → hard fail (no coerce to empty defaults for provided keys).
 * Result is always a full validated Phase3ControlPlane.
 * Used by applyControlPlaneToWorking / mergeDcPersistSliceIntoSession for
 * incremental current_phase updates from Phase 2 call sites.
 */
export function mergeControlPlanePatch(
  existing: Phase3ControlPlane | null | undefined,
  patch: unknown,
): Phase3ControlPlane {
  if (patch === undefined || patch === null) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "ControlPlane patch must be a plain object",
    );
  }
  // Full formal plane → replace.
  try {
    return validateControlPlaneInput(patch);
  } catch (err) {
    if (!(err instanceof ControlPlaneError)) throw err;
    // Fall through to patch-merge only for missing required fields, not unknown/wrong-type.
    if (err.code === UNKNOWN_CONTROL_PLANE_FIELD) throw err;
    // Wrong type on a present field must still hard-fail — detect via partial walk below.
  }

  if (!isPlainObject(patch)) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "ControlPlane patch must be a plain object",
    );
  }

  for (const key of Object.keys(patch)) {
    if (!(CONTROL_PLANE_FIELD_WHITELIST as readonly string[]).includes(key)) {
      throw new ControlPlaneError(
        UNKNOWN_CONTROL_PLANE_FIELD,
        `Unknown ControlPlane field "${key}"`,
        key,
      );
    }
  }

  const base = existing
    ? cloneFormalControlPlane(existing)
    : createDefaultControlPlane(
        typeof patch.current_phase === "string" &&
          (AGENT_PHASE_LITERALS as readonly string[]).includes(patch.current_phase)
          ? (patch.current_phase as AgentPhase)
          : "opening",
      );

  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    // Explicit undefined is treated as absent (no write); null is a legal value for nullable fields.
    if (patch[key] === undefined) continue;
    merged[key] = patch[key];
  }
  return validateControlPlaneInput(merged);
}

export function replaceFormalControlPlane(raw: unknown): Phase3ControlPlane {
  return validateControlPlaneInput(raw);
}

/**
 * One-way mirror: CP → agent_v2 UI fields only.
 * Never reads agent_v2 back into CP.
 */
export function mirrorControlPlanePhaseToAgentV2Patch(
  cp: Phase3ControlPlane,
): { current_phase: AgentPhase; investigation_agenda: AgendaItem[] } {
  return {
    current_phase: cp.current_phase,
    investigation_agenda: cp.investigation_agenda.map((a) => ({ ...a })),
  };
}

/**
 * Guard: agent_v2 must not overwrite formal CP.
 * If both present and conflict on current_phase / opening fields, CP wins;
 * attempting to apply agent_v2 as CP source throws.
 */
export function assertAgentV2CannotOverwriteControlPlane(input: {
  control_plane: Phase3ControlPlane | null | undefined;
  agent_v2_as_control_plane_candidate?: unknown;
}): Phase3ControlPlane | null | undefined {
  if (input.agent_v2_as_control_plane_candidate !== undefined) {
    throw new ControlPlaneError(
      INVALID_CONTROL_PLANE_FIELD,
      "agent_v2 must not overwrite or restore formal ControlPlane",
      "agent_v2",
    );
  }
  return input.control_plane;
}

/**
 * Resolve formal CP for persist extract:
 * - Prefer session.control_plane (validated).
 * - Do NOT synthesize formal CP from agent_v2.
 */
export function resolveFormalControlPlaneFromSession(session: {
  control_plane?: unknown;
  agent_v2?: { current_phase?: unknown } | null;
}): Phase3ControlPlane | undefined {
  if (session.control_plane !== undefined && session.control_plane !== null) {
    return validateControlPlaneOutput(session.control_plane);
  }
  // Intentionally ignore agent_v2 — not formal CP authority (Contract §10.1).
  return undefined;
}
