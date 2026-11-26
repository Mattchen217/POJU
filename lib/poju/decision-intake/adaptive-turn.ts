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
 * M2.4-R1: Answer Interpretation + Question Generation are gap-driven Phase 4 core.
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
import {
  activeTargets,
  answerEventFromModelDraft,
  extractGroundedProposedDecisionTarget,
} from "./answer-interpretation";
import { interpretAnswerWithModel } from "./answer-interpretation-model";
import { applyAnswerEventToSessionDc } from "./apply-answer-to-dc";
import {
  findClarifiedConflictForTurn,
  handleConflictClarificationAnswer,
} from "./conflict-clarification-turn";
import { bindConflictClarificationToPlan } from "./conflict-clarification";
import {
  ensureDecisionBlueprint,
  activateNextBlueprintPriorityBand,
  directionIdForDir,
  resolveDdrIdsForDir,
} from "./blueprint";
import { buildAdaptiveQuestionPlan } from "./question-generation";
import {
  bumpCoreAfterMaterialWrite,
  canAskOrdinary,
  claimClarification,
  classifyCollectionMode,
  confirmClarification,
  isMaterialDcWrite,
  reconcileClarificationClaims,
  releaseClarification,
} from "./budget-ledger";
import { reportInformationNeedById } from "./report-information-needs.v1";
import { bumpBudgetAfterAsk, refundIneffectiveQuestion } from "./scope-budget";
import { buildUnderstandingState, refreshDecisionUnderstanding } from "./understanding-state";
import { bindPersonalAnalysisProfile } from "./personal-analysis-profile";
import {
  applyUnderstandingModelToState,
  generateDecisionUnderstandingTurn,
  type UnderstandingModelTestHook,
} from "./understanding-response-model";
import {
  candidateAllowedForIntakeLayer,
  candidateHasReportPurpose,
  formatReportPurposeForPrompt,
} from "./investigation-report-map";
import type { IntakeLayerFocus } from "./types";
import {
  applyIntakeProtection,
  classifyIntakeInput,
  intakeProtectionUserMessage,
  mapIntakeProtectionOutcome,
  readIntakeProtection,
  withIntakeProtection,
} from "./intake-protection";
import {
  answerSourceFor,
  recordAnswerInterpretation,
  recordAnswerSource,
} from "./answer-source-record";
import { applyConfirmedGoalChange } from "./goal-change-blueprint-update";
import { isDirAnsweredForIntake } from "./intake-answer-coverage";
import type { ModelInterpretationResult } from "./answer-interpretation-model";
import type { RankedPlanningCandidate } from "@/lib/poju/decision-context/question-plan-cycle";
import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  AnswerEvent,
  IntakeControlItem,
  IntakeControlResolutionRecord,
  NeedItem,
  PendingAnswerResolution,
  PendingIntakeControl,
  UnderstandingState,
} from "./types";
import {
  answerEventFromPendingBind,
  asTerminalRejectedPending,
  authorizedRoleOptions,
  buildClarificationPlan,
  continuableUnresolvedItems,
  isActivePendingAnswerResolution,
  isCannotDetermineSelection,
  isPendingClarificationPlan,
  isRoleBindingReason,
  mergePendingResolution,
  nextResolvingItem,
  normalizePendingItems,
  parseCertaintyChoice,
  parseClarificationRoleChoice,
  parseConstraintConfirmChoice,
  parseDefinitionPatchChoice,
  pendingFromAnswerEvent,
  pendingSourceTurnIds,
  pendingWithRemainingItems,
  persistKeyForPendingBind,
  recordUnclearPendingAttempt,
  rejectPendingItem,
  withPendingAnswerResolution,
  type PendingBindChoice,
} from "./pending-answer-resolution";
import {
  attachIntakeControlFromEvent,
  controlSourceTurnIds,
  controlWithPlan,
  hasResolvedProposedDecisionTarget,
  isActivePendingIntakeControl,
  isControlClarificationUncertain,
  isIntakeControlPlan,
  nextPendingControlItem,
  parseGoalChangeConfirmation,
  recordUncertainControlAttempt,
  updateControlItemStatus,
  withPendingIntakeControl,
} from "./pending-intake-control";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** AnswerEvent bound to the raw answer record and the provider/model actually used. */
function eventFromInterpretation(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  interpreted: Extract<ModelInterpretationResult, { ok: true }>;
}): AnswerEvent {
  const meta = input.interpreted.call_meta;
  return answerEventFromModelDraft({
    session: input.session,
    statement: input.statement,
    source_turn_id: input.source_turn_id,
    draft: input.interpreted.draft,
    source_record: answerSourceFor(input.session, input.source_turn_id),
    model_call: meta ? { provider: meta.provider, model: meta.model } : null,
  });
}

/**
 * Model failure fails closed: no DC write, no version bump, no budget charge,
 * last_sent_question untouched. Only the raw answer record is kept so the
 * turn stays auditable; the caller surfaces a recoverable error.
 */
function interpretationFailureResult(
  failureSession: POJUSessionState,
  interpreted: Extract<ModelInterpretationResult, { ok: false }>,
): AdaptiveTurnResult {
  return {
    session: failureSession,
    outcome:
      interpreted.reason === "invalid_schema" || interpreted.reason === "invalid_json"
        ? "answer_interpretation_invalid_schema"
        : "answer_interpretation_failed",
    answer_event: null,
    understanding: null,
    plan: null,
    authorized_question: null,
    ask_error: `${interpreted.reason}:${interpreted.detail}`,
  };
}

/** Refund the sent question when the answer was unknown / declined (idempotent). */
function refundSentQuestion(session: POJUSessionState): POJUSessionState {
  const u = session.decision_understanding;
  const last = u?.last_sent_question;
  if (!u || !last) return session;
  const sentPlan =
    session.adaptive_ask_plan?.plan_id === last.plan_id
      ? session.adaptive_ask_plan
      : u.next_question_plan?.plan_id === last.plan_id
        ? u.next_question_plan
        : null;
  const budget = refundIneffectiveQuestion(u.budget, {
    plan_id: last.plan_id,
    dir_ids: last.dir_ids,
    budget_cost: sentPlan?.budget_cost ?? 1,
  });
  if (budget === u.budget) return session;
  return { ...session, decision_understanding: { ...u, budget } };
}

function withUnderstanding(
  session: POJUSessionState,
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  askSnap: IntakeAskPlanSnapshot | null | undefined,
): POJUSessionState {
  return {
    ...session,
    decision_understanding: understanding,
    adaptive_ask_plan: plan,
    intake_ask_plan: askSnap ?? session.intake_ask_plan ?? null,
  };
}

type DirBasedNeed = Extract<NeedItem, { kind: "dir_based" }>;

function openBlockingReportNeeds(understanding: UnderstandingState): DirBasedNeed[] {
  return understanding.need_to_understand.items.filter(
    (n): n is DirBasedNeed => n.kind === "dir_based" && n.must_continue === true,
  );
}

function sessionWithCoreBudgetAfterMaterialWrite(
  session: POJUSessionState,
  applied: {
    applied: boolean;
    skipped_reason?: string;
    fact_ids_written: string[];
    constraint_ids_written: string[];
    session: POJUSessionState;
  },
  answer_event: AnswerEvent,
  source_turn_id: string,
): POJUSessionState {
  if (!applied.applied || applied.skipped_reason === "turn_already_mapped") {
    return session;
  }
  const dcSession = applied.session;
  if (
    !isMaterialDcWrite({
      fact_ids_written: applied.fact_ids_written,
      constraint_ids_written: applied.constraint_ids_written,
      session: dcSession,
      answer: { classification: answer_event.classification },
    })
  ) {
    return session;
  }
  const u = session.decision_understanding;
  if (!u) return session;
  const budget = bumpCoreAfterMaterialWrite(u.budget, {
    source_turn_id,
    answer_event_id: answer_event.event_id,
  });
  if (budget === u.budget) return session;
  return { ...session, decision_understanding: { ...u, budget } };
}

function outcomeFromPlanResult(planned: {
  plan: AdaptiveQuestionPlan | null;
  planner_block: { reason_code: string; detail: string } | null;
}): AdaptiveTurnResult["outcome"] {
  if (planned.plan) return "planned";
  if (planned.planner_block) return "planner_blocked";
  return "ready_no_question";
}

function sessionWithClarificationPlan(
  session: POJUSessionState,
  pending: PendingAnswerResolution,
  plan: AdaptiveQuestionPlan,
): POJUSessionState {
  const understanding = session.decision_understanding
    ? {
        ...session.decision_understanding,
        next_question_plan: plan,
      }
    : null;
  const withPending = withPendingAnswerResolution(session, pending);
  if (!understanding) {
    return { ...withPending, adaptive_ask_plan: plan };
  }
  return withUnderstanding(withPending, understanding, plan, withPending.intake_ask_plan ?? null);
}

function restoreClarificationResult(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const plan = input.pending.clarification_plan;
  const session = plan
    ? sessionWithClarificationPlan(input.session, input.pending, plan)
    : withPendingAnswerResolution(input.session, input.pending);
  return {
    session,
    outcome: input.outcome,
    answer_event: input.answer_event,
    understanding: session.decision_understanding ?? null,
    plan,
    authorized_question: plan?.question_text ?? null,
    persist_error: input.persist_error,
    ask_error: plan
      ? undefined
      : "pending_clarification_plan_failed",
  };
}

function pendingOrchestrationResult(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome?: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const restored = restoreClarificationResult({
    session: input.session,
    pending: input.pending,
    answer_event: input.answer_event,
    persist_error: input.persist_error,
    outcome: input.outcome ?? "planned",
  });
  if (!restored.plan) {
    return {
      ...restored,
      outcome: "planner_blocked",
      ask_error: restored.ask_error ?? "pending_clarification_plan_failed",
      authorized_question: null,
    };
  }
  return restored;
}

function sessionWithIntakeControlPlan(
  session: POJUSessionState,
  control: PendingIntakeControl,
  plan: AdaptiveQuestionPlan,
): POJUSessionState {
  const understanding = session.decision_understanding
    ? {
        ...session.decision_understanding,
        next_question_plan: plan,
      }
    : null;
  const withControl = withPendingIntakeControl(session, control);
  if (!understanding) {
    return { ...withControl, adaptive_ask_plan: plan };
  }
  return withUnderstanding(withControl, understanding, plan, withControl.intake_ask_plan ?? null);
}

function intakeControlOrchestrationResult(input: {
  session: POJUSessionState;
  control: PendingIntakeControl;
  answer_event: AnswerEvent | null;
  persist_error?: string;
  outcome?: AdaptiveTurnResult["outcome"];
}): AdaptiveTurnResult {
  const plan = input.control.clarification_plan;
  const session = plan
    ? sessionWithIntakeControlPlan(input.session, input.control, plan)
    : withPendingIntakeControl(input.session, input.control);
  if (!plan) {
    return {
      session,
      outcome: "planner_blocked",
      answer_event: input.answer_event,
      understanding: session.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: input.persist_error,
      ask_error: "pending_intake_control_plan_failed",
    };
  }
  return {
    session,
    outcome: input.outcome ?? "planned",
    answer_event: input.answer_event,
    understanding: session.decision_understanding ?? null,
    plan,
    authorized_question: plan.question_text,
    persist_error: input.persist_error,
  };
}

