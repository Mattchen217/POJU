/**
 * M2.4-R2 — scheduling/control metadata for unresolved model aspects,
 * goal_change confirmation, and insight_mismatch clarification.
 *
 * This is not a second Decision Context or fact store and never widens
 * authorized DIRs or confirmation authority. A goal_change is applied only
 * after explicit user confirmation, through the formal Blueprint update entry
 * (goal-change-blueprint-update.ts); this module never mutates Blueprint.
 * Items from several source turns queue here; none is silently dropped.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { LONG_ANSWER_ASPECT_TEXT } from "./answer-interpretation";
import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  IntakeControlItem,
  PendingIntakeControl,
} from "./types";

/** Uncertain follow-up replies allowed per control item before it closes. */
export const CONTROL_ITEM_MAX_UNCERTAIN_ATTEMPTS = 2;

const POLARITY_BLOCK_RE =
  /并非|并不|不能|不可|不要|拒绝|反对|否定|排除|[不没未无非]/;
const UNCERTAIN_RE =
  /目前无法确定|暂时无法确定|无法确定|没法确定|不确定|不明确|不清楚|不知道|说不清|暂时不确定|再想想|还没想好|unsure|maybe|perhaps/i;
const GOAL_CONFIRM_RE =
  /确认更换|确认修改|确认改|同意更换|同意修改|可以更换|更换决策目标|改决策目标|yes|confirm/i;
const GOAL_DECLINE_RE =
  /保持原来|维持原|不改|不要改|拒绝更换|不用改|仍用原来|还是原来|不更换/;

export type GoalChangeChoice = "confirm" | "decline" | "uncertain";

export function isActivePendingIntakeControl(
  control: PendingIntakeControl | null | undefined,
): boolean {
  if (!control || control.status !== "pending") return false;
  return control.items.some(
    (item) => item.status === "pending" || item.status === "uncertain",
  );
}

export function withPendingIntakeControl(
  session: POJUSessionState,
  control: PendingIntakeControl | null,
): POJUSessionState {
  return { ...session, pending_intake_control: control };
}

export function nextPendingControlItem(
  control: PendingIntakeControl,
): IntakeControlItem | null {
  if (control.resolving_item_id) {
    const current = control.items.find(
      (item) =>
        item.item_id === control.resolving_item_id &&
        (item.status === "pending" || item.status === "uncertain"),
    );
    if (current) return current;
  }
  return (
    control.items.find(
      (item) => item.status === "pending" || item.status === "uncertain",
    ) ?? null
  );
}

export function originalDecisionTargetOf(
  session: POJUSessionState,
): string | null {
  return (
    session.decision_context?.definition?.decision_question ??
    session.decision_blueprint?.decision_question ??
    session.original_question ??
    null
  );
}

export function parseGoalChangeConfirmation(statement: string): GoalChangeChoice {
  const t = statement.trim();
  if (!t) return "uncertain";
  const numbered = /^([1-9]\d*)(?:[.、.)）]|\s|$)/.exec(t);
  if (numbered) {
    const rest = t.slice(numbered[0].length).trim();
    const n = Number(numbered[1]);
    if (rest && UNCERTAIN_RE.test(rest)) return "uncertain";
    if (n === 1 && rest && POLARITY_BLOCK_RE.test(rest)) return "uncertain";
    if (n === 1 && (!rest || !POLARITY_BLOCK_RE.test(rest))) return "confirm";
    if (n === 2) return "decline";
  }
  if (UNCERTAIN_RE.test(t)) return "uncertain";
  if (GOAL_DECLINE_RE.test(t)) return "decline";
  if (POLARITY_BLOCK_RE.test(t)) return "uncertain";
  if (GOAL_CONFIRM_RE.test(t) || /^(确认|是的|是|同意)$/u.test(t)) {
    return "confirm";
  }
  return "uncertain";
}

export function isControlClarificationUncertain(statement: string): boolean {
  const t = statement.trim();
  if (!t || t.length < 2) return true;
  return (
    /^(不知道|不清楚|不了解|没印象|不确定)$/u.test(t) || UNCERTAIN_RE.test(t)
  );
}

export function hasResolvedProposedDecisionTarget(
  item: IntakeControlItem,
): boolean {
  return Boolean(item.proposed_decision_target?.trim());
}

