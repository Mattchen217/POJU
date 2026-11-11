/**
 * M2.4-R2 — Model-backed Answer Interpretation.
 *
 * The model only interprets this turn's user answer and proposes a
 * ModelAnswerDraft. Formal AnswerEvent construction, DIR/DDR/role
 * authorization, DC writes, and confirmation stay in deterministic code.
 *
 * Timeout is 60s: openRouterChatCompletion refuses walls shorter than
 * OPENROUTER_RETRY_MIN_REMAINING_MS (45s) on the first attempt, and 60s
 * stays far below the Agent default 285s wait.
 */

import { openRouterChatCompletion } from "@/lib/llm/openrouter-shared";
import type { POJUSessionState } from "@/lib/poju/types";
import { activeTargets, correctablePriorAnswers } from "./answer-interpretation";
import type { AnswerClass, ModelAnswerDraft } from "./types";

export const MODEL_ANSWER_INTERPRETER_VERSION = "model_m2_4_r2" as const;

/** Short independent wall; must stay >= 45s for the shared OpenRouter client. */
export const ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS = 60_000;

export const MAX_EXTRACTED_ITEMS = 8;
export const MAX_ITEM_TEXT_LENGTH = 500;
export const MAX_SOURCE_QUOTE_LENGTH = 2000;
export const MAX_UNRESOLVED_ASPECTS = 16;
export const MAX_ASPECT_TEXT_LENGTH = 200;
export const MAX_EXPLANATION_LENGTH = 2000;

export const MODEL_ANSWER_CLASSIFICATIONS = [
  "clear_answer",
  "partial_answer",
  "vague_answer",
  "unknown",
  "declined",
  "correction",
  "supplement",
  "contradiction",
  "goal_change",
  "insight_mismatch",
  "off_topic",
  "invalid_input",
  "estimate",
] as const satisfies readonly AnswerClass[];

export const MODEL_SEMANTIC_KINDS = [
  "reality_fact",
  "constraint",
  "definition_patch",
] as const;

export const MODEL_CERTAINTIES = ["explicit", "estimated", "unclear"] as const;

export type ModelAnswerClassification = (typeof MODEL_ANSWER_CLASSIFICATIONS)[number];
export type ModelSemanticKind = (typeof MODEL_SEMANTIC_KINDS)[number];
export type ModelCertainty = (typeof MODEL_CERTAINTIES)[number];

export type { ModelAnswerDraft };

export type ModelInterpretationContext = {
  decision_question: string | null;
  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    fact_role_codes?: string[];
  } | null;
  authorized: {
    dir_ids: string[];
    ddr_ids: string[];
    fact_roles: string[];
    fact_role_codes: string[];
  };
  blueprint_directions: Array<{
    direction_id: string;
    label: string;
    need: string;
    scope_boundary: string;
    dir_ids: string[];
  }>;
  related_reality_facts: Array<{
    fact_id: string;
    statement: string;
    status: string;
    fact_roles: string[];
    related_dir_ids: string[];
  }>;
  related_constraints: Array<{
    constraint_id: string;
    statement: string;
    category: string;
    status: string;
    rigidity: string;
    related_dir_ids: string[];
  }>;
  related_conflicts: Array<{
    conflict_id: string;
    fact_ids: string[];
    state: string;
    statements_snapshot: string[];
  }>;
  /** The user's own earlier answers; usable only by classification "correction". */
  correctable_prior_answers: Array<{
    role_code: string;
    statement: string;
  }>;
  user_answer: string;
  locale: string;
};

/** Provider metadata of one interpretation call; null fields for test hooks. */
export type ModelInterpretationCallMeta = {
  source: "openrouter" | "test_hook";
  provider: string | null;
  model: string | null;
  finish_reason: string | null;
  latency_ms: number;
  /** Raw model text, kept only for evidence tooling; never persisted by production. */
  raw_text?: string;
};

export type ModelInterpretationSuccess = {
  ok: true;
  draft: ModelAnswerDraft;
  stripped_authority_fields: string[];
  call_meta?: ModelInterpretationCallMeta;
};

export type ModelInterpretationFailure = {
  ok: false;
  reason: "call_failed" | "timeout" | "invalid_json" | "invalid_schema";
  detail: string;
  call_meta?: ModelInterpretationCallMeta;
};

export type ModelInterpretationResult =
  | ModelInterpretationSuccess
  | ModelInterpretationFailure;

/**
 * @internal Test-only hook. Production never sets this.
 * May return a draft object, a JSON string, or an invalid shape for schema tests.
 */
