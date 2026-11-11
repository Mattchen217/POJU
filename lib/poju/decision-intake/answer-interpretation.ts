/**
 * M1 Answer Interpretation — structured classify before DC write / next ask.
 * M2.4-R1: context-aware classification; last_sent_question is the only answer target.
 * M2.4-R1-FU1: fact_role_codes from actually-sent Plan; never expand to DIR.required_fact_roles.
 * Never auto-confirm; never chart-as-fact.
 */

/** Phase 4: context-aware deterministic classifier (not full model interpretation). */
export const ANSWER_INTERPRETATION_VERSION = "deterministic_m2_4_r1" as const;

import type { POJUSessionState } from "@/lib/poju/types";
import type {
  AnswerClass,
  AnswerEvent,
  IntakeControlItem,
  ModelAnswerDraft,
  ProposedWrite,
  SourceQuoteRejection,
  UnresolvedAnswerItem,
  UnresolvedAnswerReason,
  UnresolvedModelAspect,
} from "./types";

export const MODEL_ANSWER_INTERPRETER_VERSION = "model_m2_4_r2" as const;

const UNKNOWN_RE =
  /^(i\s*don'?t\s*know|不知道|不清楚|不了解|没印象|不确定|unsure|no\s*idea)(\b|$|[!。！?\s])/i;
const DECLINED_RE =
  /^(不想说|不愿回答|不想回答|跳过|skip(\b|$)|decline(\b|$)|prefer\s*not|no\s*comment)/i;
const ESTIMATE_RE =
  /(大概|估计|大约|maybe|perhaps|about\s+\d|roughly|i\s*think|我觉得可能|可能是|左右)/i;
const CONSTRAINT_RE =
  /(预算|deadline|截止|必须|不能超过|hard\s*limit|budget|只能|不可逆|退出成本|责任上限|最晚|不得低于|不能低于)/i;
const CORRECTION_RE =
  /(更正|纠正|之前说错了|说错了|correction|actually\s+i\s+meant)/i;
const CONTRADICTION_RE =
  /(与之前不一致|与之前说法矛盾|之前记录错了|之前说的不是事实|实际情况与之前相反|跟之前(说的|记录)?不一致|与之前不符|互相矛盾|矛盾了|冲突了|之前说的不准确|说的不准确|actually\s+that'?s\s+wrong|that\s+conflicts)/i;
const OFF_TOPIC_RE =
  /^(今天天气|讲个笑话|tell\s+me\s+a\s+joke|无关)/i;

const ROLE_CODE_RE = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/;

/** Stable pending item identity: source_turn_id + extracted-item index. Never text alone. */
export function unresolvedItemId(sourceTurnId: string, extractedIndex: number): string {
  return `${sourceTurnId}#${extractedIndex}`;
}

export function unresolvedAspectId(sourceTurnId: string, aspectIndex: number): string {
  return `${sourceTurnId}#aspect#${aspectIndex}`;
}

export function intakeControlItemId(
  sourceTurnId: string,
  kind: IntakeControlItem["kind"],
  index = 0,
): string {
  return `${sourceTurnId}#control#${kind}#${index}`;
}

const MAX_SOURCE_QUOTE_LENGTH = 2000;

/**
 * Conservative normalization for deterministic source-quote grounding.
 * Unicode + whitespace + safe punctuation only. No semantic similarity.
 */
export function normalizeAnswerGroundingText(text: string): string {
  let s = text.normalize("NFKC").replace(/[​-‍﻿]/g, "");
  s = s
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[；]/g, ";")
    .replace(/[：]/g, ":")
    .replace(/[？]/g, "?")
    .replace(/[！]/g, "!")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[【]/g, "[")
    .replace(/[】]/g, "]")
    .replace(/[、]/g, ",");
  return s.replace(/\s+/gu, " ").trim();
}

export type SourceQuoteGroundingResult =
  | { ok: true }
  | { ok: false; reason: SourceQuoteRejection["reason"] };

/**
 * A model extraction is grounded only when the normalized source_quote is a
 * contiguous substring of the normalized user statement.
 */
