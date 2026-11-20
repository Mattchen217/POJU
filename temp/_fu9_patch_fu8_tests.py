from pathlib import Path

p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")

old_header = """ * M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect scheduling, goal_change / insight_mismatch control flow.
"""
new_header = """ * M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect scheduling, goal_change / insight_mismatch control flow.
 * M2.4-R2-FU9: source-content equality, insight_mismatch clarification resolution, goal_change target extraction.
"""
assert old_header in text
text = text.replace(old_header, new_header, 1)

# Add exact definition_patch to FU8-C4..C7 empty extracted_items goal_change drafts.
# These four blocks share the same empty extracted_items pattern inside goal_change.
old_empty = '''            classification: "goal_change",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "proposed target change",
'''
new_filled = '''            classification: "goal_change",
            extracted_items: [
              {
                text: "要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
'''
count = text.count(old_empty)
assert count == 4, f"expected 4 empty goal_change drafts, found {count}"
text = text.replace(old_empty, new_filled)

# FU8-D2: inject a model hook so clarification does not call OpenRouter
# and still writes no inferred facts.
old_d2 = '''      const factsBeforeClarify = first.decision_context!.reality_facts.length;
      stubResponse = "FU8D2 FREEFORM MUST NOT WIN";
      const clarified = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "不一致的地方是我并不是因为怕风险才犹豫。",
        locale: "zh-CN",
      });
'''
new_d2 = '''      const factsBeforeClarify = first.decision_context!.reality_facts.length;
      const clarify = "不一致的地方是我并不是因为怕风险才犹豫。";
      const clarifyDraft = {
        classification: "clear_answer" as const,
        extracted_items: [] as import("../lib/poju/decision-intake/types").ModelAnswerDraft["extracted_items"],
        unresolved_aspects: [] as string[],
        explanation: "no persistable user-authored fact in this clarification",
      };
      stubResponse = "FU8D2 FREEFORM MUST NOT WIN";
      const clarified = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => clarifyDraft },
      });
'''
assert old_d2 in text, "FU8-D2 clarification block not found"
text = text.replace(old_d2, new_d2, 1)

old_replay = '''      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            {
              role: "user" as const,
              content: "不一致的地方是我并不是因为怕风险才犹豫。",
              timestamp: NOW,
              client_id: turnId,
            },
          ],
        },
        userMessage: "不一致的地方是我并不是因为怕风险才犹豫。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
'''
new_replay = '''      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            {
              role: "user" as const,
              content: clarify,
              timestamp: NOW,
              client_id: turnId,
            },
          ],
        },
        userMessage: clarify,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => clarifyDraft },
      });
'''
assert old_replay in text, "FU8-D2 replay block not found"
text = text.replace(old_replay, new_replay, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("updated FU8 C4-C7 and D2")