export type AnswerInterpretationModelHook = (input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  locale: string;
  signal?: AbortSignal;
  context: ModelInterpretationContext;
}) => Promise<unknown> | unknown;

const CLASS_SET = new Set<string>(MODEL_ANSWER_CLASSIFICATIONS);
const KIND_SET = new Set<string>(MODEL_SEMANTIC_KINDS);
const CERT_SET = new Set<string>(MODEL_CERTAINTIES);

const AUTHORITY_FIELD_NAMES = new Set([
  "user_confirmed",
  "user_confirmation",
  "verification_level",
  "confirmed",
  "current_state",
  "ddr_status",
  "ddr_ids",
  "dir_ids",
  "fact_roles",
  "readiness",
  "verdict",
  "freeze",
  "freeze_state",
  "resolution",
  "blueprint_scope",
  "truth",
  "truth_judgment",
  "has_user_confirm_event",
  "preferred_path",
  "affects_preferred_path",
  "dc_dirs",
  "dirs",
  "status",
]);

const SYSTEM_PROMPT = `You are the Decision Intake Answer Interpretation module.
Return a single JSON object only. Do not write prose outside JSON.

Your job is only to interpret THIS TURN's user answer. You do not write Decision Context, confirm facts, choose DIR/DDR/fact roles, resolve conflicts, or change Blueprint scope.

Rules:
1. Interpret only the current user answer. Do not invent information the user did not say.
2. Distinguish explicit statements, estimates, guesses, uncertainty, and declined answers.
3. Extract multiple independent facts separately. Do not merge them into a vague summary.
4. Distinguish reality facts, decision constraints, and definition changes via semantic_kind.
5. When the user corrects prior information, use classification "correction". Do not treat a correction as a normal supplement. A correction changes facts the user stated; when the user says the decision they need to make is different from context.decision_question, classify "goal_change" instead, even if it also contradicts earlier answers.
6. When the user explicitly says prior statements contradict, use classification "contradiction". Do not pick a side.
7. Do not turn psychological speculation, model inference, traditional mingli analysis, or personal-pattern analysis into extracted RealityFacts.
8. Do not mark anything confirmed just because it sounds reasonable. You have no confirmation authority and must not emit user_confirmed, verification_level, confirmed, readiness, freeze, resolution, or DIR/DDR/Blueprint authority fields.
9. Do not classify as unknown just because the answer is short.
10. Do not infer not_applicable just because a fact was unmentioned.

Role binding:
1. Each extracted item must bind the most specific authorized role code when you can determine it.
2. role_code_hint may only be a complete string that already exists in context.authorized.fact_role_codes (or, for a correction only, in context.correctable_prior_answers), or null.
3. If you cannot determine the specific role, return null. Do not guess.
4. Do not select multiple roles for one item because several might be relevant. Pick at most one role_code_hint per item.
5. Do not invent or output model-inferred DIR ids, DDR ids, or role codes. Do not construct role codes yourself.
6. Do not copy one fact into multiple extracted items with different roles.
7. context.correctable_prior_answers lists the user's own answers to earlier questions. Only when this answer explicitly corrects one of them, classify as "correction" and use that entry's role_code for the corrected item. Never use those codes for any other classification or for new information.
role_hint is deprecated and is not an authorization basis. Do not use it to claim access to a role.

Source authority:
1. The user's whole answer is stored verbatim as the statement of every fact you help locate. Your text is never stored as the fact; it only labels the item.
2. Every extracted item must include source_quote: a verbatim excerpt of the current user answer that shows where this item is said. Quote the part that carries the item together with its qualifiers (negation, hedging, conditions, time limits, amounts or ranges, "but / unless / if / only" parts) when they are adjacent.
3. Never paraphrase in source_quote and never quote context facts or your own inference. One item has exactly one source_quote.
4. If nothing in the current user answer can be quoted for an item, do not emit it as an extracted item. Put it in unresolved_aspects instead.
5. source_start / source_end are optional 0-based character offsets of source_quote inside user_answer (end exclusive). Return null for both unless you are certain they are exact; wrong offsets cause the item to be rejected.
6. For classification "goal_change", emit one definition_patch item whose source_quote is only the span that names the proposed new decision target itself, without lead-in words and without the goal being replaced. The user will be asked to confirm it; you do not change any goal.
7. For "unknown" or "declined" answers that address the whole question, extracted_items may be empty.
8. For "insight_mismatch" (the user says the current understanding / summary of them is wrong), quote the part that says what is wrong.

JSON shape:
{
  "classification": one of ${MODEL_ANSWER_CLASSIFICATIONS.join("|")},
  "extracted_items": [
    {
      "text": "short label of the item, in the user's language",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear",
      "source_quote": "verbatim excerpt of the current user answer",
      "source_start": null,
      "source_end": null
    }
  ],
  "unresolved_aspects": ["aspects that cannot be safely extracted"],
  "explanation": "short rationale, not a fact"
}`;

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