function replayInactiveIntakeControl(input: {
  session: POJUSessionState;
  control: PendingIntakeControl;
}): AdaptiveTurnResult {
  const session = withPendingIntakeControl(input.session, input.control);
  const live =
    liveNonClarificationPlan(session) &&
    !isIntakeControlPlan(liveNonClarificationPlan(session))
      ? liveNonClarificationPlan(session)
      : session.adaptive_ask_plan && !isIntakeControlPlan(session.adaptive_ask_plan)
        ? session.adaptive_ask_plan
        : null;
  return {
    session,
    outcome: "idempotent_replay",
    answer_event: null,
    understanding: session.decision_understanding ?? null,
    plan: live,
    authorized_question: live?.question_text ?? null,
    persist_error: "pending_intake_control_replay",
  };
}

function liveNonClarificationPlan(
  session: POJUSessionState,
): AdaptiveQuestionPlan | null {
  const last = session.decision_understanding?.last_sent_question ?? null;
  const plan = session.adaptive_ask_plan;
  if (
    plan &&
    last &&
    last.plan_id === plan.plan_id &&
    !isPendingClarificationPlan(plan) &&
    !isIntakeControlPlan(plan)
  ) {
    return plan;
  }
  return null;
}

function replayInactivePendingResolution(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
}): AdaptiveTurnResult {
  const terminal = isActivePendingAnswerResolution(input.pending)
    ? input.pending
    : asTerminalRejectedPending(input.pending);
  const session = withPendingAnswerResolution(input.session, terminal);
  const live = liveNonClarificationPlan(session);
  return {
    session,
    outcome: "idempotent_replay",
    answer_event: null,
    understanding: session.decision_understanding ?? null,
    plan: live,
    authorized_question: live?.question_text ?? null,
    persist_error: "pending_answer_resolution_replay",
  };
}

async function continueInvestigationAfterTerminalRefusal(input: {
  current: POJUSessionState;
  pending: PendingAnswerResolution;
  now: string;
  answer_event: AnswerEvent | null;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
}): Promise<AdaptiveTurnResult> {
  const terminal = asTerminalRejectedPending(input.pending);
  let current = withPendingAnswerResolution(input.current, terminal);
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;
  current = withPendingAnswerResolution(
    activateNextBlueprintPriorityBand(current, input.now),
    terminal,
  );
  const understanding = input.buildUnderstanding({
    session: current,
    blueprint: current.decision_blueprint!,
    now: input.now,
    last_answer_event_id: input.answer_event?.event_id ?? null,
  });
  if (isActivePendingIntakeControl(current.pending_intake_control)) {
    const prepared = controlWithPlan(
      current,
      current.pending_intake_control!,
      input.now,
    );
    current = withPendingIntakeControl(current, prepared);
    current = withPendingAnswerResolution(current, terminal);
    return intakeControlOrchestrationResult({
      session: current,
      control: prepared,
      answer_event: input.answer_event,
      persist_error: "pending_answer_resolution_rejected",
      outcome: "planned",
    });
  }
  const planned = await input.planFromState(current, understanding, input.now);
  const session = withPendingAnswerResolution(planned.session, terminal);
  return {
    session,
    outcome: outcomeFromPlanResult(planned),
    ask_error: planned.planner_block
      ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
      : undefined,
    answer_event: input.answer_event,
    understanding: planned.understanding,
    plan: planned.plan,
    authorized_question: planned.authorized_question,
    persist_error: "pending_answer_resolution_rejected",
  };
}

/**
 * Deterministic Catalog-scoped fallback for open blocking report needs (DIR-based).
 * Must still pass DDR association + Blueprint scope/depth/budget/NA via
 * buildAdaptiveQuestionPlan validation — never a free-form substitute.
 */
