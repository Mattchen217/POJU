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
  /(?:(?:将|会|已经)?(?:承担|负责|支付|覆盖|出资|投资|雇佣|招聘)|已经决定|已经确认|确认为|属于|拥有|已经完成|正在执行|(?:^|[\s，,：:])[A-Za-z\u4e00-\u9fff][A-Za-z\u4e00-\u9fff\s·]{0,24}是)|(?:\b(?:pays|covers|bears|funds|handles|owns|belongs|invests|hires)\b|\b(?:is|are)\s+(?:paying|covering|bearing|funding|handling|investing|hiring|responsible|confirmed|the\s+(?:partner|boss|spouse|investor|advisor|owner))\b|\bwill\s+(?:cover|pay|handle|bear|take|fund|own|invest|hire)\b|\bhas\s+(?:agreed|decided|confirmed|paid|covered|funded|completed|invested|hired)\b|\bshall\s+(?:cover|pay|bear|fund|invest|hire)\b|\bdefinitely\s+(?:true|covers|pays|confirmed)\b|\balready\s+confirmed\b|\bconfirmed\s+fact\b)/i;

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

/** Title / Latin abbreviations that end with a period (case-insensitive). */
const PERIOD_ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "jr",
  "vs",
  "etc",
  "approx",
  "dept",
  "est",
  "vol",
  "fig",
  "no",
]);

/**
 * True when the period at `index` is inside a protected token (abbrev, initials,
 * a.m./p.m., URL, email, domain) and must not end a sentence.
 */
export function isProtectedPeriod(text: string, index: number): boolean {
  if (text[index] !== ".") return false;

  // Decimal: digit.digit
  if (
    index > 0 &&
    /\d/.test(text[index - 1]!) &&
    index + 1 < text.length &&
    /\d/.test(text[index + 1]!)
  ) {
    return true;
  }

  let tokenStart = index;
  while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1]!)) tokenStart -= 1;
  let tokenEnd = index + 1;
  while (tokenEnd < text.length && !/\s/.test(text[tokenEnd]!)) tokenEnd += 1;
  const token = text.slice(tokenStart, tokenEnd);
  const leftIncludingPeriod = text.slice(tokenStart, index + 1);

  // URL / email / domain: period mid-token is never a sentence boundary.
  if (
    /@/.test(token) ||
    /^https?:\/\//i.test(token) ||
    /^www\./i.test(token) ||
    /\.[a-z0-9-]+(\/|:|\?|#|$)/i.test(token)
  ) {
    if (index < tokenEnd - 1) return true;
    // Trailing period glued to URL/email ("https://example.com.") — treat as
    // sentence end only when followed by whitespace/EOF; mid-token already protected.
  }

  const leftLower = leftIncludingPeriod.toLowerCase();
  // e.g. / i.e. — protect both internal and trailing abbrev periods so
  // "e.g. Alex" stays one clause until a later real boundary.
  if (/(?:^|[^a-z])(?:e\.g|i\.e)\.$/i.test(leftIncludingPeriod)) return true;
  // a.m. / p.m. — protect ONLY the internal period ("p." before "m").
  // The trailing period after "m" is a candidate sentence boundary so that
  // "3.14 p.m. Alex may join." becomes two sentences.
  if (
    /[ap]\.$/i.test(text.slice(Math.max(0, index - 1), index + 1)) &&
    index + 1 < text.length &&
    /m/i.test(text[index + 1]!)
  ) {
    return true;
  }
  // Title abbreviations: Dr. Mr. Mrs. ...
  const abbrevMatch = leftLower.match(/([a-z]+)\.$/);
  if (abbrevMatch && PERIOD_ABBREVIATIONS.has(abbrevMatch[1]!)) return true;

  // Dotted acronyms: U.S. / U.K. — never treat internal or trailing acronym
  // periods as sentence boundaries (real boundary comes later).
  if (/^(?:[A-Z]\.){2,}$/.test(token) || /^(?:[A-Z]\.){2,}$/.test(leftIncludingPeriod)) {
    return true;
  }
  // Initials: "U." awaiting more letters ("U.S"), or "A. Smith".
  if (/[A-Z]\.$/.test(text.slice(Math.max(0, index - 1), index + 1))) {
    const next = index + 1 < text.length ? text[index + 1]! : "";
    if (/[A-Z]/.test(next)) return true;
    if (/\s/.test(next) && /^[A-Z]\.$/.test(leftIncludingPeriod)) return true;
  }

  return false;
}

function nextNonWhitespace(text: string, from: number): string {
  let j = from;
  while (j < text.length && /\s/.test(text[j]!)) j += 1;
  return j < text.length ? text[j]! : "";
}

