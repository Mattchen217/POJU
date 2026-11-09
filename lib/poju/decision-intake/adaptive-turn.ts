/**
 * M1 Production Adaptive Question Turn orchestrator.
 *
 * Order (normative, M2.3-R2):
 *   User Answer → Answer Interpretation → DC Update (persist)
 *   → Ensure Blueprint → activateNextBlueprintPriorityBand (latest DC)
 *   → Understanding + Readiness (on activated DC) → Question Planning
 *   → Scope/Depth/Budget Validation → Generate Next Question → Persist
 *   → (Agent returns assistant from plan)
 * Sole production entry used by collecting-dc-turn / handleUserMessage.
 * Answer Interpretation + Question Generation are **v1 simplified** (see those modules).
 * Fresh sessions without draft DC enter via bootstrapFreshSessionMainLoop (M1-R).
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  buildIntakeCandidatesFromDc,
  INTAKE_ASK_SCORING_PATH,
  type IntakeAskPlanSnapshot,
} from "@/lib/poju/decision-context/production-intake-ask";
import { planNextAskFromCandidates } from "@/lib/poju/decision-context/question-plan-cycle";
import { snapshotFromDc } from "@/lib/poju/decision-context/question-planning";
import { buildProductionNaValidationContextFromSession } from "@/lib/poju/decision-context/na-validation-from-session";
import { persistDcLifecycleChange } from "@/lib/poju/decision-context/production-dc-lifecycle";
import { interpretUserAnswer } from "./answer-interpretation";
import { applyAnswerEventToSessionDc } from "./apply-answer-to-dc";
import { ensureDecisionBlueprint,
  activateNextBlueprintPriorityBand } from "./blueprint";
import { buildAdaptiveQuestionPlan } from "./question-generation";
import { bumpBudgetAfterAsk } from "./scope-budget";
import { buildUnderstandingState } from "./understanding-state";
import { resolveDdrIdsForDir } from "./blueprint";
import type { RankedPlanningCandidate } from "@/lib/poju/decision-context/question-plan-cycle";
import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  NeedItem,
  UnderstandingState,
} from "./types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function withUnderstanding(
  session: POJUSessionState,
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  askSnap: IntakeAskPlanSnapshot | null,
): POJUSessionState {
  return {
    ...session,
    decision_understanding: understanding,
    adaptive_ask_plan: plan,
    intake_ask_plan: askSnap ?? session.intake_ask_plan ?? null,
  };
}

type DirBasedNeed = Extract<NeedItem, { kind: "dir_based" }>;

function openBlueprintP0P1Needs(understanding: UnderstandingState): DirBasedNeed[] {
  return understanding.need_to_understand.items.filter(
    (n): n is DirBasedNeed =>
      n.kind === "dir_based" && (n.priority === "P0" || n.priority === "P1"),
  );
}

function outcomeFromPlanResult(planned: {
  plan: AdaptiveQuestionPlan | null;
  planner_block: { reason_code: string; detail: string } | null;
}): AdaptiveTurnResult["outcome"] {
  if (planned.plan) return "planned";
  if (planned.planner_block) return "planner_blocked";
  return "ready_no_question";
}

/**
 * Deterministic Catalog-scoped fallback for an unfinished Blueprint P0/P1 DIR.
 * Must still pass DDR association + Blueprint scope/depth/budget/NA via
 * buildAdaptiveQuestionPlan validation — never a free-form substitute.
 */
