/**
 * M2.4-R2-FU2 — pending answer resolution and deterministic role clarification.
 * Scheduling state only. Never a second Decision Context or fact source.
 * Clarification questions are generated deterministically (no new LLM call).
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  ModelAnswerDraft,
  PendingAnswerResolution,
  UnresolvedAnswerItem,
  UnresolvedAnswerReason,
} from "./types";
import { answerEventFromModelDraft } from "./answer-interpretation";

export const ROLE_BINDING_UNRESOLVED_REASONS: readonly UnresolvedAnswerReason[] = [
  "unlocated_role_code",
  "unauthorized_role_code",
  "illegal_role_code",
] as const;

const ROLE_CODE_RE = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/;

const UNCLEAR_RE =
  /^(不确定|不知道|不清楚|不了解|没印象|无法确定|没法确定|说不清|暂时不确定|unsure|no\s*idea|i\s*don'?t\s*know)([!。！?\s]|$)/i;
const REFUSED_RE =
  /^(不想说|不愿回答|不想回答|跳过|拒绝澄清|不想澄清|skip|decline|prefer\s*not|no\s*comment)([!。！?\s]|$)/i;

export function isRoleBindingReason(reason: UnresolvedAnswerReason): boolean {
  return (ROLE_BINDING_UNRESOLVED_REASONS as readonly string[]).includes(reason);
}

export function roleBindingUnresolvedItems(
  items: UnresolvedAnswerItem[] | undefined | null,
): UnresolvedAnswerItem[] {
  if (!items || items.length === 0) return [];
  return items.filter((item) => isRoleBindingReason(item.reason));
}

export type RoleChoiceParse =
  | { ok: true; role_code: string }
  | { ok: false; reason: "unclear" | "refused" | "unauthorized" };

export type AuthorizedRoleOption = {
  index: number;
  role_code: string;
  role: string;
  dir_id: string;
  need: string;
};

export function authorizedRoleOptions(
  session: POJUSessionState,
  codes: string[],
): AuthorizedRoleOption[] {
  const dc = session.decision_context;
  const out: AuthorizedRoleOption[] = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    const m = ROLE_CODE_RE.exec(code);
    if (!m) continue;
    const dir_id = m[1]!;
    const role = m[2]!;
    const need =
      dc?.dirs.find((d) => d.dir_id === dir_id)?.need?.trim() || dir_id;
    out.push({ index: i + 1, role_code: code, role, dir_id, need });
  }
  return out;
}

export function parseClarificationRoleChoice(
  statement: string,
  options: AuthorizedRoleOption[],
): RoleChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (UNCLEAR_RE.test(t) || t === "不确定" || t === "不知道" || t === "不清楚") {
    return { ok: false, reason: "unclear" };
  }
  if (REFUSED_RE.test(t) || t === "跳过" || t === "不想澄清") {
    return { ok: false, reason: "refused" };
  }

  const exactCodes = options.filter(
    (o) => t === o.role_code || t.includes(o.role_code),
  );
  if (exactCodes.length === 1) return { ok: true, role_code: exactCodes[0]!.role_code };
  if (exactCodes.length > 1) return { ok: false, reason: "unclear" };

  const numbered = /^([1-9]\d*)(?:[.、.)）]|\s|$)/.exec(t);
  if (numbered) {
    const n = Number(numbered[1]);
    const hit = options.find((o) => o.index === n);
    if (hit) return { ok: true, role_code: hit.role_code };
  }

  const roleHits = options.filter((o) => {
    if (!o.role) return false;
    if (t === o.role) return true;
    return t.includes(o.role);
  });
  if (roleHits.length === 1) return { ok: true, role_code: roleHits[0]!.role_code };
  if (roleHits.length > 1) return { ok: false, reason: "unclear" };

  const dirHits = options.filter((o) => t.includes(o.dir_id));
  if (dirHits.length === 1) return { ok: true, role_code: dirHits[0]!.role_code };
  if (dirHits.length > 1) return { ok: false, reason: "unclear" };

  const needHits = options.filter((o) => o.need.length >= 4 && t.includes(o.need));
  if (needHits.length === 1) return { ok: true, role_code: needHits[0]!.role_code };

  return { ok: false, reason: "unclear" };
}

export function buildRoleClarificationQuestionText(
  pending: PendingAnswerResolution,
  options: AuthorizedRoleOption[],
): string | null {
  if (options.length === 0) return null;
  const items = pending.unresolved_items.filter((i) => isRoleBindingReason(i.reason));
  if (items.length === 0) return null;
  const itemLines = items
    .map((item, i) => `${i + 1}. 「${item.text}」`)
    .join("\n");
  const roleLines = options
    .map(
      (o) =>
        `${o.index}. ${o.role} — ${o.need}（${o.dir_id}）`,
    )
    .join("\n");
  return [
    "刚才这条回答还不能对应到当前已授权的调查角色，因此尚未写入决策上下文。请明确下面的信息属于哪一项（请回复编号或角色名称）：",
    "",
    "待澄清信息：",
    itemLines,
    "",
    "可选角色（仅限当前已授权范围，不可扩大）：",
    roleLines,
    "",
    "如果暂时无法确定，请直接回复「不确定」。",
  ].join("\n");
}

/**
 * Deterministic clarification plan. Reuses a previously generated plan for the
 * same pending source_turn_id so replay does not recount budget.
 */
