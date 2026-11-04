/**
 * Phase 3 S3 — Confirmation Event (Contract §11).
 * Discriminated union Fact | Constraint with mutual exclusion on target ids.
 * user_confirmed is derived — never writable by model/caller as authority.
 * Gate confirm MUST NOT batch-create Fact/Constraint Confirmation Events.
 */

import { deriveUserConfirmed } from "./fact-combination";
import type { FactStatus, VerificationLevel } from "./types";

export const CONFIRMATION_EVENT_VERSION = 1 as const;

export type ConfirmationEvent =
  | {
      event_id: string;
      target_type: "fact";
      fact_id: string;
      constraint_id?: never;
      source_turn_id: string;
      confirmation_turn_id: string | null;
      confirmation_action_id: string;
      event_type: "confirm_fact";
      actor: "user";
      confirmed_at: string;
      event_version: 1;
    }
  | {
      event_id: string;
      target_type: "constraint";
      constraint_id: string;
      fact_id?: never;
      source_turn_id: string;
      confirmation_turn_id: string | null;
      confirmation_action_id: string;
      event_type: "confirm_constraint";
      actor: "user";
      confirmed_at: string;
      event_version: 1;
    };

/** Optional UI-click evidence (Contract §11.4). Never model-generated. */
export interface UserConfirmationAction {
  confirmation_action_id: string;
  session_id: string;
  target_type: "fact" | "constraint";
  target_id: string;
  control_id: string;
  anchor_id: string | null;
  occurred_at: string;
}

export const CONFIRMATION_ACTION_REUSED = "CONFIRMATION_ACTION_REUSED";
export const CONFIRMATION_EVENT_INVALID = "CONFIRMATION_EVENT_INVALID";
export const CONFIRMATION_EVENT_ID_DUPLICATE = "CONFIRMATION_EVENT_ID_DUPLICATE";

export class ConfirmationEventError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ConfirmationEventError";
    this.code = code;
  }
}

export function isConfirmationEventError(
  err: unknown,
): err is ConfirmationEventError {
  return err instanceof ConfirmationEventError;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

/** Validate a single ConfirmationEvent; strip unknown fields by rebuilding. */
export function validateConfirmationEvent(raw: unknown): ConfirmationEvent {
  if (!isPlainObject(raw)) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "ConfirmationEvent must be an object",
    );
  }

  const event_id = requireNonEmptyString(raw.event_id, "event_id");
  const source_turn_id = requireNonEmptyString(raw.source_turn_id, "source_turn_id");
  const confirmation_action_id = requireNonEmptyString(
    raw.confirmation_action_id,
    "confirmation_action_id",
  );
  const confirmed_at = requireNonEmptyString(raw.confirmed_at, "confirmed_at");

  if (raw.actor !== "user") {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "actor must be user",
    );
  }
  if (raw.event_version !== 1) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "event_version must be 1",
    );
  }

  let confirmation_turn_id: string | null;
  if (raw.confirmation_turn_id === null) {
    confirmation_turn_id = null;
  } else {
    confirmation_turn_id = requireNonEmptyString(
      raw.confirmation_turn_id,
      "confirmation_turn_id",
    );
  }

  if (raw.target_type === "fact") {
    if (raw.event_type !== "confirm_fact") {
      throw new ConfirmationEventError(
        CONFIRMATION_EVENT_INVALID,
        "event_type must match target_type fact",
      );
    }
    if (raw.constraint_id !== undefined) {
      throw new ConfirmationEventError(
        CONFIRMATION_EVENT_INVALID,
        "fact ConfirmationEvent must not include constraint_id",
      );
    }
    const fact_id = requireNonEmptyString(raw.fact_id, "fact_id");
    return {
      event_id,
      target_type: "fact",
      fact_id,
      source_turn_id,
      confirmation_turn_id,
      confirmation_action_id,
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at,
      event_version: 1,
    };
  }

  if (raw.target_type === "constraint") {
    if (raw.event_type !== "confirm_constraint") {
      throw new ConfirmationEventError(
        CONFIRMATION_EVENT_INVALID,
        "event_type must match target_type constraint",
      );
    }
    if (raw.fact_id !== undefined) {
      throw new ConfirmationEventError(
        CONFIRMATION_EVENT_INVALID,
        "constraint ConfirmationEvent must not include fact_id",
      );
    }
    const constraint_id = requireNonEmptyString(raw.constraint_id, "constraint_id");
    return {
      event_id,
      target_type: "constraint",
      constraint_id,
      source_turn_id,
      confirmation_turn_id,
      confirmation_action_id,
      event_type: "confirm_constraint",
      actor: "user",
      confirmed_at,
      event_version: 1,
    };
  }

  throw new ConfirmationEventError(
    CONFIRMATION_EVENT_INVALID,
    "target_type must be fact|constraint",
  );
}

export function eventTargetKey(event: ConfirmationEvent): string {
  return event.target_type === "fact"
    ? `fact:${event.fact_id}`
    : `constraint:${event.constraint_id}`;
}

export function sameConfirmationContent(
  a: ConfirmationEvent,
  b: ConfirmationEvent,
): boolean {
  return (
    a.target_type === b.target_type &&
    eventTargetKey(a) === eventTargetKey(b) &&
    a.event_type === b.event_type &&
    a.source_turn_id === b.source_turn_id &&
    a.actor === b.actor &&
    a.event_version === b.event_version
  );
}