function tryCatalogFallbackForOpenP0P1(input: {
  dc: NonNullable<POJUSessionState["decision_context"]>;
  blueprint: NonNullable<POJUSessionState["decision_blueprint"]>;
  understanding: UnderstandingState;
  budget: UnderstandingState["budget"];
  now: string;
  scoring_path: string;
}): { plan: AdaptiveQuestionPlan | null; last_reject: string | null } {
  const needs = openBlueprintP0P1Needs(input.understanding).slice().sort((a, b) => {
    const pr = (p: "P0" | "P1" | "P2") => (p === "P0" ? 0 : p === "P1" ? 1 : 2);
    const d = pr(a.priority) - pr(b.priority);
    if (d !== 0) return d;
    return a.dir_id.localeCompare(b.dir_id);
  });
  let last_reject: string | null = null;
  for (const need of needs) {
    const dir = input.dc.dirs.find((d) => d.dir_id === need.dir_id);
    if (!dir || dir.id_lifecycle === "deprecated") {
      last_reject = `fallback_dir_missing:${need.dir_id}`;
      continue;
    }
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    if (!input.blueprint.dir_ids.includes(need.dir_id)) {
      last_reject = `fallback_dir_out_of_scope:${need.dir_id}`;
      continue;
    }
    const ddr_ids =
      need.ddr_ids.length > 0
        ? [...need.ddr_ids]
        : resolveDdrIdsForDir(need.dir_id, input.blueprint);
    if (!ddr_ids.length || ddr_ids.some((id) => id.startsWith("DDR_FOR_"))) {
      last_reject = `fallback_missing_ddr:${need.dir_id}`;
      continue;
    }
    const roles = dir.required_fact_roles ?? [];
    const fact_role_codes = roles.map((r) => `v1/dir/${dir.dir_id}/role/${r}`);
    const depth = (input.budget.depth_by_dir[need.dir_id] ?? 0) + 1;
    const gap =
      need.gap_type === "unknown" ||
      need.gap_type === "partial" ||
      need.gap_type === "conflict" ||
      need.gap_type === "declined"
        ? need.gap_type
        : "unknown";
    const ranked: RankedPlanningCandidate = {
      candidate: {
        candidate_id: `cq_fallback_${need.dir_id}`,
        kind: "dir_based",
        dir_ids: [need.dir_id],
        ddr_ids,
        fact_role_codes,
        impact: {
          decision_critical: need.priority === "P0" || need.may_affect_p5_ranking,
          may_affect_p5_ranking: need.may_affect_p5_ranking,
          gate_class: need.priority,
        },
        depth,
        repetition_count: Math.max(0, depth - 1),
        budget_cost: 1,
      },
      score: {
        candidate_id: `cq_fallback_${need.dir_id}`,
        gap_type: gap,
        unresolved_count: Math.max(1, fact_role_codes.length),
        role_states: [],
        information_gain_est: 1,
        attributable_fail: false,
      },
      sort_key: `fallback|${need.priority}|${need.dir_id}`,
    };
    const built = buildAdaptiveQuestionPlan({
      dc: input.dc,
      blueprint: input.blueprint,
      selected: ranked,
      budget: input.budget,
      now: input.now,
      scoring_path: input.scoring_path,
    });
    if (built.validation.ok) {
      return { plan: built.plan, last_reject: null };
    }
    last_reject = `fallback_reject:${built.validation.reason_code}:${need.dir_id}`;
  }
  return { plan: null, last_reject };
}

/**
 * Run one adaptive collecting turn.
 * When `statement` is empty and `init_only`, only ensures Blueprint + first plan.
 */

export type AdaptiveTurnTestHooks = {
  /** @internal Test-only. Runs immediately before each Understanding build. */
  beforeUnderstandingBuild?: () => void;
};

