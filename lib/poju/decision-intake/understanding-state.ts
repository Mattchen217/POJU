/**
 * Build derived Understanding State from DC + Blueprint (not a second fact DB).
 * M2.4-R1: retain fact IDs/sources; Understood only for known/n_a; Need lists
 * unmet roles; summary updates only on substantial content change.
 */

import { evaluateDecisionSufficiency } from "@/lib/poju/decision-context/stop-criteria";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  directionIdForDir,
  gateClassForDirFromCatalog,
  resolveDdrIdsForDir,
} from "./blueprint";
import {
  ACTIVE_DDR_CATALOG_VERSION,
  loadDdrCatalog,
} from "@/lib/poju/decision-context/catalog";
import { dirIntakeAnswerCoverage } from "./intake-answer-coverage";
import type {
  AdaptiveQuestionPlan,
  DecisionBlueprint,
  NeedItem,
  PersonalPatternInsightBlock,
  SessionBudgetSnapshot,
  UnderstandingState,
  UnderstoodItem,
} from "./types";

export function defaultBudget(
  session: POJUSessionState,
  blueprint: DecisionBlueprint,
): SessionBudgetSnapshot {
  const prev = session.decision_understanding?.budget;
  const soft = blueprint.question_budget.soft;
  const hard = blueprint.question_budget.hard;
  const session_asked_count = prev?.session_asked_count ?? 0;
  return {
    soft_budget_limit: soft,
    hard_budget_limit: hard,
    session_asked_count,
    review_cycle: prev?.review_cycle ?? 1,
    cycle_base_asked: prev?.cycle_base_asked ?? 0,
    remaining_hard_budget: Math.max(0, hard - session_asked_count),
    depth_by_dir: { ...(prev?.depth_by_dir ?? {}) },
    ...(prev?.ineffective_plan_ids?.length
      ? { ineffective_plan_ids: [...prev.ineffective_plan_ids] }
      : {}),
  };
}

export function evaluatePersonalPatternInsight(
  _session: POJUSessionState,
): PersonalPatternInsightBlock {
  // Phase 5 production gate not claimed in M1 — unavailable is correct, never forge.
  return {
    status: "unavailable",
    reason: "phase5_personal_analysis_not_wired_for_m1",
    insights: [],
  };
}

function briefWithSource(id: string, statement: string): string {
  return `[${id}] ${statement}`;
}

function unmetRolesForDir(
  dir: { dir_id: string; required_fact_roles?: string[] },
  reality_facts: Array<{
    related_dir_ids?: string[];
    fact_roles?: string[];
    status: string;
  }>,
): string[] {
  const required = dir.required_fact_roles ?? [];
  if (!required.length) return [];
  const facts = reality_facts.filter((f) =>
    (f.related_dir_ids ?? []).includes(dir.dir_id),
  );
  return required.filter((role) => {
    const hit = facts.some(
      (f) =>
        (f.fact_roles ?? []).includes(role) &&
        f.status !== "unknown" &&
        f.status !== "declined",
    );
    return !hit;
  });
}

function understandingFingerprint(input: {
  dq: string | null;
  confirmed: string[];
  unconfirmed: string[];
  analysis: string[];
  conflicts: string[];
  needCount: number;
  understoodCount: number;
}): string {
  return [
    input.dq ?? "",
    `c:${input.confirmed.length}`,
    `u:${input.unconfirmed.length}`,
    `a:${input.analysis.length}`,
    `x:${input.conflicts.length}`,
    `n:${input.needCount}`,
    `k:${input.understoodCount}`,
    input.confirmed.slice(0, 3).join("|"),
    input.unconfirmed.slice(0, 3).join("|"),
    input.conflicts.slice(0, 2).join("|"),
  ].join("::");
}

