# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
SRC = Path(r"D:\POJU\pojulife\temp\m24r2\src")

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {path.relative_to(ROOT)} ({len(text)} chars)")

def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"PATCH MISS: {label}\n---OLD START---\n{old}\n---OLD END---")
    if text.count(old) != 1:
        raise SystemExit(f"PATCH AMBIGUOUS ({text.count(old)}): {label}")
    return text.replace(old, new)

def main() -> None:
    at_path = ROOT / "lib/poju/decision-intake/adaptive-turn.ts"
    at = read(at_path)
    if "interpretAnswerWithModel" not in at:
        at = must_replace(
            at,
            'import { interpretUserAnswer } from "./answer-interpretation";\n',
            'import { answerEventFromModelDraft } from "./answer-interpretation";\n'
            'import { interpretAnswerWithModel } from "./answer-interpretation-model";\n',
            "adaptive-turn imports",
        )
    if "interpretAnswerModel?" not in at:
        at = must_replace(
            at,
            "  conflictClarifyPersist?: (\n"
            "    previous: POJUSessionState,\n"
            "    nextDcSession: POJUSessionState,\n"
            "    idempotency_key: string,\n"
            "  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;\n"
            "};\n",
            "  conflictClarifyPersist?: (\n"
            "    previous: POJUSessionState,\n"
            "    nextDcSession: POJUSessionState,\n"
            "    idempotency_key: string,\n"
            "  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;\n"
            "  /**\n"
            "   * @internal Test-only model interpretation substitute.\n"
            "   * When omitted (production default), interpretAnswerWithModel calls OpenRouter.\n"
            "   * Must never be set outside tests. Not an environment bypass switch.\n"
            "   */\n"
            "  interpretAnswerModel?: import(\"./answer-interpretation-model\").AnswerInterpretationModelHook;\n"
            "};\n",
            "AdaptiveTurnTestHooks.interpretAnswerModel",
        )
    if "locale?: string;" not in at:
        at = must_replace(
            at,
            "  /** @internal Test-only fault injection. Omitted in production. */\n"
            "  test_hooks?: AdaptiveTurnTestHooks;\n"
            "}): Promise<AdaptiveTurnResult> {",
            "  /** @internal Test-only fault injection. Omitted in production. */\n"
            "  test_hooks?: AdaptiveTurnTestHooks;\n"
            "  locale?: string;\n"
            "  signal?: AbortSignal;\n"
            "}): Promise<AdaptiveTurnResult> {",
            "runAdaptiveQuestionTurn locale/signal",
        )
    if "interpretAnswerWithModel({" not in at:
        at = must_replace(
            at,
            "    answer_event = interpretUserAnswer({\n"
            "      session: current,\n"
            "      statement,\n"
            "      source_turn_id: input.source_turn_id,\n"
            "      now: input.now,\n"
            "    });\n",
            "    const interpreted = await interpretAnswerWithModel({\n"
            "      session: current,\n"
            "      statement,\n"
            "      source_turn_id: input.source_turn_id,\n"
            "      locale: input.locale,\n"
            "      signal: input.signal,\n"
            "      testHook: input.test_hooks?.interpretAnswerModel,\n"
            "    });\n"
            "    if (!interpreted.ok) {\n"
            "      const outcome =\n"
            "        interpreted.reason === \"invalid_schema\" || interpreted.reason === \"invalid_json\"\n"
            "          ? \"answer_interpretation_invalid_schema\"\n"
            "          : \"answer_interpretation_failed\";\n"
            "      return {\n"
            "        session: input.session,\n"
            "        outcome,\n"
            "        answer_event: null,\n"
            "        understanding: null,\n"
            "        plan: null,\n"
            "        authorized_question: null,\n"
            "        ask_error: `${interpreted.reason}:${interpreted.detail}`,\n"
            "      };\n"
            "    }\n"
            "    answer_event = answerEventFromModelDraft({\n"
            "      session: current,\n"
            "      statement,\n"
            "      source_turn_id: input.source_turn_id,\n"
            "      draft: interpreted.draft,\n"
            "    });\n",
            "replace interpretUserAnswer with model path",
        )
    write(at_path, at)

    # collecting-dc-turn
    col_path = ROOT / "lib/poju/collecting-dc-turn.ts"
    col = read(col_path)
    if ' | "answer_interpretation_failed"' not in col:
        col = must_replace(
            col,
            '   * treat as investigation-complete / final-confirm.\n'
            '   */\n'
            '  | "planner_blocked";\n',
            '   * treat as investigation-complete / final-confirm.\n'
            '   */\n'
            '  | "planner_blocked"\n'
            "  /** Model answer interpretation call failed (timeout / transport / throw). */\n"
            '  | "answer_interpretation_failed"\n'
            "  /** Model returned invalid JSON or a schema-invalid draft. */\n"
            '  | "answer_interpretation_invalid_schema";\n',
            "CollectingDcTurnOutcome",
        )
    if 'turn.outcome === "answer_interpretation_failed"' not in col:
        col = must_replace(
            col,
            '  if (turn.outcome === "planner_blocked") {\n'
            "    return {\n"
            "      session: turn.session,\n"
            '      outcome: "planner_blocked",\n',
            '  if (\n'
            '    turn.outcome === "answer_interpretation_failed" ||\n'
            '    turn.outcome === "answer_interpretation_invalid_schema"\n'
            "  ) {\n"
            "    return {\n"
            "      session: turn.session,\n"
            "      outcome: turn.outcome,\n"
            "      ask_planned: false,\n"
            "      persist_error: turn.persist_error,\n"
            "      ...common,\n"
            "      authorized_question: null,\n"
            "      plan: null,\n"
            "      understanding: null,\n"
            "    };\n"
            "  }\n"
            '  if (turn.outcome === "planner_blocked") {\n'
            "    return {\n"
            "      session: turn.session,\n"
            '      outcome: "planner_blocked",\n',
            "map interpretation failure outcomes",
        )
    if "locale?: string;" not in col:
        col = must_replace(
            col,
            "    now: string;\n"
            "    init_only?: boolean;\n"
            "    test_hooks?: AdaptiveTurnTestHooks;\n"
            "  },\n"
            "): Promise<CollectingDcTurnResult> {",
            "    now: string;\n"
            "    init_only?: boolean;\n"
            "    test_hooks?: AdaptiveTurnTestHooks;\n"
            "    locale?: string;\n"
            "    signal?: AbortSignal;\n"
            "  },\n"
            "): Promise<CollectingDcTurnResult> {",
            "runCollectingDcTurn locale/signal",
        )
        col = must_replace(
            col,
            "    init_only: input.init_only,\n"
            "    test_hooks: input.test_hooks,\n"
            "  });\n"
            "  return mapAdaptiveOutcome(turn, Boolean(input.init_only));\n"
            "}\n",
            "    init_only: input.init_only,\n"
            "    test_hooks: input.test_hooks,\n"
            "    locale: input.locale,\n"
            "    signal: input.signal,\n"
            "  });\n"
            "  return mapAdaptiveOutcome(turn, Boolean(input.init_only));\n"
            "}\n",
            "pass locale/signal into runAdaptiveQuestionTurn",
        )
        col = must_replace(
            col,
            "    now: string;\n"
            "    test_hooks?: AdaptiveTurnTestHooks;\n"
            "  },\n"
            "): Promise<CollectingDcTurnResult> {",
            "    now: string;\n"
            "    test_hooks?: AdaptiveTurnTestHooks;\n"
            "    locale?: string;\n"
            "    signal?: AbortSignal;\n"
            "  },\n"
            "): Promise<CollectingDcTurnResult> {",
            "runM1ProductionPreLlmTurn locale/signal",
        )
    write(col_path, col)

    # agent.ts
    agent_path = ROOT / "lib/poju/agent.ts"
    agent = read(agent_path)
    if "locale: sessionOutputLocale," not in agent or "Answer Interpretation FAIL-CLOSED" not in agent:
        if "locale: sessionOutputLocale," not in agent.split("runM1ProductionPreLlmTurn")[1][:800]:
            agent = must_replace(
                agent,
                "        m1CollectingTurn = await runM1ProductionPreLlmTurn(sessionForLlm, {\n"
                "          statement,\n"
                "          source_turn_id: turnId,\n"
                "          now: nowPre,\n"
                "          test_hooks: input.__testOnlyM1Hooks,\n"
                "        });\n",
                "        m1CollectingTurn = await runM1ProductionPreLlmTurn(sessionForLlm, {\n"
                "          statement,\n"
                "          source_turn_id: turnId,\n"
                "          now: nowPre,\n"
                "          test_hooks: input.__testOnlyM1Hooks,\n"
                "          locale: sessionOutputLocale,\n"
                "          signal,\n"
                "        });\n",
                "agent pass locale/signal",
            )
        if "Answer Interpretation FAIL-CLOSED" not in agent:
            agent = must_replace(
                agent,
                "        if (\n"
                '          m1CollectingTurn.outcome === "persist_failed" ||\n'
                '          m1CollectingTurn.outcome === "persist_threw"\n'
                "        ) {\n",
                "        if (\n"
                '          m1CollectingTurn.outcome === "answer_interpretation_failed" ||\n'
                '          m1CollectingTurn.outcome === "answer_interpretation_invalid_schema"\n'
                "        ) {\n"
                "          const failText =\n"
                '            "【系统】本轮回答未能完成语义理解，决策上下文未写入。请稍后重试，或换一种表述。" +\n'
                "            (m1CollectingTurn.ask_error\n"
                "              ? `(${m1CollectingTurn.ask_error})`\n"
                "              : \"\");\n"
                "          const failAssistant: POJUMessage = {\n"
                '            role: "assistant",\n'
                "            content: failText,\n"
                "            timestamp: nowPre,\n"
                "            client_id: safeRandomUUID(),\n"
                "            meta: {\n"
                "              m1_fail_closed: true,\n"
                "              m1_outcome: m1CollectingTurn.outcome,\n"
                "              m1_ask_error: m1CollectingTurn.ask_error ?? null,\n"
                "            },\n"
                "          };\n"
                "          console.error(\n"
                '            "[agent] M1 Answer Interpretation FAIL-CLOSED (no free-ask fallback)",\n'
                "            m1CollectingTurn.outcome,\n"
                "            m1CollectingTurn.ask_error,\n"
                "          );\n"
                "          return withSessionProfileFlags({\n"
                "            ...sessionForLlm,\n"
                "            messages: [...messagesWithUser, failAssistant],\n"
                "            last_interaction_at: nowPre,\n"
                "          });\n"
                "        }\n"
                "        if (\n"
                '          m1CollectingTurn.outcome === "persist_failed" ||\n'
                '          m1CollectingTurn.outcome === "persist_threw"\n'
                "        ) {\n",
                "agent interpretation fail-closed branch",
            )
        write(agent_path, agent)
    else:
        print("agent.ts already patched")

    # poju/types.ts
    ptypes_path = ROOT / "lib/poju/types.ts"
    ptypes = read(ptypes_path)
    if "answer_interpretation_failed" not in ptypes:
        ptypes = must_replace(
            ptypes,
            '    m1_outcome?: "persist_failed" | "persist_threw" | "planner_blocked";\n',
            "    m1_outcome?:\n"
            '      | "persist_failed"\n'
            '      | "persist_threw"\n'
            '      | "planner_blocked"\n'
            '      | "answer_interpretation_failed"\n'
            '      | "answer_interpretation_invalid_schema";\n',
            "poju types m1_outcome",
        )
        write(ptypes_path, ptypes)
    else:
        print("poju types already patched")

    # index.ts
    index_path = ROOT / "lib/poju/decision-intake/index.ts"
    index = read(index_path)
    if "answerEventFromModelDraft" not in index:
        index = must_replace(
            index,
            'export { interpretUserAnswer } from "./answer-interpretation";\n',
            "export {\n"
            "  interpretUserAnswer,\n"
            "  activeTargets,\n"
            "  classifyAnswer,\n"
            "  writesFor,\n"
            "  answerEventFromModelDraft,\n"
            "  ANSWER_INTERPRETATION_VERSION,\n"
            "  MODEL_ANSWER_INTERPRETER_VERSION,\n"
            '} from "./answer-interpretation";\n'
            "export {\n"
            "  interpretAnswerWithModel,\n"
            "  parseAndValidateModelAnswerDraft,\n"
            "  buildModelInterpretationContext,\n"
            "  ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS,\n"
            "  MODEL_ANSWER_INTERPRETER_VERSION as MODEL_ANSWER_INTERPRETER_VERSION_MODEL,\n"
            '} from "./answer-interpretation-model";\n',
            "index.ts exports",
        )
        write(index_path, index)
    else:
        print("index.ts already patched")

    # fixture
    fixture = ROOT / "scripts/fixtures/test-answer-interpretation-hook.ts"
    write(fixture, read(SRC / "test-answer-interpretation-hook.ts"))

    # tests
    path = ROOT / "scripts/test-m1-production-adaptive-question-loop.ts"
    text = read(path)
    if "withDeterministicHandleHooks" not in text:
        text = must_replace(
            text,
            '  const { handleUserMessage } = await import("../lib/poju/agent");\n'
            '  const { runCollectingDcTurn } = await import("../lib/poju/collecting-dc-turn");\n',
            '  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");\n'
            '  const { runCollectingDcTurn: runCollectingDcTurnRaw } = await import("../lib/poju/collecting-dc-turn");\n'
            "  const { withDeterministicHandleHooks, mergeAnswerInterpretationTestHooks } = await import(\n"
            '    "./fixtures/test-answer-interpretation-hook"\n'
            "  );\n"
            "  const handleUserMessage: typeof handleUserMessageRaw = (input) =>\n"
            "    handleUserMessageRaw(withDeterministicHandleHooks(input));\n"
            "  const runCollectingDcTurn: typeof runCollectingDcTurnRaw = (session, input) =>\n"
            "    runCollectingDcTurnRaw(session, {\n"
            "      ...input,\n"
            "      test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),\n"
            "    });\n",
            "wrap adaptive test handleUserMessage/runCollectingDcTurn",
        )
    if "M2.4-R2 Case A:" not in text:
        cases = read(SRC / "r2-cases.ts")
        if not cases.endswith("\n"):
            cases += "\n"
        text = must_replace(
            text,
            '    await check("M2.4-R1-FU6 Case Z25: accuracy-rate insufficient first and affirmed second selects the second fact", async () => {\n'
            '      const result = await answerSeededConflict("m24z25", "第一条准确率不高，但第二条准确");\n'
            '      assertSelectedClarification("m24z25", result, result.seeded.factB.fact_id);\n'
            "    });\n",
            '    await check("M2.4-R1-FU6 Case Z25: accuracy-rate insufficient first and affirmed second selects the second fact", async () => {\n'
            '      const result = await answerSeededConflict("m24z25", "第一条准确率不高，但第二条准确");\n'
            '      assertSelectedClarification("m24z25", result, result.seeded.factB.fact_id);\n'
            "    });\n" + cases,
            "append R2 cases A-F",
        )
    write(path, text)

    path = ROOT / "scripts/test-m1-r-fresh-session-main-loop.ts"
    text = read(path)
    if "withDeterministicHandleHooks" not in text:
        text = must_replace(
            text,
            '  const { handleUserMessage } = await import("../lib/poju/agent");\n',
            '  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");\n'
            "  const { withDeterministicHandleHooks } = await import(\n"
            '    "./fixtures/test-answer-interpretation-hook"\n'
            "  );\n"
            "  const handleUserMessage: typeof handleUserMessageRaw = (input) =>\n"
            "    handleUserMessageRaw(withDeterministicHandleHooks(input));\n",
            "wrap m1-r handleUserMessage",
        )
        write(path, text)
    else:
        print("m1-r already wrapped")

    path = ROOT / "scripts/test-m2-1-readiness-confirm-freeze.ts"
    text = read(path)
    if "withDeterministicHandleHooks" not in text:
        text = must_replace(
            text,
            '  const { handleUserMessage } = await import("../lib/poju/agent");\n',
            '  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");\n'
            "  const { withDeterministicHandleHooks } = await import(\n"
            '    "./fixtures/test-answer-interpretation-hook"\n'
            "  );\n"
            "  const handleUserMessage: typeof handleUserMessageRaw = (input) =>\n"
            "    handleUserMessageRaw(withDeterministicHandleHooks(input));\n",
            "wrap m2-1 handleUserMessage",
        )
        write(path, text)
    else:
        print("m2-1 already wrapped")

    path = ROOT / "scripts/test-m2-3-decision-blueprint.ts"
    text = read(path)
    if "handleUserMessageRaw" not in text:
        text = must_replace(
            text,
            '  const { handleUserMessage } = await import("../lib/poju/agent");\n'
            "  const { runM1ProductionPreLlmTurn, runCollectingDcTurn } = await import(\n"
            '    "../lib/poju/collecting-dc-turn"\n'
            "  );\n",
            '  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");\n'
            "  const {\n"
            "    runM1ProductionPreLlmTurn: runM1ProductionPreLlmTurnRaw,\n"
            "    runCollectingDcTurn: runCollectingDcTurnRaw,\n"
            "  } = await import(\n"
            '    "../lib/poju/collecting-dc-turn"\n'
            "  );\n"
            "  const { withDeterministicHandleHooks, mergeAnswerInterpretationTestHooks } = await import(\n"
            '    "./fixtures/test-answer-interpretation-hook"\n'
            "  );\n"
            "  const handleUserMessage: typeof handleUserMessageRaw = (input) =>\n"
            "    handleUserMessageRaw(withDeterministicHandleHooks(input));\n"
            "  const runM1ProductionPreLlmTurn: typeof runM1ProductionPreLlmTurnRaw = (session, input) =>\n"
            "    runM1ProductionPreLlmTurnRaw(session, {\n"
            "      ...input,\n"
            "      test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),\n"
            "    });\n"
            "  const runCollectingDcTurn: typeof runCollectingDcTurnRaw = (session, input) =>\n"
            "    runCollectingDcTurnRaw(session, {\n"
            "      ...input,\n"
            "      test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),\n"
            "    });\n",
            "wrap m2-3 handleUserMessage and collecting turns",
        )
        text = must_replace(
            text,
            "    runAdaptiveQuestionTurn,\n"
            "    attachAuthorizedAssistantQuestion,\n"
            '  } = await import("../lib/poju/decision-intake");\n',
            "    runAdaptiveQuestionTurn: runAdaptiveQuestionTurnRaw,\n"
            "    attachAuthorizedAssistantQuestion,\n"
            '  } = await import("../lib/poju/decision-intake");\n'
            "  const runAdaptiveQuestionTurn: typeof runAdaptiveQuestionTurnRaw = (input) =>\n"
            "    runAdaptiveQuestionTurnRaw({\n"
            "      ...input,\n"
            "      test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),\n"
            "    });\n",
            "wrap m2-3 runAdaptiveQuestionTurn",
        )
        write(path, text)
    else:
        print("m2-3 already wrapped")

    print("ALL REMAINING PATCHES APPLIED")

if __name__ == "__main__":
    main()