function questionTextForItem(
  item: IntakeControlItem,
  originalTarget: string | null,
): string {
  if (item.kind === "goal_change") {
    const current = originalTarget?.trim() || "（当前目标未单独记录）";
    if (!hasResolvedProposedDecisionTarget(item)) {
      return [
        "你提出要更换决策目标，但还没有给出可核对的新目标原文。",
        "",
        `当前决策目标仍是：「${current}」`,
        "",
        "请直接重述你建议的新决策目标，使用你自己的原话，不要用转述或推断。",
        "",
        "在明确新目标之前，系统不会询问是否确认更换，也不会修改调查蓝图或决策定义。",
      ].join("\n");
    }
    const proposed = item.proposed_decision_target!.trim();
    return [
      "你提出将决策目标改为以下内容：",
      "",
      `「${proposed}」`,
      "",
      `当前决策目标仍是：「${current}」`,
      "",
      "是否确认更换当前决策目标？确认后会按新目标更新调查蓝图（旧版本保留在历史记录中），并重新规划接下来的问题；不确认则保持原目标不变。",
      "",
      "1. 确认更换决策目标",
      "2. 保持原来的决策目标",
    ].join("\n");
  }
  if (item.kind === "insight_mismatch") {
    return [
      "你提到当前理解或分析与你的实际情况不一致：",
      "",
      `「${item.text}」`,
      "",
      "请具体说明哪些地方不一致，或补充需要纠正的内容。在澄清之前，系统不会把模型推断写成事实，也不会自动修改调查蓝图。",
    ].join("\n");
  }
  if (item.text === LONG_ANSWER_ASPECT_TEXT) {
    return `${LONG_ANSWER_ASPECT_TEXT}。这次的回答尚未写入决策上下文。`;
  }
  return `关于「${item.text}」，刚才的回答还不够明确。请补充说明这一点。`;
}

export function controlSourceTurnIds(control: PendingIntakeControl): string[] {
  const ids = new Set<string>([control.source_turn_id, ...(control.source_turn_ids ?? [])]);
  for (const item of control.items) ids.add(item.source_turn_id);
  return [...ids].filter(Boolean);
}

/**
 * Record one uncertain follow-up for a control item. Below the bound it stays
 * "uncertain" (same plan re-presented); at the bound it becomes the terminal
 * "closed_uncertain" and is never asked again.
 */
export function recordUncertainControlAttempt(
  control: PendingIntakeControl,
  item: IntakeControlItem,
): { control: PendingIntakeControl; terminal: boolean } {
  const attempts = (item.attempts ?? 0) + 1;
  const terminal = attempts >= CONTROL_ITEM_MAX_UNCERTAIN_ATTEMPTS;
  const items = control.items.map((row) =>
    row.item_id === item.item_id
      ? { ...row, attempts, status: terminal ? ("closed_uncertain" as const) : ("uncertain" as const) }
      : row,
  );
  return { control: { ...control, items }, terminal };
}

function planIdForItem(control: PendingIntakeControl, item: IntakeControlItem): string {
  const stage =
    item.kind === "goal_change" && !hasResolvedProposedDecisionTarget(item)
      ? "goal_change_restate"
      : item.kind;
  return `qp_intake_control_${stage}_${control.source_turn_id}_${item.item_id}`.slice(
    0,
    120,
  );
}