/**
 * Split on sentence terminators without requiring whitespace after Chinese
 * punctuation. Protects decimals, abbreviations, initials, URLs, and emails.
 * Preserves order; never emits empty sentences.
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

    if (ch === "." && isProtectedPeriod(trimmed, i)) continue;

    const next = i + 1 < trimmed.length ? trimmed[i + 1]! : "";
    let split = false;
    if (ch === "!" || ch === "?") {
      split =
        next === "" ||
        /\s/.test(next) ||
        /[A-Za-z\u4e00-\u9fff]/.test(next);
    } else {
      // Period is a candidate only when unprotected. Do NOT treat
      // "period + uppercase" alone as sufficient — peek past whitespace:
      // lowercase ⇒ abbreviation/acronym continuation; uppercase/CJK ⇒ boundary.
      const peek = nextNonWhitespace(trimmed, i + 1);
      if (peek === "") {
        split = true;
      } else if (/[\u4e00-\u9fff]/.test(peek)) {
        split = true;
      } else if (/[A-Z0-9]/.test(peek)) {
        split = true;
      } else if (/[a-z]/.test(peek)) {
        split = false;
      } else if (!/\s/.test(next) && /[A-Za-z\u4e00-\u9fff]/.test(next)) {
        // "end.Alex" / "end.中文" without space
        split = true;
      }
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

/**
 * Program-side allowlist: DC fact_roles that may qualify as Page07 third-party
 * behavior evidence. Identity / location / job / relationship roles are excluded.
 * Namespaced tags `…/role/<code>` are accepted when <code> is on the allowlist.
 */
export const PAGE07_BEHAVIOR_EVIDENCE_FACT_ROLES: ReadonlySet<string> = new Set([
  "third_party_commitment",
  "third_party_action",
  "resource_commitment",
  "written_agreement",
  "party_obligation",
]);

const BEHAVIOR_TOKEN_STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "with",
  "that",
  "this",
  "it",
  "as",
  "at",
  "by",
  "from",
  "we",
  "our",
  "user",
  "users",
  "my",
  "his",
  "her",
  "their",
  "has",
  "have",
  "had",
  "will",
  "can",
  "may",
  "might",
  "writing",
  "written",
  "agreed",
  "agree",
  "decided",
  "decide",
  "的",
  "了",
  "在",
  "是",
  "与",
  "和",
  "或",
]);

/** Quantity / ratio / amount modifiers — never count as behavior objects. */
const BEHAVIOR_QUANTITY_MODIFIERS = new Set([
  "half",
  "quarter",
  "percent",
  "percentage",
  "pct",
  "all",
  "full",
  "entire",
  "some",
  "any",
  "one",
  "two",
  "three",
  "four",
  "five",
  "ten",
  "fifty",
  "hundred",
  "thousand",
]);

/**
 * Compatible payment / coverage action class. hire / invest stay separate.
 * Broad verbs alone never prove object identity.
 */
const BEHAVIOR_ACTION_CLASS: Readonly<Record<string, string>> = {
  cover: "pay_cover",
  covers: "pay_cover",
  covering: "pay_cover",
  pay: "pay_cover",
  pays: "pay_cover",
  paying: "pay_cover",
  paid: "pay_cover",
  bear: "pay_cover",
  bears: "pay_cover",
  bearing: "pay_cover",
  fund: "pay_cover",
  funds: "pay_cover",
  funding: "pay_cover",
  funded: "pay_cover",
  handle: "pay_cover",
  handles: "pay_cover",
  handling: "pay_cover",
  承担: "pay_cover",
  支付: "pay_cover",
  覆盖: "pay_cover",
  出资: "pay_cover",
  hire: "hire",
  hires: "hire",
  hiring: "hire",
  hired: "hire",
  雇佣: "hire",
  招聘: "hire",
  invest: "invest",
  invests: "invest",
  investing: "invest",
  invested: "invest",
  投资: "invest",
};

/**
 * Specific object anchors — identify which concrete obligation is meant.
 * These may synonym-fold (relocation↔moving) but must NOT collapse across
 * distinct obligations (relocation ≠ rent ≠ salary).
 */
const BEHAVIOR_SPECIFIC_OBJECT_GROUPS: readonly (readonly string[])[] = [
  ["relocation", "relocating", "moving", "move"],
  ["rent", "rental", "rents"],
  ["deposit", "deposits"],
  ["salary", "salaries", "wage", "wages", "payroll"],
  ["employee", "employees", "staff", "worker", "workers"],
  ["apartment", "flat", "housing"],
  ["schedule", "schedules", "timing"],
];

/**
 * Domain-level specifics that conflict when both sides name different domains
 * (e.g. relocation deposit vs rent deposit share "deposit" but conflict).
 */
const BEHAVIOR_DOMAIN_SPECIFICS: ReadonlySet<string> = new Set([
  "relocation",
  "rent",
  "salary",
  "employee",
  "apartment",
]);

