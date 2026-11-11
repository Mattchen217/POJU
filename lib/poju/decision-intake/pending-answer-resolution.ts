/**
 * M2.4-R2-FU3 — pending answer resolution and deterministic clarification.
 * Scheduling state only. Never a second Decision Context or fact source.
 * Clarification questions are generated deterministically (no new LLM call).
 * Each clarification turn resolves exactly one pending item by stable item_id.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  ModelAnswerDraft,
  PendingAnswerResolution,
  PendingRejectedItem,
  UnresolvedAnswerItem,
  UnresolvedAnswerReason,
} from "./types";
import {
  answerEventFromModelDraft,
  unresolvedItemId,
} from "./answer-interpretation";

export { unresolvedItemId };

export const ROLE_BINDING_UNRESOLVED_REASONS: readonly UnresolvedAnswerReason[] = [
  "unlocated_role_code",
  "unauthorized_role_code",
  "illegal_role_code",
] as const;

export const CONTINUABLE_UNRESOLVED_REASONS: readonly UnresolvedAnswerReason[] = [
  "unlocated_role_code",
  "unauthorized_role_code",
  "illegal_role_code",
  "unclear_certainty",
  "estimated_constraint_not_persistable",
  "definition_patch_not_persistable",
] as const;

const ROLE_CODE_RE = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/;

const UNCLEAR_RE =
  /^(不确定|不知道|不清楚|不了解|没印象|无法确定|没法确定|说不清|暂时不确定|目前无法确定|unsure|no\s*idea|i\s*don'?t\s*know)([!。！?\s]|$)/i;
const REFUSED_RE =
  /^(不想说|不愿回答|不想回答|跳过|拒绝澄清|不想澄清|暂时不处理|拒绝处理|skip|decline|prefer\s*not|no\s*comment)([!。！?\s]|$)/i;

export function isRoleBindingReason(reason: UnresolvedAnswerReason): boolean {
  return (ROLE_BINDING_UNRESOLVED_REASONS as readonly string[]).includes(reason);
}

export function isContinuableUnresolvedReason(
  reason: UnresolvedAnswerReason,
): boolean {
  return (CONTINUABLE_UNRESOLVED_REASONS as readonly string[]).includes(reason);
}

export function roleBindingUnresolvedItems(
  items: UnresolvedAnswerItem[] | undefined | null,
): UnresolvedAnswerItem[] {
  if (!items || items.length === 0) return [];
  return items.filter((item) => isRoleBindingReason(item.reason));
}

export function continuableUnresolvedItems(
  items: UnresolvedAnswerItem[] | undefined | null,
): UnresolvedAnswerItem[] {
  if (!items || items.length === 0) return [];
  return items.filter((item) => isContinuableUnresolvedReason(item.reason));
}

export function ensureUnresolvedItemId(
  item: UnresolvedAnswerItem,
  index: number,
): UnresolvedAnswerItem {
  if (item.item_id && item.item_id.trim()) return item;
  return {
    ...item,
    item_id: unresolvedItemId(item.source_turn_id, index),
  };
}

export function normalizePendingItems(
  items: UnresolvedAnswerItem[] | undefined | null,
): UnresolvedAnswerItem[] {
  return (items ?? []).map((item, index) => ensureUnresolvedItemId(item, index));
}

export function nextResolvingItem(
  pending: PendingAnswerResolution,
): UnresolvedAnswerItem | null {
  const items = normalizePendingItems(pending.unresolved_items);
  if (pending.resolving_item_id) {
    const hit = items.find((item) => item.item_id === pending.resolving_item_id);
    if (hit) return hit;
  }
  return items[0] ?? null;
}

export type RoleChoiceParse =
  | { ok: true; role_code: string }
  | { ok: false; reason: "unclear" | "refused" | "unauthorized" };

export type CertaintyChoiceParse =
  | { ok: true; certainty: "explicit" | "estimated" | "unclear" }
  | { ok: false; reason: "unclear" | "refused" };

export type ConstraintConfirmParse =
  | { ok: true; confirmed: boolean; still_uncertain: boolean }
  | { ok: false; reason: "unclear" | "refused" };

export type DefinitionPatchChoiceParse =
  | { ok: true; as_fact: boolean }
  | { ok: false; reason: "unclear" | "refused" };

export type AuthorizedRoleOption = {
  index: number;
  role_code: string;
  role: string;
  dir_id: string;
  need: string;
  aliases: string[];
};

export function isActivePendingAnswerResolution(
  pending: PendingAnswerResolution | null | undefined,
): boolean {
  if (!pending) return false;
  if (pending.status !== "pending") return false;
  return normalizePendingItems(pending.unresolved_items).length > 0;
}

export function asTerminalRejectedPending(
  pending: PendingAnswerResolution,
): PendingAnswerResolution {
  return {
    ...pending,
    status: "rejected",
    unresolved_items: [],
    clarification_plan: null,
    clarification_plan_id: null,
    resolving_item_id: null,
  };
}

export function isPendingClarificationPlan(
  plan: AdaptiveQuestionPlan | null | undefined,
): boolean {
  if (!plan) return false;
  return (
    String(plan.ask_now_reason ?? "").includes("pending_answer_resolution") ||
    String(plan.scoring_path ?? "").includes("pending_answer_resolution") ||
    /(?:^|_)clarify(?:_|$)/.test(plan.plan_id) ||
    plan.plan_id.startsWith("qp_role_clarify") ||
    plan.plan_id.startsWith("qp_certainty_clarify") ||
    plan.plan_id.startsWith("qp_constraint_clarify") ||
    plan.plan_id.startsWith("qp_defpatch_clarify")
  );
}

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
    const aliases: string[] = [];
    if (isWorkRelatedOption(role, dir_id, need)) aliases.push("工作角色");
    out.push({ index: i + 1, role_code: code, role, dir_id, need, aliases });
  }
  return out;
}

export function isClarificationRefusal(statement: string): boolean {
  const t = statement.trim();
  if (!t) return false;
  if (REFUSED_RE.test(t) || t === "跳过" || t === "不想澄清" || t === "拒绝澄清") {
    return true;
  }
  return false;
}

const CLAUSE_SPLIT_RE = /而是|但是|不过|可是|但|,|，|。|;|；|！|!|？|\?/;

const NEGATION_CUES_RE =
  /不能确认|无法确认|不可以|不能写入|不可写入|不要写入|不确认|不认为|不觉得|不认可|不确定|不明确|不选|不是|并不|并非|没有|不对|排除|否定|未必/;

const UNCERTAINTY_CUES_RE =
  /目前无法确定|暂时无法确定|无法确定|没法确定|不确定|不明确|不清楚|不知道|说不清|暂时不确定|unsure|no\s*idea|i\s*don'?t\s*know/i;

const HEDGE_CUES_RE =
  /我不确定是不是|不确定是不是|是不是|可能|也许|大概|好像|似乎|不一定|不好说|不太确定/;

function isWorkRelatedOption(role: string, dir_id: string, need: string): boolean {
  return /工作|在职|status_quo|STATUS-QUO/i.test(`${role} ${dir_id} ${need}`);
}

function splitClauses(text: string): string[] {
  const parts = text
    .split(CLAUSE_SPLIT_RE)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function standaloneNumber(statement: string): number | null {
  const t = statement.trim();
  const numbered = /^([1-9]\d*)(?:[.、.)）]|\s|$)/.exec(t);
  if (!numbered) return null;
  const rest = t.slice(numbered[0].length).trim();
  if (rest && (NEGATION_CUES_RE.test(rest) || UNCERTAINTY_CUES_RE.test(rest) || HEDGE_CUES_RE.test(rest))) {
    return null;
  }
  return Number(numbered[1]);
}

function hasExplicitCertaintyNegation(t: string): boolean {
  return (
    /不明确/.test(t) ||
    /不认为.{0,16}明确/.test(t) ||
    /不觉得.{0,16}明确/.test(t) ||
    /不是明确/.test(t) ||
    /并非明确/.test(t) ||
    /并不明确/.test(t) ||
    /算不上明确/.test(t) ||
    /不算明确/.test(t)
  );
}

function hasUncertaintyExpression(t: string): boolean {
  return UNCERTAINTY_CUES_RE.test(t) || hasExplicitCertaintyNegation(t);
}

function hasEstimateExpression(t: string): boolean {
  return /(个人估计|仍然只是估计|仍然是估计|只是估计|还是估计|estimated|user_estimate)/i.test(
    t,
  );
}

function estimateNegated(t: string): boolean {
  return /不是.{0,8}估计|不认为.{0,10}估计|并非.{0,8}估计/.test(t);
}

function hasExplicitCertaintyAffirm(t: string): boolean {
  // Never treat a bare 明确 as affirmation — 不明确 would otherwise match.
  return /(明确事实|明确陈述|明确约束|这是明确|explicit|user_asserted)/i.test(t);
}

function confirmNegated(t: string): boolean {
  return (
    /不确认/.test(t) ||
    /不能确认/.test(t) ||
    /无法确认/.test(t) ||
    /不是明确约束/.test(t) ||
    /不是明确/.test(t) ||
    /不可以写入/.test(t) ||
    /不能写入/.test(t) ||
    /不可写入/.test(t) ||
    /不要写入/.test(t) ||
    /不许写入/.test(t)
  );
}

function hasConstraintConfirmAffirm(t: string): boolean {
  if (/^(确认|是的|yes)$/i.test(t.trim())) return true;
  return /(确认这是明确约束|确认为明确|改为明确|可以写入|确认这是明确)/.test(t);
}

function optionMentioned(fragment: string, option: AuthorizedRoleOption): boolean {
  if (!fragment) return false;
  if (fragment === option.role_code || fragment.includes(option.role_code)) return true;
  if (option.role && (fragment === option.role || fragment.includes(option.role))) {
    return true;
  }
  if (fragment.includes(option.dir_id)) return true;
  if (option.need.length >= 4 && fragment.includes(option.need)) return true;
  return option.aliases.some((alias) => alias.length > 0 && fragment.includes(alias));
}

export function parseClarificationRoleChoice(
  statement: string,
  options: AuthorizedRoleOption[],
): RoleChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };
  if (
    hasUncertaintyExpression(t) ||
    HEDGE_CUES_RE.test(t) ||
    t === "不确定" ||
    t === "不知道" ||
    t === "不清楚"
  ) {
    return { ok: false, reason: "unclear" };
  }

  const numbered = standaloneNumber(t);
  if (numbered != null) {
    const hit = options.find((o) => o.index === numbered);
    if (hit) return { ok: true, role_code: hit.role_code };
  }

  const exactCodes = options.filter(
    (o) => t === o.role_code || t.includes(o.role_code),
  );
  if (exactCodes.length === 1 && !NEGATION_CUES_RE.test(t)) {
    return { ok: true, role_code: exactCodes[0]!.role_code };
  }
  if (exactCodes.length > 1) return { ok: false, reason: "unclear" };

  const affirmed = new Set<string>();
  const negated = new Set<string>();
  for (const clause of splitClauses(t)) {
    const mentioned = options.filter((o) => optionMentioned(clause, o));
    if (NEGATION_CUES_RE.test(clause)) {
      for (const option of mentioned) negated.add(option.role_code);
      continue;
    }
    for (const option of mentioned) affirmed.add(option.role_code);
  }
  for (const code of [...affirmed]) {
    if (negated.has(code)) affirmed.delete(code);
  }
  if (affirmed.size === 1) {
    const code = [...affirmed][0]!;
    if (options.some((option) => option.role_code === code)) {
      return { ok: true, role_code: code };
    }
    return { ok: false, reason: "unauthorized" };
  }
  return { ok: false, reason: "unclear" };
}

export function parseCertaintyChoice(statement: string): CertaintyChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };

  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, certainty: "explicit" };
  if (numbered === 2) return { ok: true, certainty: "estimated" };
  if (numbered === 3) return { ok: true, certainty: "unclear" };

  if (hasUncertaintyExpression(t)) {
    return { ok: true, certainty: "unclear" };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, certainty: "estimated" };
  }
  if (hasExplicitCertaintyAffirm(t) && !hasExplicitCertaintyNegation(t)) {
    return { ok: true, certainty: "explicit" };
  }
  return { ok: false, reason: "unclear" };
}

export function parseConstraintConfirmChoice(
  statement: string,
): ConstraintConfirmParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };

  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, confirmed: true, still_uncertain: false };
  if (numbered === 2) return { ok: true, confirmed: false, still_uncertain: false };
  if (numbered === 3) return { ok: true, confirmed: false, still_uncertain: true };

  if (hasUncertaintyExpression(t)) {
    return { ok: true, confirmed: false, still_uncertain: true };
  }
  if (confirmNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasConstraintConfirmAffirm(t)) {
    return { ok: true, confirmed: true, still_uncertain: false };
  }
  return { ok: false, reason: "unclear" };
}

export function parseDefinitionPatchChoice(
  statement: string,
): DefinitionPatchChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t) || /暂时不处理|先不处理/.test(t)) {
    return { ok: false, reason: "refused" };
  }
  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, as_fact: true };
  if (numbered === 2) return { ok: false, reason: "refused" };
  if (hasUncertaintyExpression(t) || HEDGE_CUES_RE.test(t)) {
    return { ok: false, reason: "unclear" };
  }
  if (
    /不作为|不改为|不当作|不记录|不要作为|不要改为/.test(t) ||
    /不是明确事实/.test(t)
  ) {
    return { ok: false, reason: "unclear" };
  }
  if (/(作为明确事实|改为事实|当作事实|记录为事实|作为事实)/i.test(t)) {
    return { ok: true, as_fact: true };
  }
  return { ok: false, reason: "unclear" };
}

function itemPreview(item: UnresolvedAnswerItem): string {
  return `「${item.text}」`;
}

export function buildRoleClarificationQuestionText(
  pending: PendingAnswerResolution,
  options: AuthorizedRoleOption[],
  item?: UnresolvedAnswerItem | null,
): string | null {
  if (options.length === 0) return null;
  const target = item ?? nextResolvingItem(pending);
  if (!target || !isRoleBindingReason(target.reason)) return null;
  const roleLines = options
    .map((o) => {
      const alias = o.aliases.includes("工作角色") ? "（工作角色）" : "";
      return `${o.index}. ${o.role}${alias} — ${o.need}（${o.dir_id}）`;
    })
    .join("\n");
  return [
    "刚才这条回答还不能对应到当前已授权的调查角色，因此尚未写入决策上下文。请明确下面的信息属于哪一项（请回复编号或角色名称）：",
    "",
    "待澄清信息：",
    itemPreview(target),
    "",
    "可选角色（仅限当前已授权范围，不可扩大）：",
    roleLines,
    "",
    "如果暂时无法确定，请直接回复「不确定」。如果拒绝处理这条信息，请回复「拒绝澄清」。",
  ].join("\n");
}

export function buildCertaintyClarificationQuestionText(
  item: UnresolvedAnswerItem,
): string {
  return [
    "刚才这条回答已经提取到，但还不能判断它是明确陈述、个人估计，还是目前无法确定，因此尚未写入决策上下文。",
    "",
    "待澄清信息：",
    itemPreview(item),
    "",
    "请明确选择其中一项（请回复编号或原文）：",
    "1. 明确事实",
    "2. 个人估计",
    "3. 目前无法确定",
    "",
    "如果拒绝处理这条信息，请直接回复「拒绝澄清」。",
  ].join("\n");
}

export function buildConstraintConfirmQuestionText(
  item: UnresolvedAnswerItem,
): string {
  return [
    "刚才这条约束目前只是估计，系统不能把它伪装成明确断言后写入决策上下文。",
    "",
    "待澄清信息：",
    itemPreview(item),
    "",
    "请明确选择其中一项（请回复编号或原文）：",
    "1. 确认这是明确约束（可以按明确陈述写入）",
    "2. 仍然只是估计",
    "3. 目前无法确定",
    "",
    "如果拒绝处理这条信息，请直接回复「拒绝澄清」。",
  ].join("\n");
}

export function buildDefinitionPatchQuestionText(
  item: UnresolvedAnswerItem,
): string {
  return [
    "刚才提取到一条定义修订，但当前决策上下文写入器还不能合法保存定义修订，因此尚未写入。",
    "",
    "待澄清信息：",
    itemPreview(item),
    "",
    "请明确选择其中一项（请回复编号或原文）：",
    "1. 改为作为明确事实记录",
    "2. 暂时不处理",
    "",
    "如果拒绝处理这条信息，请直接回复「拒绝澄清」。",
  ].join("\n");
}

export function clarificationQuestionTextForItem(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  item: UnresolvedAnswerItem;
}): string | null {
  const item = input.item;
  if (isRoleBindingReason(item.reason)) {
    const codes =
      item.authorized_role_codes.length > 0
        ? item.authorized_role_codes
        : [];
    const options = authorizedRoleOptions(input.session, codes);
    return buildRoleClarificationQuestionText(input.pending, options, item);
  }
  if (item.reason === "unclear_certainty") {
    return buildCertaintyClarificationQuestionText(item);
  }
  if (item.reason === "estimated_constraint_not_persistable") {
    return buildConstraintConfirmQuestionText(item);
  }
  if (item.reason === "definition_patch_not_persistable") {
    return buildDefinitionPatchQuestionText(item);
  }
  return null;
}

function planPrefixForReason(reason: UnresolvedAnswerReason): string {
  if (isRoleBindingReason(reason)) return "qp_role_clarify";
  if (reason === "unclear_certainty") return "qp_certainty_clarify";
  if (reason === "estimated_constraint_not_persistable") return "qp_constraint_clarify";
  if (reason === "definition_patch_not_persistable") return "qp_defpatch_clarify";
  return "qp_clarify";
}

function candidatePrefixForReason(reason: UnresolvedAnswerReason): string {
  return planPrefixForReason(reason).replace(/^qp_/, "cq_");
}

function planIdForItem(pending: PendingAnswerResolution, item: UnresolvedAnswerItem): string {
  return `${planPrefixForReason(item.reason)}_${pending.source_turn_id}_${item.item_id}`.slice(0, 120);
}

/**
 * Deterministic clarification plan for the current resolving item.
 * Reuses a previously generated plan for the same item_id so replay does
 * not recount budget. A different remaining item gets a new plan_id.
 */
