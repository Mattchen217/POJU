# -*- coding: utf-8 -*-
"""M2.3-R2-FU4 implementation patch."""
from pathlib import Path

ROOT = Path(".")

def patch_adaptive_turn():
    p = ROOT / "lib/poju/decision-intake/adaptive-turn.ts"
    t = p.read_text(encoding="utf-8")

    hook_type = '''
export type AdaptiveTurnTestHooks = {
  /** @internal Test-only. Runs immediately before each Understanding build. */
  beforeUnderstandingBuild?: () => void;
};

'''
    # Insert hook type before runAdaptiveQuestionTurn export
    marker = "export async function runAdaptiveQuestionTurn(input: {"
    if "export type AdaptiveTurnTestHooks" not in t:
        t = t.replace(marker, hook_type + marker, 1)
    else:
        print("adaptive-turn: hooks type already present")

    # Add test_hooks to input type
    old_input = '''export async function runAdaptiveQuestionTurn(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  /** Skip answer interpretation; plan from current DC (session init / first ask). */
  init_only?: boolean;
}): Promise<AdaptiveTurnResult> {
  let current = input.session;'''

    new_input = '''export async function runAdaptiveQuestionTurn(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  /** Skip answer interpretation; plan from current DC (session init / first ask). */
  init_only?: boolean;
  /** @internal Test-only fault injection. Omitted in production. */
  test_hooks?: AdaptiveTurnTestHooks;
}): Promise<AdaptiveTurnResult> {
  let current = input.session;
  const buildUnderstanding = (
    args: Parameters<typeof buildUnderstandingState>[0],
  ): UnderstandingState => {
    input.test_hooks?.beforeUnderstandingBuild?.();
    return buildUnderstandingState(args);
  };'''

    if "test_hooks?: AdaptiveTurnTestHooks" not in t:
        if old_input not in t:
            raise SystemExit("adaptive-turn: input signature block not found")
        t = t.replace(old_input, new_input, 1)
    else:
        print("adaptive-turn: test_hooks already in signature")

    # Replace buildUnderstandingState({ with buildUnderstanding({ ONLY inside
    # runAdaptiveQuestionTurn. The import and the typeof reference must stay.
    # After adding buildUnderstanding wrapper, replace remaining direct calls
    # that are NOT the return inside the wrapper and NOT the typeof.
    # Safer: replace the four known call sites by unique surrounding context.

    replacements = [
        (
            '''        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        if (planned.planner_block) {''',
            '''        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        if (planned.planner_block) {''',
        ),
        (
            '''        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: outcomeFromPlanResult(planned),''',
            '''        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: outcomeFromPlanResult(planned),''',
        ),
        (
            '''    understanding0 = buildUnderstandingState({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event?.event_id ?? null,
    });''',
            '''    understanding0 = buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event?.event_id ?? null,
    });''',
        ),
        (
            '''        u = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event?.event_id ?? null,
        });''',
            '''        u = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event?.event_id ?? null,
        });''',
        ),
    ]
    for old, new in replacements:
        if old not in t:
            # maybe already patched
            if new in t:
                print("adaptive-turn: call site already patched")
                continue
            raise SystemExit(f"adaptive-turn: call site not found:\n{old[:120]}")
        t = t.replace(old, new, 1)

    # Replace the catch-final u==null / ready_no_question block with Max's FU4 version
    old_final = '''    // M2.3-R2-FU3: Understanding rebuild failed (u==null). Cannot infer P0/P1
    // complete from missing needs. Conservative fail-closed while Blueprint
    // exists and hard budget may remain -- never ready_no_question / free-ask.
    if (!u && current.decision_blueprint) {
      let hardBudgetRemains = true;
      try {
        const hard = current.decision_blueprint.question_budget.hard;
        const asked =
          current.decision_understanding?.budget?.session_asked_count ?? 0;
        hardBudgetRemains = hard - asked > 0;
      } catch {
        // Cannot read budget either -- treat as remaining (fail-closed).
        hardBudgetRemains = true;
      }
      if (hardBudgetRemains) {
        return {
          session: current,
          outcome: "planner_blocked",
          ask_error: `understanding_exception:${err}`,
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error,
        };
      }
    }

    return {
      session: current,
      outcome: "ready_no_question",
      answer_event,
      understanding: u,
      plan: null,
      authorized_question: null,
      persist_error,
      ask_error: err,
    };
  }
}'''

    new_final = '''    // M2.3-R2-FU4: no valid Understanding after exception => never ready_no_question.
    // Hard-budget exhaustion is not a legal Readiness stop without Understanding.
    if (!u && current.decision_blueprint) {
      return {
        session: current,
        outcome: "planner_blocked",
        ask_error: `understanding_exception:${err}`,
        answer_event,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error,
      };
    }

    return {
      session: current,
      outcome: "planner_blocked",
      ask_error: `planner_exception:${err}`,
      answer_event,
      understanding: u,
      plan: null,
      authorized_question: null,
      persist_error,
    };
  }
}'''

    if old_final not in t:
        if 'ask_error: `understanding_exception:${err}`' in t and 'outcome: "ready_no_question"' not in t.split("catch (e)")[-1]:
            print("adaptive-turn: final catch already FU4-shaped?")
        else:
            # show nearby for debug
            idx = t.find("M2.3-R2-FU3: Understanding rebuild failed")
            print("FOUND idx", idx)
            if idx < 0:
                idx = t.find("ready_no_question")
            print(repr(t[idx:idx+800]))
            raise SystemExit("adaptive-turn: final catch block not found")
    else:
        t = t.replace(old_final, new_final, 1)

    # Verify: only import + typeof + wrapper body call buildUnderstandingState
    # Count remaining buildUnderstandingState({
    direct_calls = t.count("buildUnderstandingState({")
    if direct_calls != 0:
        raise SystemExit(f"adaptive-turn: still have {direct_calls} direct buildUnderstandingState({{ calls")
    if t.count("buildUnderstanding({") < 4:
        raise SystemExit("adaptive-turn: expected >=4 buildUnderstanding({ calls")

    p.write_text(t, encoding="utf-8", newline="\n")
    print("OK adaptive-turn.ts")


