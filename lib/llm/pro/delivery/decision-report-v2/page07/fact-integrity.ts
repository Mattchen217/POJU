/**
 * Page07 fact citation stance + participant verification/role integrity.
 * Fail-closed. Structural stance is required; keyword hedges alone do not launder.
 */

export const PAGE07_REALITY_CITATION_STANCES = [
  "as_confirmed",
  "as_conditional",
  "as_uncertain",
] as const;

export type Page07RealityCitationStance =
  (typeof PAGE07_REALITY_CITATION_STANCES)[number];

export type Page07ParticipantVerificationStatus =
  | "confirmed"
  | "unverified"
  | "unknown"
  | "user_stated"
  | "missing";

/** Neutral roles that do not claim a concrete identity. */
export const PAGE07_NEUTRAL_PARTICIPANT_ROLES = new Set([
  "other",
  "party",
  "third_party",
  "unknown",
  "unspecified",
  "neutral",
]);

/**
 * Precise per-role synonym maps. partner must NOT match boss, etc.
 * Each role is checked only against its own pattern.
 */
export const PAGE07_ROLE_SUPPORT_PATTERNS: Readonly<
  Record<string, RegExp>
> = {
  partner:
    /(?:partner(?:ship)?|business\s+partner|co-?signer|合伙人|合作伙伴|合资)/i,
  business_partner:
    /(?:business\s+partner|合伙人|合作伙伴|合资|co-?signer)/i,
  spouse: /(?:spouse|husband|wife|married|配偶|丈夫|妻子|太太|先生)/i,
  boss: /(?:\bboss\b|manager|supervisor|employer|上司|老板|直属领导|雇主)/i,
  family: /(?:\bfamily\b|parent|sibling|亲属|家人|父母|兄弟|姐妹)/i,
  advisor: /(?:\badvisor\b|consultant|顾问|咨询师)/i,
  investor: /(?:\binvestor\b|投资人|出资方|出资)/i,
  colleague: /(?:colleague|coworker|co-worker|同事)/i,
};

const ASSERTIVE_CLAIM =
  /将承担|将负责|会承担|一定会|已经承担|已经确认对方|确认为|is\s+responsible|will\s+(?:cover|pay|handle|bear|take|fund)|covers\s+half|shall\s+(?:cover|pay|bear)|definitely\s+(?:true|covers|pays)|already\s+confirmed|confirmed\s+fact/i;

const CONDITIONAL_FRAME =
  /如果|若该|若对方|假如|目前尚未|尚未验证|仍未确认|仍不确定|仍是未验证|conditional\s+on|if\s+the\b|if\s+.*\b(?:holds|confirms|is\s+verified|estimate)|unless\b|remains?\s+unverified|not\s+yet\s+(?:verified|confirmed)|still\s+unverified|estimate\s+holds|should\s+.*\bconfirm/i;

const TRAILING_HEDGE =
  /(?:仍需确认|尚未验证|仍不确定|still\s+needs?\s+(?:confirm|verification)|remains?\s+unverified|this\s+(?:is|remains)\s+unverified|not\s+yet\s+confirmed)\s*[。.!！]?$/i;

export function isConfirmedDcStatus(status: string | undefined): boolean {
  return status === "confirmed";
}

export function isNonConfirmedDcStatus(status: string | undefined): boolean {
  if (!status) return true;
  return status !== "confirmed";
}

/**
 * Max participant.verification_status allowed for one DC fact.
 * user_asserted / estimates never authorize participant "confirmed"
 * (independently verified strength).
 */