export function buildIntakeControlPlan(input: {
  session: POJUSessionState;
  control: PendingIntakeControl;
  now: string;
  item?: IntakeControlItem | null;
}): AdaptiveQuestionPlan | null {
  const item = input.item ?? nextPendingControlItem(input.control);
  if (!item) return null;
  const expectedId = planIdForItem(input.control, item);
  if (
    input.control.clarification_plan &&
    input.control.clarification_plan.plan_id === expectedId
  ) {
    return input.control.clarification_plan;
  }
  const last = input.session.decision_understanding?.last_sent_question;
  const sibling = input.control.items.find(
    (other) => other.source_turn_id === item.source_turn_id && other.authorized_dir_ids.length > 0,
  );
  const dirIds =
    item.authorized_dir_ids.length > 0
      ? [...item.authorized_dir_ids]
      : sibling
        ? [...sibling.authorized_dir_ids]
        : last
          ? [...last.dir_ids]
          : [];
  const ddrIds = last ? [...last.ddr_ids] : [];
  if (dirIds.length === 0 && ddrIds.length === 0) {
    return null;
  }
  const codes =
    item.authorized_role_codes.length > 0
      ? [...item.authorized_role_codes]
      : last?.fact_role_codes
        ? [...last.fact_role_codes]
        : [];
  const budget = input.session.decision_understanding?.budget;
  return {
    plan_id: expectedId,
    candidate_id: `cq_intake_control_${item.kind}_${input.control.source_turn_id}_${item.item_id}`.slice(
      0,
      120,
    ),
    direction_id: last?.direction_id ?? "",
    ddr_ids: ddrIds,
    dir_ids: dirIds,
    fact_role_codes: [...codes],
    missing_info: item.kind,
    decision_value: "supporting",
    ask_now_reason:
      item.kind === "goal_change" && !hasResolvedProposedDecisionTarget(item)
        ? "pending_intake_control_goal_change_restate"
        : `pending_intake_control_${item.kind}`,
    expected_info:
      item.kind === "goal_change"
        ? hasResolvedProposedDecisionTarget(item)
          ? "请确认是否更换决策目标"
          : "请重述建议的新决策目标"
        : "请澄清当前未决项",
    depth: 0,
    // Confirming the user's own target change is not an investigation question.
    budget_cost: item.kind === "goal_change" ? 0 : 1,
    remaining_hard_budget: budget?.remaining_hard_budget ?? 0,
    gate_class: "P0",
    scope_boundary:
      "Only currently authorized roles and DIRs of the actually-sent question; no Blueprint expansion",
    rationale: `Deterministic intake-control follow-up for ${item.kind}`,
    question_text: questionTextForItem(
      item,
      input.control.original_decision_target ?? originalDecisionTargetOf(input.session),
    ),
    built_at: input.now,
    scoring_path: `pending_intake_control→deterministic_${item.kind}`,
    conflict_clarification: null,
  };
}

export function isIntakeControlPlan(plan: AdaptiveQuestionPlan | null | undefined): boolean {
  if (!plan) return false;
  return (
    String(plan.ask_now_reason ?? "").includes("pending_intake_control") ||
    String(plan.scoring_path ?? "").includes("pending_intake_control")
  );
}

export function controlFromAnswerEvent(input: {
  session: POJUSessionState;
  event: AnswerEvent;
  statement: string;
  now: string;
}): PendingIntakeControl | null {
  const items = (input.event.control_items ?? []).filter(
    (item) => item.text.trim().length > 0,
  );
  if (items.length === 0) return null;
  const original_decision_target = originalDecisionTargetOf(input.session);
  const resolving = items[0]!;
  const seed: PendingIntakeControl = {
    status: "pending",
    source_turn_id: input.event.client_turn_id,
    original_statement: input.statement.slice(0, 2000),
    original_classification: input.event.classification,
    items: items.map((item) => ({ ...item, status: "pending" })),
    clarification_plan: null,
    clarification_plan_id: null,
    resolving_item_id: resolving.item_id,
    entered_controlled_blueprint_update: false,
    original_decision_target,
    last_resolved_turn_id: null,
  };
  const plan = buildIntakeControlPlan({
    session: input.session,
    control: seed,
    now: input.now,
    item: resolving,
  });
  if (!plan) return seed;
  return {
    ...seed,
    clarification_plan: plan,
    clarification_plan_id: plan.plan_id,
  };
}