/**
 * Generic descriptors — never sufficient alone for a match.
 * cost/expenses must not launder rent vs relocation.
 */
const BEHAVIOR_GENERIC_OBJECT_GROUPS: readonly (readonly string[])[] = [
  ["cost", "costs", "expense", "expenses"],
  ["payment", "payments"],
  ["amount", "amounts"],
  ["money"],
  ["fee", "fees"],
  ["charge", "charges"],
];

const BEHAVIOR_SPECIFIC_CONCEPT: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const group of BEHAVIOR_SPECIFIC_OBJECT_GROUPS) {
    const concept = group[0]!;
    for (const t of group) m.set(t, concept);
  }
  return m;
})();

const BEHAVIOR_GENERIC_CONCEPT: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const group of BEHAVIOR_GENERIC_OBJECT_GROUPS) {
    const concept = group[0]!;
    for (const t of group) m.set(t, concept);
  }
  return m;
})();

export type Page07BehaviorAnchor = {
  actionClass: string;
  /** Concrete obligation anchors (synonym-collapsed). Required for a match. */
  specificObjectConcepts: ReadonlySet<string>;
  /** Soft descriptors (cost/expense/…). Never sufficient alone. */
  genericObjectDescriptors: ReadonlySet<string>;
};

export function factHasBehaviorEvidenceRole(
  roles: readonly string[] | undefined,
): boolean {
  for (const raw of roles ?? []) {
    const role = raw.trim();
    if (!role) continue;
    if (PAGE07_BEHAVIOR_EVIDENCE_FACT_ROLES.has(role)) return true;
    const m = role.match(/\/role\/([^/]+)$/);
    if (m && PAGE07_BEHAVIOR_EVIDENCE_FACT_ROLES.has(m[1]!)) return true;
  }
  return false;
}

function tokenizeBehaviorLexemes(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isQuantityOrBareNumber(token: string): boolean {
  if (BEHAVIOR_QUANTITY_MODIFIERS.has(token)) return true;
  if (/^\d+$/.test(token)) return true;
  if (/^\d+%$/.test(token)) return true;
  return false;
}

function classifyObjectToken(
  token: string,
): { kind: "specific" | "generic"; concept: string } | null {
  if (token.length < 2) return null;
  if (BEHAVIOR_TOKEN_STOP.has(token)) return null;
  if (isQuantityOrBareNumber(token)) return null;
  if (BEHAVIOR_ACTION_CLASS[token]) return null;
  const specific = BEHAVIOR_SPECIFIC_CONCEPT.get(token);
  if (specific) return { kind: "specific", concept: specific };
  const generic = BEHAVIOR_GENERIC_CONCEPT.get(token);
  if (generic) return { kind: "generic", concept: generic };
  // Unknown content word after the verb: treat as specific (fail-closed identity).
  return { kind: "specific", concept: token };
}

/**
 * Deterministic action + object anchor for a behavior claim.
 * Fail-closed: missing action class or no specific object concept ⇒ null.
 * Generic-only phrases ("cover the cost") are unresolvable.
 */
export function extractBehaviorAnchor(
  text: string,
  displayLabel: string,
): Page07BehaviorAnchor | null {
  const label = displayLabel.trim().toLowerCase();
  const labelParts = new Set(label.split(/\s+/).filter(Boolean));
  const tokens = tokenizeBehaviorLexemes(text).filter(
    (t) => t !== label && !labelParts.has(t),
  );
  if (!tokens.length) return null;

  let actionClass: string | null = null;
  let lastActionIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const cls = BEHAVIOR_ACTION_CLASS[tokens[i]!];
    if (cls) {
      lastActionIdx = i;
      actionClass = cls;
    }
  }
  if (!actionClass || lastActionIdx < 0) return null;

  const collect = (fromIdx: number, skipActionOnly: boolean) => {
    const specific = new Set<string>();
    const generic = new Set<string>();
    for (let i = fromIdx; i < tokens.length; i++) {
      if (skipActionOnly && BEHAVIOR_ACTION_CLASS[tokens[i]!]) continue;
      if (i === lastActionIdx) continue;
      const classified = classifyObjectToken(tokens[i]!);
      if (!classified) continue;
      if (classified.kind === "specific") specific.add(classified.concept);
      else generic.add(classified.concept);
    }
    return { specific, generic };
  };

  // Prefer tokens after the last action verb.
  let { specific, generic } = collect(lastActionIdx + 1, false);
  if (!specific.size && !generic.size) {
    ({ specific, generic } = collect(0, true));
  }
  // Generic-only / empty specific ⇒ cannot identify the obligation.
  if (!specific.size) return null;
  return {
    actionClass,
    specificObjectConcepts: specific,
    genericObjectDescriptors: generic,
  };
}

