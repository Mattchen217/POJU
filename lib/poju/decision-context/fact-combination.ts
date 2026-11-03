/**
 * Fact status × verification_level legality + derived user_confirmed.
 * Hard rule: independently_verified MUST NOT imply user_confirmed.
 */

import type {
  FactCombinationInput,
  FactStatus,
  RealityFact,
  VerificationLevel,
} from "./types";

/** Legal pairs from Eng SoT §2. */
export const LEGAL_FACT_COMBINATIONS: ReadonlyArray<
  readonly [FactStatus, VerificationLevel]
> = [
  ["confirmed", "user_asserted"],
  ["confirmed", "independently_verified"],
  ["unverified", "user_estimate"],
  ["unverified", "user_asserted"],
  ["unknown", "none"],
  ["declined", "none"],
  ["not_applicable", "none"],
] as const;

const LEGAL_SET = new Set(
  LEGAL_FACT_COMBINATIONS.map(([s, v]) => `${s}::${v}`),
);

export function isLegalFactCombination(
  status: FactStatus,
  verification_level: VerificationLevel,
): boolean {
  return LEGAL_SET.has(`${status}::${verification_level}`);
}

export class IllegalFactCombinationError extends Error {
  readonly status: FactStatus;
  readonly verification_level: VerificationLevel;

  constructor(status: FactStatus, verification_level: VerificationLevel) {
    super(
      `Illegal RealityFact combination: status=${status} verification_level=${verification_level}`,
    );
    this.name = "IllegalFactCombinationError";
    this.status = status;
    this.verification_level = verification_level;
  }
}

/**
 * Derive user_confirmed.
 * - Only true when has_user_confirm_event is true AND status/verification allow confirmation semantics.
 * - independently_verified alone → false.
 * - unknown / declined / not_applicable → always false (even if a bogus event flag is passed).
 */
export function deriveUserConfirmed(input: FactCombinationInput): boolean {
  const { status, verification_level, has_user_confirm_event } = input;
  if (!has_user_confirm_event) return false;
  if (
    status === "unknown" ||
    status === "declined" ||
    status === "not_applicable"
  ) {
    return false;
  }
  // Independently verified without a user confirm event cannot set this; event required above.
  // Even with event, independently_verified does not *imply* user_confirmed by itself —
  // only an explicit user-confirm event does. If the event is present, user_confirmed may be true
  // for confirmed+user_asserted or unverified+user_asserted (user said it / confirmed it).
  // For independently_verified: user_confirmed stays false unless the event is specifically a
  // user confirm (not verification). Spec: independently_verified must NOT imply user_confirmed.
  if (verification_level === "independently_verified") {
    return false;
  }
  return (
    (status === "confirmed" || status === "unverified") &&
    (verification_level === "user_asserted" ||
      verification_level === "user_estimate")
  );
}

export function assertLegalFactCombination(
  status: FactStatus,
  verification_level: VerificationLevel,
): void {
  if (!isLegalFactCombination(status, verification_level)) {
    throw new IllegalFactCombinationError(status, verification_level);
  }
}

export type BuildRealityFactInput = Omit<RealityFact, "user_confirmed"> & {
  has_user_confirm_event?: boolean;
  user_confirmed?: never;
};

/**
 * Build a RealityFact with validated combination and derived user_confirmed.
 * Rejects illegal status×verification pairs.
 */
export function buildRealityFact(input: BuildRealityFactInput): RealityFact {
  assertLegalFactCombination(input.status, input.verification_level);
  const user_confirmed = deriveUserConfirmed({
    status: input.status,
    verification_level: input.verification_level,
    has_user_confirm_event: input.has_user_confirm_event,
  });
  const {
    has_user_confirm_event: _evt,
    ...rest
  } = input as BuildRealityFactInput & { has_user_confirm_event?: boolean };
  return {
    ...rest,
    user_confirmed,
  };
}

/** Re-derive user_confirmed after a status/verification/event change. */
export function withDerivedUserConfirmed(
  fact: Omit<RealityFact, "user_confirmed"> & {
    user_confirmed?: boolean;
    has_user_confirm_event?: boolean;
  },
): RealityFact {
  assertLegalFactCombination(fact.status, fact.verification_level);
  const user_confirmed = deriveUserConfirmed({
    status: fact.status,
    verification_level: fact.verification_level,
    has_user_confirm_event: fact.has_user_confirm_event,
  });
  const { has_user_confirm_event: _e, ...rest } = fact;
  return { ...rest, user_confirmed };
}