export function buildClarificationPlan(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  now: string;
  item?: UnresolvedAnswerItem | null;
}): AdaptiveQuestionPlan | null {
  const item = input.item ?? nextResolvingItem(input.pending);
  if (!item) return null;
  const expectedId = planIdForItem(input.pending, item);
  if (
    input.pending.clarification_plan &&
    input.pending.clarification_plan.plan_id === expectedId
  ) {
    return input.pending.clarification_plan;
  }
  const last = input.session.decision_understanding?.last_sent_question;
  const dirIds =
    input.pending.authorized_dir_ids.length > 0
      ? [...input.pending.authorized_dir_ids]
      : last
        ? [...last.dir_ids]
        : [];
  const ddrIds = last ? [...last.ddr_ids] : [];
  if (dirIds.length === 0 && ddrIds.length === 0) {
    return null;
  }
  const question_text = clarificationQuestionTextForItem({
    session: input.session,
    pending: input.pending,
    item,
  });
  if (!question_text) return null;

  const priorPlan =
    (input.pending.clarification_plan &&
    input.pending.clarification_plan.plan_id === last?.plan_id
      ? input.pending.clarification_plan
      : null) ??
    (input.session.adaptive_ask_plan &&
    input.session.adaptive_ask_plan.plan_id === last?.plan_id
      ? input.session.adaptive_ask_plan
      : null) ??
    (input.session.decision_understanding?.next_question_plan &&
    input.session.decision_understanding.next_question_plan.plan_id === last?.plan_id
      ? input.session.decision_understanding.next_question_plan
      : null);

  const codes =
    item.authorized_role_codes.length > 0
      ? [...item.authorized_role_codes]
      : [...input.pending.authorized_role_codes];
  const budget = input.session.decision_understanding?.budget;
  const dirId = dirIds[0] ?? "";
  const depth = dirId ? (budget?.depth_by_dir[dirId] ?? 0) + 1 : priorPlan?.depth ?? 1;

  return {
    plan_id: expectedId,
    candidate_id: `${candidatePrefixForReason(item.reason)}_${input.pending.source_turn_id}_${item.item_id}`.slice(0, 120),
    direction_id: last?.direction_id ?? priorPlan?.direction_id ?? "",
    ddr_ids: ddrIds,
    dir_ids: dirIds,
    fact_role_codes: [...codes],
    missing_info: item.reason,
    decision_value: priorPlan?.decision_value ?? "supporting",
    ask_now_reason: `pending_answer_resolution_${item.reason}`,
    expected_info: "请针对当前这条未决信息给出明确澄清",
    depth,
    budget_cost: 1,
    remaining_hard_budget: budget?.remaining_hard_budget ?? priorPlan?.remaining_hard_budget ?? 0,
    gate_class: priorPlan?.gate_class ?? "P0",
    scope_boundary:
      priorPlan?.scope_boundary ??
      "Only currently authorized roles and DIRs of the actually-sent question; no Blueprint expansion",
    rationale: `Deterministic clarification for unresolved ${item.reason}`,
    question_text,
    built_at: input.now,
    scoring_path: `pending_answer_resolution→deterministic_${item.reason}`,
    conflict_clarification: null,
  };
}