export function groundSourceQuote(
  sourceQuote: string,
  statement: string,
): SourceQuoteGroundingResult {
  if (sourceQuote.length > MAX_SOURCE_QUOTE_LENGTH) {
    return { ok: false, reason: "source_quote_too_long" };
  }
  const quote = normalizeAnswerGroundingText(sourceQuote);
  const hay = normalizeAnswerGroundingText(statement);
  if (!quote) return { ok: false, reason: "source_quote_empty" };
  if (!hay.includes(quote)) return { ok: false, reason: "source_quote_not_grounded" };
  return { ok: true };
}


/**
 * Validate a complete authorization set. Fail closed on malformed, empty,
 * duplicate, or last-sent DIR-mismatched codes. Do not filter bad items
 * and continue with the remainder.
 */
function validateAuthorizedRoleCodes(
  codes: string[],
  lastSentDirIds: string[],
): { ok: true; codes: string[]; roles: string[] } | { ok: false } {
  if (codes.length === 0) return { ok: false };
  const seen = new Set<string>();
  const out: string[] = [];
  const roles: string[] = [];
  for (const code of codes) {
    const match = ROLE_CODE_RE.exec(code);
    if (!match) return { ok: false };
    const dirId = match[1]!;
    const role = match[2]!;
    if (!role) return { ok: false };
    if (!lastSentDirIds.includes(dirId)) return { ok: false };
    if (seen.has(code)) return { ok: false };
    seen.add(code);
    out.push(code);
    roles.push(role);
  }
  if (out.length === 0 || roles.length === 0) return { ok: false };
  return { ok: true, codes: out, roles };
}

/**
 * Current question is the ONLY answer-target authority.
 * last_sent_question is the sole authorization source.
 * Never use next_question_plan or adaptive_ask_plan as a substitute
 * when last_sent_question is missing. Never derive from Blueprint.required_fact_roles.
 */
export function activeTargets(session: POJUSessionState): {
  dir_ids: string[];
  ddr_ids: string[];
  direction_id?: string;
  fact_roles: string[];
  /** Full actually-sent Plan role codes; never expanded from Blueprint.required_fact_roles. */
  fact_role_codes: string[];
  auth_error?: "missing_authorized_fact_roles" | "missing_authorized_answer_target";
} {
  const understanding = session.decision_understanding;
  const lastSent = understanding?.last_sent_question;
  const missingRoles = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_fact_roles" as const,
  };
  const missingTarget = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_answer_target" as const,
  };

  if (lastSent && (lastSent.dir_ids.length > 0 || lastSent.ddr_ids.length > 0)) {
    let codes = lastSent.fact_role_codes ? [...lastSent.fact_role_codes] : [];
    if (codes.length === 0) {
      // Historical session: restore ONLY when next_question_plan.plan_id matches exactly.
      const nqp = understanding?.next_question_plan ?? null;
      if (
        nqp &&
        nqp.plan_id === lastSent.plan_id &&
        Array.isArray(nqp.fact_role_codes) &&
        nqp.fact_role_codes.length > 0
      ) {
        codes = [...nqp.fact_role_codes];
      }
    }
    const validated = validateAuthorizedRoleCodes(codes, lastSent.dir_ids);
    if (!validated.ok) return missingRoles;
    return {
      dir_ids: [...lastSent.dir_ids],
      ddr_ids: [...lastSent.ddr_ids],
      direction_id: lastSent.direction_id,
      fact_roles: validated.roles,
      fact_role_codes: validated.codes,
    };
  }

  return missingTarget;
}

