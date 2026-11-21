/**
 * M1 UI projection — read the same structured Session state the model uses.
 * No re-inference of facts; no progress-from-question-count.
 */

import type { POJUSessionState } from "@/lib/poju/types";

export type AlreadyUnderstoodItem = {
  label: string;
  status: "known" | "n_a" | "asserted";
};

export type AdaptiveQuestionUiProjection = {
  current_question: string | null;
  understanding_summary: string | null;
  understood_labels: string[];
  need_labels: string[];
  personal_pattern_status: string | null;
  readiness_verdict: string | null;
  budget_asked: number | null;
  budget_hard: number | null;
  plan_direction_id: string | null;
  plan_dir_ids: string[];
  investigation_directions: Array<{ direction_id: string; label: string; priority: string; dir_ids: string[] }>;
  dir_states: Array<{ dir_id: string; need: string; state: string; priority: string; may_affect_ranking: boolean }>;
  open_conflicts: Array<{ conflict_id: string; field: string; statements: string[] }>;
  readiness_reasons: string[];
  readiness_can_ask: boolean | null;
  budget_remaining: number | null;
  need_details: Array<{ label: string; priority: string; direction_id: string | null; gap_type: string }>;
  personal_pattern_insights: Array<{ text: string; source: string; related_dir_ids: string[] }>;
  readiness_progress_percent: number | null;
  readiness_progress_complete: boolean | null;
};


