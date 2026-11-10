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

const HEDGE_OR_REJECT_RE =
  /(可能|大概|都不确定|不太确定|不确定|都不准确|两条都不对|两条都不准确|都不是事实|都不是|都错了|都错|都不对|unknown|declined)/i;

const FIRST_ORDINAL_RE = /第\s*(一条|一项|1\s*条|1\s*项)/;
const SECOND_ORDINAL_RE = /第\s*(二条|二项|2\s*条|2\s*项)/;

function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s,，。．.!！？?、；;:：""''“”‘’()（）[\]【】]/g, "")
    .trim();
}

function standaloneIndex(compact: string): 1 | 2 | null {
  if (/^(1|一|选择?1|我选1|选一)$/.test(compact)) return 1;
  if (/^(2|二|选择?2|我选2|选二)$/.test(compact)) return 2;
  return null;
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
  const compact = statement.replace(/\s+/g, "");

  if (HEDGE_OR_REJECT_RE.test(statement) || HEDGE_OR_REJECT_RE.test(compact)) {
    return { kind: "ambiguous", reason: "user_choice_not_explicit" };
  }

  const hitFirst = FIRST_ORDINAL_RE.test(compact);
  const hitSecond = SECOND_ORDINAL_RE.test(compact);
  if (hitFirst && hitSecond) {
    return { kind: "ambiguous", reason: "user_choice_not_explicit" };
  }

  let index: number | null = null;
  if (hitFirst) index = 0;
  else if (hitSecond) index = 1;
  else {
    const standalone = standaloneIndex(normalizeComparable(statement));
    if (standalone === 1) index = 0;
    else if (standalone === 2) index = 1;
  }

  if (index == null) {
    const needle = normalizeComparable(statement);
    if (needle.length >= 4) {
      const matches = facts.filter((fact) => {
        const hay = normalizeComparable(fact.statement);
        if (hay.length < 4) return false;
        return needle === hay || needle.includes(hay) || hay.includes(needle);
      });
      if (matches.length === 1) {
        index = facts.findIndex((fact) => fact.fact_id === matches[0]!.fact_id);
      }
    }
  }

  if (index == null || index < 0 || index >= orderedIds.length) {
    return { kind: "ambiguous", reason: "user_choice_not_explicit" };
  }

  const factId = orderedIds[index]!;
  return {
    kind: "selected",
    fact_id: factId,
    resolution: JSON.stringify({
      selected_fact_id: factId,
      user_statement: statement.slice(0, 1000),
    }),
  };
}