/** @deprecated Use buildClarificationPlan. Kept for existing role-clarification call sites. */
export function buildRoleClarificationPlan(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  now: string;
}): AdaptiveQuestionPlan | null {
  return buildClarificationPlan(input);
}

export function pendingFromAnswerEvent(input: {
  session: POJUSessionState;
  event: AnswerEvent;
  statement: string;
  now: string;
}): PendingAnswerResolution | null {
  const items = normalizePendingItems(
    continuableUnresolvedItems(eventUnresolved(input.event)),
  );
  if (items.length === 0) return null;
  const last = input.session.decision_understanding?.last_sent_question;
  const authorized =
    items[0]?.authorized_role_codes.length
      ? [...items[0]!.authorized_role_codes]
      : [...(last?.fact_role_codes ?? [])];
  const authorizedDirs = last ? [...last.dir_ids] : [];
  const sent_question_id = last?.plan_id ?? items[0]?.sent_question_id ?? "";
  const resolving = items[0]!;
  const seed: PendingAnswerResolution = {
    status: "pending",
    source_turn_id: input.event.client_turn_id,
    original_statement: input.statement.slice(0, 2000),
    original_classification: input.event.classification,
    unresolved_items: items,
    rejected_items: [],
    authorized_role_codes: authorized,
    authorized_dir_ids: authorizedDirs,
    sent_question_id,
    clarification_plan: null,
    clarification_plan_id: null,
    resolving_item_id: resolving.item_id,
  };
  const plan = buildClarificationPlan({
    session: input.session,
    pending: seed,
    now: input.now,
    item: resolving,
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

/** Merge new continuable unresolved items into an existing pending task (same source only). */
export function mergePendingResolution(
  existing: PendingAnswerResolution | null | undefined,
  incoming: PendingAnswerResolution,
): PendingAnswerResolution {
  if (!existing || existing.source_turn_id !== incoming.source_turn_id) {
    return incoming;
  }
  const existingItems = normalizePendingItems(existing.unresolved_items);
  const seen = new Set(existingItems.map((i) => i.item_id));
  const mergedItems = [...existingItems];
  for (const item of normalizePendingItems(incoming.unresolved_items)) {
    if (!seen.has(item.item_id)) {
      seen.add(item.item_id);
      mergedItems.push(item);
    }
  }
  const resolving =
    (existing.resolving_item_id &&
      mergedItems.find((i) => i.item_id === existing.resolving_item_id)) ||
    mergedItems[0] ||
    null;
  return {
    ...existing,
    status: mergedItems.length === 0 && (existing.rejected_items ?? []).length > 0 ? "rejected" : "pending",
    unresolved_items: mergedItems,
    rejected_items: [...(existing.rejected_items ?? [])],
    authorized_dir_ids:
      existing.authorized_dir_ids.length > 0
        ? existing.authorized_dir_ids
        : incoming.authorized_dir_ids,
    resolving_item_id: resolving?.item_id ?? existing.resolving_item_id,
    clarification_plan:
      mergedItems.length === 0
        ? null
        : existing.clarification_plan ?? incoming.clarification_plan,
    clarification_plan_id:
      mergedItems.length === 0
        ? null
        : existing.clarification_plan_id ?? incoming.clarification_plan_id,
  };
}

export function withPendingAnswerResolution(
  session: POJUSessionState,
  pending: PendingAnswerResolution | null,
): POJUSessionState {
  return { ...session, pending_answer_resolution: pending };
}

export function pendingWithRemainingItems(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  remaining: UnresolvedAnswerItem[];
  rejected_items?: PendingRejectedItem[];
  now: string;
}): PendingAnswerResolution {
  const remaining = normalizePendingItems(input.remaining);
  const rejected = input.rejected_items ?? input.pending.rejected_items ?? [];
  const status: PendingAnswerResolution["status"] =
    remaining.length === 0 && rejected.length > 0 ? "rejected" : "pending";
  const resolving = remaining[0] ?? null;
  const seed: PendingAnswerResolution = {
    ...input.pending,
    status,
    unresolved_items: remaining,
    rejected_items: rejected,
    resolving_item_id: resolving?.item_id ?? null,
    clarification_plan: null,
    clarification_plan_id: null,
  };
  if (!resolving) {
    // Terminal state: never restore a resendable old clarification_plan
    // merely because unresolved_items is empty.
    return {
      ...seed,
      status: rejected.length > 0 ? "rejected" : seed.status,
      clarification_plan: null,
      clarification_plan_id: null,
      resolving_item_id: null,
    };
  }
  const plan = buildClarificationPlan({
    session: input.session,
    pending: seed,
    now: input.now,
    item: resolving,
  });
  return plan
    ? { ...seed, clarification_plan: plan, clarification_plan_id: plan.plan_id }
    : seed;
}

export function rejectPendingItem(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  item: UnresolvedAnswerItem;
  rejected_at_turn_id: string;
  rejected_statement: string;
  now: string;
}): PendingAnswerResolution {
  const rejectedItem: PendingRejectedItem = {
    item_id: input.item.item_id,
    source_turn_id: input.item.source_turn_id,
    text: input.item.text,
    semantic_kind: input.item.semantic_kind,
    certainty: input.item.certainty,
    reason: input.item.reason,
    rejected_at_turn_id: input.rejected_at_turn_id,
    rejected_statement: input.rejected_statement.slice(0, 2000),
  };
  const remaining = normalizePendingItems(input.pending.unresolved_items).filter(
    (item) => item.item_id !== input.item.item_id,
  );
  return pendingWithRemainingItems({
    session: input.session,
    pending: input.pending,
    remaining,
    rejected_items: [...(input.pending.rejected_items ?? []), rejectedItem],
    now: input.now,
  });
}

export type PendingBindChoice =
  | { type: "role"; role_code: string }
  | { type: "certainty"; certainty: "explicit" | "estimated" | "unclear" }
  | { type: "constraint_confirm"; confirmed: boolean; still_uncertain: boolean }
  | { type: "definition_as_fact" };

/**
 * Convert exactly one pending item into an AnswerEvent after a user choice.
 * Other pending items are not included and must remain on the pending record.
 */
export function answerEventFromPendingBind(input: {
  session: POJUSessionState;
  pending: PendingAnswerResolution;
  item: UnresolvedAnswerItem;
  choice: PendingBindChoice;
}): AnswerEvent {
  const item = input.item;
  let semantic_kind = item.semantic_kind;
  let certainty: "explicit" | "estimated" | "unclear" = item.certainty;
  let role_code_hint: string | null = item.raw_role_code_hint ?? null;

  if (input.choice.type === "role") {
    role_code_hint = input.choice.role_code;
  } else if (input.choice.type === "certainty") {
    certainty = input.choice.certainty;
  } else if (input.choice.type === "constraint_confirm") {
    semantic_kind = "constraint";
    certainty = input.choice.confirmed
      ? "explicit"
      : input.choice.still_uncertain
        ? "unclear"
        : "estimated";
  } else if (input.choice.type === "definition_as_fact") {
    semantic_kind = "reality_fact";
    certainty = "explicit";
  }

  if (!role_code_hint && item.authorized_role_codes.length === 1) {
    role_code_hint = item.authorized_role_codes[0]!;
  }

  const classification: ModelAnswerDraft["classification"] =
    input.pending.original_classification === "invalid_input"
      ? "clear_answer"
      : certainty === "estimated"
        ? "estimate"
        : input.pending.original_classification === "unknown" ||
            input.pending.original_classification === "declined"
          ? "clear_answer"
          : (input.pending.original_classification as ModelAnswerDraft["classification"]);

  const draft: ModelAnswerDraft = {
    classification,
    extracted_items: [
      {
        text: item.text,
        semantic_kind,
        role_hint: null,
        role_code_hint,
        certainty,
      },
    ],
    unresolved_aspects: [],
    explanation: `pending_answer_resolution_bind:${item.item_id}`,
  };
  const event = answerEventFromModelDraft({
    session: input.session,
    statement: item.text,
    source_turn_id: input.pending.source_turn_id,
    draft,
  });
  // Preserve the original item_id on any follow-up unresolved result.
  if (event.unresolved_items.length > 0) {
    event.unresolved_items = event.unresolved_items.map((u) => ({
      ...u,
      item_id: item.item_id,
      source_turn_id: input.pending.source_turn_id,
      authorized_role_codes:
        u.authorized_role_codes.length > 0
          ? u.authorized_role_codes
          : [...item.authorized_role_codes],
      sent_question_id: u.sent_question_id || item.sent_question_id,
    }));
  }
  return event;
}

export function persistKeyForPendingBind(
  sessionId: string,
  sourceTurnId: string,
  itemId: string,
): string {
  return `dc_collect:${sessionId}:${sourceTurnId}:resolve:${itemId}`;
}
