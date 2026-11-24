/**
 * Page07 fact citation stance + participant verification/role integrity.
 * Fail-closed. Structural stance is required; keyword hedges alone do not launder.
 * R3/R4: sentence-level assertive / conditional / uncertain checks; Chinese
 * sentence boundaries without requiring whitespace; no token-overlap attribution;
 * no cross-sentence frame sponsorship.
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

/**
 * Deterministic / settled third-party identity, behavior, commitment, resource,
 * or outcome claims — ZH + EN. Ordinary present tense is included.
 */
const ASSERTIVE_CLAIM =
  /(?:(?:将|会|已经)?(?:承担|负责|支付|覆盖|出资)|已经决定|已经确认|确认为|属于|拥有|已经完成|正在执行|(?:^|[\s，,：:])[A-Za-z\u4e00-\u9fff][A-Za-z\u4e00-\u9fff\s·]{0,24}是)|(?:\b(?:pays|covers|bears|funds|handles|owns|belongs)\b|\b(?:is|are)\s+(?:paying|covering|bearing|funding|handling|responsible|confirmed|the\s+(?:partner|boss|spouse|investor|advisor|owner))\b|\bwill\s+(?:cover|pay|handle|bear|take|fund|own)\b|\bhas\s+(?:agreed|decided|confirmed|paid|covered|funded|completed)\b|\bshall\s+(?:cover|pay|bear|fund)\b|\bdefinitely\s+(?:true|covers|pays|confirmed)\b|\balready\s+confirmed\b|\bconfirmed\s+fact\b)/i;

const CONDITIONAL_FRAME =
  /如果|若该|若对方|假如|在[^。.!！？]{0,24}前提|取决于|conditional\s+on|if\s+the\b|if\s+.*\b(?:holds|confirms|is\s+verified|estimate|granted|approved|receives?|approval)|unless\b|should\s+.*\bconfirm|provided\s+that\b|only\s+if\b/i;

const UNCERTAINTY_FRAME =
  /可能|或许|也许|尚未验证|仍未确认|仍不确定|仍是未验证|未验证|不确定|估计|据说|据称|might\b|may\b|maybe\b|possibly\b|allegedly\b|reportedly\b|unverified|uncertain|estimate\b|remains?\s+unverified|not\s+yet\s+(?:verified|confirmed)|still\s+unverified|without\s+confirmation|treat\s+(?:as|the)\s+unknown|as\s+unknown\b/i;

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

/**
 * Split on sentence terminators without requiring whitespace after Chinese
 * punctuation. Avoids splitting decimals (3.14). Preserves order.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === "。" || ch === "！" || ch === "？") {
      const piece = trimmed.slice(start, i + 1).trim();
      if (piece) out.push(piece);
      start = i + 1;
      continue;
    }
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // Decimal: digit.digit — not a sentence boundary.
    if (
      ch === "." &&
      i > 0 &&
      /\d/.test(trimmed[i - 1]!) &&
      i + 1 < trimmed.length &&
      /\d/.test(trimmed[i + 1]!)
    ) {
      continue;
    }

    const next = i + 1 < trimmed.length ? trimmed[i + 1]! : "";
    let split = false;
    if (ch === "!" || ch === "?") {
      split =
        next === "" ||
        /\s/.test(next) ||
        /[A-Za-z\u4e00-\u9fff]/.test(next);
    } else {
      // Period: end, whitespace, CJK, or capital letter starting next sentence
      // (with or without space). Lowercase continuation (e.g. abbreviations) kept.
      split =
        next === "" ||
        /\s/.test(next) ||
        /[\u4e00-\u9fff]/.test(next) ||
        /[A-Z]/.test(next);
    }
    if (!split) continue;
    const piece = trimmed.slice(start, i + 1).trim();
    if (piece) out.push(piece);
    start = i + 1;
  }
  const tail = trimmed.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export function textHasConditionalFrame(text: string): boolean {
  return CONDITIONAL_FRAME.test(text);
}

export function textHasUncertaintyFrame(text: string): boolean {
  return UNCERTAINTY_FRAME.test(text);
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
  const parts = splitIntoSentences(trimmed);
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

function sentenceHasRequiredFrame(
  sentence: string,
  stance: Exclude<Page07RealityCitationStance, "as_confirmed">,
): boolean {
  if (stance === "as_conditional") return textHasConditionalFrame(sentence);
  return textHasUncertaintyFrame(sentence);
}

/**
 * When citing a non-confirmed fact with conditional/uncertain stance,
 * stance framing must attach to the same sentence as any assertive claim.
 * Cross-sentence if/uncertainty cannot sponsor a bare assert.
 *
 * R4: no token-overlap attribution. Every sentence is checked. In multi-fact
 * units, a bare assertive sentence cannot be ignored just because overlap
 * failed — confirmed neighbors must not launder non-confirmed cites.
 */
export function nonConfirmedCitationTextOk(input: {
  stance: Page07RealityCitationStance;
  text: string;
  /** DC fact statement — required so status/statement pairing stays fail-closed. */
  factStatement?: string;
  /** All reality_fact_ids on the same unit (informational; not used to skip checks). */
  unitFactIds?: readonly string[];
}): { ok: true } | { ok: false; reason: string } {
  if (input.stance === "as_confirmed") {
    return { ok: false, reason: "as_confirmed_on_nonconfirmed" };
  }
  if (textIsTrailingHedgeLaunder(input.text)) {
    return { ok: false, reason: "trailing_hedge_launder" };
  }

  const factStatement = (input.factStatement ?? "").trim();
  if (!factStatement) {
    return { ok: false, reason: "fact_statement_unresolvable" };
  }

  const sentences = splitIntoSentences(input.text);
  if (!sentences.length) {
    return { ok: false, reason: "empty_citation_text" };
  }

  // Conservative: check every sentence. Do not skip via token overlap.
  void input.unitFactIds;
  for (const sentence of sentences) {
    if (
      textHasAssertiveClaim(sentence) &&
      !sentenceHasRequiredFrame(sentence, input.stance)
    ) {
      return {
        ok: false,
        reason:
          input.stance === "as_conditional"
            ? "assertive_without_same_sentence_conditional"
            : "assertive_without_same_sentence_uncertainty",
      };
    }
  }

  if (input.stance === "as_conditional") {
    if (!sentences.some((s) => textHasConditionalFrame(s))) {
      return { ok: false, reason: "missing_fact_related_conditional" };
    }
  } else if (input.stance === "as_uncertain") {
    if (!sentences.some((s) => textHasUncertaintyFrame(s))) {
      return { ok: false, reason: "missing_fact_related_uncertainty" };
    }
  }

  return { ok: true };
}
