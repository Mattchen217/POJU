/**
 * Bind an open Conflict to the actually-sent Adaptive Plan, and parse
 * explicit user choices for formal Conflict Resolution.
 * This module does not mutate DecisionContext.conflicts or RealityFacts.
 */

import type { RealityFact } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AdaptiveQuestionPlan,
  ConflictClarificationTarget,
} from "./types";

export type { ConflictClarificationTarget };

export type ConflictChoiceResult =
  | {
      kind: "selected";
      fact_id: string;
      resolution: string;
    }
  | {
      kind: "ambiguous";
      reason: string;
    };

export function sameFactIdMembership(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

export function clarificationQuestionText(facts: RealityFact[]): string {
  const choices = facts
    .map((fact, index) => `${index + 1}. ${fact.statement}`)
    .join("\n");
  return (
    `我发现这项信息存在两条不一致的记录：\n${choices}\n` +
    "请明确选择哪一条准确。也可以说明两条都不准确，我会继续核实，不会自行替你判断。"
  );
}

export function bindConflictClarificationToPlan(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
): AdaptiveQuestionPlan {
  const dc = session.decision_context;
  if (!dc) return plan;

  const candidateDirIds = new Set(plan.dir_ids);

  const conflict = dc.conflicts.find((item) => {
    if (item.state !== "open") return false;

    return item.fact_ids.some((factId) => {
      const fact = dc.reality_facts.find(
        (candidate) => candidate.fact_id === factId,
      );

      return Boolean(
        fact &&
          (fact.related_dir_ids ?? []).some((dirId) =>
            candidateDirIds.has(dirId),
          ),
      );
    });
  });

  if (!conflict) {
    return {
      ...plan,
      conflict_clarification: null,
    };
  }

  const facts = conflict.fact_ids
    .map((id) => dc.reality_facts.find((fact) => fact.fact_id === id))
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));

  // Do not issue a clarification question if source facts are incomplete.
  if (facts.length !== conflict.fact_ids.length || facts.length < 2) {
    return {
      ...plan,
      conflict_clarification: null,
    };
  }

  const target: ConflictClarificationTarget = {
    conflict_id: conflict.conflict_id,
    fact_ids: [...conflict.fact_ids],
  };

  return {
    ...plan,
    conflict_clarification: target,
    question_text: clarificationQuestionText(facts),
  };
}

/**
 * Re-ask the same Conflict clarification without mixing in another Conflict
 * or falling back to a normal gap question.
 */
export function planForSameConflictClarification(
  session: POJUSessionState,
  target: ConflictClarificationTarget,
): AdaptiveQuestionPlan | null {
  const dc = session.decision_context;
  if (!dc) return null;

  const conflict = dc.conflicts.find(
    (item) => item.conflict_id === target.conflict_id,
  );
  if (!conflict || conflict.state !== "open") return null;
  if (!sameFactIdMembership(conflict.fact_ids, target.fact_ids)) return null;

  const facts = target.fact_ids
    .map((id) => dc.reality_facts.find((fact) => fact.fact_id === id))
    .filter((fact): fact is RealityFact => Boolean(fact));
  if (facts.length !== target.fact_ids.length || facts.length < 2) {
    return null;
  }

  const base =
    session.adaptive_ask_plan ??
    session.decision_understanding?.next_question_plan;
  if (!base) return null;

  return {
    ...base,
    conflict_clarification: {
      conflict_id: target.conflict_id,
      fact_ids: [...target.fact_ids],
    },
    question_text: clarificationQuestionText(facts),
  };
}

export type ExplicitChoice =
  | { kind: "selected"; index: number }
  | { kind: "ambiguous"; reason: string };

const CHOICE_AMBIGUOUS: ExplicitChoice = {
  kind: "ambiguous",
  reason: "user_choice_not_explicit",
};

/**
 * If parseExplicitChoice already found negation, hedge, or conflicting
 * option semantics, restatement must not become a backdoor into a selection.
 * A mere "no explicit option language" result may still try restatement.
 */
const BLOCK_RESTATEMENT_REASONS = new Set([
  "negated_choice",
  "hedged_choice",
  "conflicting_choice",
  "both_selected",
  "both_inaccurate",
  "unknown_negation_scope",
  "contrast_not_resolved",
]);

const CONTRAST_SPLIT_RE = /而是|但是|不过|可是|但/;

const BOTH_INACCURATE_RE =
  /(都不准确|两条都不对|两条都不准确|都不是事实|都不是|都错了|都错|都不对)/;

const HEDGE_CUES_RE =
  /(可能|也许|大概|好像|似乎|不一定|不好说|不清楚|都不确定|不太确定|不确定|不太)/;

