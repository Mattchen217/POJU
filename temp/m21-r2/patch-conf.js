const fs = require("fs");
const path = require("path");

const root = "D:/POJU/pojulife";
const confPath = path.join(root, "lib/poju/decision-context/confirmation-event.ts");
const freezePath = path.join(root, "lib/poju/decision-intake/confirm-and-freeze.ts");
const testPath = path.join(root, "scripts/test-m2-1-readiness-confirm-freeze.ts");

let conf = fs.readFileSync(confPath, "utf8");

// 1) Replace hasUserConfirmEventForTarget with matching helper + keep thin wrapper
const oldHas = `/** True when a valid user Confirmation Event exists for this fact/constraint. */
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
}`;

const newHas = `export type ConfirmEventMatchTarget =
  | { type: "fact"; fact_id: string }
  | { type: "constraint"; constraint_id: string };

export type ConfirmEventMatchOpts = {
  /** When set (non-empty), event.source_turn_id must equal this. */
  source_turn_id?: string | null;
  /** When set (non-empty), event.confirmation_turn_id must equal this. */
  confirmation_turn_id?: string | null;
};

function targetMatchesEvent(
  event: ConfirmationEvent,
  target: ConfirmEventMatchTarget,
): boolean {
  if (target.type === "fact") {
    return event.target_type === "fact" && event.fact_id === target.fact_id;
  }
  return (
    event.target_type === "constraint" &&
    event.constraint_id === target.constraint_id
  );
}

/**
 * Find a Confirmation Event that matches target and optional source/confirm-turn.
 * Stale events (wrong source or wrong confirm turn when those are required) do not match.
 */
export function findMatchingUserConfirmEvent(
  events: ConfirmationEvent[] | null | undefined,
  target: ConfirmEventMatchTarget,
  opts: ConfirmEventMatchOpts = {},
): ConfirmationEvent | undefined {
  const list = events ?? [];
  const wantSource = opts.source_turn_id?.trim() || "";
  const wantConfirm = opts.confirmation_turn_id?.trim() || "";
  return list.find((e) => {
    if (!targetMatchesEvent(e, target)) return false;
    if (wantSource && e.source_turn_id !== wantSource) return false;
    if (wantConfirm && e.confirmation_turn_id !== wantConfirm) return false;
    return true;
  });
}

/** True when a matching user Confirmation Event exists (optional source/confirm-turn). */
export function hasUserConfirmEventForTarget(
  events: ConfirmationEvent[] | null | undefined,
  target: ConfirmEventMatchTarget,
  opts: ConfirmEventMatchOpts = {},
): boolean {
  return findMatchingUserConfirmEvent(events, target, opts) !== undefined;
}`;

if (!conf.includes(oldHas)) {
  console.error("FATAL: hasUserConfirmEventForTarget block not found exactly");
  process.exit(1);
}
conf = conf.replace(oldHas, newHas);

// 2) Update deriveUserConfirmedFromEvents to accept source/confirm matching
const oldDerive = `export function deriveUserConfirmedFromEvents(input: {
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
}`;

const newDerive = `export function deriveUserConfirmedFromEvents(input: {
  status: FactStatus;
  verification_level: VerificationLevel;
  events: ConfirmationEvent[] | null | undefined;
  target: ConfirmEventMatchTarget;
  /** Prefer matching on current fact/constraint source so stale events cannot confirm. */
  source_turn_id?: string | null;
  confirmation_turn_id?: string | null;
}): boolean {
  const has_user_confirm_event = hasUserConfirmEventForTarget(
    input.events,
    input.target,
    {
      source_turn_id: input.source_turn_id,
      confirmation_turn_id: input.confirmation_turn_id,
    },
  );
  return deriveUserConfirmed({
    status: input.status,
    verification_level: input.verification_level,
    has_user_confirm_event,
  });
}`;

if (!conf.includes(oldDerive)) {
  console.error("FATAL: deriveUserConfirmedFromEvents block not found");
  process.exit(1);
}
conf = conf.replace(oldDerive, newDerive);

// 3) Extend ConfirmationProvenanceContext + assertConfirmationEventProvenance
const oldCtx = `export interface ConfirmationProvenanceContext {
  session_id: string;
  messages: readonly POJUMessage[] | null | undefined;
  decision_context?: DecisionContext | null;
  /** Optional: expected owning session for cross-session hard-fail. */
  expected_session_id?: string;
}`;

