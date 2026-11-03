/**
 * Phase 3 S3 — Confirmation Event (Contract §11).
 * Discriminated union Fact | Constraint with mutual exclusion on target ids.
 * user_confirmed is derived — never writable by model/caller as authority.
 * Gate confirm MUST NOT batch-create Fact/Constraint Confirmation Events.
 */

import { deriveUserConfirmed } from "./fact-combination";
import type { FactStatus, VerificationLevel, DecisionContext } from "./types";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import {
  mutatePOJUSession,
  type CasWritePOJUSessionResult,
  type MutatePOJUSessionOptions,
} from "@/lib/poju/session-mutation";

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
export const CONFIRMATION_SOURCE_INVALID = "CONFIRMATION_SOURCE_INVALID";
export const CONFIRMATION_TARGET_INVALID = "CONFIRMATION_TARGET_INVALID";

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


/** Resolve source_turn_id against Session messages (stable client_id). */
export function findSessionMessageByTurnId(
  messages: readonly POJUMessage[] | null | undefined,
  source_turn_id: string,
): POJUMessage | undefined {
  const id = source_turn_id.trim();
  if (!id) return undefined;
  return (messages ?? []).find((m) => m.client_id === id);
}

export interface ConfirmationProvenanceContext {
  session_id: string;
  messages: readonly POJUMessage[] | null | undefined;
  decision_context?: DecisionContext | null;
  /** Optional: expected owning session for cross-session hard-fail. */
  expected_session_id?: string;
}

/**
 * Contract §11.3 / §16.6 / P3-112 — source message must be a real user turn
 * on the current Session; target Fact/Constraint must exist and associate.
 * Does not mutate state; never treats a forged non-empty string as provenance.
 */
export function assertConfirmationEventProvenance(
  ctx: ConfirmationProvenanceContext,
  event: ConfirmationEvent,
): void {
  const session_id = ctx.expected_session_id ?? ctx.session_id;
  if (!session_id || !session_id.trim()) {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      "session_id required for confirmation provenance",
    );
  }
  if (ctx.session_id !== session_id) {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      "confirmation session_id mismatch (cross-session)",
    );
  }

  const source_turn_id = requireNonEmptyString(event.source_turn_id, "source_turn_id");
  const message = findSessionMessageByTurnId(ctx.messages, source_turn_id);
  if (!message) {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      `source_turn_id does not map to a message in current Session: ${source_turn_id}`,
    );
  }
  if (message.role !== "user") {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      `source_turn_id must reference a user message, got role=${message.role}`,
    );
  }

  const dc = ctx.decision_context;
  if (event.target_type === "fact") {
    const fact = (dc?.reality_facts ?? []).find((f) => f.fact_id === event.fact_id);
    if (!fact) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        `fact_id not found in Decision Context: ${event.fact_id}`,
      );
    }
    if (
      fact.source_turn_id != null &&
      fact.source_turn_id.trim() !== "" &&
      fact.source_turn_id !== source_turn_id
    ) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        `Confirmation Event source_turn_id does not match Fact.source_turn_id (${fact.source_turn_id})`,
      );
    }
  } else {
    const constraint = (dc?.constraints ?? []).find(
      (c) => c.constraint_id === event.constraint_id,
    );
    if (!constraint) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        `constraint_id not found in Decision Context: ${event.constraint_id}`,
      );
    }
    if (
      constraint.source_turn_id != null &&
      constraint.source_turn_id.trim() !== "" &&
      constraint.source_turn_id !== source_turn_id
    ) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        `Confirmation Event source_turn_id does not match Constraint.source_turn_id (${constraint.source_turn_id})`,
      );
    }
  }
}

/**
 * Append with provenance against a live Session snapshot (P3-112 submit path helper).
 */
export function appendConfirmationEventWithProvenance(
  ctx: ConfirmationProvenanceContext,
  existing: ConfirmationEvent[] | null | undefined,
  raw: unknown,
): AppendConfirmationResult {
  const event = validateConfirmationEvent(raw);
  assertConfirmationEventProvenance(ctx, event);
  return appendConfirmationEvent(existing, event);
}

export interface ConfirmFactInput {
  operation_id: string;
  event_id: string;
  fact_id: string;
  source_turn_id: string;
  confirmation_action_id: string;
  confirmation_turn_id?: string | null;
  confirmed_at?: string;
}

export interface ConfirmConstraintInput {
  operation_id: string;
  event_id: string;
  constraint_id: string;
  source_turn_id: string;
  confirmation_action_id: string;
  confirmation_turn_id?: string | null;
  confirmed_at?: string;
}

function applyFactConfirmToDc(
  dc: DecisionContext,
  events: ConfirmationEvent[],
  fact_id: string,
  now: string,
): DecisionContext {
  const reality_facts = (dc.reality_facts ?? []).map((f) => {
    if (f.fact_id !== fact_id) return f;
    const user_confirmed = deriveUserConfirmedFromEvents({
      status: f.status,
      verification_level: f.verification_level,
      events,
      target: { type: "fact", fact_id },
    });
    return { ...f, user_confirmed, updated_at: now };
  });
  return { ...dc, reality_facts, updated_at: now };
}