function tryCatalogFallbackForOpenBlocking(input: {
  dc: NonNullable<POJUSessionState["decision_context"]>;
  blueprint: NonNullable<POJUSessionState["decision_blueprint"]>;
  understanding: UnderstandingState;
  budget: UnderstandingState["budget"];
  now: string;
  scoring_path: string;
}): { plan: AdaptiveQuestionPlan | null; last_reject: string | null } {
  const needs = openBlockingReportNeeds(input.understanding).slice().sort((a, b) => {
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
      last_sent_question_text:
        input.understanding.last_sent_question?.question_text ?? null,
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
  /**
   * @internal Test-only C1 substitute for Conflict-clarification persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests.
   */
  conflictClarifyPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
  /**
   * @internal Test-only C1 substitute for pending-bind persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests.
   */
  pendingBindPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
  /**
   * @internal Test-only model interpretation substitute.
   * When omitted (production default), interpretAnswerWithModel calls OpenRouter.
   * Must never be set outside tests. Not an environment bypass switch.
   */
  interpretAnswerModel?: import("./answer-interpretation-model").AnswerInterpretationModelHook;
  /**
   * @internal Test-only C1 substitute for intake-control clarification persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests. Not a production bypass.
   */
  intakeControlPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
  /**
   * @internal Test-only Understanding / response model substitute.
   * When omitted (production default), generateDecisionUnderstandingTurn calls OpenRouter.
   */
  understandingResponseModel?: UnderstandingModelTestHook;
};

type AdaptiveTurnInput = {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  /** Skip answer interpretation; plan from current DC (session init / first ask). */
  init_only?: boolean;
  /** @internal Test-only fault injection. Omitted in production. */
  test_hooks?: AdaptiveTurnTestHooks;
  locale?: string;
  signal?: AbortSignal;
};

export async function runAdaptiveQuestionTurn(
  input: AdaptiveTurnInput,
): Promise<AdaptiveTurnResult> {
  const result = await runAdaptiveQuestionTurnInner(input);
  const closed = await closeBlockedClarifications(result, input);
  return enrichOrdinaryTurnWithUnderstandingModel(closed, input);
}

function shouldEnrichWithUnderstandingModel(result: AdaptiveTurnResult): boolean {
  if (
    result.outcome !== "planned" &&
    result.outcome !== "ready_no_question"
  ) {
    return false;
  }
  if (!result.understanding) return false;
  const plan = result.plan;
  if (plan && (isPendingClarificationPlan(plan) || isIntakeControlPlan(plan))) {
    return false;
  }
  // Conflict-clarification plans keep code wording; ordinary investigation must be model-authored.
  if (plan?.conflict_clarification) return false;
  return true;
}

function buildLegalCandidatesForUnderstanding(input: {
  session: POJUSessionState;
  plan: AdaptiveQuestionPlan | null;
  intake_layer?: IntakeLayerFocus | null;
  locale?: string;
}): Array<{
  candidate_id: string;
  direction_id: string;
  dir_ids: string[];
  ddr_ids: string[];
  intake_layer: string | null;
  report_page_ids: string[];
  report_section_ids: string[];
  missing_info: string;
  decision_value: string;
  expected_info: string;
  decision_value_detail: string;
  evidence_requirements: string;
  why_it_matters: string;
  template_question: string;
}> {
  const dc = input.session.decision_context;
  const blueprint = input.session.decision_blueprint;
  const locale = input.locale ?? input.session.locked_output_locale ?? "zh";
  const layer =
    input.intake_layer ??
    input.session.decision_understanding?.current_intake_layer ??
    null;
  if (!dc || !blueprint) {
    if (!input.plan) return [];
    const purpose = formatReportPurposeForPrompt(input.plan.dir_ids, locale);
    return [
      {
        candidate_id: input.plan.candidate_id,
        direction_id: input.plan.direction_id,
        dir_ids: [...input.plan.dir_ids],
        ddr_ids: [...input.plan.ddr_ids],
        intake_layer: purpose.intake_layer,
        report_page_ids: purpose.report_pages,
        report_section_ids: purpose.report_section_ids,
        missing_info: input.plan.missing_info,
        decision_value: input.plan.decision_value,
        expected_info: input.plan.expected_info,
        decision_value_detail: input.plan.decision_value,
        evidence_requirements: purpose.required_precondition
          ? "user_evidence_required"
          : "optional_or_bounded",
        why_it_matters: purpose.report_purpose || input.plan.ask_now_reason,
        template_question: input.plan.question_text,
      },
    ];
  }
  const rankedIds = input.session.intake_ask_plan?.ranked_candidate_ids ?? [];
  const candidates = buildIntakeCandidatesFromDc(dc, blueprint).filter((c) => {
    if (!candidateHasReportPurpose(c.dir_ids)) return false;
    if (layer && !candidateAllowedForIntakeLayer(c.dir_ids, layer)) return false;
    return true;
  });
  const byId = new Map(candidates.map((c) => [c.candidate_id, c]));
  const orderedIds =
    rankedIds.length > 0
      ? rankedIds
      : input.plan
        ? [input.plan.candidate_id, ...candidates.map((c) => c.candidate_id)]
        : candidates.map((c) => c.candidate_id);
  const seen = new Set<string>();
  const out: Array<{
    candidate_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    intake_layer: string | null;
    report_page_ids: string[];
    report_section_ids: string[];
    missing_info: string;
    decision_value: string;
    expected_info: string;
    decision_value_detail: string;
    evidence_requirements: string;
    why_it_matters: string;
    template_question: string;
  }> = [];
  for (const id of orderedIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (input.plan && id === input.plan.candidate_id) {
      if (!candidateHasReportPurpose(input.plan.dir_ids)) continue;
      if (layer && !candidateAllowedForIntakeLayer(input.plan.dir_ids, layer)) {
        continue;
      }
      const purpose = formatReportPurposeForPrompt(input.plan.dir_ids, locale);
      out.push({
        candidate_id: input.plan.candidate_id,
        direction_id: input.plan.direction_id,
        dir_ids: [...input.plan.dir_ids],
        ddr_ids: [...input.plan.ddr_ids],
        intake_layer: purpose.intake_layer,
        report_page_ids: purpose.report_pages,
        report_section_ids: purpose.report_section_ids,
        missing_info: input.plan.missing_info,
        decision_value: input.plan.decision_value,
        expected_info: input.plan.expected_info,
        decision_value_detail: input.plan.decision_value,
        evidence_requirements: purpose.required_precondition
          ? "user_evidence_required"
          : "optional_or_bounded",
        why_it_matters: purpose.report_purpose || input.plan.ask_now_reason,
        template_question: input.plan.question_text,
      });
      continue;
    }
    const c = byId.get(id);
    if (!c) continue;
    // Drop candidates that cannot map to 8-page report requirements.
    if (!candidateHasReportPurpose(c.dir_ids)) continue;
    const dirId = c.dir_ids[0] ?? "";
    const purpose = formatReportPurposeForPrompt(c.dir_ids, locale);
    out.push({
      candidate_id: c.candidate_id,
      direction_id: dirId ? directionIdForDir(blueprint, dirId) : "DIRN-DEFINITION",
      dir_ids: [...c.dir_ids],
      ddr_ids: [...c.ddr_ids],
      intake_layer: purpose.intake_layer,
      report_page_ids: purpose.report_pages,
      report_section_ids: purpose.report_section_ids,
      missing_info: c.kind,
      decision_value: c.impact.decision_critical
        ? "decision_critical"
        : c.impact.may_affect_p5_ranking
          ? "may_affect_p5"
          : "supporting",
      expected_info: dirId
        ? dc.dirs.find((d) => d.dir_id === dirId)?.need ?? dirId
        : c.fact_role_codes.join(","),
      decision_value_detail: c.impact.decision_critical
        ? "decision_critical"
        : c.impact.may_affect_p5_ranking
          ? "may_affect_p5"
          : "supporting",
      evidence_requirements: purpose.required_precondition
        ? "user_evidence_required"
        : "optional_or_bounded",
      why_it_matters: purpose.report_purpose || c.kind,
      template_question: "",
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function enrichOrdinaryTurnWithUnderstandingModel(
  result: AdaptiveTurnResult,
  input: AdaptiveTurnInput,
): Promise<AdaptiveTurnResult> {
  if (!shouldEnrichWithUnderstandingModel(result)) return result;
  const understanding = result.understanding!;
  const intake_layer = understanding.current_intake_layer ?? null;
  const legal_candidates = buildLegalCandidatesForUnderstanding({
    session: result.session,
    plan: result.plan,
    intake_layer,
    locale: input.locale,
  });
  const legal_candidate_ids = legal_candidates.map((c) => c.candidate_id);
  // Code rank hint may be outside the current layer after gate filtering — do not force it in.

  const modelResult = await generateDecisionUnderstandingTurn({
    session: result.session,
    understanding,
    plan: result.plan,
    previous_plan: understanding.last_sent_question
      ? result.session.adaptive_ask_plan ?? result.plan
      : null,
    code_rank_hint_candidate_id: result.plan?.candidate_id ?? null,
    legal_candidate_ids,
    legal_candidates,
    locale: input.locale,
    init_only: Boolean(input.init_only),
    user_statement: input.statement,
    signal: input.signal,
    testHook: input.test_hooks?.understandingResponseModel,
  });

  if (!modelResult.ok) {
    console.warn(
      "[di2-understanding] model failed; keeping DC + user answer; no code-plan ask masquerade",
      modelResult.reason,
      modelResult.call_meta.model_status ?? "model_failed",
    );
    return {
      ...result,
      outcome: "understanding_model_failed",
      ask_error: `understanding_model_failed:${modelResult.reason}${
        modelResult.detail ? `:${modelResult.detail}` : ""
      }`,
      model_response_text: undefined,
      suggested_replies: undefined,
      profile_hash: modelResult.profile.profile_hash,
      understanding_model_status: "model_failed",
      // Keep DC writes; do NOT authorize code-ranked #1 as a successful model turn.
      authorized_question: null,
    };
  }

  const applied = applyUnderstandingModelToState(
    understanding,
    result.plan,
    modelResult.output,
  );
  // Model chooses among legal candidates; code only validates membership +
  // intake-layer / scope / budget. Code rank is a hint — not a hard preselection.
  let nextPlan = applied.plan;
  const selectedId =
    modelResult.output.next_question.selected_candidate_id?.trim() || null;

  if (selectedId) {
    const hit = legal_candidates.find((c) => c.candidate_id === selectedId);
    if (!hit) {
      return {
        ...result,
        outcome: "understanding_model_failed",
        ask_error: "understanding_model_failed:illegal_candidate",
        authorized_question: null,
        profile_hash: modelResult.profile.profile_hash,
      };
    }
    if (
      intake_layer &&
      hit.intake_layer &&
      !candidateAllowedForIntakeLayer(hit.dir_ids, intake_layer)
    ) {
      return {
        ...result,
        outcome: "understanding_model_failed",
        ask_error: "understanding_model_failed:intake_layer_mismatch",
        authorized_question: null,
        profile_hash: modelResult.profile.profile_hash,
      };
    }

    // Rebuild formal plan from model-selected candidate (full scope/budget validation).
    const dc = result.session.decision_context;
    const blueprint = result.session.decision_blueprint;
    if (!dc || !blueprint) {
      return {
        ...result,
        outcome: "understanding_model_failed",
        ask_error: "understanding_model_failed:missing_dc_or_blueprint",
        authorized_question: null,
        profile_hash: modelResult.profile.profile_hash,
      };
    }
    const naValidation = await buildProductionNaValidationContextFromSession(
      result.session,
      { nowIso: new Date().toISOString() },
    );
    const layerFiltered = buildIntakeCandidatesFromDc(dc, blueprint).filter((c) => {
      if (!candidateHasReportPurpose(c.dir_ids)) return false;
      if (intake_layer && !candidateAllowedForIntakeLayer(c.dir_ids, intake_layer)) {
        return false;
      }
      return true;
    });
    const ranked = planNextAskFromCandidates({
      candidates: layerFiltered,
      snap: snapshotFromDc(dc),
      naValidation,
      remaining_hard_budget: understanding.budget.remaining_hard_budget,
    });
    const selectedRanked =
      ranked.ranked.find((r) => r.candidate.candidate_id === selectedId) ?? null;
    if (!selectedRanked) {
      return {
        ...result,
        outcome: "understanding_model_failed",
        ask_error: "understanding_model_failed:candidate_not_in_ranked_set",
        authorized_question: null,
        profile_hash: modelResult.profile.profile_hash,
      };
    }
    const built = buildAdaptiveQuestionPlan({
      dc,
      blueprint,
      selected: selectedRanked,
      budget: understanding.budget,
      now: new Date().toISOString(),
      last_sent_question_text:
        understanding.last_sent_question?.question_text ?? null,
      scoring_path: `${INTAKE_ASK_SCORING_PATH}→model_selected→buildAdaptiveQuestionPlan`,
    });
    if (!built.validation.ok) {
      return {
        ...result,
        outcome: "understanding_model_failed",
        ask_error: `understanding_model_failed:scope_budget_reject:${built.validation.reason_code}`,
        authorized_question: null,
        profile_hash: modelResult.profile.profile_hash,
      };
    }
    nextPlan = bindConflictClarificationToPlan(result.session, built.plan);
    const modelQ = modelResult.output.next_question.question_text?.trim();
    if (modelQ) {
      nextPlan = {
        ...nextPlan,
        question_text: modelQ,
        ask_now_reason:
          modelResult.output.next_question.rationale || nextPlan.ask_now_reason,
        rationale: `model_selected:${selectedId}`,
        scoring_path: `${nextPlan.scoring_path}→model_wording`,
      };
    }
  } else if (
    nextPlan &&
    modelResult.output.next_question.question_text &&
    nextPlan.candidate_id ===
      (selectedId ?? nextPlan.candidate_id)
  ) {
    nextPlan = {
      ...nextPlan,
      question_text: modelResult.output.next_question.question_text,
      ask_now_reason:
        modelResult.output.next_question.rationale || nextPlan.ask_now_reason,
    };
  }

  // Persist code-validated intake layer (model proposal cannot advance gates).
  const nextUnderstanding = {
    ...applied.understanding,
    current_intake_layer: intake_layer ?? applied.understanding.current_intake_layer,
    next_question_plan: nextPlan,
  };
  const askSnap = result.session.intake_ask_plan ?? null;
  const nextSession = withUnderstanding(
    result.session,
    nextUnderstanding,
    nextPlan,
    askSnap,
  );

  return {
    ...result,
    session: nextSession,
    understanding: nextUnderstanding,
    plan: nextPlan,
    authorized_question: nextPlan?.question_text ?? null,
    model_response_text: modelResult.output.response_text,
    suggested_replies: modelResult.output.suggested_replies,
    profile_hash: modelResult.profile.profile_hash,
    understanding_model_status:
      modelResult.call_meta.model_status === "model_retry_succeeded"
        ? "model_retry_succeeded"
        : "model_success",
    outcome: nextPlan ? "planned" : "ready_no_question",
  };
}
type ClarificationBlock = "budget_exhausted" | "depth_exhausted";

function clarificationBlock(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
  answerResolution: boolean,
): ClarificationBlock | null {
  const u = session.decision_understanding;
  const bp = session.decision_blueprint;
  if (!u || !bp || plan.budget_cost === 0) return null;
  if (
    u.budget.remaining_hard_budget < plan.budget_cost ||
    u.budget.session_asked_count >= u.budget.hard_budget_limit
  ) {
    return "budget_exhausted";
  }
  // Binding what the user already said is not probing deeper into a direction.
  if (answerResolution) return null;
  const direction = bp.directions.find((d) => d.direction_id === plan.direction_id);
  const cap = direction?.depth_soft_cap ?? bp.question_budget.depth_per_direction;
  if (plan.dir_ids.some((dirId) => (u.budget.depth_by_dir[dirId] ?? 0) >= cap)) {
    return "depth_exhausted";
  }
  return null;
}

/**
 * Clarifications are questions: charged and bound by the hard budget; aspect /
 * insight follow-ups are also bound by the per-direction depth. A clarification
 * that would be newly sent past its limit is not asked: its item closes auditably
 * (never written as fact) and the next clarification or the planner decides,
 * which reaches readiness once nothing askable is left. Re-presenting an
 * already-sent question and free goal_change confirmations are never blocked.
 */
async function closeBlockedClarifications(
  result: AdaptiveTurnResult,
  input: AdaptiveTurnInput,
): Promise<AdaptiveTurnResult> {
  let r = result;
  for (let guard = 0; guard < 64; guard++) {
    const plan = r.plan;
    const u = r.session.decision_understanding;
    if (!plan || !u || !r.session.decision_blueprint) return r;
    const isPending = isPendingClarificationPlan(plan);
    if (!isPending && !isIntakeControlPlan(plan)) return r;
    if (u.last_sent_question?.plan_id === plan.plan_id) return r;
    const block = clarificationBlock(r.session, plan, isPending);
    if (!block) return r;
    const persist_error = result.persist_error;

    let current = r.session;
    if (isPending) {
      const pending = current.pending_answer_resolution;
      const item = pending && isActivePendingAnswerResolution(pending) ? nextResolvingItem(pending) : null;
      if (!pending || !item) return r;
      current = withPendingAnswerResolution(
        current,
        rejectPendingItem({
          session: current,
          pending,
          item,
          rejected_at_turn_id: input.source_turn_id,
          rejected_statement: "",
          now: input.now,
          terminal_reason: block,
        }),
      );
    } else {
      const control = current.pending_intake_control;
      const item = control && isActivePendingIntakeControl(control) ? nextPendingControlItem(control) : null;
      if (!control || !item || item.kind === "goal_change") return r;
      const status = block === "budget_exhausted" ? "closed_budget_exhausted" : "closed_depth_exhausted";
      current = withPendingIntakeControl(current, {
        ...control,
        items: control.items.map((x) => (x.item_id === item.item_id ? { ...x, status } : x)),
        resolving_item_id: null,
        clarification_plan: null,
        clarification_plan_id: null,
      });
    }

    const nextPending = current.pending_answer_resolution;
    if (nextPending && isActivePendingAnswerResolution(nextPending)) {
      r = pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event: r.answer_event,
        persist_error,
        outcome: "planned",
      });
      continue;
    }
    const nextControl = current.pending_intake_control;
    if (nextControl && nextControl.status === "pending") {
      const prepared = controlWithPlan(current, nextControl, input.now);
      current = withPendingIntakeControl(current, prepared);
      if (prepared.status === "pending" && prepared.clarification_plan) {
        r = intakeControlOrchestrationResult({
          session: current,
          control: prepared,
          answer_event: r.answer_event,
          persist_error,
          outcome: "planned",
        });
        continue;
      }
    }
    const understanding = buildUnderstandingState({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: r.answer_event?.event_id ?? null,
    });
    const planned = await planFromState(current, understanding, input.now);
    return {
      ...r,
      session: {
        ...planned.session,
        pending_answer_resolution: current.pending_answer_resolution ?? null,
        pending_intake_control: current.pending_intake_control ?? null,
      },
      outcome: outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,
      understanding: planned.understanding,
      plan: planned.plan,
      authorized_question: planned.authorized_question,
      persist_error,
    };
  }
  return r;
}

async function runAdaptiveQuestionTurnInner(
  input: AdaptiveTurnInput,
): Promise<AdaptiveTurnResult> {
  let current = bindPersonalAnalysisProfile(input.session, input.now);
  const du0 = current.decision_understanding;
  if (du0) {
    const sentPlanIds = new Set<string>();
    if (du0.last_sent_question?.plan_id) {
      sentPlanIds.add(du0.last_sent_question.plan_id);
    }
    if (current.adaptive_ask_plan?.plan_id) {
      sentPlanIds.add(current.adaptive_ask_plan.plan_id);
    }
    for (const claim of du0.budget.clarification_claims ?? []) {
      if (
        (claim.status === "confirmed" || claim.status === "claimed") &&
        claim.plan_id
      ) {
        sentPlanIds.add(claim.plan_id);
      }
    }
    const budget = reconcileClarificationClaims(
      du0.budget,
      { sent_plan_ids: [...sentPlanIds] },
      input.now,
    );
    if (budget !== du0.budget) {
      current = {
        ...current,
        decision_understanding: { ...du0, budget },
      };
    }
  }
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
    const intakeDecision = applyIntakeProtection({
      state: readIntakeProtection(current),
      kind: classifyIntakeInput(statement),
      nowIso: input.now,
      turnId: input.source_turn_id,
    });
    current = withIntakeProtection(current, intakeDecision.state);
    const protectionOutcome = mapIntakeProtectionOutcome(intakeDecision.action);
    if (protectionOutcome) {
      const live = liveNonClarificationPlan(current);
      const originalQuestion =
        current.decision_understanding?.last_sent_question?.question_text ??
        live?.question_text ??
        null;
      return {
        session: current,
        outcome: protectionOutcome,
        answer_event: null,
        understanding: current.decision_understanding ?? null,
        plan: live,
        authorized_question: originalQuestion,
        persist_error: protectionOutcome,
        user_visible_message: intakeProtectionUserMessage(
          intakeDecision,
          input.locale ?? current.locked_output_locale ?? "zh",
          originalQuestion,
        ),
      };
    }
    const priorClarify = findClarifiedConflictForTurn(
      current,
      input.source_turn_id,
    );
    const clarifyKey = `dc_conflict_clarify:${current.session_id}:${input.source_turn_id}`;
    const keySeen = (current.decision_context_idempotency_keys ?? []).includes(
      clarifyKey,
    );
    const lastSentTarget =
      current.decision_understanding?.last_sent_question?.conflict_clarification ??
      null;
    const clarifyTarget =
      lastSentTarget ??
      (priorClarify
        ? {
            conflict_id: priorClarify.conflict_id,
            fact_ids: [...priorClarify.fact_ids],
          }
        : null);
    const turnKind =
      priorClarify || keySeen || lastSentTarget
        ? ("conflict_clarification" as const)
        : isActivePendingAnswerResolution(current.pending_answer_resolution)
          ? ("pending_clarification" as const)
          : isActivePendingIntakeControl(current.pending_intake_control)
            ? ("intake_control_follow_up" as const)
            : ("ordinary_answer" as const);
    const sourceInput = {
      source_turn_id: input.source_turn_id,
      statement,
      now: input.now,
      turn_kind: turnKind,
    };
    current = recordAnswerSource(current, sourceInput);
    // Every failure return keeps the raw answer record and nothing else.
    const failureSession = recordAnswerSource(input.session, sourceInput);
    if (priorClarify || keySeen || lastSentTarget) {
      if (!clarifyTarget) {
        // Persist key seen but Conflict record missing: still avoid ordinary writes.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstanding({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: null,
        });
        const planned = await planFromState(current, understanding, input.now);
        return {
          session: planned.session,
          outcome: "idempotent_replay",
          answer_event: null,
          understanding: planned.understanding,
          plan: planned.plan,
          authorized_question: planned.authorized_question,
          persist_error: "idempotent_skip",
          ask_error: planned.planner_block
            ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
            : undefined,
        };
      }
      return handleConflictClarificationAnswer({
        current,
        original: failureSession,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        target: clarifyTarget,
        buildUnderstanding,
        planFromState,
        withUnderstanding,
        outcomeFromPlanResult,
        errorText,
        persistOverride: input.test_hooks?.conflictClarifyPersist,
      });
    }

    const existingPending = current.pending_answer_resolution;
    if (isActivePendingAnswerResolution(existingPending)) {
      return handlePendingAnswerResolutionTurn({
        current,
        original: failureSession,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        buildUnderstanding,
        planFromState,
        persist_error: undefined,
        test_hooks: input.test_hooks,
      });
    }
    if (
      existingPending &&
      pendingSourceTurnIds(existingPending).includes(input.source_turn_id)
    ) {
      // Terminal or inactive pending: replay the original source turn without
      // restoring a refused clarification or recounting budget.
      return replayInactivePendingResolution({
        session: current,
        pending: existingPending,
      });
    }

    const existingControl = current.pending_intake_control;
    if (isActivePendingIntakeControl(existingControl)) {
      return handlePendingIntakeControlTurn({
        current,
        original: failureSession,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        locale: input.locale,
        signal: input.signal,
        buildUnderstanding,
        planFromState,
        test_hooks: input.test_hooks,
      });
    }
    if (
      existingControl &&
      (controlSourceTurnIds(existingControl).includes(input.source_turn_id) ||
        input.source_turn_id === existingControl.last_resolved_turn_id)
    ) {
      return replayInactiveIntakeControl({
        session: current,
        control: existingControl,
      });
    }

    current = refreshDecisionUnderstanding(current, { now: input.now });
    const interpreted = await interpretAnswerWithModel({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      locale: input.locale,
      signal: input.signal,
      testHook: input.test_hooks?.interpretAnswerModel,
    });
    if (!interpreted.ok) {
      return interpretationFailureResult(failureSession, interpreted);
    }
    answer_event = eventFromInterpretation({
      session: current,
      statement,
      source_turn_id: input.source_turn_id,
      interpreted,
    });
    current = recordAnswerInterpretation(current, input.source_turn_id, answer_event, input.now);
    const pendingUnresolved = continuableUnresolvedItems(
      answer_event.unresolved_items,
    );

    // Not an answer to the sent question: write nothing, charge nothing, and
    // re-present the same authorized question (same plan_id → no new budget).
    if (
      answer_event.classification === "off_topic" ||
      answer_event.classification === "invalid_input"
    ) {
      current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
      if (isActivePendingIntakeControl(current.pending_intake_control)) {
        return intakeControlOrchestrationResult({
          session: current,
          control: current.pending_intake_control!,
          answer_event,
          persist_error: `${answer_event.classification}_no_dc_write`,
          outcome: "planned",
        });
      }
      const live = liveNonClarificationPlan(current);
      if (live) {
        return {
          session: current,
          outcome: "planned",
          answer_event,
          understanding: current.decision_understanding ?? null,
          plan: live,
          authorized_question: live.question_text,
          persist_error: `${answer_event.classification}_no_dc_write`,
        };
      }
    }

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
        const lastSent =
          current.decision_understanding?.last_sent_question ??
          planned.understanding.last_sent_question ??
          null;
        const existingPlan =
          current.adaptive_ask_plan ??
          current.decision_understanding?.next_question_plan ??
          null;
        if (existingPlan && lastSent && lastSent.plan_id === existingPlan.plan_id) {
          const recovered: UnderstandingState = {
            ...planned.understanding,
            next_question_plan: existingPlan,
            last_sent_question: lastSent,
            budget: current.decision_understanding?.budget ?? planned.understanding.budget,
          };
          return {
            session: withUnderstanding(
              current,
              recovered,
              existingPlan,
              current.intake_ask_plan ?? null,
            ),
            outcome: "idempotent_replay",
            answer_event,
            understanding: recovered,
            plan: existingPlan,
            authorized_question: lastSent.question_text,
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
        if (pendingUnresolved.length > 0 && applied.skipped_reason !== "turn_already_mapped") {
          current = finishPendingFromEvent(current, answer_event, statement, input.now);
          current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
          return pendingOrchestrationResult({
            session: current,
            pending: current.pending_answer_resolution!,
            answer_event,
            persist_error: "pending_answer_resolution",
            outcome: "planned",
          });
        }
        current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
        if (isActivePendingIntakeControl(current.pending_intake_control)) {
          return intakeControlOrchestrationResult({
            session: current,
            control: current.pending_intake_control!,
            answer_event,
            persist_error: applied.skipped_reason,
            outcome: "planned",
          });
        }
        // Off-topic / invalid / non-role unresolved: still recompute understanding.
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

      // Persist DC via C1 (budget bump on session before commit)
      const key = `dc_collect:${current.session_id}:${input.source_turn_id}`;
      let working: POJUSessionState = {
        ...applied.session,
        decision_understanding:
          applied.session.decision_understanding ?? current.decision_understanding,
        decision_blueprint:
          current.decision_blueprint ?? applied.session.decision_blueprint,
        messages: current.messages,
        agent_v2: current.agent_v2,
      };
      working = sessionWithCoreBudgetAfterMaterialWrite(
        working,
        applied,
        answer_event,
        input.source_turn_id,
      );
      const persisted = await persistDcLifecycleChange(input.session, working, key);
      if (persisted.error === "idempotent_skip") {
        current = {
          ...persisted.session,
          decision_understanding:
            working.decision_understanding ?? persisted.session.decision_understanding,
        };
        persist_error = "idempotent_skip";
      } else if (!persisted.committed) {
        return {
          session: failureSession,
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
          decision_understanding: working.decision_understanding,
        };
      }
      if (
        answer_event.classification === "unknown" ||
        answer_event.classification === "declined"
      ) {
        current = refundSentQuestion(current);
      }

      current = attachIntakeControlFromEvent(current, answer_event, statement, input.now);
      if (pendingUnresolved.length > 0) {
        current = finishPendingFromEvent(current, answer_event, statement, input.now);
        return pendingOrchestrationResult({
          session: current,
          pending: current.pending_answer_resolution!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
      if (isActivePendingIntakeControl(current.pending_intake_control)) {
        return intakeControlOrchestrationResult({
          session: current,
          control: current.pending_intake_control!,
          answer_event,
          persist_error,
          outcome: "planned",
        });
      }
    } catch (e) {
      return {
        session: failureSession,
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
      const openBlocking = openBlockingReportNeeds(u);
      if (openBlocking.length > 0 && u.budget.remaining_hard_budget > 0) {
        const blockedU: UnderstandingState = {
          ...u,
          next_question_plan: null,
          readiness: {
            ...u.readiness,
            verdict: "continue",
            can_ask: true,
            reasons: [
              ...u.readiness.reasons,
              "open_blocking_report_needs",
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
  const finalizePlan = (builtPlan: AdaptiveQuestionPlan): AdaptiveQuestionPlan =>
    bindConflictClarificationToPlan(session, builtPlan);

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

  if (!canAskOrdinary(budget)) {
    const u: UnderstandingState = {
      ...understanding,
      budget,
      next_question_plan: null,
      readiness: {
        ...understanding.readiness,
        verdict: "ready_for_final_confirm",
        can_ask: false,
        reasons: [
          ...understanding.readiness.reasons,
          "core_effective_answer_cap_reached",
          "core_budget_exhausted_final_review",
        ],
      },
    };
    return {
      session: withUnderstanding(session, u, null, session.intake_ask_plan ?? null),
      understanding: u,
      plan: null,
      authorized_question: null,
      planner_block: null,
    };
  }

  const intakeLayer = understanding.current_intake_layer ?? null;
  const candidates = buildIntakeCandidatesFromDc(dc, blueprint).map((c) => {
    const dirId = c.dir_ids[0];
    const depth = dirId ? (budget.depth_by_dir[dirId] ?? 0) + 1 : c.depth;
    // Filter completed dirs already handled in builder; enforce depth cap here.
    return { ...c, depth, repetition_count: Math.max(0, depth - 1) };
  }).filter((c) => {
    if (!c.ddr_ids.length || c.ddr_ids.some((id) => id.startsWith("DDR_FOR_"))) {
      return false;
    }
    if (!candidateHasReportPurpose(c.dir_ids)) return false;
    if (intakeLayer && !candidateAllowedForIntakeLayer(c.dir_ids, intakeLayer)) {
      return false;
    }
    for (const dirId of c.dir_ids) {
      if (!blueprint.dir_ids.includes(dirId)) return false;
      // Answered (awaiting confirmation or an information boundary): never re-ask.
      const dir = dc.dirs.find((d) => d.dir_id === dirId);
      if (dir && isDirAnsweredForIntake(dc, dir)) return false;
    }
    const dirId = c.dir_ids[0];
    if (!dirId) return true;
    const used = budget.depth_by_dir[dirId] ?? 0;
    return used < blueprint.question_budget.depth_per_direction;
  });

  // When the hard budget cannot cover every open DIR that blocks Freeze
  // sufficiency, spend it only on those DIRs; a non-blocking question then
  // could leave the session unable to freeze.
  const sufficiencyBlocking = new Set(
    dc.dirs
      .filter((d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false)
      .map((d) => d.dir_id),
  );
  const blockingCandidates = candidates.filter((c) =>
    c.dir_ids.some((dirId) => sufficiencyBlocking.has(dirId)),
  );
  const openBlockingDirs = new Set(
    blockingCandidates.flatMap((c) => c.dir_ids.filter((dirId) => sufficiencyBlocking.has(dirId))),
  );
  const plannable =
    blockingCandidates.length > 0 && budget.remaining_hard_budget <= openBlockingDirs.size
      ? blockingCandidates
      : candidates;

  const naValidation = await buildProductionNaValidationContextFromSession(
    session,
    { nowIso: now },
  );
  const planResult = planNextAskFromCandidates({
    candidates: plannable,
    snap: snapshotFromDc(dc),
    naValidation,
    remaining_hard_budget: budget.remaining_hard_budget,
  });

  // selected_candidate_id is a code rank hint only — model chooses among legal candidates.
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

  const openBlocking = openBlockingReportNeeds(understanding);
  // Catalog fallback must not skip problem/desired gates by injecting detail DIRs.
  const earlyIntakeLayer =
    intakeLayer === "problem_understanding" || intakeLayer === "desired_outcome";
  const protectOpenBlocking =
    openBlocking.length > 0 &&
    budget.remaining_hard_budget > 0 &&
    !earlyIntakeLayer;

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
          "open_blocking_report_needs",
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
    const fb = tryCatalogFallbackForOpenBlocking({
      dc,
      blueprint,
      understanding,
      budget,
      now,
      scoring_path: `${INTAKE_ASK_SCORING_PATH}→catalog_fallback_p0_p1→buildAdaptiveQuestionPlan`,
    });
    if (fb.plan) {
      const finalPlan = finalizePlan(fb.plan);
      const u: UnderstandingState = {
        ...understanding,
        budget,
        next_question_plan: finalPlan,
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
        session: withUnderstanding(session, u, finalPlan, askSnap),
        understanding: u,
        plan: finalPlan,
        authorized_question: finalPlan.question_text,
        planner_block: null as { reason_code: string; detail: string } | null,
      };
    }
    const rejectDetail = fb.last_reject ? `${detail}|${fb.last_reject}` : detail;
    return blockOpenObligations(reason_code, rejectDetail, extraReasons);
  };

  if (!planResult.selected) {
    // M2.3-R2-FU: open P0/P1 + remaining hard budget must not become false completion.
    if (protectOpenBlocking) {
      return tryFallbackOrBlock(
        "no_selectable_candidate",
        "open_p0_p1_no_selectable_candidate",
        ["no_selectable_candidate"],
      );
    }
    if (earlyIntakeLayer && budget.remaining_hard_budget > 0) {
      const u: UnderstandingState = {
        ...understanding,
        next_question_plan: null,
        readiness: {
          ...understanding.readiness,
          verdict: "continue",
          can_ask: true,
          reasons: [
            ...understanding.readiness.reasons,
            "intake_layer_no_selectable_candidate",
            `intake_layer:${intakeLayer}`,
          ],
        },
      };
      return {
        session: withUnderstanding(session, u, null, askSnap),
        understanding: u,
        plan: null,
        authorized_question: null,
        planner_block: {
          reason_code: "intake_layer_no_selectable_candidate",
          detail: String(intakeLayer),
        },
      };
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
    last_sent_question_text:
        understanding.last_sent_question?.question_text ??
        session.decision_understanding?.last_sent_question?.question_text ??
        null,
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
        last_sent_question_text:
        understanding.last_sent_question?.question_text ??
        session.decision_understanding?.last_sent_question?.question_text ??
        null,
      scoring_path: `${INTAKE_ASK_SCORING_PATH}→buildAdaptiveQuestionPlan`,
      });
      if (alt.validation.ok) {
        const finalPlan = finalizePlan(alt.plan);
        const u: UnderstandingState = {
          ...understanding,
          budget,
          next_question_plan: finalPlan,
          last_sent_question: null,
        };
        return {
          session: withUnderstanding(session, u, finalPlan, askSnap),
          understanding: u,
          plan: finalPlan,
          authorized_question: finalPlan.question_text,
          planner_block: null,
        };
      }
    }
    // M2.3-R2-FU: all candidates rejected — preserve exact reason; never false-complete.
    const rejectReason = `scope_budget_reject:${built.validation.reason_code}`;
    if (protectOpenBlocking) {
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

  const finalPlan = finalizePlan(built.plan);
  const u: UnderstandingState = {
    ...understanding,
    budget,
    next_question_plan: finalPlan,
    last_sent_question: understanding.last_sent_question,
  };
  return {
    session: withUnderstanding(session, u, finalPlan, askSnap),
    understanding: u,
    plan: finalPlan,
    authorized_question: finalPlan.question_text,
    planner_block: null,
  };
}

/**
 * SEND_SITE_INVENTORY — user-visible DI2 investigation sends must use
 * attachAuthorizedAssistantQuestion (budget guard + last_sent_question):
 * - lib/poju/agent.ts (post-LLM display attach)
 * - protect / invalid-input paths that re-present the same authorized plan
 * Clarification plans are attached only through agent after orchestration returns plan.
 */

export type AttachAuthorizedQuestionResult = {
  session: POJUSessionState;
  attached: boolean;
  block_reason?: string;
};

function ordinaryPlanNeedIdsValid(plan: AdaptiveQuestionPlan): boolean {
  const ids = plan.need_ids;
  if (!ids?.length) return false;
  return ids.every((id) => {
    const need = reportInformationNeedById(id);
    return Boolean(need && need.ask_policy !== "never");
  });
}

export function guardAndAttachAuthorizedQuestion(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
  turnId: string,
  now: string,
): AttachAuthorizedQuestionResult {
  const collection_mode = classifyCollectionMode(plan);
  const planWithMode: AdaptiveQuestionPlan = {
    ...plan,
    collection_mode: plan.collection_mode ?? collection_mode,
    question_shape: plan.question_shape ?? "single",
  };
  const understanding = session.decision_understanding;
  if (!understanding) {
    return {
      session,
      attached: false,
      block_reason: "missing_decision_understanding",
    };
  }
  const already =
    understanding.last_sent_question?.plan_id === planWithMode.plan_id;
  if (already) {
    return {
      session: {
        ...session,
        adaptive_ask_plan: planWithMode,
        decision_understanding: {
          ...understanding,
          next_question_plan: planWithMode,
        },
      },
      attached: true,
    };
  }

  if (collection_mode === "ordinary" && !ordinaryPlanNeedIdsValid(planWithMode)) {
    return {
      session,
      attached: false,
      block_reason: "invalid_ssot_need_ids",
    };
  }

  let budget = understanding.budget;

  if (budget.session_asked_count >= budget.hard_budget_limit) {
    return {
      session,
      attached: false,
      block_reason: "hard_budget_exhausted",
    };
  }

  if (collection_mode === "clarification") {
    const claim = claimClarification(budget, planWithMode.plan_id, now);
    if (!claim.ok) {
      return {
        session,
        attached: false,
        block_reason: "clarification_allowance_exhausted",
      };
    }
    // Claim reserves allowance; asked-count is charged here and refunded on release
    // if the assistant question never enters the outbound messages.
    budget = bumpBudgetAfterAsk(claim.budget, planWithMode);
  } else {
    if (!canAskOrdinary(budget)) {
      return {
        session,
        attached: false,
        block_reason: "core_ordinary_cap_reached",
      };
    }
    budget = bumpBudgetAfterAsk(budget, planWithMode);
  }

  return {
    session: {
      ...session,
      adaptive_ask_plan: planWithMode,
      decision_understanding: {
        ...understanding,
        budget,
        next_question_plan: planWithMode,
        last_sent_question: {
          question_text: planWithMode.question_text,
          plan_id: planWithMode.plan_id,
          direction_id: planWithMode.direction_id,
          dir_ids: planWithMode.dir_ids,
          ddr_ids: planWithMode.ddr_ids,
          fact_role_codes: [...planWithMode.fact_role_codes],
          turn_id: turnId,
          conflict_clarification: planWithMode.conflict_clarification
            ? {
                conflict_id: planWithMode.conflict_clarification.conflict_id,
                fact_ids: [...planWithMode.conflict_clarification.fact_ids],
              }
            : null,
        },
      },
    },
    attached: true,
  };
}

export function confirmAuthorizedQuestionSend(
  session: POJUSessionState,
  plan_id: string,
  _turnId: string,
  send_event_id: string,
  now?: string,
): POJUSessionState {
  const understanding = session.decision_understanding;
  if (!understanding) return session;
  const claims = understanding.budget.clarification_claims ?? [];
  const claim = claims.find((c) => c.plan_id === plan_id);
  if (!claim || claim.status !== "claimed") return session;
  const iso = now ?? new Date().toISOString();
  const budget = confirmClarification(
    understanding.budget,
    plan_id,
    iso,
    send_event_id,
  );
  return {
    ...session,
    decision_understanding: { ...understanding, budget },
  };
}

export function releaseAuthorizedQuestionClaim(
  session: POJUSessionState,
  plan_id: string,
  now?: string,
): POJUSessionState {
  const understanding = session.decision_understanding;
  if (!understanding) return session;
  const claims = understanding.budget.clarification_claims ?? [];
  const claim = claims.find((c) => c.plan_id === plan_id);
  if (!claim || claim.status !== "claimed") return session;
  const iso = now ?? new Date().toISOString();
  let budget = releaseClarification(understanding.budget, plan_id, iso);
  const plan =
    session.adaptive_ask_plan?.plan_id === plan_id
      ? session.adaptive_ask_plan
      : understanding.next_question_plan?.plan_id === plan_id
        ? understanding.next_question_plan
        : null;
  if (plan) {
    budget = refundIneffectiveQuestion(budget, {
      plan_id: plan.plan_id,
      dir_ids: Array.isArray(plan.dir_ids) ? plan.dir_ids : [],
      budget_cost: typeof plan.budget_cost === "number" ? plan.budget_cost : 1,
    });
  } else if (understanding.last_sent_question?.plan_id === plan_id) {
    budget = refundIneffectiveQuestion(budget, {
      plan_id,
      dir_ids: understanding.last_sent_question.dir_ids ?? [],
      budget_cost: 1,
    });
  }
  const last = understanding.last_sent_question;
  const last_sent_question =
    last?.plan_id === plan_id ? null : last;
  return {
    ...session,
    adaptive_ask_plan:
      session.adaptive_ask_plan?.plan_id === plan_id
        ? null
        : session.adaptive_ask_plan,
    decision_understanding: {
      ...understanding,
      budget,
      last_sent_question,
      next_question_plan:
        understanding.next_question_plan?.plan_id === plan_id
          ? null
          : understanding.next_question_plan,
    },
  };
}

/** Mark a plan as actually shown without double-counting (restore same plan_id). */
export function attachAuthorizedAssistantQuestion(
  session: POJUSessionState,
  plan: AdaptiveQuestionPlan,
  turnId: string,
  now?: string,
): AttachAuthorizedQuestionResult {
  const iso = now ?? plan.built_at ?? new Date().toISOString();
  return guardAndAttachAuthorizedQuestion(session, plan, turnId, iso);
}

function finishPendingFromEvent(
  session: POJUSessionState,
  event: AnswerEvent,
  statement: string,
  now: string,
): POJUSessionState {
  const incoming = pendingFromAnswerEvent({
    session,
    event,
    statement,
    now,
  });
  if (!incoming) return session;
  const existing = session.pending_answer_resolution;
  // Items from a new source turn are queued behind the current ones (never dropped).
  const merged = mergePendingResolution(existing, incoming);
  const resolving = nextResolvingItem(merged);
  const plan =
    (merged.clarification_plan &&
    resolving &&
    merged.clarification_plan_id &&
    merged.resolving_item_id === resolving.item_id
      ? merged.clarification_plan
      : null) ??
    buildClarificationPlan({ session, pending: merged, now, item: resolving });
  const pending: PendingAnswerResolution = plan
    ? {
        ...merged,
        clarification_plan: plan,
        clarification_plan_id: plan.plan_id,
        resolving_item_id: resolving?.item_id ?? merged.resolving_item_id,
      }
    : merged;
  return withPendingAnswerResolution(session, pending);
}

async function handlePendingAnswerResolutionTurn(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  persist_error?: string;
  test_hooks?: AdaptiveTurnTestHooks;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const pendingRaw = current.pending_answer_resolution;
  if (!pendingRaw) {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "missing_pending_answer_resolution",
    };
  }

  const pending: PendingAnswerResolution = {
    ...pendingRaw,
    unresolved_items: normalizePendingItems(pendingRaw.unresolved_items),
    rejected_items: pendingRaw.rejected_items ?? [],
    authorized_dir_ids: pendingRaw.authorized_dir_ids ?? [],
    resolving_item_id: pendingRaw.resolving_item_id ?? null,
  };

  // Replay of an extracted-answer source turn: restore the already-sent
  // clarification question. Do not regenerate, recount budget, or rewrite DC.
  if (pendingSourceTurnIds(pending).includes(input.source_turn_id)) {
    return pendingOrchestrationResult({
      session: current,
      pending,
      answer_event: null,
      persist_error: "pending_answer_resolution_replay",
      outcome: "idempotent_replay",
    });
  }

  const resolving = nextResolvingItem(pending);
  if (!resolving) {
    if ((pending.rejected_items ?? []).length > 0) {
      return continueInvestigationAfterTerminalRefusal({
        current,
        pending,
        now: input.now,
        answer_event: null,
        buildUnderstanding: input.buildUnderstanding,
        planFromState: input.planFromState,
      });
    }
    const sanitized = asTerminalRejectedPending({
      ...pending,
      rejected_items: pending.rejected_items ?? [],
    });
    return {
      session: withPendingAnswerResolution(current, sanitized),
      outcome: "planner_blocked",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "pending_answer_resolution_unresolved",
      ask_error: "pending_clarification_plan_failed",
    };
  }

  const parseChoice = ():
    | { ok: true; choice: PendingBindChoice }
    | { ok: false; reason: "unclear" | "refused" | "unauthorized" } => {
    if (isRoleBindingReason(resolving.reason)) {
      const options = authorizedRoleOptions(
        current,
        resolving.authorized_role_codes,
      );
      const parsed = parseClarificationRoleChoice(input.statement, options);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "role", role_code: parsed.role_code } };
    }
    if (resolving.reason === "unclear_certainty") {
      if (isCannotDetermineSelection(input.statement)) {
        return { ok: true, choice: { type: "cannot_determine" } };
      }
      const parsed = parseCertaintyChoice(input.statement);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "certainty", certainty: parsed.certainty } };
    }
    if (resolving.reason === "estimated_constraint_not_persistable") {
      const parsed = parseConstraintConfirmChoice(input.statement);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        choice: {
          type: "constraint_confirm",
          confirmed: parsed.confirmed,
          still_uncertain: parsed.still_uncertain,
        },
      };
    }
    if (resolving.reason === "definition_patch_not_persistable") {
      const parsed = parseDefinitionPatchChoice(input.statement);
      if (!parsed.ok) return parsed;
      return { ok: true, choice: { type: "definition_as_fact" } };
    }
    return { ok: false, reason: "unclear" };
  };

  const closeOrContinue = (nextPending: PendingAnswerResolution, persist_error: string) => {
    current = withPendingAnswerResolution(current, nextPending);
    if (!isActivePendingAnswerResolution(nextPending)) {
      return continueInvestigationAfterTerminalRefusal({
        current,
        pending: nextPending,
        now: input.now,
        answer_event: null,
        buildUnderstanding: input.buildUnderstanding,
        planFromState: input.planFromState,
      });
    }
    return Promise.resolve(
      pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event: null,
        persist_error,
        outcome: "planned",
      }),
    );
  };

  // Unparseable clarification replies are bounded: after the retry limit the
  // item closes as unclear (auditable, never written as fact, never re-asked).
  const recordUnclearAttempt = () => {
    const attempt = recordUnclearPendingAttempt({
      session: current,
      pending,
      item: resolving,
      turn_id: input.source_turn_id,
      statement: input.statement,
      now: input.now,
    });
    return closeOrContinue(
      attempt.pending,
      attempt.terminal
        ? "pending_answer_resolution_closed_unclear"
        : "pending_answer_resolution_unresolved",
    );
  };

  const parsed = parseChoice();
  if (!parsed.ok) {
    if (parsed.reason === "refused") {
      const nextPending = rejectPendingItem({
        session: current,
        pending,
        item: resolving,
        rejected_at_turn_id: input.source_turn_id,
        rejected_statement: input.statement,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      if (!isActivePendingAnswerResolution(nextPending)) {
        return continueInvestigationAfterTerminalRefusal({
          current,
          pending: nextPending,
          now: input.now,
          answer_event: null,
          buildUnderstanding: input.buildUnderstanding,
          planFromState: input.planFromState,
        });
      }
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event: null,
        persist_error: "pending_answer_resolution_rejected",
        outcome: "planned",
      });
    }
    return recordUnclearAttempt();
  }

  if (parsed.choice.type === "role") {
    const authorized = resolving.authorized_role_codes;
    if (!authorized.includes(parsed.choice.role_code)) {
      return recordUnclearAttempt();
    }
    const targets = activeTargets(current);
    if (
      targets.fact_role_codes.length > 0 &&
      !targets.fact_role_codes.includes(parsed.choice.role_code)
    ) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event: null,
        persist_error: "pending_answer_resolution_unauthorized",
        outcome: "planned",
      });
    }
    if (targets.auth_error === "missing_authorized_answer_target") {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event: null,
        persist_error: "missing_authorized_answer_target",
        outcome: "planned",
      });
    }
  }

  // "Cannot tell" is never a fact nor user_asserted; bounded like any unclear reply.
  if (parsed.choice.type === "certainty" && parsed.choice.certainty === "unclear") {
    return recordUnclearAttempt();
  }
  // A repeated "still an estimate" is an answer: it binds below as a
  // user_estimate fact (never a Constraint) instead of being asked again.
  const keptAsEstimate =
    parsed.choice.type === "constraint_confirm" &&
    !parsed.choice.confirmed &&
    !parsed.choice.still_uncertain &&
    (resolving.attempts ?? 0) >= 1;
  if (
    parsed.choice.type === "constraint_confirm" &&
    !parsed.choice.confirmed &&
    !keptAsEstimate
  ) {
    const stillUncertain = parsed.choice.still_uncertain;
    const nextReason = stillUncertain
      ? "unclear_certainty"
      : "estimated_constraint_not_persistable";
    const nextCertainty = stillUncertain ? "unclear" : "estimated";
    const updated: typeof pending = {
      ...pending,
      unresolved_items: pending.unresolved_items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              reason: nextReason,
              certainty: nextCertainty,
              attempts: stillUncertain ? item.attempts : (item.attempts ?? 0) + 1,
            }
          : item,
      ),
    };
    const nextPending = pendingWithRemainingItems({
      session: current,
      pending: updated,
      remaining: updated.unresolved_items,
      rejected_items: updated.rejected_items,
      now: input.now,
    });
    current = withPendingAnswerResolution(current, nextPending);
    return pendingOrchestrationResult({
      session: current,
      pending: nextPending,
      answer_event: null,
      persist_error: "pending_answer_resolution_unresolved",
      outcome: "planned",
    });
  }

  if (parsed.choice.type === "cannot_determine") {
    // A sibling item of the same answer already answered this role: the
    // unknown sub-item adds no record, it only closes (auditably).
    const code =
      resolving.raw_role_code_hint ??
      (resolving.authorized_role_codes.length === 1 ? resolving.authorized_role_codes[0]! : null);
    const m = code ? /^v1\/dir\/([^/]+)\/role\/([^/]+)$/.exec(code) : null;
    const roleAnswered = Boolean(
      m &&
        (current.decision_context?.reality_facts ?? []).some(
          (f) =>
            f.source_turn_id === resolving.source_turn_id &&
            (f.related_dir_ids ?? []).includes(m[1]!) &&
            (f.fact_roles ?? []).includes(m[2]!),
        ),
    );
    if (roleAnswered) {
      const nextPending = rejectPendingItem({
        session: current,
        pending,
        item: resolving,
        rejected_at_turn_id: input.source_turn_id,
        rejected_statement: input.statement,
        now: input.now,
        terminal_reason: "user_cannot_determine",
      });
      return closeOrContinue(nextPending, "pending_item_cannot_determine");
    }
  }

  const answer_event = answerEventFromPendingBind({
    session: current,
    pending,
    item: resolving,
    choice: parsed.choice,
  });

  const followUp = continuableUnresolvedItems(answer_event.unresolved_items).map(
    (item) => ({
      ...item,
      item_id: resolving.item_id,
      source_turn_id: resolving.source_turn_id,
    }),
  );
  const siblings = pending.unresolved_items.filter(
    (item) => item.item_id !== resolving.item_id,
  );

  if (answer_event.proposed_writes.length === 0) {
    const remaining = followUp.length > 0 ? [...siblings, ...followUp] : pending.unresolved_items;
    const nextPending = pendingWithRemainingItems({
      session: current,
      pending,
      remaining,
      rejected_items: pending.rejected_items,
      now: input.now,
    });
    return pendingOrchestrationResult({
      session: withPendingAnswerResolution(current, nextPending),
      pending: nextPending,
      answer_event,
      persist_error: "pending_answer_resolution_bind_failed",
      outcome: "planned",
    });
  }

  try {
    const applied = await applyAnswerEventToSessionDc(current, answer_event, {
      now: input.now,
      allow_incremental_same_turn: true,
      incremental: {
        pending_source_turn_id: resolving.source_turn_id,
        pending_authorized_role_codes: [...resolving.authorized_role_codes],
        pending_authorized_dir_ids:
          (resolving.authorized_dir_ids ?? []).length > 0
            ? [...resolving.authorized_dir_ids!]
            : pending.authorized_dir_ids.length > 0
              ? [...pending.authorized_dir_ids]
              : [...(current.decision_understanding?.last_sent_question?.dir_ids ?? [])],
        resolving_item_id: resolving.item_id,
      },
    });

    const itemAlreadyWritten = (): boolean => {
      const dc = current.decision_context;
      if (!dc) return false;
      return answer_event.proposed_writes.some((w) => {
        if (w.kind === "reality_fact") {
          return dc.reality_facts.some(
            (f) =>
              f.source_turn_id === resolving.source_turn_id &&
              f.statement === w.statement &&
              (f.related_dir_ids ?? []).some((d) => w.related_dir_ids.includes(d)) &&
              (f.fact_roles ?? []).some((r) => w.fact_roles.includes(r)),
          );
        }
        if (w.kind === "constraint") {
          return dc.constraints.some(
            (c) =>
              c.source_turn_id === resolving.source_turn_id &&
              c.statement === w.statement &&
              (c.related_dir_ids ?? []).some((d) => w.related_dir_ids.includes(d)),
          );
        }
        return false;
      });
    };

    let persistedOk = false;
    if (applied.skipped_reason === "turn_already_mapped") {
      if (!itemAlreadyWritten()) {
        return pendingOrchestrationResult({
          session: current,
          pending,
          answer_event,
          persist_error: "turn_already_mapped",
          outcome: "planned",
        });
      }
      persistedOk = true;
    } else if (!applied.applied) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event,
        persist_error: applied.skipped_reason,
        outcome: "planned",
      });
    } else {
      const key = persistKeyForPendingBind(
        current.session_id,
        resolving.source_turn_id,
        resolving.item_id,
      );
      const persistFn =
        input.test_hooks?.pendingBindPersist ?? persistDcLifecycleChange;
      let working: POJUSessionState = {
        ...applied.session,
        decision_understanding:
          applied.session.decision_understanding ?? current.decision_understanding,
        decision_blueprint:
          current.decision_blueprint ?? applied.session.decision_blueprint,
        messages: current.messages,
        agent_v2: current.agent_v2,
      };
      working = sessionWithCoreBudgetAfterMaterialWrite(
        working,
        applied,
        answer_event,
        resolving.source_turn_id,
      );
      const persisted = await persistFn(input.original, working, key);
      if (persisted.error === "idempotent_skip") {
        current = {
          ...persisted.session,
          decision_understanding:
            working.decision_understanding ?? persisted.session.decision_understanding,
        };
        persistedOk = true;
      } else if (!persisted.committed) {
        return {
          session: input.original,
          outcome: "dc_persist_failed",
          answer_event,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error: persisted.error ?? "persist_failed",
        };
      } else {
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
          decision_understanding: working.decision_understanding,
        };
        persistedOk = true;
      }
    }

    if (!persistedOk) {
      return pendingOrchestrationResult({
        session: current,
        pending,
        answer_event,
        persist_error: "pending_answer_resolution_bind_failed",
        outcome: "planned",
      });
    }

    // Only after bind + DC persist success may this item be removed.
    const remaining = siblings;
    if (remaining.length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining,
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return pendingOrchestrationResult({
        session: current,
        pending: nextPending,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }

    if ((pending.rejected_items ?? []).length > 0) {
      const nextPending = pendingWithRemainingItems({
        session: current,
        pending,
        remaining: [],
        rejected_items: pending.rejected_items,
        now: input.now,
      });
      current = withPendingAnswerResolution(current, nextPending);
      return continueInvestigationAfterTerminalRefusal({
        current,
        pending: nextPending,
        now: input.now,
        answer_event,
        buildUnderstanding: input.buildUnderstanding,
        planFromState: input.planFromState,
      });
    }

    current = withPendingAnswerResolution(current, null);
    if (isActivePendingIntakeControl(current.pending_intake_control)) {
      const prepared = controlWithPlan(
        current,
        current.pending_intake_control!,
        input.now,
      );
      current = withPendingIntakeControl(current, prepared);
      return intakeControlOrchestrationResult({
        session: current,
        control: prepared,
        answer_event,
        persist_error: input.persist_error,
        outcome: "planned",
      });
    }
    const bp2 = ensureDecisionBlueprint(current, { now: input.now });
    current = bp2.session;
    current = activateNextBlueprintPriorityBand(current, input.now);
    const understanding = input.buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event.event_id,
    });
    const planned = await input.planFromState(current, understanding, input.now);
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
      persist_error: input.persist_error,
    };
  } catch (e) {
    return {
      session: input.original,
      outcome: "dc_persist_threw",
      answer_event,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: e instanceof Error ? e.message : String(e),
    };
  }
}



