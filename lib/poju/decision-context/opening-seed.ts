/**
 * Opening → DC draft seed (Definition + initial Facts + Constraints) — Contract §14.1.
 * Forbidden: DIR, Agenda, Hypothesis, model-inferred RealityFact, breakthrough_core as user fact source.
 * Phase 3 S3/S4: do NOT use user_confirmed_event?: boolean as formal confirm source.
 * Prefer Confirmation Events; ephemeral has_user_confirm_event only for seed-time derive.
 * Gate confirm must NOT auto-confirm all facts (handled by Opening Anchor / S3).
 */

import { buildRealityFact, deriveUserConfirmed } from "./fact-combination";
import type {
  Constraint,
  ConstraintCategory,
  ConstraintRigidity,
  DecisionContext,
  Definition,
  RealityFact,
  VerificationLevel,
} from "./types";
import { assertLegalFactCombination } from "./fact-combination";

export const OPENING_SEED_MISSING_SOURCE_TURN =
  "OPENING_SEED_MISSING_SOURCE_TURN" as const;
export const OPENING_SEED_FORBIDDEN_ENTITY =
  "OPENING_SEED_FORBIDDEN_ENTITY" as const;

export class OpeningSeedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpeningSeedError";
    this.code = code;
  }
}

export interface OpeningDilemmaBuffer {
  concrete_event: string | null;
  stakes: string | null;
  sticking_point: string | null;
}

export interface OpeningDirectionBuffer {
  wants: string | null;
  priority: string | null;
}

/** User-sourced statement eligible to become a RealityFact (never model insight). */
export interface OpeningUserStatement {
  statement: string;
  /** Stable id or null → generated. */
  fact_id?: string;
  verification_level: Extract<
    VerificationLevel,
    "user_asserted" | "user_estimate"
  >;
  /**
   * Ephemeral seed-time flag only — NOT a formal Confirmation Event.
   * Prefer wiring ConfirmationEvent[] and deriveUserConfirmedFromEvents at product paths.
   * @deprecated boolean must not be formal confirm authority (Contract §11.5).
   */
  has_user_confirm_event?: boolean;
  /**
   * @deprecated Deleted as formal confirm source (Contract §11.5 / Mapping §5.2).
   * Accepted only as input alias → has_user_confirm_event for prior suite compat.
   */
  user_confirmed_event?: boolean;
  status?: "confirmed" | "unverified";
  /**
   * Required for RealityFact creation (Contract §14.1).
   * Must be a non-empty turn id naming the user statement source.
   */
  source_turn_id: string;
  fact_roles?: string[];
}

export interface OpeningUserConstraint {
  statement: string;
  category: ConstraintCategory;
  rigidity?: ConstraintRigidity;
  constraint_id?: string;
  verification_level?: Extract<
    VerificationLevel,
    "user_asserted" | "user_estimate"
  >;
  /** Ephemeral only — not formal Confirmation Event authority. */
  has_user_confirm_event?: boolean;
  /** @deprecated Alias only — not formal Confirmation Event authority. */
  user_confirmed_event?: boolean;
  /** Required for Constraint creation (Contract §14.1 source clarity). */
  source_turn_id: string;
}

export interface SeedOpeningInput {
  context_id?: string;
  session_id?: string;
  now?: string;
  /**
   * Temporary agent_v2 Opening buffers for Definition only — NOT formal RealityFact authority.
   * Must NOT be confused with breakthrough_core (banned as user fact source).
   */
  core_dilemma: OpeningDilemmaBuffer | null;
  desired_direction: OpeningDirectionBuffer | null;
  /** Only user-explicit sentences; model insights / breakthrough_core must be omitted. */
  user_statements?: OpeningUserStatement[];
  user_constraints?: OpeningUserConstraint[];
  decision_question?: string | null;
  unacceptable_outcomes?: string[];
  /**
   * Hard ban surface: if caller passes these, seed MUST fail (Contract §14.1).
   * Not part of happy-path API — present so misuse is catchable.
   */
  hypotheses?: unknown;
  dirs?: unknown;
  agenda?: unknown;
  breakthrough_core?: unknown;
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

function nonempty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
}

function requireSourceTurnId(
  raw: string | null | undefined,
  kind: "fact" | "constraint",
  index: number,
): string {
  const id = nonempty(raw ?? null);
  if (!id) {
    throw new OpeningSeedError(
      OPENING_SEED_MISSING_SOURCE_TURN,
      `Opening Seed ${kind}[${index}] requires non-empty source_turn_id (Contract §14.1)`,
    );
  }
  return id;
}