const aspectKey = (text: string) => text.replace(/[\s「」『』"“”'‘’。，,.!！?？]/gu, "");

export function mergeIntakeControl(
  existing: PendingIntakeControl | null | undefined,
  incomingRaw: PendingIntakeControl,
): PendingIntakeControl {
  // An aspect already queued or handled in this control is never queued again.
  const knownAspects = new Set(
    (existing?.items ?? [])
      .filter((item) => item.kind === "unresolved_aspect")
      .map((item) => aspectKey(item.text)),
  );
  const incomingItems = incomingRaw.items.filter((item) => {
    if (item.kind !== "unresolved_aspect") return true;
    const key = aspectKey(item.text);
    if (knownAspects.has(key)) return false;
    knownAspects.add(key);
    return true;
  });
  const incoming: PendingIntakeControl =
    incomingItems.length === incomingRaw.items.length
      ? incomingRaw
      : { ...incomingRaw, items: incomingItems };
  if (!existing || !isActivePendingIntakeControl(existing)) {
    if (!existing) return incoming;
    if (incoming.items.length === 0) return existing;
    const incomingIds = new Set(incoming.items.map((item) => item.item_id));
    const handled = existing.items.filter(
      (item) =>
        item.status !== "pending" && item.status !== "uncertain" && !incomingIds.has(item.item_id),
    );
    return {
      ...incoming,
      items: [...handled, ...incoming.items],
      ...(existing.resolution_records?.length
        ? { resolution_records: [...existing.resolution_records] }
        : {}),
    };
  }
  if (existing.source_turn_id !== incoming.source_turn_id) {
    // Queue behind the active item; never drop a later turn's control items.
    const seen = new Set(existing.items.map((item) => item.item_id));
    return {
      ...existing,
      status: "pending",
      items: [...existing.items, ...incoming.items.filter((item) => !seen.has(item.item_id))],
      source_turn_ids: [
        ...new Set([...controlSourceTurnIds(existing), incoming.source_turn_id]),
      ],
    };
  }
  const seen = new Set(existing.items.map((item) => item.item_id));
  const items = [...existing.items];
  for (const item of incoming.items) {
    if (!seen.has(item.item_id)) {
      seen.add(item.item_id);
      items.push(item);
    }
  }
  const resolving =
    (existing.resolving_item_id &&
      items.find(
        (item) =>
          item.item_id === existing.resolving_item_id &&
          (item.status === "pending" || item.status === "uncertain"),
      )) ||
    items.find((item) => item.status === "pending" || item.status === "uncertain") ||
    null;
  return {
    ...existing,
    items,
    resolving_item_id: resolving?.item_id ?? existing.resolving_item_id,
    clarification_plan: existing.clarification_plan ?? incoming.clarification_plan,
    clarification_plan_id:
      existing.clarification_plan_id ?? incoming.clarification_plan_id,
    status: resolving ? "pending" : existing.status,
  };
}

export function attachIntakeControlFromEvent(
  session: POJUSessionState,
  event: AnswerEvent,
  statement: string,
  now: string,
): POJUSessionState {
  const incoming = controlFromAnswerEvent({ session, event, statement, now });
  if (!incoming) return session;
  const existing = session.pending_intake_control;
  const merged = mergeIntakeControl(existing, incoming);
  const resolving = nextPendingControlItem(merged);
  const plan =
    (merged.clarification_plan &&
    resolving &&
    merged.resolving_item_id === resolving.item_id
      ? merged.clarification_plan
      : null) ??
    buildIntakeControlPlan({ session, control: merged, now, item: resolving });
  const control: PendingIntakeControl = plan
    ? {
        ...merged,
        clarification_plan: plan,
        clarification_plan_id: plan.plan_id,
        resolving_item_id: resolving?.item_id ?? merged.resolving_item_id,
      }
    : merged;
  return withPendingIntakeControl(session, control);
}

export function updateControlItemStatus(
  control: PendingIntakeControl,
  itemId: string,
  status: IntakeControlItem["status"],
  extras?: Partial<PendingIntakeControl>,
): PendingIntakeControl {
  const items = control.items.map((item) =>
    item.item_id === itemId ? { ...item, status } : item,
  );
  const next = {
    ...control,
    ...extras,
    items,
  };
  const resolving = nextPendingControlItem(next);
  const stillPending = Boolean(resolving);
  return {
    ...next,
    status: stillPending ? "pending" : "resolved",
    resolving_item_id: resolving?.item_id ?? null,
    clarification_plan: stillPending ? next.clarification_plan : null,
    clarification_plan_id: stillPending ? next.clarification_plan_id : null,
  };
}

export function controlWithPlan(
  session: POJUSessionState,
  control: PendingIntakeControl,
  now: string,
  item?: IntakeControlItem | null,
): PendingIntakeControl {
  const resolving = item ?? nextPendingControlItem(control);
  if (!resolving) {
    return {
      ...control,
      status: "resolved",
      clarification_plan: null,
      clarification_plan_id: null,
      resolving_item_id: null,
    };
  }
  const plan = buildIntakeControlPlan({
    session,
    control,
    now,
    item: resolving,
  });
  return {
    ...control,
    status: "pending",
    resolving_item_id: resolving.item_id,
    clarification_plan: plan,
    clarification_plan_id: plan?.plan_id ?? null,
  };
}