// Listed cues only. Do not treat a bare 非 as negation (would false-hit 非常).
const NEGATION_CUES_RE =
  /不能确认|无法确认|不认为|不觉得|不认可|不准确|不正确|不确定|不一定|不选|不是|并不|并非|未必|没有|不对|错误|排除|否定|是错的|错了|没选/;

// Family A: insufficient-accuracy constructions. Match the construction as a
// unit so that 准确 / 正确 inside it cannot be treated as affirmation.
const INSUFFICIENT_ACCURACY_RE =
  /(?:不够|不算|不太|不怎么|不完全|谈不上|称不上)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)|准确(?:度|性|程度)(?:不高|不足|有限)/;

// Family B: uncertain accuracy, including when an option mention sits
// between the hedge and 准确 / 正确.
const UNCERTAIN_ACCURACY_RE =
  /(?:不见得|未必|不一定|不能确定|无法确认|不敢确认|不好判断是否)(?:第?(?:一|1|二|2)(?:条|项))?(?:准确|正确)?/;

// Family C: explicit rejection of an option. Scope is assigned via the
// option mention in the same fragment, not by inferring the other option.
const EXPLICIT_REJECTION_RE =
  /不认可|不接受|不成立|不符合实际|不是事实|有误|存在错误/;

const FIRST_OPT_RE = /第?(?:一|1)(?:条|项)/;
const SECOND_OPT_RE = /第?(?:二|2)(?:条|项)/;

// Affirmation keywords must not fire on 不准确 / 不正确, and must not treat
// 准确度 / 准确性 / 准确程度 noun forms as affirmative evidence.
const AFFIRM_KW_RE =
  /是对的|是正确的|(?<!不)准确(?![度性]|程度)|(?<!不)正确(?!性)|(?<!不)对的|为准/;
const SELECT_KW_RE = /我?选|选择/;

type OptionPolarity = {
  mentioned: boolean;
  affirmed: boolean;
  negated: boolean;
  hedged: boolean;
};

type FragmentSemantics = {
  first: OptionPolarity;
  second: OptionPolarity;
  bothRejected: boolean;
  unknownNegationScope: boolean;
};

function compactChoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function standaloneIndex(compact: string): 1 | 2 | null {
  if (/^(1|一|选择?1|我选1|选一)$/.test(compact)) return 1;
  if (/^(2|二|选择?2|我选2|选二)$/.test(compact)) return 2;
  return null;
}

function splitContrastFragments(compact: string): string[] {
  const parts = compact
    .split(CONTRAST_SPLIT_RE)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [compact];
}

function emptyPolarity(mentioned: boolean): OptionPolarity {
  return { mentioned, affirmed: false, negated: false, hedged: false };
}

function analyzeFragment(fragment: string): FragmentSemantics {
  const mentionsFirst = FIRST_OPT_RE.test(fragment);
  const mentionsSecond = SECOND_OPT_RE.test(fragment);

  // Detect negative or insufficient-accuracy constructions before any
  // affirmative polarity assignment.
  const insufficientAccuracy = INSUFFICIENT_ACCURACY_RE.test(fragment);
  const uncertainAccuracy = UNCERTAIN_ACCURACY_RE.test(fragment);
  const explicitRejection = EXPLICIT_REJECTION_RE.test(fragment);
  const hasNeg =
    NEGATION_CUES_RE.test(fragment) ||
    insufficientAccuracy ||
    explicitRejection;
  const hasHedge = HEDGE_CUES_RE.test(fragment) || uncertainAccuracy;
  const bothRejected = BOTH_INACCURATE_RE.test(fragment);

  const first = emptyPolarity(mentionsFirst);
  const second = emptyPolarity(mentionsSecond);
  let unknownNegationScope = false;

  if (hasNeg) {
    if (mentionsFirst && mentionsSecond) {
      // Negation and two options in one fragment: scope cannot be assigned safely.
      unknownNegationScope = true;
    } else if (mentionsFirst) {
      first.negated = true;
    } else if (mentionsSecond) {
      second.negated = true;
    } else {
      unknownNegationScope = true;
    }
  }

  if (hasHedge) {
    if (mentionsFirst && !mentionsSecond) {
      first.hedged = true;
    } else if (mentionsSecond && !mentionsFirst) {
      second.hedged = true;
    } else {
      first.hedged = true;
      second.hedged = true;
    }
  }

  // Strip insufficient / uncertain accuracy constructions so leftover
  // 准确 / 正确 cannot override a negative or hedged reading.
  const residual = fragment
    .replace(INSUFFICIENT_ACCURACY_RE, "")
    .replace(UNCERTAIN_ACCURACY_RE, "");
  const hasAffirmKw = AFFIRM_KW_RE.test(residual) || SELECT_KW_RE.test(residual);

  // Affirmative keywords in a fragment cannot override negation or hedge
  // of the same option in that fragment.
  if (hasAffirmKw) {
    if (mentionsFirst && !first.negated && !first.hedged) {
      first.affirmed = true;
    }
    if (mentionsSecond && !second.negated && !second.hedged) {
      second.affirmed = true;
    }
  }

  return { first, second, bothRejected, unknownNegationScope };
}

