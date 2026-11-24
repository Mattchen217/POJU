/**
 * Page08 fact integrity — structured stance vs DC status + verification_level.
 * Prose keyword scans are secondary only; every cited fact needs an explicit stance.
 */

export const PAGE08_FACT_STANCES = [
  "as_confirmed",
  "as_user_asserted",
  "as_estimated",
  "as_unverified",
  "as_conditional",
  "as_unknown",
  "as_independently_verified",
] as const;

export type Page08FactStance = (typeof PAGE08_FACT_STANCES)[number];

export type Page08FactStanceEntry = {
  fact_id: string;
  stance: Page08FactStance | string;
};

const SCORE_OR_PROBABILITY =
  /\b\d{1,3}\s*分\b|\b\d{1,3}\s*%\b|success\s*rate|成功概率|胜率|评分\s*\d|probability\s+of\s+success/i;

/**
 * Explicit confirmation wording only — auxiliary prose guard.
 * Does not claim full NLU. Avoid bare "confirm/核实" so conditional phrasing stays allowed.
 */
const EXPLICIT_CONFIRMATION_PROSE =
  /已确认|确认为|已经证实|已经确认|confirmed\s+fact|is\s+confirmed|definitely\s+true/i;

const DATE_TOKEN =
  /20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?|\d{1,2}月\d{1,2}日/g;

const CONFIRMED_STANCES = new Set<string>([
  "as_confirmed",
  "as_independently_verified",
]);

const NON_CONFIRMED_OK_STANCES = new Set<string>([
  "as_unverified",
  "as_conditional",
  "as_estimated",
  "as_user_asserted",
  "as_unknown",
]);

export function textHasScoreOrProbability(text: string): boolean {
  return SCORE_OR_PROBABILITY.test(text);
}

/** Auxiliary: true only for explicit confirmation phrasing, not soft conditionals. */
export function textHasExplicitConfirmationProse(text: string): boolean {
  return EXPLICIT_CONFIRMATION_PROSE.test(text);
}

export function isConfirmedFactStatus(status: string | undefined): boolean {
  return status === "confirmed";
}

export function inventedDateTokens(text: string, corpus: string): string[] {
  const found = text.match(DATE_TOKEN) ?? [];
  const unique = [...new Set(found)];
  return unique.filter((token) => !corpus.includes(token));
}

export type Page08FactIssue = {
  code: string;
  detail: string;
  path?: string;
};

export function issuesForConfirmedFactIds(input: {
  ids: readonly string[];
  path: string;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  for (const fid of input.ids) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${input.path} confirmed_fact_ids cites unknown fact_id=${fid}`,
        path: input.path,
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status && !isConfirmedFactStatus(status)) {
      issues.push({
        code: "confirmed_fact_not_confirmed",
        detail: `${input.path} confirmed_fact_ids includes non-confirmed fact ${fid} (${status})`,
        path: input.path,
      });
    }
  }
  return issues;
}

export function issuesForUnverifiedFactIds(input: {
  ids: readonly string[];
  path: string;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  for (const fid of input.ids) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${input.path} unverified_fact_ids cites unknown fact_id=${fid}`,
        path: input.path,
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status && status !== "unverified") {
      issues.push({
        code: "unverified_fact_status",
        detail: `${input.path} unverified_fact_ids includes fact ${fid} with status ${status}`,
        path: input.path,
      });
    }
  }
  return issues;
}

/**
 * Check one structured stance against DC status + verification_level.
 * Fail-closed on upgrades and missing facts.
 */