async function applyAndPersistIntakeControlAnswer(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  answer_event: AnswerEvent;
  source_turn_id: string;
  now: string;
  persist: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
}): Promise<
  | { ok: true; session: POJUSessionState }
  | {
      ok: false;
      outcome: "dc_persist_failed" | "dc_persist_threw";
      persist_error: string;
    }
> {
  try {
    const applied = await applyAnswerEventToSessionDc(input.current, input.answer_event, {
      now: input.now,
    });
    if (!applied.applied) {
      return { ok: true, session: input.current };
    }
    const key = `dc_collect:${input.current.session_id}:${input.source_turn_id}`;
    let working: POJUSessionState = {
      ...applied.session,
      decision_understanding:
        applied.session.decision_understanding ?? input.current.decision_understanding,
      decision_blueprint:
        input.current.decision_blueprint ?? applied.session.decision_blueprint,
      messages: input.current.messages,
      agent_v2: input.current.agent_v2,
      pending_intake_control:
        applied.session.pending_intake_control ?? input.current.pending_intake_control,
    };
    working = sessionWithCoreBudgetAfterMaterialWrite(
      working,
      applied,
      input.answer_event,
      input.source_turn_id,
    );
    const persisted = await input.persist(input.original, working, key);
    if (persisted.error === "idempotent_skip") {
      return {
        ok: true,
        session: {
          ...persisted.session,
          decision_understanding:
            working.decision_understanding ?? persisted.session.decision_understanding,
        },
      };
    }
    if (!persisted.committed) {
      return {
        ok: false,
        outcome: "dc_persist_failed",
        persist_error: persisted.error ?? "persist_failed",
      };
    }
    const merged: POJUSessionState = {
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
      pending_intake_control:
        applied.session.pending_intake_control ??
        persisted.session.pending_intake_control,
      decision_understanding: working.decision_understanding,
    };
    return { ok: true, session: merged };
  } catch (e) {
    return {
      ok: false,
      outcome: "dc_persist_threw",
      persist_error: errorText(e),
    };
  }
}