function mergePolarity(parts: OptionPolarity[]): OptionPolarity {
  return {
    mentioned: parts.some((item) => item.mentioned),
    affirmed: parts.some((item) => item.affirmed),
    negated: parts.some((item) => item.negated),
    hedged: parts.some((item) => item.hedged),
  };
}

/**
 * Conservative clause-based parser.
 * Split contrast first, detect negation independently in each fragment,
 * and require independent affirmative evidence before selecting.
 * A bare mention of 第一条 / 第二条 is not a choice.
 */
export function parseExplicitChoice(statement: string): ExplicitChoice {
  const compact = compactChoiceText(statement);
  if (!compact) return CHOICE_AMBIGUOUS;

  const standalone = standaloneIndex(compact);
  if (standalone === 1) return { kind: "selected", index: 0 };
  if (standalone === 2) return { kind: "selected", index: 1 };

  const fragments = splitContrastFragments(compact);
  const analyses = fragments.map(analyzeFragment);

  if (analyses.some((item) => item.bothRejected)) {
    return { kind: "ambiguous", reason: "both_inaccurate" };
  }
  if (analyses.some((item) => item.unknownNegationScope)) {
    return { kind: "ambiguous", reason: "unknown_negation_scope" };
  }

  const first = mergePolarity(analyses.map((item) => item.first));
  const second = mergePolarity(analyses.map((item) => item.second));

  if ((first.affirmed && first.negated) || (second.affirmed && second.negated)) {
    return { kind: "ambiguous", reason: "conflicting_choice" };
  }
  if (first.hedged || second.hedged) {
    return { kind: "ambiguous", reason: "hedged_choice" };
  }
  if (first.affirmed && second.affirmed) {
    return { kind: "ambiguous", reason: "both_selected" };
  }

  // Contrast is allowed only when exactly one option has independent
  // affirmative evidence and that same option is never negated.
  if (first.affirmed && !first.negated && !second.affirmed) {
    return { kind: "selected", index: 0 };
  }
  if (second.affirmed && !second.negated && !first.affirmed) {
    return { kind: "selected", index: 1 };
  }

  if (first.negated || second.negated) {
    return { kind: "ambiguous", reason: "negated_choice" };
  }

  return CHOICE_AMBIGUOUS;
}

function stripAffirmWrappers(compact: string): string {
  return compact
    .replace(/^(?:我觉得|我认为|我选|选择|选|以)/, "")
    .replace(/(?:准确|是对的|是正确的|对的|正确|为准)$/, "");
}

function restatementChoice(
  statement: string,
  facts: RealityFact[],
): ExplicitChoice {
  const compact = compactChoiceText(statement);
  if (compact.length < 4) return CHOICE_AMBIGUOUS;
  if (HEDGE_CUES_RE.test(statement) || HEDGE_CUES_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }
  if (CONTRAST_SPLIT_RE.test(compact)) return CHOICE_AMBIGUOUS;
  if (NEGATION_CUES_RE.test(compact) || BOTH_INACCURATE_RE.test(compact)) {
    return CHOICE_AMBIGUOUS;
  }
  if (
    INSUFFICIENT_ACCURACY_RE.test(compact) ||
    UNCERTAIN_ACCURACY_RE.test(compact) ||
    EXPLICIT_REJECTION_RE.test(compact)
  ) {
    return CHOICE_AMBIGUOUS;
  }

  const hays = facts.map((fact) => ({
    fact,
    hay: compactChoiceText(fact.statement),
  }));
  // Exact restatement of one complete RealityFact only.
  // Do not infer a choice from substring inclusion either way.
  // Do not treat “准确” inside the fact text as the user's affirmation.
  const mentioned = hays.filter((item) => {
    if (item.hay.length < 4) return false;
    return compact === item.hay || stripAffirmWrappers(compact) === item.hay;
  });
  if (mentioned.length !== 1) {
    return CHOICE_AMBIGUOUS;
  }

  const only = mentioned[0]!;
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
  if (choice.kind === "ambiguous" && !BLOCK_RESTATEMENT_REASONS.has(choice.reason)) {
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
