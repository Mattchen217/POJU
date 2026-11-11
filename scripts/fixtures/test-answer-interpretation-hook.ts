/**
 * Test-only adapter: produce a ModelAnswerDraft from the deterministic
 * classifier so existing handleUserMessage / adaptive-turn regressions do
 * not call OpenRouter. Production never imports this module.
 */
import {
  activeTargets,
  classifyAnswer,
  writesFor,
} from "../../lib/poju/decision-intake/answer-interpretation";
import type { AdaptiveTurnTestHooks } from "../../lib/poju/decision-intake/adaptive-turn";
import type { AnswerInterpretationModelHook } from "../../lib/poju/decision-intake/answer-interpretation-model";
import type { HandleInput } from "../../lib/poju/agent";
import type { ModelAnswerDraft } from "../../lib/poju/decision-intake/types";
import type { POJUSessionState } from "../../lib/poju/types";

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
    const key = `${write.kind}:${write.statement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // write.statement is a clause or slice of the user statement, so it is
    // a contiguous source quote when the deterministic classifier is used.
    extracted_items.push({
      text: write.statement,
      semantic_kind: write.kind,
      role_hint: null,
      certainty:
        write.verification_level === "user_estimate"
          ? "estimated"
          : write.status === "unknown" || write.status === "declined"
            ? "unclear"
            : "explicit",
      source_quote: write.statement,
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

export function mergeAnswerInterpretationTestHooks(
  hooks?: AdaptiveTurnTestHooks,
): AdaptiveTurnTestHooks {
  return {
    interpretAnswerModel: deterministicAnswerModelHook,
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
