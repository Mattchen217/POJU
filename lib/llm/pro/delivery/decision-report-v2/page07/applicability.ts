/**
 * Page07 applicability gate — structured DC only, before any LLM call.
 * A bare relationship label does not enable the page.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";

export type Page07ApplicabilityStatus =
  | "applicable"
  | "not_applicable"
  | "insufficient_information";

export type Page07ApplicabilitySignal = {
  source: "decision_question" | "fact" | "constraint" | "dir";
  source_id: string | null;
  stem: string;
  /** True only when the stem is tied to the decision, not a bare label. */
  linked: boolean;
};

export type Page07ApplicabilityResult = {
  status: Page07ApplicabilityStatus;
  reason: string;
  signals: Page07ApplicabilitySignal[];
};

type FactLike = {
  fact_id?: string;
  statement?: string;
  status?: string;
};

type DirLike = {
  dir_id?: string;
  need?: string;
  why?: string;
  current_state?: string;
};

type ConstraintLike = {
  constraint_id?: string;
  statement?: string;
  category?: string;
};

/**
 * Decision-linked field / relationship scenes.
 * A category or label that is only the word "relationship" / "family" / "partner"
 * does not match these patterns.
 */
const LINKED_STEMS: readonly { id: string; re: RegExp }[] = [
  {
    id: "career_change",
    re: /career\s*change|change\s+(?:my\s+)?(?:job|career|company)|switching\s+careers?|new\s+company|leave\s+(?:the\s+)?(?:company|job)|事业换场|换场|跳槽|换工作|换公司|转行/i,
  },
  {
    id: "relocate",
    re: /relocat(?:e|ion|ing)|move\s+(?:to|cities|abroad)|moving\s+(?:to\s+)?(?:another\s+)?(?:city|country)|迁移|搬家|搬到|移居/i,
  },
  {
    id: "partnership",
    re: /partner(?:ship)?|co-?founder|joint\s+venture|合伙|合伙人/i,
  },
  {
    id: "intimate_joint",
    re: /intimate|marriage|spouse|joint\s+decision|decide\s+together|一起决定|联合决策|亲密关系|亲密/i,
  },
  {
    id: "family_affects_decision",
    re: /family\s+(?:will\s+|would\s+|may\s+|might\s+)?(?:affect|changes?|blocks?|pressure)|家人(?:会|将|可能)?(?:影响|改变).{0,16}(?:决定|选择)|家庭影响/i,
  },
  {
    id: "org_team_field",
    re: /organi[sz]ational\s+(?:field|culture|environment|politics)|org(?:anization)?\s+(?:field|culture|environment)|team\s+(?:field|culture|dynamic|environment)|组织环境|团队场域|职场环境|组织场域/i,
  },
];

const BARE_RELATIONSHIP_LABEL =
  /^(relationship|relationships|relation|family|social|interpersonal|partner|关系|家庭|家人)$/i;

function stemsIn(text: string): string[] {
  const raw = text.trim();
  if (!raw || BARE_RELATIONSHIP_LABEL.test(raw)) return [];
  return LINKED_STEMS.filter((stem) => stem.re.test(raw)).map((stem) => stem.id);
}

function pushBare(
  signals: Page07ApplicabilitySignal[],
  source: Page07ApplicabilitySignal["source"],
  sourceId: string | null,
  text: string,
) {
  if (!BARE_RELATIONSHIP_LABEL.test(text.trim())) return;
  signals.push({
    source,
    source_id: sourceId,
    stem: "bare_relationship_label",
    linked: false,
  });
}

/**
 * Heuristic from structured DC: question + fact statements + constraint
 * categories/statements + DIR needs. Does not enable on a bare relationship label.
 */
export function evaluatePage07Applicability(
  dc: DecisionContext | null | undefined,
  dirs?: readonly DirLike[] | null,
  facts?: readonly FactLike[] | null,
  question?: string | null,
): Page07ApplicabilityResult {
  const q = (question ?? dc?.definition?.decision_question ?? "").trim();
  const factList = facts ?? dc?.reality_facts ?? [];
  const dirList = dirs ?? dc?.dirs ?? [];
  const constraints: readonly ConstraintLike[] = dc?.constraints ?? [];
  const signals: Page07ApplicabilitySignal[] = [];

  const questionStems = stemsIn(q);
  if (questionStems.length) {
    for (const stem of questionStems) {
      signals.push({
        source: "decision_question",
        source_id: null,
        stem,
        linked: true,
      });
    }
  } else {
    pushBare(signals, "decision_question", null, q);
  }

  for (const fact of factList) {
    const statement = String(fact.statement ?? "");
    const stems = stemsIn(statement);
    const status = String(fact.status ?? "").trim();
    if (stems.length) {
      const usable = status === "confirmed" || status === "unverified" || status === "";
      for (const stem of stems) {
        signals.push({
          source: "fact",
          source_id: fact.fact_id ?? null,
          stem,
          linked: usable,
        });
      }
    } else {
      pushBare(signals, "fact", fact.fact_id ?? null, statement);
    }
  }

  for (const constraint of constraints) {
    const statement = String(constraint.statement ?? "");
    const category = String(constraint.category ?? "");
    const stems = [...new Set([...stemsIn(statement), ...stemsIn(category)])];
    if (stems.length) {
      for (const stem of stems) {
        signals.push({
          source: "constraint",
          source_id: constraint.constraint_id ?? null,
          stem,
          linked: true,
        });
      }
    } else {
      pushBare(signals, "constraint", constraint.constraint_id ?? null, category);
      pushBare(signals, "constraint", constraint.constraint_id ?? null, statement);
    }
  }

  for (const dir of dirList) {
    const blob = `${dir.need ?? ""} ${dir.why ?? ""}`.trim();
    const stems = stemsIn(blob);
    const state = String(dir.current_state ?? "").trim();
    if (stems.length) {
      const linked = state === "known" || state === "";
      for (const stem of stems) {
        signals.push({
          source: "dir",
          source_id: dir.dir_id ?? null,
          stem,
          linked,
        });
      }
    } else {
      pushBare(signals, "dir", dir.dir_id ?? null, String(dir.need ?? ""));
    }
  }

  const linked = signals.filter((s) => s.linked);
  if (linked.length > 0) {
    const stems = [...new Set(linked.map((s) => s.stem))].join(", ");
    return {
      status: "applicable",
      reason: `Field or relationship is linked to this decision (${stems}).`,
      signals,
    };
  }

  const unresolvedFieldSignal = signals.some(
    (s) => !s.linked && s.stem !== "bare_relationship_label",
  );
  if (unresolvedFieldSignal) {
    return {
      status: "insufficient_information",
      reason:
        "A field or relationship signal exists but is not decision-linked enough to analyze. Do not invent participants or a field conclusion.",
      signals,
    };
  }

  if (!q && factList.length === 0 && dirList.length === 0) {
    return {
      status: "insufficient_information",
      reason:
        "No decision question or structured facts are available to judge whether a field or relationship page applies.",
      signals,
    };
  }

  return {
    status: "not_applicable",
    reason:
      "No career-change, relocation, partnership, intimate joint decision, family-affecting-decision, or org/team field linkage. A bare relationship label does not enable this page.",
    signals,
  };
}