export function buildRoleClarificationPlan(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  now: string;
}): AdaptiveQuestionPlan | null {
  if (input.pending.clarification_plan) {
    return input.pending.clarification_plan;
  }
  const last = input.session.decision_understanding?.last_sent_question;
  if (!last || (last.dir_ids.length === 0 && last.ddr_ids.length === 0)) {
    return null;
  }
  const codes = [...input.pending.authorized_role_codes];
  const options = authorizedRoleOptions(input.session, codes);
  const question_text = buildRoleClarificationQuestionText(input.pending, options);
  if (!question_text) return null;

  const priorPlan =
    (input.session.adaptive_ask_plan &&
    input.session.adaptive_ask_plan.plan_id === last.plan_id
      ? input.session.adaptive_ask_plan
      : null) ??
    (input.session.decision_understanding?.next_question_plan &&
    input.session.decision_understanding.next_question_plan.plan_id === last.plan_id
      ? input.session.decision_understanding.next_question_plan
      : null);

  const plan_id = `qp_role_clarify_${input.pending.source_turn_id}`.slice(0, 120);
  const budget = input.session.decision_understanding?.budget;
  const dirId = last.dir_ids[0] ?? "";
  const depth = dirId ? (budget?.depth_by_dir[dirId] ?? 0) + 1 : priorPlan?.depth ?? 1;

  return {
    plan_id,
    candidate_id: `cq_role_clarify_${input.pending.source_turn_id}`.slice(0, 120),
    direction_id: last.direction_id,
    ddr_ids: [...last.ddr_ids],
    dir_ids: [...last.dir_ids],
    fact_role_codes: [...codes],
    missing_info: "role_binding_unresolved",
    decision_value: priorPlan?.decision_value ?? "supporting",
    ask_now_reason: "pending_answer_resolution_role_clarification",
    expected_info: "请明确这条信息对应的已授权调查角色",
    depth,
    budget_cost: 1,
    remaining_hard_budget: budget?.remaining_hard_budget ?? priorPlan?.remaining_hard_budget ?? 0,
    gate_class: priorPlan?.gate_class ?? "P0",
    scope_boundary:
      priorPlan?.scope_boundary ??
      "Only currently authorized roles of the actually-sent question; no Blueprint expansion",
    rationale: "Deterministic role clarification for unresolved role binding",
    question_text,
    built_at: input.now,
    scoring_path: "pending_answer_resolution→deterministic_role_clarification",
    conflict_clarification: null,
  };
}