export type AppendConfirmationResult =
  | { outcome: "appended"; events: ConfirmationEvent[]; event: ConfirmationEvent }
  | { outcome: "idempotent_skip"; events: ConfirmationEvent[]; event: ConfirmationEvent };

/**
 * Append with Contract §11.3 rules:
 * - event_id unique in session
 * - confirmation_action_id unique; same action+same target+same content → idempotent skip
 * - same action different target/type → hard fail
 */
export function appendConfirmationEvent(
  existing: ConfirmationEvent[] | null | undefined,
  raw: unknown,
): AppendConfirmationResult {
  const event = validateConfirmationEvent(raw);
  const events = [...(existing ?? [])];

  if (events.some((e) => e.event_id === event.event_id)) {
    const prior = events.find((e) => e.event_id === event.event_id)!;
    if (
      prior.confirmation_action_id === event.confirmation_action_id &&
      sameConfirmationContent(prior, event)
    ) {
      return { outcome: "idempotent_skip", events, event: prior };
    }
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_ID_DUPLICATE,
      `event_id already used: ${event.event_id}`,
    );
  }

  const sameAction = events.find(
    (e) => e.confirmation_action_id === event.confirmation_action_id,
  );
  if (sameAction) {
    if (sameConfirmationContent(sameAction, event)) {
      return { outcome: "idempotent_skip", events, event: sameAction };
    }
    throw new ConfirmationEventError(
      CONFIRMATION_ACTION_REUSED,
      `confirmation_action_id reused with different target/type: ${event.confirmation_action_id}`,
    );
  }

  events.push(event);
  return { outcome: "appended", events, event };
}

/** True when a valid user Confirmation Event exists for this fact/constraint. */
export function hasUserConfirmEventForTarget(
  events: ConfirmationEvent[] | null | undefined,
  target: { type: "fact"; fact_id: string } | { type: "constraint"; constraint_id: string },
): boolean {
  const list = events ?? [];
  if (target.type === "fact") {
    return list.some(
      (e) => e.target_type === "fact" && e.fact_id === target.fact_id,
    );
  }
  return list.some(
    (e) =>
      e.target_type === "constraint" && e.constraint_id === target.constraint_id,
  );
}

/**
 * Derived user_confirmed from Confirmation Events + status/verification.
 * independently_verified does NOT imply user_confirmed.
 * unknown/declined/not_applicable never become user_confirmed via events.
 * user_estimate stays unverified status even after confirm (caller keeps status);
 * deriveUserConfirmed may still be true for estimate+event (user confirmed their estimate)
 * but status must remain unverified per §11.5 — this helper only derives the flag.
 */
export function deriveUserConfirmedFromEvents(input: {
  status: FactStatus;
  verification_level: VerificationLevel;
  events: ConfirmationEvent[] | null | undefined;
  target: { type: "fact"; fact_id: string } | { type: "constraint"; constraint_id: string };
}): boolean {
  const has_user_confirm_event = hasUserConfirmEventForTarget(
    input.events,
    input.target,
  );
  return deriveUserConfirmed({
    status: input.status,
    verification_level: input.verification_level,
    has_user_confirm_event,
  });
}

/**
 * Gate confirm must not create Fact/Constraint Confirmation Events.
 * Call this as a hard guard around Gate confirm paths.
 */
export function assertGateConfirmDoesNotCreateFactEvents(
  before: ConfirmationEvent[] | null | undefined,
  after: ConfirmationEvent[] | null | undefined,
): void {
  const b = before ?? [];
  const a = after ?? [];
  if (a.length !== b.length) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "Opening Gate confirm must not create Fact/Constraint Confirmation Events",
    );
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.event_id !== b[i]!.event_id) {
      throw new ConfirmationEventError(
        CONFIRMATION_EVENT_INVALID,
        "Opening Gate confirm must not mutate Confirmation Events",
      );
    }
  }
}

/** ID namespace helpers — isolate Gate vs Fact confirm vs source turn (brief). */
export function makeOpeningConfirmEventId(seed: string): string {
  return `opening_confirm_event_${seed}`;
}

export function makeFactConfirmEventId(seed: string): string {
  return `fact_confirm_event_${seed}`;
}

export function validateUserConfirmationAction(
  raw: unknown,
): UserConfirmationAction {
  if (!isPlainObject(raw)) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "UserConfirmationAction must be an object",
    );
  }
  const confirmation_action_id = requireNonEmptyString(
    raw.confirmation_action_id,
    "confirmation_action_id",
  );
  const session_id = requireNonEmptyString(raw.session_id, "session_id");
  if (raw.target_type !== "fact" && raw.target_type !== "constraint") {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "target_type must be fact|constraint",
    );
  }
  const target_id = requireNonEmptyString(raw.target_id, "target_id");
  const control_id = requireNonEmptyString(raw.control_id, "control_id");
  let anchor_id: string | null;
  if (raw.anchor_id === null) {
    anchor_id = null;
  } else {
    anchor_id = requireNonEmptyString(raw.anchor_id, "anchor_id");
  }
  const occurred_at = requireNonEmptyString(raw.occurred_at, "occurred_at");
  return {
    confirmation_action_id,
    session_id,
    target_type: raw.target_type,
    target_id,
    control_id,
    anchor_id,
    occurred_at,
  };
}