export function buildDefinitionFromOpeningBuffers(
  dilemma: OpeningDilemmaBuffer | null,
  direction: OpeningDirectionBuffer | null,
  opts?: {
    decision_question?: string | null;
    unacceptable_outcomes?: string[];
  },
): Definition {
  const priorities: string[] = [];
  const p = nonempty(direction?.priority ?? null);
  if (p) priorities.push(p);
  return {
    concrete_event: nonempty(dilemma?.concrete_event ?? null),
    stakes: nonempty(dilemma?.stakes ?? null),
    desired_outcome: nonempty(direction?.wants ?? null),
    decision_question: nonempty(opts?.decision_question ?? null),
    goal_priorities: priorities,
    unacceptable_outcomes: (opts?.unacceptable_outcomes ?? [])
      .map((x) => x.trim())
      .filter(Boolean),
  };
}

export function seedDecisionContextFromOpening(
  input: SeedOpeningInput,
): DecisionContext {
  // Ban creating Hypotheses / DIR / Agenda / breakthrough_core-as-fact via this path.
  if (input.hypotheses != null) {
    throw new OpeningSeedError(
      OPENING_SEED_FORBIDDEN_ENTITY,
      "Opening Seed must not create or accept Hypotheses (Contract §14.1)",
    );
  }
  if (input.dirs != null) {
    throw new OpeningSeedError(
      OPENING_SEED_FORBIDDEN_ENTITY,
      "Opening Seed must not create or accept DIR (Contract §14.1)",
    );
  }
  if (input.agenda != null) {
    throw new OpeningSeedError(
      OPENING_SEED_FORBIDDEN_ENTITY,
      "Opening Seed must not create or accept Agenda (Contract §14.1)",
    );
  }
  if (input.breakthrough_core != null) {
    throw new OpeningSeedError(
      OPENING_SEED_FORBIDDEN_ENTITY,
      "breakthrough_core must not be used as user fact source (Contract §14.1)",
    );
  }

  const now = input.now ?? new Date().toISOString();
  const context_id =
    input.context_id ??
    newId(input.session_id ? `dc_${input.session_id}` : "dc");

  const definition = buildDefinitionFromOpeningBuffers(
    input.core_dilemma,
    input.desired_direction,
    {
      decision_question: input.decision_question,
      unacceptable_outcomes: input.unacceptable_outcomes,
    },
  );

  const reality_facts: RealityFact[] = [];
  for (const [i, stmt] of (input.user_statements ?? []).entries()) {
    const statement = stmt.statement.trim();
    if (!statement) continue;
    const source_turn_id = requireSourceTurnId(stmt.source_turn_id, "fact", i);
    const hasEvt = Boolean(
      stmt.has_user_confirm_event ?? stmt.user_confirmed_event,
    );
    // user_estimate stays unverified even after confirm (Contract §11.5 / P3-113).
    // Gate confirm must not auto-confirm — only explicit per-fact event flag / Confirmation Event.
    const status =
      stmt.status ??
      (stmt.verification_level === "user_estimate"
        ? "unverified"
        : hasEvt
          ? "confirmed"
          : "unverified");
    reality_facts.push(
      buildRealityFact({
        fact_id: stmt.fact_id ?? newId(`fact_opening_${i}`),
        statement,
        status,
        verification_level: stmt.verification_level,
        source_stage: "opening",
        source_turn_id,
        has_user_confirm_event: hasEvt,
        fact_roles: stmt.fact_roles,
      }),
    );
  }

  const constraints: Constraint[] = [];
  for (const [i, c] of (input.user_constraints ?? []).entries()) {
    const statement = c.statement.trim();
    if (!statement) continue;
    const source_turn_id = requireSourceTurnId(c.source_turn_id, "constraint", i);
    const verification_level = c.verification_level ?? "user_asserted";
    const hasEvt = Boolean(c.has_user_confirm_event ?? c.user_confirmed_event);
    const status =
      verification_level === "user_estimate"
        ? "unverified"
        : hasEvt
          ? "confirmed"
          : "unverified";
    assertLegalFactCombination(status, verification_level);
    constraints.push({
      constraint_id: c.constraint_id ?? newId(`constraint_opening_${i}`),
      statement,
      category: c.category,
      status,
      verification_level,
      source_stage: "opening",
      source_turn_id,
      rigidity: c.rigidity ?? "hard",
      user_confirmed: deriveUserConfirmed({
        status,
        verification_level,
        has_user_confirm_event: hasEvt,
      }),
      updated_at: now,
    });
  }

  return {
    context_id,
    version: 1,
    status: "draft",
    definition,
    reality_facts,
    constraints,
    hypotheses: [],
    dirs: [],
    conflicts: [],
    content_hash: null,
    created_at: now,
    updated_at: now,
    parent_version: null,
    information_boundaries: [],
    delivery_mode: null,
  };
}