export async function runAdaptiveQuestionTurn(input: {
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
  };
  const dc0 = current.decision_context;
  if (!dc0 || (dc0.status !== "draft" && dc0.status !== "final")) {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: "no_dc",
    };
  }

  // 1) Blueprint
  const bp = ensureDecisionBlueprint(current, { now: input.now });
  current = bp.session;

  let answer_event: AnswerEvent | null = null;
  let persist_error: string | undefined;

  // 2) Answer Interpretation → DC Update (unless init_only)
  if (!input.init_only) {
    const statement = input.statement.trim();
    if (!statement) {
      return {
        session: current,
        outcome: "not_applicable_phase",
        answer_event: null,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: "empty_statement",
      };
    }
    answer_event = interpretUserAnswer({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      now: input.now,
    });

    try {
      const applied = await applyAnswerEventToSessionDc(current, answer_event, {
        now: input.now,
      });
      if (applied.skipped_reason === "turn_already_mapped") {
        // Idempotent replay: rebuild understanding/plan from existing DC, no dup writes.
        // M2.3-R2-FU2: preserve planner_blocked — do not drop nonterminal protection.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        if (planned.planner_block) {
          return {
            session: planned.session,
            outcome: "planner_blocked",
            ask_error: `${planned.planner_block.reason_code}:${planned.planner_block.detail}`,
            answer_event,
            understanding: planned.understanding,
            plan: planned.plan,
            authorized_question: planned.authorized_question,
            persist_error: "turn_already_mapped",
          };
        }
        return {
          session: planned.session,
          outcome: "idempotent_replay",
          answer_event,
          understanding: planned.understanding,
          plan: planned.plan,
          authorized_question: planned.authorized_question,
          persist_error: "turn_already_mapped",
        };
      }
      if (!applied.applied) {
        // Off-topic / invalid: still recompute understanding; may keep prior needs.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,
          answer_event,
          understanding: planned.understanding,
          plan: planned.plan,
          authorized_question: planned.authorized_question,
          persist_error: applied.skipped_reason,
        };
      }

      // Persist DC via C1
      const key = `dc_collect:${current.session_id}:${input.source_turn_id}`;
      const persisted = await persistDcLifecycleChange(
        input.session,
        applied.session,
        key,
      );
      if (persisted.error === "idempotent_skip") {
        current = persisted.session;
        persist_error = "idempotent_skip";
      } else if (!persisted.committed) {
        return {
          session: input.session,
          outcome: "dc_persist_failed",
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error: persisted.error ?? "persist_failed",
        };
      } else {
        // Keep C1 revision mirrors from commit.session — caller/savePOJUSession
        // must not see a stale session_revision after DC write.
        current = {
          ...applied.session,
          ...persisted.session,
          decision_context:
            persisted.session.decision_context ?? applied.session.decision_context,
          decision_context_versions:
            persisted.session.decision_context_versions ??
            applied.session.decision_context_versions,
          decision_context_idempotency_keys:
            persisted.session.decision_context_idempotency_keys ??
            applied.session.decision_context_idempotency_keys,
          control_plane:
            persisted.session.control_plane ?? applied.session.control_plane,
          decision_blueprint: applied.session.decision_blueprint,
          messages: applied.session.messages,
          agent_v2: applied.session.agent_v2,
          session_revision: persisted.session.session_revision,
          dc_write_revision: persisted.session.dc_write_revision,
        };
      }
    } catch (e) {
      return {
        session: input.session,
        outcome: "dc_persist_threw",
        answer_event,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: errorText(e),
      };
    }
  }

  // Ensure blueprint present after persist merge
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;

  // M2.3-R2 authoritative sequence:
  //   activate priority band on latest DC → build Understanding → Readiness → plan
  // Do not build Readiness against a DC that band activation later mutates.
  current = activateNextBlueprintPriorityBand(current, input.now);

  let understanding0: UnderstandingState | null = null;
  try {
    understanding0 = buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event?.event_id ?? null,
    });
    const planned = await planFromState(current, understanding0, input.now);
    return {
      session: planned.session,
      outcome: outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,
      answer_event,
      understanding: planned.understanding,
      plan: planned.plan,
      authorized_question: planned.authorized_question,
      persist_error,
    };
  } catch (e) {
    // M2.3-R2-FU2: planner/understanding exception must not disguise as investigation complete
    // while Blueprint P0/P1 obligations remain and hard budget remains.
    const err = errorText(e);
    let u = understanding0;
    if (!u) {
      try {
        u = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event?.event_id ?? null,
        });
      } catch {
        u = null;
      }
    }
    if (u) {
      const openP0P1 = openBlueprintP0P1Needs(u);
      if (openP0P1.length > 0 && u.budget.remaining_hard_budget > 0) {
        const blockedU: UnderstandingState = {
          ...u,
          next_question_plan: null,
          readiness: {
            ...u.readiness,
            verdict: "continue",
            can_ask: true,
            reasons: [
              ...u.readiness.reasons,
              "open_blueprint_p0_p1_obligations",
              "planner_blocked",
              "planner_exception",
            ],
          },
        };
        return {
          session: withUnderstanding(
            current,
            blockedU,
            null,
            current.intake_ask_plan ?? null,
          ),
          outcome: "planner_blocked",
          ask_error: `planner_exception:${err}`,
          answer_event,
          understanding: blockedU,
          plan: null,
          authorized_question: null,
          persist_error,
        };
      }
    }

    // M2.3-R2-FU4: no valid Understanding after exception => never ready_no_question.
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
}