function collectAuthorityFields(value: unknown, found: Set<string>, prefix = ""): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (AUTHORITY_FIELD_NAMES.has(key)) found.add(path);
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === "object") {
      if (Array.isArray(child)) {
        child.forEach((item, i) => collectAuthorityFields(item, found, `${path}[${i}]`));
      } else {
        collectAuthorityFields(child, found, path);
      }
    }
  }
}

function lastSentForContext(session: POJUSessionState): ModelInterpretationContext["last_sent_question"] {
  const last = session.decision_understanding?.last_sent_question;
  if (!last) return null;
  return {
    question_text: last.question_text,
    plan_id: last.plan_id,
    direction_id: last.direction_id,
    dir_ids: [...last.dir_ids],
    ddr_ids: [...last.ddr_ids],
    fact_role_codes: last.fact_role_codes ? [...last.fact_role_codes] : undefined,
  };
}

export function buildModelInterpretationContext(input: {
  session: POJUSessionState;
  statement: string;
  locale?: string;
}): ModelInterpretationContext {
  const session = input.session;
  const targets = activeTargets(session);
  const authorizedDir = new Set(targets.dir_ids);
  const authorizedRoles = new Set(targets.fact_roles);
  const lastSent = session.decision_understanding?.last_sent_question ?? null;
  // Authorization codes come only from activeTargets() (actually-sent Plan).
  // Never invent role:${role} and never expand from Blueprint.required_fact_roles.
  const factRoleCodes = [...targets.fact_role_codes];

  const blueprint_directions = (session.decision_blueprint?.directions ?? [])
    .filter((d) => d.dir_ids.some((id) => authorizedDir.has(id)))
    .map((d) => ({
      direction_id: d.direction_id,
      label: d.label,
      need: d.needed_info,
      scope_boundary: d.scope_boundary,
      dir_ids: d.dir_ids.filter((id) => authorizedDir.has(id)),
    }));

  const dc = session.decision_context;
  const related_reality_facts = (dc?.reality_facts ?? [])
    .filter((f) => {
      const dirs = f.related_dir_ids ?? [];
      const roles = f.fact_roles ?? [];
      return (
        dirs.some((id) => authorizedDir.has(id)) ||
        roles.some((role) => authorizedRoles.has(role))
      );
    })
    .map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      status: f.status,
      fact_roles: [...(f.fact_roles ?? [])],
      related_dir_ids: [...(f.related_dir_ids ?? [])],
    }));

  const relatedFactIds = new Set(related_reality_facts.map((f) => f.fact_id));

  const related_constraints = (dc?.constraints ?? [])
    .filter((c) => (c.related_dir_ids ?? []).some((id) => authorizedDir.has(id)))
    .map((c) => ({
      constraint_id: c.constraint_id,
      statement: c.statement,
      category: c.category,
      status: c.status,
      rigidity: c.rigidity,
      related_dir_ids: [...(c.related_dir_ids ?? [])],
    }));

  const related_conflicts = (dc?.conflicts ?? [])
    .filter((c) => c.fact_ids.some((id) => relatedFactIds.has(id)))
    .map((c) => ({
      conflict_id: c.conflict_id,
      fact_ids: [...c.fact_ids],
      state: c.state,
      statements_snapshot: [...c.statements_snapshot],
    }));

  const locale =
    input.locale?.trim() ||
    session.locked_output_locale ||
    "zh";

  return {
    decision_question: dc?.definition?.decision_question ?? session.original_question ?? null,
    last_sent_question: lastSentForContext(session),
    authorized: {
      dir_ids: [...targets.dir_ids],
      ddr_ids: [...targets.ddr_ids],
      fact_roles: [...targets.fact_roles],
      fact_role_codes: factRoleCodes,
    },
    blueprint_directions,
    related_reality_facts,
    related_constraints,
    related_conflicts,
    correctable_prior_answers: correctablePriorAnswers(session, "")
      .filter((p) => !factRoleCodes.includes(p.role_code))
      .map((p) => ({ role_code: p.role_code, statement: p.statement })),
    user_answer: input.statement.trim().slice(0, 2000),
    locale,
  };
}