def patch_collecting():
    p = ROOT / "lib/poju/collecting-dc-turn.ts"
    t = p.read_text(encoding="utf-8")

    old_import = '''import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  UnderstandingState,
} from "@/lib/poju/decision-intake/types";'''

    new_import = '''import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  UnderstandingState,
} from "@/lib/poju/decision-intake/types";
import type {
  AdaptiveTurnTestHooks,
} from "@/lib/poju/decision-intake/adaptive-turn";'''

    if "AdaptiveTurnTestHooks" not in t:
        if old_import not in t:
            raise SystemExit("collecting: import block not found")
        t = t.replace(old_import, new_import, 1)

    old_run = '''export async function runCollectingDcTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
    init_only?: boolean;
  },
): Promise<CollectingDcTurnResult> {
  const { runAdaptiveQuestionTurn } = await import(
    "@/lib/poju/decision-intake/adaptive-turn"
  );
  const turn = await runAdaptiveQuestionTurn({
    session,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    now: input.now,
    init_only: input.init_only,
  });
  return mapAdaptiveOutcome(turn, Boolean(input.init_only));
}'''

    new_run = '''export async function runCollectingDcTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
    init_only?: boolean;
    test_hooks?: AdaptiveTurnTestHooks;
  },
): Promise<CollectingDcTurnResult> {
  const { runAdaptiveQuestionTurn } = await import(
    "@/lib/poju/decision-intake/adaptive-turn"
  );
  const turn = await runAdaptiveQuestionTurn({
    session,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    now: input.now,
    init_only: input.init_only,
    test_hooks: input.test_hooks,
  });
  return mapAdaptiveOutcome(turn, Boolean(input.init_only));
}'''

    if "test_hooks: input.test_hooks" not in t:
        if old_run not in t:
            raise SystemExit("collecting: runCollectingDcTurn block not found")
        t = t.replace(old_run, new_run, 1)

    old_pre = '''export async function runM1ProductionPreLlmTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
  },
): Promise<CollectingDcTurnResult> {
  const dc = session.decision_context;
  const hasDraft = dc?.status === "draft" || dc?.status === "final";

  // Brand-new session: no draft DC — bootstrap DC + Blueprint + first adaptive Q.
  // Do not interpret the decision question as an answer to a prior investigate ask.
  if (!hasDraft) {
    const { bootstrapFreshSessionMainLoop } = await import(
      "@/lib/poju/decision-intake/fresh-session-bootstrap"
    );
    const turn = await bootstrapFreshSessionMainLoop({
      session,
      statement: input.statement,
      source_turn_id: input.source_turn_id,
      now: input.now,
    });
    return mapAdaptiveOutcome(turn, true);
  }

  // Draft DC already present (seeded tests, Call B, or prior bootstrap): answer path.
  return runCollectingDcTurn(session, input);
}'''

    # The comment dash might be different encoding - use a more flexible approach
    if "test_hooks?: AdaptiveTurnTestHooks" not in t.split("runM1ProductionPreLlmTurn")[1][:400]:
        # Patch input type of runM1ProductionPreLlmTurn
        old_sig = '''export async function runM1ProductionPreLlmTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
  },
): Promise<CollectingDcTurnResult> {'''
        new_sig = '''export async function runM1ProductionPreLlmTurn(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now: string;
    test_hooks?: AdaptiveTurnTestHooks;
  },
): Promise<CollectingDcTurnResult> {'''
        if old_sig not in t:
            raise SystemExit("collecting: runM1ProductionPreLlmTurn sig not found")
        t = t.replace(old_sig, new_sig, 1)

        old_return = "  return runCollectingDcTurn(session, input);\n}"
        new_return = '''  return runCollectingDcTurn(session, {
    ...input,
    test_hooks: input.test_hooks,
  });
}'''
        # Only the last occurrence in this file (the draft-DC branch)
        if old_return not in t:
            raise SystemExit("collecting: final return runCollectingDcTurn not found")
        # replace last occurrence
        idx = t.rfind(old_return)
        t = t[:idx] + new_return + t[idx + len(old_return):]

    p.write_text(t, encoding="utf-8", newline="\n")
    print("OK collecting-dc-turn.ts")


