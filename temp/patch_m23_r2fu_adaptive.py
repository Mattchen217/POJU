# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
p = ROOT / "lib/poju/decision-intake/adaptive-turn.ts"
t = p.read_text(encoding="utf-8")

# 1) Update imports
old_imp = '''import { buildAdaptiveQuestionPlan } from "./question-generation";
import { bumpBudgetAfterAsk } from "./scope-budget";
import { buildUnderstandingState } from "./understanding-state";
import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  UnderstandingState,
} from "./types";'''

new_imp = '''import { buildAdaptiveQuestionPlan } from "./question-generation";
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
} from "./types";'''

if old_imp not in t:
    raise SystemExit("import block not found")
t = t.replace(old_imp, new_imp, 1)

# 2) Add outcome helper after withUnderstanding
old_with = '''function withUnderstanding(
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
}'''

new_with = '''function withUnderstanding(
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
}'''

if old_with not in t:
    raise SystemExit("withUnderstanding not found")
t = t.replace(old_with, new_with, 1)

# 3) Replace outcome mapping sites (2 occurrences of ternary)
old_ternary = 'outcome: planned.plan ? "planned" : "ready_no_question",'
new_ternary = '''outcome: outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,'''
# Careful: the two sites have slightly different following fields.
# First occurrence (off-topic) has persist_error: applied.skipped_reason
# Second has persist_error,

count = t.count(old_ternary)
if count != 2:
    raise SystemExit(f"expected 2 ternary outcomes, got {count}")
t = t.replace(old_ternary, new_ternary)

# 4) Replace entire planFromState function
start = t.find("async function planFromState(")
end = t.find("/** Mark a plan as actually shown", start)
if start < 0 or end < 0:
    raise SystemExit("planFromState span not found")

new_plan = r'''async function planFromState(
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

'''

t = t[:start] + new_plan + t[end:]
p.write_text(t, encoding="utf-8")
print("patched adaptive-turn.ts")
# sanity
t2 = p.read_text(encoding="utf-8")
assert "planner_blocked" in t2
assert "tryCatalogFallbackForOpenP0P1" in t2
assert "outcomeFromPlanResult" in t2
assert t2.count("planner_block:") >= 5
print("adaptive-turn sanity ok")