function applyConstraintConfirmToDc(
  dc: DecisionContext,
  events: ConfirmationEvent[],
  constraint_id: string,
  now: string,
): DecisionContext {
  const constraints = (dc.constraints ?? []).map((c) => {
    if (c.constraint_id !== constraint_id) return c;
    const user_confirmed = deriveUserConfirmedFromEvents({
      status: c.status,
      verification_level: c.verification_level,
      events,
      target: { type: "constraint", constraint_id },
    });
    return { ...c, user_confirmed, updated_at: now };
  });
  return { ...dc, constraints, updated_at: now };
}

/** Contract §16.6 confirmFact — real user-message provenance required. */
export async function confirmFact(
  sessionId: string,
  input: ConfirmFactInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<CasWritePOJUSessionResult & { event: ConfirmationEvent; outcome: AppendConfirmationResult["outcome"] }> {
  let outcome: AppendConfirmationResult["outcome"] = "appended";
  let committed: ConfirmationEvent | null = null;
  const now = input.confirmed_at ?? new Date().toISOString();
  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        if (latest.session_id !== sessionId) {
          throw new ConfirmationEventError(
            CONFIRMATION_SOURCE_INVALID,
            "session_id mismatch",
          );
        }
        const raw = {
          event_id: input.event_id,
          target_type: "fact" as const,
          fact_id: input.fact_id,
          source_turn_id: input.source_turn_id,
          confirmation_turn_id:
            input.confirmation_turn_id === undefined ? null : input.confirmation_turn_id,
          confirmation_action_id: input.confirmation_action_id,
          event_type: "confirm_fact" as const,
          actor: "user" as const,
          confirmed_at: now,
          event_version: 1 as const,
        };
        const appended = appendConfirmationEventWithProvenance(
          {
            session_id: latest.session_id,
            expected_session_id: sessionId,
            messages: latest.messages,
            decision_context: latest.decision_context ?? null,
          },
          latest.confirmation_events,
          raw,
        );
        outcome = appended.outcome;
        committed = appended.event;
        if (appended.outcome === "idempotent_skip") {
          return latest;
        }
        if (!latest.decision_context) {
          throw new ConfirmationEventError(
            CONFIRMATION_TARGET_INVALID,
            "Decision Context missing",
          );
        }
        return {
          ...latest,
          confirmation_events: appended.events,
          decision_context: applyFactConfirmToDc(
            latest.decision_context,
            appended.events,
            input.fact_id,
            now,
          ),
        };
      },
    },
    opts,
  );
  if (!committed) {
    throw new ConfirmationEventError(CONFIRMATION_EVENT_INVALID, "confirmFact produced no event");
  }
  return { ...result, event: committed, outcome };
}

/** Contract §16.6 confirmConstraint — real user-message provenance required. */
export async function confirmConstraint(
  sessionId: string,
  input: ConfirmConstraintInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<CasWritePOJUSessionResult & { event: ConfirmationEvent; outcome: AppendConfirmationResult["outcome"] }> {
  let outcome: AppendConfirmationResult["outcome"] = "appended";
  let committed: ConfirmationEvent | null = null;
  const now = input.confirmed_at ?? new Date().toISOString();
  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        if (latest.session_id !== sessionId) {
          throw new ConfirmationEventError(
            CONFIRMATION_SOURCE_INVALID,
            "session_id mismatch",
          );
        }
        const raw = {
          event_id: input.event_id,
          target_type: "constraint" as const,
          constraint_id: input.constraint_id,
          source_turn_id: input.source_turn_id,
          confirmation_turn_id:
            input.confirmation_turn_id === undefined ? null : input.confirmation_turn_id,
          confirmation_action_id: input.confirmation_action_id,
          event_type: "confirm_constraint" as const,
          actor: "user" as const,
          confirmed_at: now,
          event_version: 1 as const,
        };
        const appended = appendConfirmationEventWithProvenance(
          {
            session_id: latest.session_id,
            expected_session_id: sessionId,
            messages: latest.messages,
            decision_context: latest.decision_context ?? null,
          },
          latest.confirmation_events,
          raw,
        );
        outcome = appended.outcome;
        committed = appended.event;
        if (appended.outcome === "idempotent_skip") {
          return latest;
        }
        if (!latest.decision_context) {
          throw new ConfirmationEventError(
            CONFIRMATION_TARGET_INVALID,
            "Decision Context missing",
          );
        }
        return {
          ...latest,
          confirmation_events: appended.events,
          decision_context: applyConstraintConfirmToDc(
            latest.decision_context,
            appended.events,
            input.constraint_id,
            now,
          ),
        };
      },
    },
    opts,
  );
  if (!committed) {
    throw new ConfirmationEventError(
      CONFIRMATION_EVENT_INVALID,
      "confirmConstraint produced no event",
    );
  }
  return { ...result, event: committed, outcome };
}