def patch_agent():
    p = ROOT / "lib/poju/agent.ts"
    t = p.read_text(encoding="utf-8")

    old_imp = '''import {
  runCollectingDcTurn,
  runM1ProductionPreLlmTurn,
} from "@/lib/poju/collecting-dc-turn";'''
    new_imp = '''import {
  runCollectingDcTurn,
  runM1ProductionPreLlmTurn,
} from "@/lib/poju/collecting-dc-turn";
import type {
  AdaptiveTurnTestHooks,
} from "@/lib/poju/decision-intake/adaptive-turn";'''
    if "AdaptiveTurnTestHooks" not in t:
        if old_imp not in t:
            raise SystemExit("agent: import block not found")
        t = t.replace(old_imp, new_imp, 1)

    # Add __testOnlyM1Hooks to HandleInput
    if "__testOnlyM1Hooks" not in t:
        old_hi = '''  server_invoke?: {
    base_analysis: unknown | null;
    profile?: import("@/lib/profile/types").UserProfile | null;
    lab_prompt_capture?: import("@/lib/llm/phases/types").PhaseLLMInput["lab_prompt_capture"];
    /** Skip confirmation→delivery pipeline (LAB Stage1→2). */
    skip_delivery_pipeline?: boolean;
  };
}'''
        # The arrow char may be garbled; find by skip_delivery_pipeline
        marker = "skip_delivery_pipeline?: boolean;"
        idx = t.find(marker)
        if idx < 0:
            raise SystemExit("agent: HandleInput marker not found")
        # find closing of HandleInput after marker
        end = t.find("\n}", idx)
        # insert before the closing brace of interface
        insert = '''
  /** @internal Test-only fault injection for M1 adaptive-loop integration tests. */
  __testOnlyM1Hooks?: AdaptiveTurnTestHooks;'''
        # end points at \n} of the interface - but there may be nested }. Find the
        # interface end more carefully: after server_invoke block.
        # Look for pattern after skip_delivery line:
        rest = t[idx:]
        # Find "\n  };\n}" which closes server_invoke then HandleInput
        close = rest.find("\n  };\n}")
        if close < 0:
            raise SystemExit("agent: HandleInput close not found")
        abs_close = idx + close + len("\n  };")  # position of \n} of interface
        t = t[:abs_close] + insert + t[abs_close:]

    # Pass hooks into runM1ProductionPreLlmTurn
    old_call = '''        m1CollectingTurn = await runM1ProductionPreLlmTurn(sessionForLlm, {
          statement,
          source_turn_id: turnId,
          now: nowPre,
        });'''
    new_call = '''        m1CollectingTurn = await runM1ProductionPreLlmTurn(sessionForLlm, {
          statement,
          source_turn_id: turnId,
          now: nowPre,
          test_hooks: input.__testOnlyM1Hooks,
        });'''
    if "test_hooks: input.__testOnlyM1Hooks" not in t:
        if old_call not in t:
            raise SystemExit("agent: runM1ProductionPreLlmTurn call not found")
        t = t.replace(old_call, new_call, 1)

    # Tighten m1UnderstandingFailClosed
    old_fc = '''        const m1UnderstandingFailClosed =
          !m1CollectingTurn.authorized_question &&
          Boolean(m1CollectingTurn.ask_error) &&
          (m1CollectingTurn.ask_error!.includes("understanding_exception") ||
            m1CollectingTurn.ask_error!.includes("planner_exception") ||
            (m1CollectingTurn.understanding == null &&
              Boolean(m1CollectingTurn.session.decision_blueprint)));
        if (
          m1CollectingTurn.outcome === "planner_blocked" ||
          m1UnderstandingFailClosed
        ) {'''

    new_fc = '''        const m1UnderstandingFailClosed =
          !m1CollectingTurn.authorized_question &&
          (
            m1CollectingTurn.outcome === "planner_blocked" ||
            Boolean(m1CollectingTurn.ask_error?.includes("understanding_exception")) ||
            Boolean(m1CollectingTurn.ask_error?.includes("planner_exception")) ||
            (
              m1CollectingTurn.understanding == null &&
              Boolean(m1CollectingTurn.session.decision_blueprint)
            )
          );
        if (m1UnderstandingFailClosed) {'''

    if old_fc not in t:
        if "ask_error?.includes(\"understanding_exception\")" in t:
            print("agent: fail-closed already tightened")
        else:
            idx = t.find("m1UnderstandingFailClosed")
            print(repr(t[idx:idx+600]))
            raise SystemExit("agent: fail-closed block not found")
    else:
        t = t.replace(old_fc, new_fc, 1)

    p.write_text(t, encoding="utf-8", newline="\n")
    print("OK agent.ts")


patch_adaptive_turn()
patch_collecting()
patch_agent()
print("ALL CODE PATCHES DONE")