export function classifyAnswer(input: {
  session: POJUSessionState;
  statement: string;
  target: ReturnType<typeof activeTargets>;
}): {
  cls: AnswerClass;
  notes: string[];
} {
  const t = input.statement.trim();
  const notes: string[] = [];

  // empty / invalid — keep CJK single-ack as invalid so they do not write DC
  if (!t || t.length < 2) return { cls: "invalid_input", notes: ["empty"] };

  // missing authorized target / roles — never guess DIR or expand roles
  if (input.target.auth_error === "missing_authorized_fact_roles") {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }
  if (
    input.target.auth_error === "missing_authorized_answer_target" ||
    (input.target.dir_ids.length === 0 && input.target.ddr_ids.length === 0)
  ) {
    return { cls: "invalid_input", notes: ["missing_authorized_answer_target"] };
  }
  if (input.target.fact_roles.length === 0) {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }

  // off_topic
  if (OFF_TOPIC_RE.test(t)) return { cls: "off_topic", notes: ["off_topic"] };

  // unknown (exact CJK tokens first; \b unreliable for CJK)
  if (
    t === "不知道" ||
    t === "不清楚" ||
    t === "不了解" ||
    t === "没印象" ||
    t === "不确定"
  ) {
    return { cls: "unknown", notes: ["user_unknown"] };
  }
  if (UNKNOWN_RE.test(t)) return { cls: "unknown", notes: ["user_unknown"] };

  // declined
  if (t === "不想说" || t === "不愿回答" || t === "不想回答" || t === "跳过") {
    return { cls: "declined", notes: ["user_declined"] };
  }
  if (DECLINED_RE.test(t)) return { cls: "declined", notes: ["user_declined"] };

  // explicit correction (before contradiction markers that may co-occur)
  if (CORRECTION_RE.test(t) && !CONTRADICTION_RE.test(t)) {
    return { cls: "correction", notes: ["correction"] };
  }

  // explicit contradiction
  if (CONTRADICTION_RE.test(t) || (CORRECTION_RE.test(t) && CONTRADICTION_RE.test(t))) {
    return { cls: "contradiction", notes: ["contradiction"] };
  }
  // "不是…而是" often contradiction with prior
  if (/不是.+而是/.test(t)) {
    return { cls: "contradiction", notes: ["contradiction_reframing"] };
  }

  // estimate / uncertain
  if (ESTIMATE_RE.test(t)) return { cls: "estimate", notes: ["estimate"] };

  // constraint language — clear_answer class; ProposedWrite becomes constraint
  if (CONSTRAINT_RE.test(t)) {
    notes.push("constraint_signal");
    return { cls: "clear_answer", notes };
  }

  // clear vs partial — content-based, not length-alone
  const hasConcrete =
    /\d/.test(t) ||
    /(方案|选项|公司|城市|家庭|责任|风险|期限|成本|收入|离职|留下)/.test(t);
  if (hasConcrete && t.length >= 6) {
    return { cls: "clear_answer", notes: ["clear"] };
  }
  if (t.length >= 4) {
    return { cls: "partial_answer", notes: ["partial"] };
  }
  // Too thin to be a fact write
  return { cls: "invalid_input", notes: ["too_thin"] };
}

/** Split one user turn into independent factual clauses (same source_turn_id). */
function splitIndependentFacts(statement: string): string[] {
  const cleaned = statement.trim();
  if (!cleaned) return [];
  // Soft split on clause separators / "另外/还有/以及"
  const parts = cleaned
    .split(/(?:[。；;！!？?\n]+|(?:另外|还有|以及|并且|同时)[,，\s]*)/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length >= 2) return parts;
  return [cleaned];
}

function stripMetaPrefix(text: string): string {
  return text
    .replace(
      /^(更正一下|更正|纠正|之前说错了|说错了|之前说的不准确|actually\s+i\s+meant)[:：,\s]*/i,
      "",
    )
    .trim();
}

export function writesFor(
  cls: AnswerClass,
  statement: string,
  targets: ReturnType<typeof activeTargets>,
  notes: string[],
): ProposedWrite[] {
  const roles =
    targets.fact_roles.length > 0 ? targets.fact_roles : [];
  const dirs = targets.dir_ids;

  if (cls === "off_topic" || cls === "invalid_input") return [];
  if (roles.length === 0) return [];

  if (cls === "unknown") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unknown",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }
  if (cls === "declined") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "declined",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  const wantsConstraint =
    notes.includes("constraint_signal") || CONSTRAINT_RE.test(statement);

  if (wantsConstraint && cls !== "estimate") {
    const constraintRoles = roles.includes("hard_constraint")
      ? roles
      : [...roles, "hard_constraint"];
    return [
      {
        kind: "constraint",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
        constraint_category: /预算|budget|钱|salary|cost|财务/i.test(statement)
          ? "financial"
          : /deadline|截止|时间|timing|最晚/i.test(statement)
            ? "time"
            : /不可逆|退出成本|exit/i.test(statement)
              ? "exit_cost"
              : "responsibility",
        rigidity: "hard",
      },
      // Companion fact so Intake role evidence can progress before E1 confirm.
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
      },
    ];
  }

  if (cls === "estimate") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_estimate",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  // correction / contradiction / clear / partial — never confirmed without E1.
  // Multi-fact: one ProposedWrite per independent clause; same DIR/DDR/roles only.
  const clauses =
    cls === "correction" || cls === "contradiction"
      ? [stripMetaPrefix(statement) || statement]
      : splitIndependentFacts(statement);

  const uniqueClauses = Array.from(new Set(clauses.map((c) => c.slice(0, 500))));
  return uniqueClauses.map((clause) => ({
    kind: "reality_fact" as const,
    statement: clause,
    status: "unverified" as const,
    verification_level: "user_asserted" as const,
    fact_roles: roles,
    related_dir_ids: dirs,
  }));
}