export function issuesForFactStance(input: {
  path: string;
  factId: string;
  stance: string;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  factVerificationLevelById?: ReadonlyMap<string, string>;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  const fid = input.factId.trim();
  const stance = input.stance.trim();
  if (!fid) {
    issues.push({
      code: "fact_stance_missing_fact_id",
      detail: `${input.path} declares stance=${stance} without a fact_id`,
      path: input.path,
    });
    return issues;
  }
  if (input.knownFactIds && !input.knownFactIds.has(fid)) {
    issues.push({
      code: "unknown_fact_id",
      detail: `${input.path} stance cites unknown fact_id=${fid}`,
      path: input.path,
    });
    return issues;
  }
  const status = input.factStatusById?.get(fid);
  const verification = input.factVerificationLevelById?.get(fid) ?? "none";

  if (stance === "as_confirmed") {
    if (status && status !== "confirmed") {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_confirmed on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_independently_verified") {
    if (status && status !== "confirmed") {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_independently_verified on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    if (verification !== "independently_verified") {
      issues.push({
        code: "fact_verification_upgrade",
        detail: `${input.path} stance=as_independently_verified on fact ${fid} with verification_level=${verification}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_user_asserted") {
    if (verification !== "user_asserted") {
      issues.push({
        code: "fact_stance_verification_mismatch",
        detail: `${input.path} stance=as_user_asserted on fact ${fid} with verification_level=${verification}`,
        path: input.path,
      });
    }
    if (
      status &&
      status !== "confirmed" &&
      status !== "unverified"
    ) {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_user_asserted on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_estimated") {
    if (verification !== "user_estimate") {
      issues.push({
        code: "fact_stance_verification_mismatch",
        detail: `${input.path} stance=as_estimated on fact ${fid} with verification_level=${verification}`,
        path: input.path,
      });
    }
    if (
      status &&
      (status === "declined" || status === "not_applicable")
    ) {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_estimated on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_unverified") {
    if (status && status !== "unverified") {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_unverified on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_unknown") {
    if (
      status &&
      status !== "unknown" &&
      status !== "declined" &&
      status !== "not_applicable"
    ) {
      issues.push({
        code: "fact_stance_status_mismatch",
        detail: `${input.path} stance=as_unknown on fact ${fid} with status=${status}`,
        path: input.path,
      });
    }
    return issues;
  }

  if (stance === "as_conditional") {
    // Conditional framing is allowed for any known status; it does not upgrade.
    return issues;
  }

  issues.push({
    code: "fact_stance_unknown",
    detail: `${input.path} has unsupported stance=${stance} for fact ${fid}`,
    path: input.path,
  });
  return issues;
}

export function issuesForFactStanceList(input: {
  path: string;
  factIds: readonly string[];
  stances: readonly Page08FactStanceEntry[];
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  factVerificationLevelById?: ReadonlyMap<string, string>;
  /**
   * When true: citing any non-confirmed fact requires stance in
   * as_conditional | as_unverified | as_estimated | as_unknown | as_user_asserted
   * (never a confirmed-class stance).
   */
  requireNonConfirmedStance?: boolean;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  const stanceById = new Map(
    input.stances.map((s) => [s.fact_id, s.stance] as const),
  );

  for (const entry of input.stances) {
    if (!entry.fact_id?.trim()) {
      issues.push({
        code: "fact_stance_missing_fact_id",
        detail: `${input.path} declares stance=${entry.stance} without a fact_id`,
        path: input.path,
      });
      continue;
    }
    issues.push(
      ...issuesForFactStance({
        path: input.path,
        factId: entry.fact_id,
        stance: entry.stance,
        knownFactIds: input.knownFactIds,
        factStatusById: input.factStatusById,
        factVerificationLevelById: input.factVerificationLevelById,
      }),
    );
  }

  for (const fid of input.factIds) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${input.path} cites unknown fact_id=${fid}`,
        path: input.path,
      });
      continue;
    }
    const stance = stanceById.get(fid);
    if (!stance) {
      issues.push({
        code: "missing_reality_fact_stance",
        detail: `${input.path} cites fact_id=${fid} without reality_fact_stances entry`,
        path: input.path,
      });
      continue;
    }
    if (input.requireNonConfirmedStance) {
      const status = input.factStatusById?.get(fid);
      if (status && status !== "confirmed") {
        if (CONFIRMED_STANCES.has(stance)) {
          issues.push({
            code: "fact_stance_status_mismatch",
            detail: `${input.path} cites non-confirmed fact ${fid} (${status}) with confirmed-class stance=${stance}`,
            path: input.path,
          });
        } else if (!NON_CONFIRMED_OK_STANCES.has(stance)) {
          issues.push({
            code: "fact_stance_required",
            detail: `${input.path} cites non-confirmed fact ${fid} without conditional/unverified stance`,
            path: input.path,
          });
        }
      }
    }
  }
  return issues;
}

/**
 * trigger_status=defined may only rest on confirmed facts (or no fact cites).
 * Non-confirmed fact cites require trigger_status=conditional|pending_confirmation
 * and a non-confirmed stance.
 */
export function issuesForTriggerFactPolicy(input: {
  path: string;
  triggerStatus: string;
  factIds: readonly string[];
  stances: readonly Page08FactStanceEntry[];
  factStatusById?: ReadonlyMap<string, string>;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  const stanceById = new Map(
    input.stances.map((s) => [s.fact_id, s.stance] as const),
  );
  for (const fid of input.factIds) {
    const status = input.factStatusById?.get(fid);
    if (!status || status === "confirmed") continue;
    const stance = stanceById.get(fid) ?? "";
    if (
      input.triggerStatus === "defined" &&
      status !== "confirmed"
    ) {
      issues.push({
        code: "trigger_non_confirmed_requires_conditional",
        detail: `${input.path} trigger_status=defined cites non-confirmed fact ${fid} (${status}); use conditional or pending_confirmation`,
        path: input.path,
      });
    }
    if (CONFIRMED_STANCES.has(stance) || !stance) {
      issues.push({
        code: "trigger_fact_stance_required",
        detail: `${input.path} cites non-confirmed fact ${fid} without as_conditional/as_unverified (or equivalent) stance`,
        path: input.path,
      });
    }
  }
  return issues;
}

export function issuesForCitedFactsInProse(input: {
  path: string;
  text: string;
  dateCorpus: string;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  if (textHasScoreOrProbability(input.text)) {
    issues.push({
      code: "invented_score_or_probability",
      detail: `${input.path} contains unsourced score or probability language`,
      path: input.path,
    });
  }
  for (const token of inventedDateTokens(input.text, input.dateCorpus)) {
    issues.push({
      code: "invented_date",
      detail: `${input.path} contains a date not present in the payload: ${token}`,
      path: input.path,
    });
  }
  return issues;
}

/**
 * Auxiliary contradiction guard (not a substitute for structured stances):
 * if this content unit cites any non-confirmed DC fact and its own prose uses
 * explicit confirmation wording, fail-closed.
 *
 * Scope is limited to this unit's reality_fact_ids — never mix other units.
 */
export function issuesForExplicitConfirmationContradiction(input: {
  path: string;
  text: string;
  factIds: readonly string[];
  stances?: readonly Page08FactStanceEntry[];
  factStatusById?: ReadonlyMap<string, string>;
}): Page08FactIssue[] {
  const issues: Page08FactIssue[] = [];
  if (!input.factIds.length) return issues;
  if (!textHasExplicitConfirmationProse(input.text)) return issues;

  const nonConfirmed: string[] = [];
  for (const fid of input.factIds) {
    const status = input.factStatusById?.get(fid);
    if (status && status !== "confirmed") {
      nonConfirmed.push(`${fid}(${status})`);
    }
  }
  if (!nonConfirmed.length) return issues;

  // stances are accepted for call-site completeness; contradiction is prose vs DC status.
  void input.stances;

  issues.push({
    code: "explicit_confirmation_on_non_confirmed_fact",
    detail: `${input.path} uses explicit confirmation prose while citing non-confirmed fact(s): ${nonConfirmed.join(", ")}`,
    path: input.path,
  });
  return issues;
}