export function pendingFromAnswerEvent(input: {
  session: POJUSessionState;
  event: AnswerEvent;
  statement: string;
  now: string;
}): PendingAnswerResolution | null {
  const items = roleBindingUnresolvedItems(eventUnresolved(input.event));
  if (items.length === 0) return null;
  const last = input.session.decision_understanding?.last_sent_question;
  const authorized =
    items[0]?.authorized_role_codes.length
      ? [...items[0]!.authorized_role_codes]
      : [...(last?.fact_role_codes ?? [])];
  const sent_question_id = last?.plan_id ?? items[0]?.sent_question_id ?? "";
  const seed: PendingAnswerResolution = {
    status: "pending",
    source_turn_id: input.event.client_turn_id,
    original_statement: input.statement.slice(0, 2000),
    original_classification: input.event.classification,
    unresolved_items: items,
    authorized_role_codes: authorized,
    sent_question_id,
    clarification_plan: null,
    clarification_plan_id: null,
  };
  const plan = buildRoleClarificationPlan({
    session: input.session,
    pending: seed,
    now: input.now,
  });
  if (!plan) return { ...seed };
  return {
    ...seed,
    clarification_plan: plan,
    clarification_plan_id: plan.plan_id,
  };
}

function eventUnresolved(event: AnswerEvent): UnresolvedAnswerItem[] {
  return event.unresolved_items ?? [];
}

/** Merge new role-binding unresolved items into an existing pending task (same source only). */
export function mergePendingResolution(
  existing: PendingAnswerResolution | null | undefined,
  incoming: PendingAnswerResolution,
): PendingAnswerResolution {
  if (!existing || existing.source_turn_id !== incoming.source_turn_id) {
    return incoming;
  }
  const seen = new Set(
    existing.unresolved_items.map((i) => `${i.reason}|${i.text}|${i.semantic_kind}`),
  );
  const mergedItems = [...existing.unresolved_items];
  for (const item of incoming.unresolved_items) {
    const key = `${item.reason}|${item.text}|${item.semantic_kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      mergedItems.push(item);
    }
  }
  return {
    ...existing,
    unresolved_items: mergedItems,
    clarification_plan: existing.clarification_plan ?? incoming.clarification_plan,
    clarification_plan_id:
      existing.clarification_plan_id ?? incoming.clarification_plan_id,
  };
}

export function withPendingAnswerResolution(
  session: POJUSessionState,
  pending: PendingAnswerResolution | null,
): POJUSessionState {
  return { ...session, pending_answer_resolution: pending };
}

export function answerEventFromPendingBind(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  chosen_role_code: string;
}): AnswerEvent {
  const draft: ModelAnswerDraft = {
    classification:
      input.pending.original_classification === "invalid_input"
        ? "clear_answer"
        : (input.pending.original_classification as ModelAnswerDraft["classification"]),
    extracted_items: input.pending.unresolved_items
      .filter((item) => isRoleBindingReason(item.reason))
      .map((item) => ({
        text: item.text,
        semantic_kind: item.semantic_kind,
        role_hint: null,
        role_code_hint: input.chosen_role_code,
        certainty: item.certainty,
      })),
    unresolved_aspects: [],
    explanation: "pending_answer_resolution_bind",
  };
  return answerEventFromModelDraft({
    session: input.session,
    statement: input.pending.original_statement,
    source_turn_id: input.pending.source_turn_id,
    draft,
  });
}

export function persistKeyForPendingBind(
  sessionId: string,
  sourceTurnId: string,
  alreadyHasWritesFromTurn: boolean,
): string {
  if (alreadyHasWritesFromTurn) {
    return `dc_collect:${sessionId}:${sourceTurnId}:role_resolve`;
  }
  return `dc_collect:${sessionId}:${sourceTurnId}`;
}