/**
 * applyAnswerEventToSessionDc currently persists Constraint.verification_level
 * as hardcoded "user_asserted" and is intentionally not modified in FU1.
 * Therefore an estimated Constraint cannot be persisted without being
 * disguised as user_asserted; it must stay unresolved.
 */
function constraintEstimateIsPersistable(): boolean {
  return false;
}

/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 * role_hint is ignored for authorization; only role_code_hint is used.
 */
export function answerEventFromModelDraft(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  draft: ModelAnswerDraft;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const structuredAspects: UnresolvedModelAspect[] = input.draft.unresolved_aspects
    .map((aspectText, aspectIndex) => ({
      aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
      source_turn_id: input.source_turn_id,
      text: aspectText.slice(0, 200),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
    }))
    .filter((aspect) => aspect.text.trim().length > 0);

  const controlItems: IntakeControlItem[] = [];
  if (cls === "goal_change") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      proposed_decision_target: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else if (cls === "insight_mismatch") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "insight_mismatch"),
      kind: "insight_mismatch",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
    });
  } else {
    for (const aspect of structuredAspects) {
      controlItems.push({
        item_id: aspect.aspect_id,
        kind: "unresolved_aspect",
        source_turn_id: aspect.source_turn_id,
        text: aspect.text,
        sent_question_id: aspect.sent_question_id,
        authorized_role_codes: [...aspect.authorized_role_codes],
        authorized_dir_ids: [...aspect.authorized_dir_ids],
        status: "pending",
      });
    }
  }

  const pushUnresolvedItem = (item: {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      item_id: unresolvedItemId(input.source_turn_id, item.extracted_index),
      source_turn_id: input.source_turn_id,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      certainty: item.certainty,
      reason: item.reason,
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      raw_role_code_hint: item.role_code_hint ?? null,
    });
    unresolved.push(item.note);
  };

  const eventShell = (writes: ProposedWrite[], classification: AnswerClass): AnswerEvent => ({
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification,
    targets: {
      dir_ids: [...targets.dir_ids],
      ddr_ids: [...targets.ddr_ids],
      direction_id: targets.direction_id,
    },
    proposed_writes: writes,
    notes: [
      ...notes,
      ...unresolved.map((u) => `unresolved:${u}`),
      ...groundingRejections.map(
        (r) =>
          `grounding_rejected:${r.reason}:${r.extracted_index}:${r.source_quote.slice(0, 80)}`,
      ),
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    unresolved_aspects: structuredAspects,
    grounding_rejections: groundingRejections,
    control_items: controlItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
  });

  if (targets.auth_error === "missing_authorized_fact_roles") {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }
  if (
    targets.auth_error === "missing_authorized_answer_target" ||
    (targets.dir_ids.length === 0 && targets.ddr_ids.length === 0)
  ) {
    notes.push("missing_authorized_answer_target");
    return eventShell([], "invalid_input");
  }
  if (authorizedRoleCodes.length === 0 || targets.fact_roles.length === 0) {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }

  if (
    cls === "off_topic" ||
    cls === "invalid_input" ||
    cls === "goal_change" ||
    cls === "insight_mismatch"
  ) {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }

  type AcceptedItem = {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    authorizedDirId: string;
    authorizedRole: string;
    bound_role_code: string;
    certainty: "explicit" | "estimated" | "unclear";
  };

  const acceptedItems: AcceptedItem[] = [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundSourceQuote(item.source_quote, statement);
    if (!grounding.ok) {
      groundingRejections.push({
        extracted_index: extractedIndex,
        text: item.text.slice(0, 500),
        source_quote: item.source_quote,
        reason: grounding.reason,
      });
      notes.push(`rejected_${grounding.reason}`);
      // Do not create a ProposedWrite or assign user_asserted / user_estimate.
      continue;
    }
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;

    if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unauthorized_role_code",
        note: `unauthorized_role_code:${code}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_unauthorized_role_code");
      continue;
    }

    if (!code && authorizedRoleCodes.length !== 1) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unlocated_role_code",
        note: `unlocated_role_code:${item.text.slice(0, 100)}`,
      });
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }

    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: acceptedCode,
        reason: "illegal_role_code",
        note: `illegal_role_code:${acceptedCode}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_illegal_role_code");
      continue;
    }

    acceptedItems.push({
      extracted_index: extractedIndex,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      bound_role_code: acceptedCode,
      certainty: item.certainty,
    });
  }

  const writes: ProposedWrite[] = [];

  const constraintCategory = (text: string): ProposedWrite["constraint_category"] =>
    /预算|budget|钱|salary|cost|财务/i.test(text)
      ? "financial"
      : /deadline|截止|时间|timing|最晚/i.test(text)
        ? "time"
        : /不可逆|退出成本|exit/i.test(text)
          ? "exit_cost"
          : "responsibility";

  const pushConstraintAndCompanion = (
    text: string,
    authorizedDirId: string,
    authorizedRole: string,
    verification_level: "user_asserted" | "user_estimate",
  ) => {
    const fact_roles = [authorizedRole];
    const related_dir_ids = [authorizedDirId];
    writes.push({
      kind: "constraint",
      statement: text,
      status: "unverified",
      verification_level,
      fact_roles,
      related_dir_ids,
      constraint_category: constraintCategory(text),
      rigidity: "hard",
    });
    const alreadyCompanion = writes.some(
      (w) => w.kind === "reality_fact" && w.statement === text,
    );
    if (!alreadyCompanion) {
      writes.push({
        kind: "reality_fact",
        statement: text,
        status: "unverified",
        verification_level,
        fact_roles,
        related_dir_ids,
      });
    }
  };

  if (cls === "unknown" || cls === "declined") {
    // Existing unknown/declined DC state rules: status + verification_level none.
    // Role authorization still uses role_code_hint; null does not expand to all roles.
    for (const item of acceptedItems) {
      writes.push({
        kind: "reality_fact",
        statement: item.text,
        status: cls,
        verification_level: "none",
        fact_roles: [item.authorizedRole],
        related_dir_ids: [item.authorizedDirId],
      });
    }
    return eventShell(writes, cls);
  }

  for (const item of acceptedItems) {
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }

    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" ? "user_estimate" : "user_asserted";

    if (item.semantic_kind === "constraint") {
      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          extracted_index: item.extracted_index,
          text: item.text,
          semantic_kind: item.semantic_kind,
          certainty: item.certainty,
          role_code_hint: item.bound_role_code,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
      pushConstraintAndCompanion(
        item.text,
        item.authorizedDirId,
        item.authorizedRole,
        verification_level,
      );
      continue;
    }
    if (item.semantic_kind === "definition_patch") {
      // Current apply-answer-to-dc does not persist definition_patch.
      // Do not leave this only in notes / proposed_writes — keep it pending.
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "definition_patch_not_persistable",
        note: `definition_patch_not_persistable:${item.text.slice(0, 100)}`,
      });
      notes.push("definition_patch_not_mapped_by_apply");
      continue;
    }

    writes.push({
      kind: "reality_fact",
      statement: item.text,
      status: "unverified",
      verification_level,
      fact_roles: [item.authorizedRole],
      related_dir_ids: [item.authorizedDirId],
    });
  }

  return eventShell(writes, cls);
}

/**
 * Interpret one user turn into an AnswerEvent (proposes writes; does not mutate DC).
 */
export function interpretUserAnswer(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now?: string;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const { cls, notes } = classifyAnswer({
    session: input.session,
    statement,
    target: targets,
  });
  const proposed_writes = writesFor(cls, statement, targets, notes);
  return {
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification: cls,
    targets: {
      dir_ids: targets.dir_ids,
      ddr_ids: targets.ddr_ids,
      direction_id: targets.direction_id,
    },
    proposed_writes,
    notes,
    unresolved_items: [],
    unresolved_aspects: [],
    grounding_rejections: [],
    control_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
  };
}
