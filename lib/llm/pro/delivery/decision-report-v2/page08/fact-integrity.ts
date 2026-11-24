/**
 * Page08 fact integrity — status preserved, confirmed list is confirmed-only,
 * no invented scores, probabilities, or calendar dates.
 */

const SCORE_OR_PROBABILITY =
  /\b\d{1,3}\s*分\b|\b\d{1,3}\s*%\b|success\s*rate|成功概率|胜率|评分\s*\d|probability\s+of\s+success/i;

const CONFIRMED_PROSE =
  /已确认|确认为|confirmed\s+fact|is\s+confirmed|definitely\s+true/i;

const DATE_TOKEN =
  /20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?|\d{1,2}月\d{1,2}日/g;

export function textHasScoreOrProbability(text: string): boolean {
  return SCORE_OR_PROBABILITY.test(text);
}

export function textTreatsFactAsConfirmed(text: string): boolean {
  return CONFIRMED_PROSE.test(text);
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

export function issuesForCitedFactsInProse(input: {
  path: string;
  text: string;
  factIds: readonly string[];
  factStatusById?: ReadonlyMap<string, string>;
  knownFactIds?: ReadonlySet<string>;
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
  for (const fid of input.factIds) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_fact_id",
        detail: `${input.path} cites unknown fact_id=${fid}`,
        path: input.path,
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (
      status &&
      status !== "confirmed" &&
      textTreatsFactAsConfirmed(input.text)
    ) {
      issues.push({
        code: "fact_status_upgrade",
        detail: `${input.path} treats fact ${fid} (${status}) as confirmed`,
        path: input.path,
      });
    }
  }
  return issues;
}