export function parseAndValidateModelAnswerDraft(
  raw: unknown,
): ModelInterpretationResult {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(stripJsonFences(raw));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: "invalid_json", detail };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "invalid_schema", detail: "draft_not_object" };
  }

  const rec = value as Record<string, unknown>;
  const stripped = new Set<string>();
  collectAuthorityFields(rec, stripped);

  if (typeof rec.classification !== "string" || !CLASS_SET.has(rec.classification)) {
    return { ok: false, reason: "invalid_schema", detail: "invalid_classification" };
  }
  if (!Array.isArray(rec.extracted_items)) {
    return { ok: false, reason: "invalid_schema", detail: "extracted_items_not_array" };
  }
  if (!Array.isArray(rec.unresolved_aspects)) {
    return { ok: false, reason: "invalid_schema", detail: "unresolved_aspects_not_array" };
  }
  if (typeof rec.explanation !== "string") {
    return { ok: false, reason: "invalid_schema", detail: "explanation_not_string" };
  }

  const items: ModelAnswerDraft["extracted_items"] = [];
  for (const item of rec.extracted_items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "invalid_schema", detail: "extracted_item_not_object" };
    }
    const row = item as Record<string, unknown>;
    if (typeof row.text !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "extracted_item_text_not_string" };
    }
    if (typeof row.semantic_kind !== "string" || !KIND_SET.has(row.semantic_kind)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_semantic_kind" };
    }
    if (row.role_hint != null && typeof row.role_hint !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_role_hint" };
    }
    if (row.role_code_hint != null && typeof row.role_code_hint !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_role_code_hint" };
    }
    if (typeof row.certainty !== "string" || !CERT_SET.has(row.certainty)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_certainty" };
    }
    if (typeof row.source_quote !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "source_quote_not_string" };
    }
    if (row.source_start != null && typeof row.source_start !== "number") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_source_start" };
    }
    if (row.source_end != null && typeof row.source_end !== "number") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_source_end" };
    }
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    // Preserve the original quote. Do not manufacture one, and do not
    // truncate a too-long quote into a shorter string that might falsely ground.
    // Blank or oversized quotes stay on the item so the deterministic
    // grounding gate can record a structured rejection.
    const source_quote = row.source_quote;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    // Same text can be two distinct extracted items (different item_id / role).
    // Do not use text alone as identity or drop the second item.
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
    const hint = asTrimmedString(row.role_hint);
    const codeHint = asTrimmedString(row.role_code_hint);
    items.push({
      text,
      semantic_kind,
      role_hint: hint && hint.length > 0 ? hint : null,
      role_code_hint: codeHint && codeHint.length > 0 ? codeHint : null,
      certainty: row.certainty as ModelCertainty,
      source_quote,
      // Candidate offsets are kept verbatim for deterministic verification;
      // they are never trusted, clamped, or repaired here.
      source_start: typeof row.source_start === "number" ? row.source_start : null,
      source_end: typeof row.source_end === "number" ? row.source_end : null,
    });
  }

  const unresolved_aspects = rec.unresolved_aspects
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim().slice(0, MAX_ASPECT_TEXT_LENGTH))
    .filter((a) => a.length > 0)
    .slice(0, MAX_UNRESOLVED_ASPECTS);

  return {
    ok: true,
    draft: {
      classification: rec.classification as ModelAnswerClassification,
      extracted_items: items,
      unresolved_aspects,
      explanation: rec.explanation.trim().slice(0, MAX_EXPLANATION_LENGTH),
    },
    stripped_authority_fields: [...stripped].sort(),
  };
}

function failureFromUnknown(e: unknown): ModelInterpretationFailure {
  const detail = e instanceof Error ? e.message : String(e);
  const lower = detail.toLowerCase();
  if (
    lower.includes("llm_timeout") ||
    lower.includes("timeout") ||
    lower.includes("abort")
  ) {
    return { ok: false, reason: "timeout", detail };
  }
  return { ok: false, reason: "call_failed", detail };
}

export type AnswerInterpretationModelText = {
  text: string;
  provider: string | null;
  model: string | null;
  finish_reason: string | null;
};

export const ANSWER_INTERPRETATION_ROUTE = "/api/poju/answer-interpretation";