async function handlePendingIntakeControlTurn(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  locale?: string;
  signal?: AbortSignal;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  test_hooks?: AdaptiveTurnTestHooks;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const controlRaw = current.pending_intake_control;
  if (!controlRaw) {
    return {
      session: current,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: current.decision_understanding ?? null,
      plan: null,
      authorized_question: null,
      persist_error: "missing_pending_intake_control",
    };
  }
  const control = controlRaw;

  if (controlSourceTurnIds(control).includes(input.source_turn_id)) {
    const prepared = controlWithPlan(current, control, input.now);
    current = withPendingIntakeControl(current, prepared);
    return intakeControlOrchestrationResult({
      session: current,
      control: prepared,
      answer_event: null,
      persist_error: "pending_intake_control_replay",
      outcome: "idempotent_replay",
    });
  }

  if (input.source_turn_id === control.last_resolved_turn_id) {
    return replayInactiveIntakeControl({ session: current, control });
  }

  const persistFn = input.test_hooks?.intakeControlPersist ?? persistDcLifecycleChange;

  const continueOrdinary = (answer_event: AnswerEvent | null, persist_error?: string) =>
    continueOrdinaryAfterIntakeControl({
      current,
      now: input.now,
      answer_event,
      buildUnderstanding: input.buildUnderstanding,
      planFromState: input.planFromState,
      persist_error,
    });

  const presentControl = (
    next: PendingIntakeControl,
    item: IntakeControlItem,
    persist_error: string | undefined,
    answer_event: AnswerEvent | null,
  ): AdaptiveTurnResult => {
    const withPlan = controlWithPlan(current, next, input.now, item);
    current = withPendingIntakeControl(current, withPlan);
    return intakeControlOrchestrationResult({
      session: current,
      control: withPlan,
      answer_event,
      persist_error,
      outcome: "planned",
    });
  };

  /**
   * After the current item closes: queued pending clarifications first (they
   * own the next turn's routing), then remaining control items, then the
   * ordinary dynamic loop.
   */
  const advance = async (
    next: PendingIntakeControl,
    answer_event: AnswerEvent | null,
    persist_error: string | undefined,
  ): Promise<AdaptiveTurnResult> => {
    current = withPendingIntakeControl(current, next);
    if (answer_event) {
      // A follow-up answer resolves its item. Its own residual aspects stay in
      // the turn's audit and are not re-queued, so clarification cannot keep
      // generating clarification; goal_change / insight_mismatch still queue.
      const followUpEvent: AnswerEvent = {
        ...answer_event,
        control_items: (answer_event.control_items ?? []).filter(
          (item) => item.kind !== "unresolved_aspect",
        ),
      };
      current = attachIntakeControlFromEvent(current, followUpEvent, input.statement, input.now);
      current = finishPendingFromEvent(current, answer_event, input.statement, input.now);
    }
    const pending = current.pending_answer_resolution;
    if (isActivePendingAnswerResolution(pending)) {
      return pendingOrchestrationResult({
        session: current,
        pending: pending!,
        answer_event,
        persist_error,
        outcome: "planned",
      });
    }
    const ctl = current.pending_intake_control;
    const remaining = ctl ? nextPendingControlItem(ctl) : null;
    if (ctl && remaining) {
      return presentControl(ctl, remaining, persist_error, answer_event);
    }
    return continueOrdinary(answer_event, persist_error);
  };

  /** Bounded uncertainty: after the retry limit the item closes as closed_uncertain. */
  const uncertainAttempt = (
    answer_event: AnswerEvent | null,
    label: string,
  ): Promise<AdaptiveTurnResult> => {
    const attempt = recordUncertainControlAttempt(control, resolving!);
    if (attempt.terminal) {
      return advance(attempt.control, null, "pending_intake_control_closed_uncertain");
    }
    return Promise.resolve(presentControl(attempt.control, resolving!, label, answer_event));
  };

  const interpret = async (): Promise<
    | { ok: true; event: AnswerEvent; draft: Extract<ModelInterpretationResult, { ok: true }>["draft"] }
    | { ok: false; result: AdaptiveTurnResult }
  > => {
    current = refreshDecisionUnderstanding(current, { now: input.now });
    const interpreted = await interpretAnswerWithModel({
      session: current,
      statement: input.statement,
      source_turn_id: input.source_turn_id,
      locale: input.locale,
      signal: input.signal,
      testHook: input.test_hooks?.interpretAnswerModel,
    });
    if (!interpreted.ok) {
      return { ok: false, result: interpretationFailureResult(input.original, interpreted) };
    }
    const event = eventFromInterpretation({
      session: current,
      statement: input.statement,
      source_turn_id: input.source_turn_id,
      interpreted,
    });
    current = recordAnswerInterpretation(current, input.source_turn_id, event, input.now);
    return { ok: true, draft: interpreted.draft, event };
  };

  const notAnAnswer = (event: AnswerEvent) =>
    event.classification === "off_topic" || event.classification === "invalid_input";

  const resolving = nextPendingControlItem(control);
  if (!resolving) {
    return continueOrdinary(null);
  }

  if (resolving.kind === "goal_change") {
    if (!hasResolvedProposedDecisionTarget(resolving)) {
      if (isControlClarificationUncertain(input.statement)) {
        return uncertainAttempt(null, "pending_intake_control_goal_change_target_unresolved");
      }
      const r = await interpret();
      if (!r.ok) return r.result;
      const extracted = extractGroundedProposedDecisionTarget(r.draft, input.statement);
      if (!extracted.proposed_decision_target) {
        return uncertainAttempt(r.event, "pending_intake_control_goal_change_target_unresolved");
      }
      const items = control.items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              proposed_decision_target: extracted.proposed_decision_target,
              target_source_turn_id: input.source_turn_id,
              target_source_statement: input.statement,
              status: "pending" as const,
            }
          : item,
      );
      const updated: PendingIntakeControl = {
        ...control,
        items,
        clarification_plan: null,
        clarification_plan_id: null,
      };
      return presentControl(
        updated,
        items.find((item) => item.item_id === resolving.item_id) ?? resolving,
        undefined,
        r.event,
      );
    }
    const choice = parseGoalChangeConfirmation(input.statement);
    if (choice === "uncertain") {
      return uncertainAttempt(null, "pending_intake_control_uncertain");
    }
    if (choice === "confirm") {
      let applied: Awaited<ReturnType<typeof applyConfirmedGoalChange>>;
      try {
        applied = await applyConfirmedGoalChange({
          original: input.original,
          session: current,
          control,
          item: resolving,
          confirm_turn_id: input.source_turn_id,
          confirmation_statement: input.statement,
          now: input.now,
          persist: persistFn,
        });
      } catch (e) {
        return {
          session: input.original,
          outcome: "dc_persist_threw",
          answer_event: null,
          understanding: null,
          plan: null,
          authorized_question: null,
          persist_error: errorText(e),
        };
      }
      if (!applied.ok) {
        if (applied.reason.startsWith("persist_failed")) {
          return {
            session: input.original,
            outcome: "dc_persist_failed",
            answer_event: null,
            understanding: null,
            plan: null,
            authorized_question: null,
            persist_error: applied.reason,
          };
        }
        return presentControl(
          control,
          resolving,
          `goal_change_blueprint_update_failed:${applied.reason}`,
          null,
        );
      }
      current = applied.session;
      return advance(
        current.pending_intake_control ?? control,
        null,
        "goal_change_blueprint_updated",
      );
    }
    // decline: retain the current target and resume its investigation.
    const declined = updateControlItemStatus(control, resolving.item_id, "declined", {
      entered_controlled_blueprint_update: false,
      last_resolved_turn_id: input.source_turn_id,
    });
    return advance(declined, null, "pending_intake_control_goal_change_declined");
  }

  if (resolving.kind === "insight_mismatch") {
    if (isControlClarificationUncertain(input.statement)) {
      return uncertainAttempt(null, "pending_intake_control_uncertain");
    }
    const r = await interpret();
    if (!r.ok) return r.result;
    const answer_event = r.event;
    if (notAnAnswer(answer_event)) {
      return uncertainAttempt(answer_event, `${answer_event.classification}_no_dc_write`);
    }
    const persisted = await applyAndPersistIntakeControlAnswer({
      current,
      original: input.original,
      answer_event,
      source_turn_id: input.source_turn_id,
      now: input.now,
      persist: persistFn,
    });
    if (!persisted.ok) {
      return {
        session: input.original,
        outcome: persisted.outcome,
        answer_event,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: persisted.persist_error,
      };
    }
    current = persisted.session;
    if (answer_event.classification === "unknown" || answer_event.classification === "declined") {
      current = refundSentQuestion(current);
    }
    const resolution_status: IntakeControlResolutionRecord["resolution_status"] =
      answer_event.proposed_writes.length > 0 ? "clarified" : "clarified_without_dc_write";
    const record: IntakeControlResolutionRecord = {
      original_mismatch_item_id: resolving.item_id,
      original_mismatch_source_turn_id: resolving.source_turn_id,
      clarification_turn_id: input.source_turn_id,
      original_mismatch_text: resolving.text,
      clarification_text: input.statement.slice(0, 2000),
      answer_event_id: answer_event.event_id,
      resolution_status,
    };
    const existingRecords = control.resolution_records ?? [];
    const already = existingRecords.some(
      (row) =>
        row.clarification_turn_id === record.clarification_turn_id &&
        row.original_mismatch_item_id === record.original_mismatch_item_id,
    );
    const resolution_records = already ? existingRecords : [...existingRecords, record];
    const prepared = updateControlItemStatus(control, resolving.item_id, "clarified", {
      last_resolved_turn_id: input.source_turn_id,
      resolution_records,
    });
    return advance(prepared, answer_event, "pending_intake_control_insight_clarified");
  }

  // unresolved_aspect follow-up: interpret the clarification under the
  // originally authorized question; new unresolved items are queued, not dropped.
  if (isControlClarificationUncertain(input.statement)) {
    return uncertainAttempt(null, "pending_intake_control_uncertain");
  }
  const r = await interpret();
  if (!r.ok) return r.result;
  const answer_event = r.event;
  if (notAnAnswer(answer_event)) {
    return uncertainAttempt(answer_event, `${answer_event.classification}_no_dc_write`);
  }
  const persisted = await applyAndPersistIntakeControlAnswer({
    current,
    original: input.original,
    answer_event,
    source_turn_id: input.source_turn_id,
    now: input.now,
    persist: persistFn,
  });
  if (!persisted.ok) {
    return {
      session: input.original,
      outcome: persisted.outcome,
      answer_event,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: persisted.persist_error,
    };
  }
  current = persisted.session;
  if (answer_event.classification === "unknown" || answer_event.classification === "declined") {
    current = refundSentQuestion(current);
  }
  const prepared = updateControlItemStatus(control, resolving.item_id, "clarified", {
    last_resolved_turn_id: input.source_turn_id,
  });
  return advance(prepared, answer_event, undefined);
}

async function continueOrdinaryAfterIntakeControl(input: {
  current: POJUSessionState;
  now: string;
  answer_event: AnswerEvent | null;
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: typeof planFromState;
  persist_error?: string;
}): Promise<AdaptiveTurnResult> {
  let current = input.current;
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;
  current = activateNextBlueprintPriorityBand(current, input.now);
  const understanding = input.buildUnderstanding({
    session: current,
    blueprint: current.decision_blueprint!,
    now: input.now,
    last_answer_event_id: input.answer_event?.event_id ?? null,
  });
  const planned = await input.planFromState(current, understanding, input.now);
  return {
    session: planned.session,
    outcome: outcomeFromPlanResult(planned),
    ask_error: planned.planner_block
      ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
      : undefined,
    answer_event: input.answer_event,
    understanding: planned.understanding,
    plan: planned.plan,
    authorized_question: planned.authorized_question,
    persist_error: input.persist_error,
  };
}