function userFacingText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Strip internal role/DIR debug prefixes from user-facing need labels. */
function sanitizeNeedLabel(value: string | null | undefined): string {
  let text = userFacingText(value);
  if (!text) return "";
  text = text
    .replace(/^missing_roles:\s*/i, "")
    .replace(/\bDIR_[A-Z0-9_]+\b/g, "")
    .replace(/\bDIR-[A-Z0-9-]+\b/g, "")
    .replace(/\bDDR_[A-Z0-9_]+\b/g, "")
    .replace(/\b[a-z]+_[a-z_]+\b/g, "")
    .replace(/\s*;\s*/g, " · ")
    .replace(/\s*·\s*·+/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function projectAlreadyUnderstoodItems(
  items: Array<{
    label?: string;
    status?: string;
    user_confirmed_any?: boolean;
    fact_ids?: string[];
  }> | null | undefined,
): AlreadyUnderstoodItem[] {
  const result: AlreadyUnderstoodItem[] = [];
  for (const item of items ?? []) {
    // DIR-level Understood still requires a user-confirm signal on related facts.
    // Opening user_asserted claims are projected separately from RealityFacts.
    if (item.user_confirmed_any !== true) continue;
    if (item.status !== "known" && item.status !== "n_a") continue;
    const label = userFacingText(item.label);
    if (!label) continue;
    result.push({
      label,
      status: item.status,
    });
  }
  return result;
}

/** Discrete user_asserted RealityFacts (opening claims) for the Understood section. */
function projectUserAssertedFacts(
  session: POJUSessionState,
): AlreadyUnderstoodItem[] {
  const facts = session.decision_context?.reality_facts ?? [];
  const dq = userFacingText(
    session.decision_context?.definition?.decision_question ??
      session.original_question ??
      "",
  ).toLowerCase();
  const out: AlreadyUnderstoodItem[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    if (f.verification_level !== "user_asserted") continue;
    if (f.status === "declined" || f.status === "unknown") continue;
    // Skip the raw full-question blob — discrete opening claims use fact_open_*.
    if ((f.fact_roles ?? []).includes("decision_question") && !f.fact_id.startsWith("fact_open_")) {
      continue;
    }
    if (f.fact_id.startsWith("fact_dq_")) continue;
    const label = userFacingText(f.statement);
    if (!label || seen.has(label)) continue;
    if (dq && label.toLowerCase() === dq) continue;
    seen.add(label);
    out.push({
      label,
      status: f.status === "confirmed" || f.user_confirmed ? "known" : "asserted",
    });
  }
  return out;
}

function mergeUnderstood(
  a: AlreadyUnderstoodItem[],
  b: AlreadyUnderstoodItem[],
): AlreadyUnderstoodItem[] {
  const byLabel = new Map<string, AlreadyUnderstoodItem>();
  for (const item of [...a, ...b]) {
    const key = item.label.toLowerCase();
    const prev = byLabel.get(key);
    if (!prev) {
      byLabel.set(key, item);
      continue;
    }
    byLabel.set(key, {
      label: prev.label,
      status:
        prev.status === "known" || item.status === "known"
          ? "known"
          : prev.status === "n_a" || item.status === "n_a"
            ? "n_a"
            : "asserted",
    });
  }
  return [...byLabel.values()];
}

export function projectAdaptiveQuestionForUi(
  session: POJUSessionState,
): AdaptiveQuestionUiProjection {
  const u = session.decision_understanding;
  const plan = session.adaptive_ask_plan ?? u?.next_question_plan ?? null;
  const dc = session.decision_context;
  const directionByDir = new Map((session.decision_blueprint?.directions ?? []).flatMap((d) =>
    d.dir_ids.map((id) => [id, { priority: d.priority, direction_id: d.direction_id }] as const),
  ));
  const understoodItems = mergeUnderstood(
    projectAlreadyUnderstoodItems(u?.understood.items),
    projectUserAssertedFacts(session),
  );
  return {
    current_question:
      u?.last_sent_question?.question_text ?? plan?.question_text ?? null,
    understanding_summary: u?.current_understanding.summary ?? null,
    understood_labels: understoodItems.map((item) => item.label),
    need_labels: (u?.need_to_understand.items ?? [])
      .map((i) => sanitizeNeedLabel(i.kind === "dir_based" ? i.missing_content : i.why))
      .filter(Boolean),
    personal_pattern_status: u?.personal_pattern_insight.status ?? null,
    readiness_verdict: u?.readiness.verdict ?? null,
    budget_asked: u?.budget.session_asked_count ?? null,
    budget_hard: u?.budget.hard_budget_limit ?? null,
    plan_direction_id: plan?.direction_id ?? null,
    plan_dir_ids: plan?.dir_ids ?? [],
    investigation_directions: (session.decision_blueprint?.directions ?? []).map((d) => ({
      direction_id: d.direction_id, label: d.label, priority: d.priority, dir_ids: d.dir_ids,
    })),
    dir_states: (dc?.dirs ?? []).filter((d) => d.id_lifecycle === "active").map((d) => ({
      dir_id: d.dir_id, need: d.need, state: d.current_state, priority: directionByDir.get(d.dir_id)?.priority ?? "P2",
      may_affect_ranking: d.may_affect_p5_ranking ?? false,
    })),
    open_conflicts: (dc?.conflicts ?? []).filter((c) => c.state !== "clarified").map((c) => ({
      conflict_id: c.conflict_id, field: c.conflict_field, statements: c.statements_snapshot,
    })),
    readiness_reasons: u?.readiness.reasons ?? [],
    readiness_can_ask: u?.readiness.can_ask ?? null,
    budget_remaining: u?.budget.remaining_hard_budget ?? null,
    need_details: (u?.need_to_understand.items ?? [])
      .map((i) => ({
        label: sanitizeNeedLabel(i.kind === "dir_based" ? i.missing_content : i.why),
        priority: i.priority,
        direction_id: i.kind === "dir_based" ? i.direction_id : null,
        gap_type: i.gap_type,
      }))
      .filter((i) => Boolean(i.label)),
    personal_pattern_insights: u?.personal_pattern_insight.insights ?? [],
    readiness_progress_percent: u?.readiness_progress?.percent ?? null,
    readiness_progress_complete: u?.readiness_progress?.complete ?? null,
  };
}
export type DecisionUnderstandingBoxView = {
  progress_percent: number | null;
  progress_complete: boolean;
  current_understanding: string | null;
  already_understood: AlreadyUnderstoodItem[];
  still_need: string[];
  conflicts: string[];
  personal_pattern_insights: string[];
  show_personal_pattern: boolean;
  current_question: string | null;
};

/**
 * User-facing 7.2 box projection. No DIR / DDR / field IDs or debug labels.
 * Progress is never 100% until completion conditions are met.
 * Hide percent when Fresh and no asserted/known progress yet (avoid fake 0%).
 */
export function projectDecisionUnderstandingBox(
  session: POJUSessionState,
): DecisionUnderstandingBoxView {
  const ui = projectAdaptiveQuestionForUi(session);
  const complete = ui.readiness_progress_complete === true;
  let percent = ui.readiness_progress_percent;
  const already = mergeUnderstood(
    projectAlreadyUnderstoodItems(session.decision_understanding?.understood.items),
    projectUserAssertedFacts(session),
  );
  const investigationStarted =
    already.length > 0 ||
    (session.decision_context?.dirs ?? []).some(
      (d) => d.current_state === "known" || d.current_state === "n_a",
    );
  if (percent != null && Number.isFinite(percent)) {
    percent = complete ? 100 : Math.min(99, Math.max(0, Math.round(percent)));
    // Misleading Fresh 0% with no asserted/known content → hide.
    if (!investigationStarted && percent === 0) percent = null;
  } else {
    percent = null;
  }
  const stillNeed = Array.from(
    new Set(ui.need_labels.map(sanitizeNeedLabel).filter(Boolean)),
  );
  // Drop need labels that duplicate already-understood wording.
  const understoodSet = new Set(already.map((i) => i.label.toLowerCase()));
  const stillNeedFiltered = stillNeed.filter(
    (label) => !understoodSet.has(label.toLowerCase()),
  );
  const conflicts = ui.open_conflicts
    .map((c) => userFacingText(c.statements.filter(Boolean).join(" \u2194 ")))
    .filter((text) => text && !stillNeedFiltered.includes(text));
  const insights =
    ui.personal_pattern_status === "available"
      ? ui.personal_pattern_insights.map((item) => userFacingText(item.text)).filter(Boolean)
      : [];
  return {
    progress_percent: percent,
    progress_complete: complete,
    current_understanding: userFacingText(ui.understanding_summary) || null,
    already_understood: already,
    still_need: stillNeedFiltered,
    conflicts,
    personal_pattern_insights: insights,
    show_personal_pattern: insights.length > 0,
    current_question: userFacingText(ui.current_question) || null,
  };
}

/**
 * Freeze the user-facing Understanding box onto the latest user turn so the
 * chat transcript can show one box per Q&A (not a single docked panel).
 */
export function stampDecisionUnderstandingBoxOnLastUser(
  session: POJUSessionState,
): POJUSessionState {
  if (!session.decision_understanding) return session;
  const box = projectDecisionUnderstandingBox(session);
  const messages = session.messages.slice();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || m.role !== "user" || m.is_rejected) continue;
    messages[i] = {
      ...m,
      meta: {
        ...m.meta,
        decision_understanding_box: box,
      },
    };
    return { ...session, messages };
  }
  return session;
}
