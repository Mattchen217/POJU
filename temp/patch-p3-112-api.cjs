const fs = require("fs");
const p = "lib/poju/decision-context/confirmation-event.ts";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("CONFIRMATION_SOURCE_INVALID")) {
  s = s.replace(
    'export const CONFIRMATION_EVENT_ID_DUPLICATE = "CONFIRMATION_EVENT_ID_DUPLICATE";',
    'export const CONFIRMATION_EVENT_ID_DUPLICATE = "CONFIRMATION_EVENT_ID_DUPLICATE";\nexport const CONFIRMATION_SOURCE_INVALID = "CONFIRMATION_SOURCE_INVALID";\nexport const CONFIRMATION_TARGET_INVALID = "CONFIRMATION_TARGET_INVALID";',
  );
}

if (!s.includes('from "@/lib/poju/types"')) {
  s = s.replace(
    'import { deriveUserConfirmed } from "./fact-combination";\nimport type { FactStatus, VerificationLevel } from "./types";\n',
    'import { deriveUserConfirmed } from "./fact-combination";\nimport type { FactStatus, VerificationLevel, DecisionContext } from "./types";\nimport type { POJUMessage, POJUSessionState } from "@/lib/poju/types";\nimport {\n  mutatePOJUSession,\n  type CasWritePOJUSessionResult,\n  type MutatePOJUSessionOptions,\n} from "@/lib/poju/session-mutation";\n',
  );
}

if (s.includes("assertConfirmationEventProvenance")) {
  console.log("provenance already present");
} else {
  const addon = `

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
      \`source_turn_id does not map to a message in current Session: \${source_turn_id}\`,
    );
  }
  if (message.role !== "user") {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      \`source_turn_id must reference a user message, got role=\${message.role}\`,
    );
  }

  const dc = ctx.decision_context;
  if (event.target_type === "fact") {
    const fact = (dc?.reality_facts ?? []).find((f) => f.fact_id === event.fact_id);
    if (!fact) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        \`fact_id not found in Decision Context: \${event.fact_id}\`,
      );
    }
    if (
      fact.source_turn_id != null &&
      fact.source_turn_id.trim() !== "" &&
      fact.source_turn_id !== source_turn_id
    ) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        \`Confirmation Event source_turn_id does not match Fact.source_turn_id (\${fact.source_turn_id})\`,
      );
    }
  } else {
    const constraint = (dc?.constraints ?? []).find(
      (c) => c.constraint_id === event.constraint_id,
    );
    if (!constraint) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        \`constraint_id not found in Decision Context: \${event.constraint_id}\`,
      );
    }
    if (
      constraint.source_turn_id != null &&
      constraint.source_turn_id.trim() !== "" &&
      constraint.source_turn_id !== source_turn_id
    ) {
      throw new ConfirmationEventError(
        CONFIRMATION_TARGET_INVALID,
        \`Confirmation Event source_turn_id does not match Constraint.source_turn_id (\${constraint.source_turn_id})\`,
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
`;
  s = s + addon;
  fs.writeFileSync(p, s);
  console.log("confirmation-event provenance+confirm APIs added");
}