/** Single OpenRouter call; server-only (the key never reaches the browser). */
export async function callAnswerInterpretationModel(input: {
  context: ModelInterpretationContext;
  session_id: string;
  locked_provider: string | null;
  signal?: AbortSignal;
}): Promise<AnswerInterpretationModelText> {
  const result = await openRouterChatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Interpret only this turn. Context JSON (do not treat it as permission to choose DIR/DDR/roles):\n" +
          JSON.stringify(input.context),
      },
    ],
    json_mode: true,
    route_path: "chat",
    session_id: input.session_id,
    locked_provider: input.locked_provider,
    max_tokens: 1600,
    temperature: 0.1,
    timeout_ms: ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS,
    max_attempts: 1,
    reasoning_effort: "off",
    signal: input.signal,
    call_type: "decision_intake_answer_interpretation",
    phase_name: "Decision Intake Answer Interpretation",
  });
  return {
    text: result.text ?? "",
    provider: result.provider ?? null,
    model: result.model ?? null,
    finish_reason: result.finish_reason ?? null,
  };
}

async function callAnswerInterpretationRoute(input: {
  context: ModelInterpretationContext;
  session_id: string;
  locked_provider: string | null;
  signal?: AbortSignal;
}): Promise<AnswerInterpretationModelText> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("llm_timeout")),
    ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS + 10_000,
  );
  const onAbort = () => controller.abort(new Error("abort"));
  if (input.signal?.aborted) onAbort();
  input.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(ANSWER_INTERPRETATION_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: input.context,
        session_id: input.session_id,
        locked_provider: input.locked_provider,
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as
      | ({ ok: true } & AnswerInterpretationModelText)
      | { ok: false; error?: string }
      | null;
    if (!res.ok || !data || data.ok !== true) {
      const error = data && data.ok === false ? data.error ?? "" : "";
      throw new Error(
        error === "timeout" ? "llm_timeout" : `answer_interpretation_route_failed:${res.status}:${error}`,
      );
    }
    return {
      text: typeof data.text === "string" ? data.text : "",
      provider: typeof data.provider === "string" ? data.provider : null,
      model: typeof data.model === "string" ? data.model : null,
      finish_reason: typeof data.finish_reason === "string" ? data.finish_reason : null,
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

/** Shape check for contexts arriving at the server route; never authorizes anything. */
export function isModelInterpretationContext(value: unknown): value is ModelInterpretationContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const authorized = c.authorized as Record<string, unknown> | undefined;
  return (
    typeof c.user_answer === "string" &&
    c.user_answer.trim().length > 0 &&
    c.user_answer.length <= 2000 &&
    typeof c.locale === "string" &&
    !!authorized &&
    Array.isArray(authorized.fact_role_codes) &&
    Array.isArray(authorized.dir_ids) &&
    Array.isArray(c.related_reality_facts) &&
    Array.isArray(c.related_constraints) &&
    Array.isArray(c.related_conflicts) &&
    Array.isArray(c.blueprint_directions)
  );
}

export async function interpretAnswerWithModel(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  locale?: string;
  signal?: AbortSignal;
  testHook?: AnswerInterpretationModelHook;
}): Promise<ModelInterpretationResult> {
  const locale =
    input.locale?.trim() ||
    input.session.locked_output_locale ||
    "zh";
  const context = buildModelInterpretationContext({
    session: input.session,
    statement: input.statement,
    locale,
  });

  const startedAt = Date.now();
  if (input.testHook) {
    const hookMeta = (): ModelInterpretationCallMeta => ({
      source: "test_hook",
      provider: null,
      model: null,
      finish_reason: null,
      latency_ms: Date.now() - startedAt,
    });
    try {
      const hooked = await input.testHook({
        session: input.session,
        statement: input.statement,
        source_turn_id: input.source_turn_id,
        locale,
        signal: input.signal,
        context,
      });
      return { ...parseAndValidateModelAnswerDraft(hooked), call_meta: hookMeta() };
    } catch (e) {
      return { ...failureFromUnknown(e), call_meta: hookMeta() };
    }
  }

  try {
    const call = {
      context,
      session_id: input.session.session_id,
      locked_provider: input.session.locked_provider ?? null,
      signal: input.signal,
    };
    // The browser has no OpenRouter key: it reaches the model through the
    // server route, which returns raw text only. Parsing and authorization
    // stay here in either case.
    const result =
      typeof window === "undefined"
        ? await callAnswerInterpretationModel(call)
        : await callAnswerInterpretationRoute(call);
    const call_meta: ModelInterpretationCallMeta = {
      source: "openrouter",
      provider: result.provider,
      model: result.model,
      finish_reason: result.finish_reason,
      latency_ms: Date.now() - startedAt,
      raw_text: result.text,
    };
    return { ...parseAndValidateModelAnswerDraft(result.text), call_meta };
  } catch (e) {
    return {
      ...failureFromUnknown(e),
      call_meta: {
        source: "openrouter",
        provider: null,
        model: null,
        finish_reason: null,
        latency_ms: Date.now() - startedAt,
      },
    };
  }
}