const newCtx = `export interface ConfirmationProvenanceContext {
  session_id: string;
  messages: readonly POJUMessage[] | null | undefined;
  decision_context?: DecisionContext | null;
  /** Optional: expected owning session for cross-session hard-fail. */
  expected_session_id?: string;
  /** When set, event.confirmation_turn_id must equal this confirm turn. */
  expected_confirmation_turn_id?: string | null;
  /** When true, confirmation_turn_id must be a non-null real user message. */
  require_confirmation_turn_id?: boolean;
}`;

if (!conf.includes(oldCtx)) {
  console.error("FATAL: ConfirmationProvenanceContext not found");
  process.exit(1);
}
conf = conf.replace(oldCtx, newCtx);

// Insert confirmation_turn_id provenance after source_turn_id user-role check
const provenanceAnchor = `  if (message.role !== "user") {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      \`source_turn_id must reference a user message, got role=\${message.role}\`,
    );
  }

  const dc = ctx.decision_context;`;

const provenanceInsert = `  if (message.role !== "user") {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      \`source_turn_id must reference a user message, got role=\${message.role}\`,
    );
  }

  if (ctx.require_confirmation_turn_id === true && event.confirmation_turn_id == null) {
    throw new ConfirmationEventError(
      CONFIRMATION_SOURCE_INVALID,
      "confirmation_turn_id required for confirmation provenance",
    );
  }

  if (event.confirmation_turn_id != null) {
    const confirmation_turn_id = requireNonEmptyString(
      event.confirmation_turn_id,
      "confirmation_turn_id",
    );
    const confirmMessage = findSessionMessageByTurnId(
      ctx.messages,
      confirmation_turn_id,
    );
    if (!confirmMessage) {
      throw new ConfirmationEventError(
        CONFIRMATION_SOURCE_INVALID,
        \`confirmation_turn_id does not map to a message in current Session: \${confirmation_turn_id}\`,
      );
    }
    if (confirmMessage.role !== "user") {
      throw new ConfirmationEventError(
        CONFIRMATION_SOURCE_INVALID,
        \`confirmation_turn_id must reference a user message, got role=\${confirmMessage.role}\`,
      );
    }
    if (
      ctx.expected_confirmation_turn_id != null &&
      ctx.expected_confirmation_turn_id.trim() !== "" &&
      confirmation_turn_id !== ctx.expected_confirmation_turn_id.trim()
    ) {
      throw new ConfirmationEventError(
        CONFIRMATION_SOURCE_INVALID,
        \`confirmation_turn_id does not match expected confirm turn (\${ctx.expected_confirmation_turn_id})\`,
      );
    }
  }

  const dc = ctx.decision_context;`;

if (!conf.includes(provenanceAnchor)) {
  console.error("FATAL: provenance anchor not found");
  process.exit(1);
}
conf = conf.replace(provenanceAnchor, provenanceInsert);

// Also update applyFactConfirmToDc / applyConstraintConfirmToDc to pass source_turn_id
const oldApplyFact = `    const user_confirmed = deriveUserConfirmedFromEvents({
      status: f.status,
      verification_level: f.verification_level,
      events,
      target: { type: "fact", fact_id },
    });`;
const newApplyFact = `    const user_confirmed = deriveUserConfirmedFromEvents({
      status: f.status,
      verification_level: f.verification_level,
      events,
      target: { type: "fact", fact_id },
      source_turn_id: f.source_turn_id,
    });`;
if (!conf.includes(oldApplyFact)) {
  console.error("FATAL: applyFactConfirm derive block not found");
  process.exit(1);
}
conf = conf.replace(oldApplyFact, newApplyFact);

const oldApplyConstraint = `    const user_confirmed = deriveUserConfirmedFromEvents({
      status: c.status,
      verification_level: c.verification_level,
      events,
      target: { type: "constraint", constraint_id },
    });`;
const newApplyConstraint = `    const user_confirmed = deriveUserConfirmedFromEvents({
      status: c.status,
      verification_level: c.verification_level,
      events,
      target: { type: "constraint", constraint_id },
      source_turn_id: c.source_turn_id,
    });`;
if (!conf.includes(oldApplyConstraint)) {
  console.error("FATAL: applyConstraintConfirm derive block not found");
  process.exit(1);
}
conf = conf.replace(oldApplyConstraint, newApplyConstraint);

fs.writeFileSync(confPath, conf, "utf8");
console.log("patched confirmation-event.ts");