async function planFromState(
  session: POJUSessionState,
  understanding: UnderstandingState,
  now: string,
): Promise<{
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
  planner_block: { reason_code: string; detail: string } | null;
}> {
  // M2.3-R2: priority-band activation already ran before Understanding/Readiness.
  // Activating here would mutate DC after Readiness and reuse a stale can_ask.
  const dc = session.decision_context!;
  const blueprint = session.decision_blueprint!;
  let budget = understanding.budget;

  if (!understanding.readiness.can_ask) {
    const u = {
      ...understanding,
      next_question_plan: null,
      last_sent_question: null,
      budget,
    };
    return {
      session: withUnderstanding(session, u, null, session.intake_ask_plan ?? null),
      understanding: u,
      plan: null,
      authorized_question: null,
      planner_block: null,
    };
  }

  const candidates = buildIntakeCandidatesFromDc(dc, blueprint).map((c) => {
    const dirId = c.dir_ids[0];
    const depth = dirId ? (budget.depth_by_dir[dirId] ?? 0) + 1 : c.depth;
    // Filter completed dirs already handled in builder; enforce depth cap here.
    return { ...c, depth, repetition_count: Math.max(0, depth - 1) };
  }).filter((c) => {
    if (!c.ddr_ids.length || c.ddr_ids.some((id) => id.startsWith("DDR_FOR_"))) {
      return false;
    }
    for (const dirId of c.dir_ids) {
      if (!blueprint.dir_ids.includes(dirId)) return false;
    }
    const dirId = c.dir_ids[0];
    if (!dirId) return true;
    const used = budget.depth_by_dir[dirId] ?? 0;
    return used < blueprint.question_budget.depth_per_direction;
  });

  const naValidation = await buildProductionNaValidationContextFromSession(
    session,
    { nowIso: now },
  );
  const planResult = planNextAskFromCandidates({
    candidates,
    snap: snapshotFromDc(dc),
    naValidation,
    remaining_hard_budget: budget.remaining_hard_budget,
  });

  const askSnap: IntakeAskPlanSnapshot = {
    scored_at: now,
    scoring_path: INTAKE_ASK_SCORING_PATH,
    selected_candidate_id: planResult.selected?.candidate.candidate_id ?? null,
    ranked_candidate_ids: planResult.ranked.map((r) => r.candidate.candidate_id),
    unresolved_counts: Object.fromEntries(
      planResult.ranked.map((r) => [
        r.candidate.candidate_id,
        r.score.unresolved_count,
      ]),
    ),
    gap_types: Object.fromEntries(
      planResult.ranked.map((r) => [r.candidate.candidate_id, r.score.gap_type]),
    ),
  };

  const openP0P1 = openBlueprintP0P1Needs(understanding);
  const protectOpenP0P1 =
    openP0P1.length > 0 && budget.remaining_hard_budget > 0;

  const blockOpenObligations = (
    reason_code: string,
    detail: string,
    extraReasons: string[],
  ) => {
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: null,
      readiness: {
        ...understanding.readiness,
        verdict: "continue",
        can_ask: true,
        reasons: [
          ...understanding.readiness.reasons,
          "open_blueprint_p0_p1_obligations",
          "planner_blocked",
          ...extraReasons,
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, askSnap),
      understanding: u,
      plan: null as AdaptiveQuestionPlan | null,
      authorized_question: null as string | null,
      planner_block: { reason_code, detail },
    };
  };

  const tryFallbackOrBlock = (reason_code: string, detail: string, extraReasons: string[]) => {
    const fb = tryCatalogFallbackForOpenP0P1({
      dc,
      blueprint,
      understanding,
      budget,
      now,
      scoring_path: `${INTAKE_ASK_SCORING_PATH}→catalog_fallback_p0_p1→buildAdaptiveQuestionPlan`,
    });
    if (fb.plan) {
      const u: UnderstandingState = {
        ...understanding,
        budget,
        next_question_plan: fb.plan,
        last_sent_question: null,
        readiness: {
          ...understanding.readiness,
          verdict: "continue",
          can_ask: true,
          reasons: [
            ...understanding.readiness.reasons,
            "catalog_fallback_p0_p1",
            ...extraReasons,
          ],
        },
      };
      return {
        session: withUnderstanding(session, u, fb.plan, askSnap),
        understanding: u,
        plan: fb.plan,
        authorized_question: fb.plan.question_text,
        planner_block: null as { reason_code: string; detail: string } | null,
      };
    }
    const rejectDetail = fb.last_reject ? `${detail}|${fb.last_reject}` : detail;
    return blockOpenObligations(reason_code, rejectDetail, extraReasons);
  };

  if (!planResult.selected) {
    // M2.3-R2-FU: open P0/P1 + remaining hard budget must not become false completion.
    if (protectOpenP0P1) {
      return tryFallbackOrBlock(
        "no_selectable_candidate",
        "open_p0_p1_no_selectable_candidate",
        ["no_selectable_candidate"],
      );
    }
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: null,
      readiness: {
        ...understanding.readiness,
        verdict:
          budget.remaining_hard_budget <= 0
            ? "hard_budget_exhausted"
            : "ready_for_final_confirm",
        can_ask: false,
        reasons: [
          ...understanding.readiness.reasons,
          "no_selectable_candidate",
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, askSnap),
      understanding: u,
      plan: null,
      authorized_question: null,
      planner_block: null,
    };
  }

  const built = buildAdaptiveQuestionPlan({
    dc,
    blueprint,
    selected: planResult.selected,
    budget,
    now,
    scoring_path: `${INTAKE_ASK_SCORING_PATH}→buildAdaptiveQuestionPlan`,
  });

  if (!built.validation.ok) {
    // Try next ranked candidates within budget/scope.
    for (const ranked of planResult.ranked.slice(1)) {
      const alt = buildAdaptiveQuestionPlan({
        dc,
        blueprint,
        selected: ranked,
        budget,
        now,
        scoring_path: `${INTAKE_ASK_SCORING_PATH}→buildAdaptiveQuestionPlan`,
      });
      if (alt.validation.ok) {
        const u: UnderstandingState = {
          ...understanding,
          budget,
          next_question_plan: alt.plan,
          last_sent_question: null,
        };
        return {
          session: withUnderstanding(session, u, alt.plan, askSnap),
          understanding: u,
          plan: alt.plan,
          authorized_question: alt.plan.question_text,
          planner_block: null,
        };
      }
    }
    // M2.3-R2-FU: all candidates rejected — preserve exact reason; never false-complete.
    const rejectReason = `scope_budget_reject:${built.validation.reason_code}`;
    if (protectOpenP0P1) {
      return tryFallbackOrBlock(
        "all_candidates_rejected",
        `${built.validation.reason_code}:${built.validation.detail}`,
        [rejectReason],
      );
    }
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: null,
      readiness: {
        verdict: "ready_for_final_confirm",
        can_ask: false,
        reasons: [
          ...understanding.readiness.reasons,
          rejectReason,
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, askSnap),
      understanding: u,
      plan: null,
      authorized_question: null,
      planner_block: null,
    };
  }

  const u: UnderstandingState = {
    ...understanding,
    budget,
    next_question_plan: built.plan,
    last_sent_question: understanding.last_sent_question,
  };
  return {
    session: withUnderstanding(session, u, built.plan, askSnap),
    understanding: u,
    plan: built.plan,
    authorized_question: built.plan.question_text,
    planner_block: null,
  };
}

/** Mark a plan as actually shown without double-counting (restore same plan_id). */
export function attachAuthorizedAssistantQuestion(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
  turnId: string,
): POJUSessionState {
  const understanding = session.decision_understanding;
  if (!understanding) {
    return {
      ...session,
      adaptive_ask_plan: plan,
    };
  }
  const already =
    understanding.last_sent_question?.plan_id === plan.plan_id;
  const budget = already
    ? understanding.budget
    : bumpBudgetAfterAsk(understanding.budget, plan);
  return {
    ...session,
    adaptive_ask_plan: plan,
    decision_understanding: {
      ...understanding,
      budget,
      next_question_plan: plan,
      last_sent_question: {
        question_text: plan.question_text,
        plan_id: plan.plan_id,
        direction_id: plan.direction_id,
        dir_ids: plan.dir_ids,
        ddr_ids: plan.ddr_ids,
        turn_id: turnId,
      },
    },
  };
}