export function maxParticipantVerificationForFact(input: {
  status: string | undefined;
  verification_level?: string | undefined;
}): Page07ParticipantVerificationStatus | "fail_closed" {
  const status = (input.status ?? "").trim();
  if (!status) return "fail_closed";

  const level = (input.verification_level ?? "").trim();

  if (status === "confirmed") {
    if (level === "independently_verified") return "confirmed";
    // user_asserted / user_estimate / none / missing level → not independent
    return "user_stated";
  }
  if (
    status === "unverified" ||
    status === "user_estimate" ||
    status === "hypothesis" ||
    status === "conflict" ||
    status === "user_asserted"
  ) {
    return "unverified";
  }
  if (
    status === "unknown" ||
    status === "declined" ||
    status === "not_applicable"
  ) {
    return "unknown";
  }
  // Unknown status token → fail closed
  return "fail_closed";
}

const VERIFICATION_RANK: Record<Page07ParticipantVerificationStatus, number> = {
  confirmed: 4,
  user_stated: 3,
  unverified: 2,
  unknown: 1,
  missing: 0,
};

export function verificationIsWithinMax(
  declared: Page07ParticipantVerificationStatus,
  maxAllowed: Page07ParticipantVerificationStatus,
): boolean {
  return VERIFICATION_RANK[declared] <= VERIFICATION_RANK[maxAllowed];
}

/** Weakest (most conservative) max across facts. */
export function weakestMaxVerification(
  maxes: readonly Page07ParticipantVerificationStatus[],
): Page07ParticipantVerificationStatus {
  if (!maxes.length) return "missing";
  return maxes.reduce((a, b) =>
    VERIFICATION_RANK[a] <= VERIFICATION_RANK[b] ? a : b,
  );
}

export function roleIsNeutral(role: string): boolean {
  return PAGE07_NEUTRAL_PARTICIPANT_ROLES.has(role.trim().toLowerCase());
}

/**
 * Exact role grounding: the declared role's own synonym pattern must hit.
 * No cross-role keyword bag.
 */
export function roleSupportedByFactBlob(
  role: string,
  factBlob: string,
): boolean {
  const key = role.trim().toLowerCase();
  if (roleIsNeutral(key)) return true;
  const pattern = PAGE07_ROLE_SUPPORT_PATTERNS[key];
  if (!pattern) {
    // Unknown concrete role token: require the raw role string in the blob.
    return factBlob.toLowerCase().includes(key);
  }
  return pattern.test(factBlob);
}

export function textHasConditionalFrame(text: string): boolean {
  return CONDITIONAL_FRAME.test(text);
}

export function textHasAssertiveClaim(text: string): boolean {
  return ASSERTIVE_CLAIM.test(text);
}

/**
 * Deterministic body + trailing-only hedge → laundering; reject.
 */
export function textIsTrailingHedgeLaunder(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const parts = trimmed.split(/(?<=[。.!?！？])\s+/).filter((p) => p.trim());
  if (parts.length < 2) {
    // Single sentence ending with hedge after assertive mid-clause
    if (!TRAILING_HEDGE.test(trimmed)) return false;
    const withoutHedge = trimmed.replace(TRAILING_HEDGE, "").trim();
    return textHasAssertiveClaim(withoutHedge);
  }
  const last = parts[parts.length - 1]!;
  const body = parts.slice(0, -1).join(" ");
  return TRAILING_HEDGE.test(last) && textHasAssertiveClaim(body);
}

/**
 * When citing a non-confirmed fact with conditional/uncertain stance,
 * the unit text must keep uncertainty (frame OR no assertive claim),
 * and must not launder via a trailing hedge alone.
 */
export function nonConfirmedCitationTextOk(input: {
  stance: Page07RealityCitationStance;
  text: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.stance === "as_confirmed") {
    return { ok: false, reason: "as_confirmed_on_nonconfirmed" };
  }
  if (textIsTrailingHedgeLaunder(input.text)) {
    return { ok: false, reason: "trailing_hedge_launder" };
  }
  if (textHasAssertiveClaim(input.text) && !textHasConditionalFrame(input.text)) {
    return { ok: false, reason: "assertive_without_conditional_frame" };
  }
  return { ok: true };
}
