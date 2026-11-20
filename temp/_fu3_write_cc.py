from pathlib import Path

cc_path = Path("lib/poju/decision-intake/conflict-clarification.ts")
text = cc_path.read_text(encoding="utf-8")
marker = "const HEDGE_OR_REJECT_RE ="
idx = text.find(marker)
if idx < 0:
    raise SystemExit("marker not found in conflict-clarification.ts")
prefix = text[:idx]

tail = r'''export type ExplicitChoice =
  | { kind: "selected"; index: number }
  | { kind: "ambiguous"; reason: string };

const CHOICE_AMBIGUOUS: ExplicitChoice = {
  kind: "ambiguous",
  reason: "user_choice_not_explicit",
};

const HEDGE_RE =
  /(可能|也许|大概|好像|似乎|不一定|不好说|不清楚|都不确定|不太确定|不确定|都不准确|两条都不对|两条都不准确|都不是事实|都不是|都错了|都错|都不对|unknown|declined)/i;

const CONTRAST_RE = /但是|但|不过|可是|而是/;

/**
 * Negation must be detected before any affirmative / ordinal selection.
 * Covers punctuation, optional spaces (stripped first), and 第1条 / 第2条 forms.
 */
const NEGATED_FIRST_RE =
  /(?:不是|不选|不认可|不准确|不对|错误|排除|否定)(?:第)?(?:一|1)(?:条|项)|第(?:一|1)(?:条|项)(?:不准确|不对|错误|不认可|不选|是错的|错了|不是)/;

const NEGATED_SECOND_RE =
  /(?:不是|不选|不认可|不准确|不对|错误|排除|否定)(?:第)?(?:二|2)(?:条|项)|第(?:二|2)(?:条|项)(?:不准确|不对|错误|不认可|不选|是错的|错了|不是)/;

const AFFIRM_FIRST_RE =
  /(?:我?选|选择|以)?第(?:一|1)(?:条|项)(?:准确|是对的|是正确的|对的|正确|为准)|以第(?:一|1)(?:条|项)为准|(?:我?选|选择)第(?:一|1)(?:条|项)/;

const AFFIRM_SECOND_RE =
  /(?:我?选|选择|以)?第(?:二|2)(?:条|项)(?:准确|是对的|是正确的|对的|正确|为准)|以第(?:二|2)(?:条|项)为准|(?:我?选|选择)第(?:二|2)(?:条|项)/;

function compactChoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s,，。．.!！？?、；;:："'"'""''“”‘’()（）[\]【】…—–-]/g, "")
    .trim();
}

function standaloneIndex(compact: string): 1 | 2 | null {
  if (/^(1|一|选择?1|我选1|选一)$/.test(compact)) return 1;
  if (/^(2|二|选择?2|我选2|选二)$/.test(compact)) return 2;
  return null;
}

function stripAffirmWrappers(compact: string): string {
  return compact
    .replace(/^(?:我觉得|我认为|我选|选择|选|以)/, "")
    .replace(/(?:准确|是对的|是正确的|对的|正确|为准)$/, "");
}

/**
 * Explicit affirmative choice parser.
 * Order is mandatory: hedges / negation / conflicting affirm+negate first,
 * then only explicit affirmative patterns (including contrast with a clear
 * affirmative on the remaining fact). A bare ordinal mention is not a choice.
 */
export function parseExplicitChoice(statement: string): ExplicitChoice {
  const compact = compactChoiceText(statement);
  if (!compact) return CHOICE_AMBIGUOUS;

  if (HEDGE_RE.test(statement) || HEDGE_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }

  const negFirst = NEGATED_FIRST_RE.test(compact);
  const negSecond = NEGATED_SECOND_RE.test(compact);
  const affFirst = AFFIRM_FIRST_RE.test(compact);
  const affSecond = AFFIRM_SECOND_RE.test(compact);

  // Affirm and negate the same option, or affirm both options.
  if ((affFirst && negFirst) || (affSecond && negSecond) || (affFirst && affSecond)) {
    return CHOICE_AMBIGUOUS;
  }

  // "不是第一条，而是第二条准确" — select second only with clear affirmation.
  if (negFirst && affSecond && !affFirst && !negSecond) {
    return { kind: "selected", index: 1 };
  }
  if (negSecond && affFirst && !affSecond && !negFirst) {
    return { kind: "selected", index: 0 };
  }

  // Any remaining negation is not an affirmative choice.
  if (negFirst || negSecond) {
    return CHOICE_AMBIGUOUS;
  }

  if (affFirst) return { kind: "selected", index: 0 };
  if (affSecond) return { kind: "selected", index: 1 };

  const standalone = standaloneIndex(compact);
  if (standalone === 1) return { kind: "selected", index: 0 };
  if (standalone === 2) return { kind: "selected", index: 1 };

  return CHOICE_AMBIGUOUS;
}

function restatementChoice(
  statement: string,
  facts: RealityFact[],
): ExplicitChoice {
  const compact = compactChoiceText(statement);
  if (compact.length < 4) return CHOICE_AMBIGUOUS;
  if (HEDGE_RE.test(statement) || HEDGE_RE.test(compact)) return CHOICE_AMBIGUOUS;
  if (CONTRAST_RE.test(compact)) return CHOICE_AMBIGUOUS;
  if (NEGATED_FIRST_RE.test(compact) || NEGATED_SECOND_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }
  if (/(不准确|不对|不是|不选|不认可|错误|排除|否定|没选|并非)/.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }

  const hays = facts.map((fact) => ({
    fact,
    hay: compactChoiceText(fact.statement),
  }));
  const mentioned = hays.filter(
    (item) => item.hay.length >= 4 && compact.includes(item.hay),
  );
  if (mentioned.length !== 1) {
    return CHOICE_AMBIGUOUS;
  }

  const only = mentioned[0]!;
  const stripped = stripAffirmWrappers(compact);
  // Only an exact fact restatement, or that restatement plus a clear
  // affirmative wrapper, may select. Do not use hay.includes(needle).
  if (compact !== only.hay && stripped !== only.hay) {
    return CHOICE_AMBIGUOUS;
  }
  const index = facts.findIndex((fact) => fact.fact_id === only.fact.fact_id);
  if (index < 0) return CHOICE_AMBIGUOUS;
  return { kind: "selected", index };
}

export function resolveConflictChoice(input: {
  statement: string;
  target: ConflictClarificationTarget;
  session: POJUSessionState;
}): ConflictChoiceResult {
  const dc = input.session.decision_context;
  if (!dc) {
    return { kind: "ambiguous", reason: "stale_conflict_target" };
  }

  const conflict = dc.conflicts.find(
    (item) => item.conflict_id === input.target.conflict_id,
  );
  if (!conflict) {
    return { kind: "ambiguous", reason: "stale_conflict_target" };
  }
  if (conflict.state !== "open") {
    return { kind: "ambiguous", reason: "stale_conflict_target" };
  }
  if (!sameFactIdMembership(conflict.fact_ids, input.target.fact_ids)) {
    return { kind: "ambiguous", reason: "stale_conflict_target" };
  }

  const orderedIds = [...input.target.fact_ids];
  const facts = orderedIds
    .map((id) => dc.reality_facts.find((fact) => fact.fact_id === id))
    .filter((fact): fact is RealityFact => Boolean(fact));
  if (facts.length !== orderedIds.length || facts.length < 2) {
    return { kind: "ambiguous", reason: "stale_conflict_target" };
  }

  const statement = input.statement.trim();
  if (!statement) {
    return { kind: "ambiguous", reason: "user_choice_not_explicit" };
  }

  let choice = parseExplicitChoice(statement);
  if (choice.kind === "ambiguous") {
    choice = restatementChoice(statement, facts);
  }

  if (choice.kind === "ambiguous" || choice.index < 0 || choice.index >= orderedIds.length) {
    return { kind: "ambiguous", reason: "user_choice_not_explicit" };
  }

  const factId = orderedIds[choice.index]!;
  return {
    kind: "selected",
    fact_id: factId,
    resolution: JSON.stringify({
      selected_fact_id: factId,
      user_statement: statement.slice(0, 1000),
    }),
  };
}
'''

cc_path.write_text(prefix + tail, encoding="utf-8", newline="\n")
print("wrote conflict-clarification.ts", cc_path.stat().st_size)