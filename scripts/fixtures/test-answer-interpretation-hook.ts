/**
 * Test-only adapter: produce a ModelAnswerDraft from the deterministic
 * classifier so existing handleUserMessage / adaptive-turn regressions do
 * not call OpenRouter. Production never imports this module.
 */
import {
  activeTargets,
  classifyAnswer,
  locateSourceQuote,
  writesFor,
} from "../../lib/poju/decision-intake/answer-interpretation";
import type { AdaptiveTurnTestHooks } from "../../lib/poju/decision-intake/adaptive-turn";
import type { AnswerInterpretationModelHook } from "../../lib/poju/decision-intake/answer-interpretation-model";
import type {
  DecisionUnderstandingModelOutput,
  UnderstandingModelTestHook,
} from "../../lib/poju/decision-intake/understanding-response-model";
import type { HandleInput } from "../../lib/poju/agent";
import type { ModelAnswerDraft } from "../../lib/poju/decision-intake/types";
import type { POJUSessionState } from "../../lib/poju/types";

/** Quote the deterministic clause when it locates in the answer, else the whole answer. */
function completeClauseQuote(statement: string, candidate: string): string {
  return locateSourceQuote(candidate, statement).ok ? candidate : statement.trim();
}

export function deterministicModelAnswerDraft(input: {
  session: POJUSessionState;
  statement: string;
}): ModelAnswerDraft {
  const targets = activeTargets(input.session);
  const { cls, notes } = classifyAnswer({
    session: input.session,
    statement: input.statement,
    target: targets,
  });
  const writes = writesFor(cls, input.statement, targets, notes);
  const extracted_items: ModelAnswerDraft["extracted_items"] = [];
  const seen = new Set<string>();
  for (const write of writes) {
    if (
      write.kind !== "reality_fact" &&
      write.kind !== "constraint" &&
      write.kind !== "definition_patch"
    ) {
      continue;
    }
    // Prefer the constraint item; conversion re-adds the companion fact.
    if (write.kind === "reality_fact") {
      const hasConstraintTwin = writes.some(
        (other) => other.kind === "constraint" && other.statement === write.statement,
      );
      if (hasConstraintTwin) continue;
    }
    const quote = completeClauseQuote(input.statement, write.statement);
    const key = `${write.kind}:${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    extracted_items.push({
      text: quote,
      semantic_kind: write.kind,
      role_hint: null,
      certainty:
        write.verification_level === "user_estimate"
          ? "estimated"
          : write.status === "unknown" || write.status === "declined"
            ? "unclear"
            : "explicit",
      source_quote: quote,
    });
  }
  return {
    classification: cls,
    extracted_items,
    unresolved_aspects: [],
    explanation: notes.join("; "),
  };
}

export const deterministicAnswerModelHook: AnswerInterpretationModelHook = (input) =>
  deterministicModelAnswerDraft({
    session: input.session,
    statement: input.statement,
  });

/**
 * Deterministic Understanding hook for offline regressions.
 * Picks a legal candidate (prefer code plan / rank hint) and authors NL —
 * does not call OpenRouter. Production never imports this module.
 */
export const deterministicUnderstandingModelHook: UnderstandingModelTestHook = (
  input,
) => {
  const pick =
    (input.plan?.candidate_id &&
    input.legal_candidate_ids.includes(input.plan.candidate_id)
      ? input.plan.candidate_id
      : null) ??
    input.legal_candidate_ids[0] ??
    null;
  const question =
    (pick && pick === input.plan?.candidate_id
      ? input.plan?.question_text
      : null) ||
    (pick
      ? `为推进当前决策理解，请补充与「${pick}」相关的关键信息。`
      : null);
  const layer = input.understanding.current_intake_layer ?? "problem_understanding";
  const out: DecisionUnderstandingModelOutput = {
    current_understanding_narrative:
      input.understanding.current_understanding.summary?.length >= 12 &&
      !/^Decision:\s*/i.test(input.understanding.current_understanding.summary) &&
      !/Open needs:\s*\d+/i.test(input.understanding.current_understanding.summary)
        ? input.understanding.current_understanding.summary
        : "我正在结合你的处境整理决策理解，并只追问对报告判断真正有影响的信息。",
    understood_labels: [],
    need_to_understand: [
      {
        label: question || "确认当前理解是否足够进入下一层",
        priority: "P0",
        necessity: "required",
        why_it_matters: "支撑当前调查层次推进",
        related_dir_ids: input.plan?.dir_ids?.slice(0, 3) ?? [],
      },
    ],
    personal_pattern_insight: { status: "none", insights: [] },
    problem_understanding_assessment: {
      statement: "deterministic_hook",
      supporting_fact_ids: [],
      unresolved_ambiguities: [],
      sufficient_proposal: layer !== "problem_understanding",
    },
    desired_outcome_assessment: {
      statement: "deterministic_hook",
      supporting_fact_ids: [],
      unresolved_ambiguities: [],
      sufficient_proposal:
        layer === "report_details" || layer === "final_understanding_review",
    },
    report_coverage_assessment: {
      missing_required_sections: [],
      notes: "deterministic_hook",
    },
    current_intake_layer: layer,
    next_question: {
      selected_candidate_id: pick,
      question_text: question,
      rationale: "deterministic_understanding_hook",
    },
    suggested_replies: [
      { label: "可以补充", value: "我可以补充更多细节" },
      { label: "暂时不确定", value: "我暂时不确定，先记为未知" },
      { label: "先确认理解", value: "目前理解基本准确，我们可以继续" },
    ],
    // Keep response_text === question so M1 regressions that assert
    // assistant content == plan.question_text still hold offline.
    response_text: question
      ? question
      : "【理解确认】当前关键信息已足够。请确认以上理解是否正确；确认后进入下一阶段。",
  };
  return out;
};

export function mergeAnswerInterpretationTestHooks(
  hooks?: AdaptiveTurnTestHooks,
): AdaptiveTurnTestHooks {
  return {
    interpretAnswerModel: deterministicAnswerModelHook,
    understandingResponseModel: deterministicUnderstandingModelHook,
    ...hooks,
  };
}

export function withDeterministicAnswerModelHook<
  T extends { test_hooks?: AdaptiveTurnTestHooks },
>(input: T): T {
  return {
    ...input,
    test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),
  };
}

export function withDeterministicHandleHooks<T extends HandleInput>(input: T): T {
  return {
    ...input,
    __testOnlyM1Hooks: mergeAnswerInterpretationTestHooks(input.__testOnlyM1Hooks),
  };
}