/**
 * Same concrete behavior only when:
 * - action classes match;
 * - at least one specific object concept overlaps;
 * - domain-level specifics do not conflict (relocation ≠ rent even if both
 *   share deposit / cost descriptors);
 * - generic descriptors alone never authorize a match.
 */
export function behaviorAnchorsMatch(
  factAnchor: Page07BehaviorAnchor | null,
  sentenceAnchor: Page07BehaviorAnchor | null,
): boolean {
  if (!factAnchor || !sentenceAnchor) return false;
  if (factAnchor.actionClass !== sentenceAnchor.actionClass) return false;
  if (
    !factAnchor.specificObjectConcepts.size ||
    !sentenceAnchor.specificObjectConcepts.size
  ) {
    return false;
  }

  const sharedSpecific = new Set<string>();
  for (const c of sentenceAnchor.specificObjectConcepts) {
    if (factAnchor.specificObjectConcepts.has(c)) sharedSpecific.add(c);
  }
  if (!sharedSpecific.size) return false;

  const factDomains = new Set(
    [...factAnchor.specificObjectConcepts].filter((c) =>
      BEHAVIOR_DOMAIN_SPECIFICS.has(c),
    ),
  );
  const sentDomains = new Set(
    [...sentenceAnchor.specificObjectConcepts].filter((c) =>
      BEHAVIOR_DOMAIN_SPECIFICS.has(c),
    ),
  );
  if (factDomains.size && sentDomains.size) {
    let domainShared = false;
    for (const d of sentDomains) {
      if (factDomains.has(d)) {
        domainShared = true;
        break;
      }
    }
    if (!domainShared) return false;
  }

  // Generics are ignored for authorization (informational only).
  void factAnchor.genericObjectDescriptors;
  void sentenceAnchor.genericObjectDescriptors;
  return true;
}

/**
 * One confirmed DC fact may support ONE assertive behavior sentence when:
 * - fact_roles include a Page07 behavior-evidence allowlist role;
 * - statement itself is an assertive behavior claim naming the participant;
 * - action class + specific object identity match (generics never suffice).
 */
export function behaviorFactSupportsSentence(input: {
  factStatement: string;
  factRoles: readonly string[] | undefined;
  displayLabel: string;
  sentence: string;
}): boolean {
  if (!factHasBehaviorEvidenceRole(input.factRoles)) return false;
  const statement = input.factStatement.trim();
  if (!statement || !textHasAssertiveClaim(statement)) return false;
  const label = input.displayLabel.trim().toLowerCase();
  if (!label || !statement.toLowerCase().includes(label)) return false;
  const sentence = input.sentence.trim();
  if (
    !sentence ||
    !textHasAssertiveClaim(sentence) ||
    !sentence.toLowerCase().includes(label)
  ) {
    return false;
  }
  return behaviorAnchorsMatch(
    extractBehaviorAnchor(statement, input.displayLabel),
    extractBehaviorAnchor(sentence, input.displayLabel),
  );
}

/**
 * Every assertive behavior sentence about the participant must be independently
 * supported by at least one qualifying confirmed behavior fact. One matched
 * sentence must not launder another unsupported sentence in the same unit.
 */
export function allParticipantBehaviorSentencesSupported(input: {
  displayLabel: string;
  unitText: string;
  candidateFacts: readonly {
    statement: string;
    roles: readonly string[] | undefined;
  }[];
}): boolean {
  const label = input.displayLabel.trim().toLowerCase();
  if (!label) return false;
  const assertiveAbout = splitIntoSentences(input.unitText).filter(
    (s) => textHasAssertiveClaim(s) && s.toLowerCase().includes(label),
  );
  // No assertive sentence about this participant → nothing to support.
  if (!assertiveAbout.length) return true;

  for (const sentence of assertiveAbout) {
    const supported = input.candidateFacts.some((fact) =>
      behaviorFactSupportsSentence({
        factStatement: fact.statement,
        factRoles: fact.roles,
        displayLabel: input.displayLabel,
        sentence,
      }),
    );
    if (!supported) return false;
  }
  return true;
}

/**
 * @deprecated Prefer allParticipantBehaviorSentencesSupported (per-sentence).
 * Kept as a thin wrapper for call sites that still pass a single fact + unit.
 */
export function confirmedFactSupportsParticipantBehavior(input: {
  factStatement: string;
  factRoles: readonly string[] | undefined;
  displayLabel: string;
  unitText: string;
}): boolean {
  return allParticipantBehaviorSentencesSupported({
    displayLabel: input.displayLabel,
    unitText: input.unitText,
    candidateFacts: [
      { statement: input.factStatement, roles: input.factRoles },
    ],
  });
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