export function buildUnderstandingState(input: {
  session: POJUSessionState;
  blueprint: DecisionBlueprint;
  now?: string;
  last_answer_event_id?: string | null;
  next_question_plan?: AdaptiveQuestionPlan | null;
}): UnderstandingState {
  const dc = input.session.decision_context;
  if (!dc) throw new Error("buildUnderstandingState: missing DC");
  const now = input.now ?? new Date().toISOString();
  const budget = defaultBudget(input.session, input.blueprint);
  const prev = input.session.decision_understanding;

  const understood: UnderstoodItem[] = [];
  const answered: NonNullable<UnderstandingState["answered_pending_confirmation"]>["items"] = [];
  const needs: NeedItem[] = [];
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);

  for (const dir of dc.dirs) {
    if (dir.id_lifecycle !== "active") continue;
    const relatedFacts = dc.reality_facts.filter((f) =>
      (f.related_dir_ids ?? []).includes(dir.dir_id),
    );
    // Understood ONLY when DC DIR state is known or n_a — never merely asked/answered.
    if (dir.current_state === "known" || dir.current_state === "n_a") {
      understood.push({
        dir_id: dir.dir_id,
        label: dir.need,
        fact_ids: relatedFacts.map((f) => f.fact_id),
        status: dir.current_state,
        user_confirmed_any: relatedFacts.some((f) => f.user_confirmed === true),
      });
      continue;
    }
    // Blueprint scope only — never invent needs outside Catalog seed.
    if (!input.blueprint.dir_ids.includes(dir.dir_id)) continue;
    // Answered but not known: awaits final confirmation (or stays an
    // information boundary); never re-asked as an open need.
    const coverage = dirIntakeAnswerCoverage(dc, dir);
    if (coverage.answered) {
      answered.push({
        dir_id: dir.dir_id,
        label: dir.need,
        fact_ids: coverage.fact_ids,
        answer_statuses: coverage.answer_statuses,
        information_boundary: coverage.information_boundary,
      });
      continue;
    }
    const direction_id = directionIdForDir(input.blueprint, dir.dir_id);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const gate = ddrLoad.ok
      ? gateClassForDirFromCatalog(
          dir.dir_id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        )
      : null;
    const ddr_ids = resolveDdrIdsForDir(dir.dir_id, input.blueprint);
    if (ddr_ids.length === 0) {
      // No legal Catalog DDR link — do not disguise as formal DDR investigation need.
      continue;
    }
    const priority =
      gate?.gate_class ??
      direction?.priority ??
      "P2";
    let gap_type: "unknown" | "partial" | "conflict" | "declined" = "unknown";
    if (dir.current_state === "conflict") gap_type = "conflict";
    else if (
      relatedFacts.length > 0 &&
      relatedFacts.every((f) => f.status === "declined")
    ) {
      gap_type = "declined";
    } else if (
      relatedFacts.some((f) => f.status === "unknown") &&
      relatedFacts.every(
        (f) => f.status === "unknown" || f.status === "declined",
      )
    ) {
      gap_type = "unknown";
    } else if (dir.partial_satisfaction || relatedFacts.length > 0) {
      gap_type = "partial";
    }
    const ranking =
      gate?.may_affect_p5_ranking ?? dir.may_affect_p5_ranking !== false;
    const missingRoles = unmetRolesForDir(dir, dc.reality_facts);
    // Having any RealityFact does NOT complete the DIR — unmet roles stay open.
    const missing_content =
      missingRoles.length > 0
        ? `missing_roles:${missingRoles.join(",")}; ${dir.need}`
        : dir.need;
    needs.push({
      kind: "dir_based",
      dir_id: dir.dir_id,
      ddr_ids,
      direction_id,
      priority,
      why: dir.why || "Required for decision judgment",
      missing_content,
      may_affect_p5_ranking: ranking,
      gap_type,
      must_continue: ranking || priority === "P0" || priority === "P1",
    });
  }

  // M2.3-R1: Blueprint-scoped DIRs not yet on DC (deferred P1/P2) remain open.
  const onDc = new Set(dc.dirs.map((d) => d.dir_id));
  for (const dirId of input.blueprint.dir_ids) {
    if (onDc.has(dirId)) continue;
    if (needs.some((n) => n.kind === "dir_based" && n.dir_id === dirId)) continue;
    const direction_id = directionIdForDir(input.blueprint, dirId);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const gate = ddrLoad.ok
      ? gateClassForDirFromCatalog(
          dirId,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        )
      : null;
    const ddr_ids = resolveDdrIdsForDir(dirId, input.blueprint);
    if (ddr_ids.length === 0) continue;
    const priority =
      gate?.gate_class ?? direction?.priority ?? "P2";
    needs.push({
      kind: "dir_based",
      dir_id: dirId,
      ddr_ids,
      direction_id,
      priority,
      why: direction?.needed_info || "Blueprint-scoped DIR not yet activated on DC",
      missing_content: direction?.needed_info || dirId,
      may_affect_p5_ranking:
        gate?.may_affect_p5_ranking ?? direction?.priority === "P0",
      gap_type: "unknown",
      must_continue: (gate?.may_affect_p5_ranking ?? false) || priority === "P0" || priority === "P1",
    });
  }

  // Formal DC only — never put AnalyticalHypotheses into confirmed facts.
  const confirmed = dc.reality_facts.filter((f) => f.status === "confirmed");
  const unconfirmed = dc.reality_facts.filter(
    (f) =>
      f.status === "unverified" ||
      f.status === "unknown" ||
      f.status === "declined",
  );
  const constraintBriefs = dc.constraints.map((c) =>
    briefWithSource(c.constraint_id, c.statement),
  );
  const openConflictBriefs = dc.conflicts
    .filter((c) => c.state === "open")
    .map((c) =>
      briefWithSource(c.conflict_id, c.statements_snapshot.join(" vs ")),
    );

  const criticalActive = dc.dirs.filter(
    (d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false,
  );
  const criticalCovered =
    criticalActive.length > 0 &&
    criticalActive.every(
      (d) =>
        d.current_state === "known" ||
        d.current_state === "n_a" ||
        d.partial_satisfaction === true,
    );
  const hasCollectingEvidence =
    (dc.reality_facts?.length ?? 0) > 0 || (dc.constraints?.length ?? 0) > 0;

  const openPriorityBandNeeds = needs.filter(
    (n) =>
      n.kind === "dir_based" &&
      (n.priority === "P0" || n.priority === "P1"),
  );
  const hasOpenP0OrP1 = openPriorityBandNeeds.length > 0;

  const sufficiency = evaluateDecisionSufficiency(dc);
  const remaining = budget.remaining_hard_budget;
  let readiness_verdict: UnderstandingState["readiness"]["verdict"] = "continue";
  let can_ask = true;
  const reasons = [...sufficiency.reasons];
  if (remaining <= 0) {
    readiness_verdict = "hard_budget_exhausted";
    can_ask = false;
    reasons.push("hard_budget_exhausted");
  } else if (hasOpenP0OrP1) {
    readiness_verdict = "continue";
    can_ask = true;
    reasons.push("open_blueprint_p0_p1_obligations");
  } else if (sufficiency.canStop) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("sufficiency_can_stop");
  } else if (needs.length === 0) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("no_open_needs");
  } else if (criticalCovered && hasCollectingEvidence) {
    readiness_verdict = "ready_for_final_confirm";
    can_ask = false;
    reasons.push("critical_dirs_partial_coverage_ready_for_confirm");
  }
  for (const item of answered) {
    if (item.information_boundary) reasons.push(`information_boundary:${item.dir_id}`);
  }

  const dq =
    dc.definition.decision_question ??
    input.blueprint.decision_question ??
    input.session.original_question ??
    null;

  const confirmed_briefs = confirmed
    .map((f) => briefWithSource(f.fact_id, f.statement))
    .slice(0, 8);
  const correctedBy = new Map<string, string>();
  for (const f of dc.reality_facts) {
    for (const id of f.corrects_fact_ids ?? []) correctedBy.set(id, f.fact_id);
  }
  const unconfirmed_briefs = [
    ...unconfirmed.map((f) =>
      correctedBy.has(f.fact_id)
        ? `${briefWithSource(f.fact_id, f.statement)} (corrected by ${correctedBy.get(f.fact_id)})`
        : briefWithSource(f.fact_id, f.statement),
    ),
    ...constraintBriefs,
  ].slice(0, 8);
  // Hypotheses stay in analysis_briefs only — never confirmed.
  const analysis_briefs = dc.hypotheses.map((h) => h.statement).slice(0, 6);

  const fp = understandingFingerprint({
    dq,
    confirmed: confirmed_briefs,
    unconfirmed: unconfirmed_briefs,
    analysis: analysis_briefs,
    conflicts: openConflictBriefs,
    needCount: needs.length,
    understoodCount: understood.length,
  });
  const prevFp = prev?.current_understanding
    ? understandingFingerprint({
        dq: prev.current_understanding.decision_question,
        confirmed: prev.current_understanding.confirmed_briefs,
        unconfirmed: prev.current_understanding.unconfirmed_briefs,
        analysis: prev.current_understanding.analysis_briefs,
        conflicts: prev.current_understanding.conflict_briefs,
        needCount: prev.need_to_understand.items.length,
        understoodCount: prev.understood.items.length,
      })
    : null;

  const summary =
    prevFp === fp && prev?.current_understanding.summary
      ? prev.current_understanding.summary
      : [
          dq ? `Decision: ${dq}` : null,
          confirmed.length ? `Confirmed facts: ${confirmed.length}` : null,
          unconfirmed.length ? `Unconfirmed/open: ${unconfirmed.length}` : null,
          dc.constraints.length
            ? `Constraints: ${dc.constraints.length}`
            : null,
          openConflictBriefs.length
            ? `Open conflicts: ${openConflictBriefs.length}`
            : null,
          needs.length ? `Open needs: ${needs.length}` : "No open DIR needs",
        ]
          .filter(Boolean)
          .join(" · ");

  return {
    understanding_id: `u_${dc.context_id}_v${dc.version}`,
    session_id: input.session.session_id,
    context_id: dc.context_id,
    context_version: dc.version,
    blueprint_version: input.blueprint.blueprint_version,
    built_at: now,
    current_understanding: {
      summary,
      decision_question: dq,
      confirmed_briefs,
      unconfirmed_briefs,
      analysis_briefs,
      conflict_briefs: openConflictBriefs.slice(0, 6),
      confidence:
        sufficiency.canStop ? "high" : confirmed.length >= 2 ? "medium" : "low",
    },
    understood: { items: understood },
    answered_pending_confirmation: { items: answered },
    need_to_understand: { items: needs },
    personal_pattern_insight: evaluatePersonalPatternInsight(input.session),
    next_question_plan: input.next_question_plan ?? null,
    readiness: {
      verdict: readiness_verdict,
      can_ask,
      reasons,
      sufficiency_verdict: sufficiency.verdict,
    },
    budget,
    last_answer_event_id: input.last_answer_event_id ?? null,
    last_sent_question:
      input.session.decision_understanding?.last_sent_question ?? null,
  };
}
