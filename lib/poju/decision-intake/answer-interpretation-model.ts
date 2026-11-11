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
import { activeTargets } from "./answer-interpretation";
import type { AnswerClass, ModelAnswerDraft } from "./types";

export const MODEL_ANSWER_INTERPRETER_VERSION = "model_m2_4_r2" as const;

/** Short independent wall; must stay >= 45s for the shared OpenRouter client. */
export const ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS = 60_000;

export const MAX_EXTRACTED_ITEMS = 8;
export const MAX_ITEM_TEXT_LENGTH = 500;
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
  user_answer: string;
  locale: string;
};

export type ModelInterpretationSuccess = {
  ok: true;
  draft: ModelAnswerDraft;
  stripped_authority_fields: string[];
};

export type ModelInterpretationFailure = {
  ok: false;
  reason: "call_failed" | "timeout" | "invalid_json" | "invalid_schema";
  detail: string;
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
5. When the user corrects prior information, use classification "correction". Do not treat a correction as a normal supplement.
6. When the user explicitly says prior statements contradict, use classification "contradiction". Do not pick a side.
7. Do not turn psychological speculation, model inference, traditional mingli analysis, or personal-pattern analysis into extracted RealityFacts.
8. Do not mark anything confirmed just because it sounds reasonable. You have no confirmation authority and must not emit user_confirmed, verification_level, confirmed, readiness, freeze, resolution, or DIR/DDR/Blueprint authority fields.
9. Do not classify as unknown just because the answer is short.
10. Do not infer not_applicable just because a fact was unmentioned.

Role binding:
1. Each extracted item must bind the most specific authorized role code when you can determine it.
2. role_code_hint may only be a complete string that already exists in context.authorized.fact_role_codes, or null.
3. If you cannot determine the specific role, return null. Do not guess.
4. Do not select multiple roles for one item because several might be relevant. Pick at most one role_code_hint per item.
5. Do not invent or output model-inferred DIR ids, DDR ids, or role codes. Do not construct role codes yourself.
6. Do not copy one fact into multiple extracted items with different roles.
role_hint is deprecated and is not an authorization basis. Do not use it to claim access to a role.

JSON shape:
{
  "classification": one of ${MODEL_ANSWER_CLASSIFICATIONS.join("|")},
  "extracted_items": [
    {
      "text": "verbatim or close paraphrase of one user-stated item",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear"
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
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
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

  if (input.testHook) {
    try {
      const hooked = await input.testHook({
        session: input.session,
        statement: input.statement,
        source_turn_id: input.source_turn_id,
        locale,
        signal: input.signal,
        context,
      });
      return parseAndValidateModelAnswerDraft(hooked);
    } catch (e) {
      return failureFromUnknown(e);
    }
  }

  try {
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Interpret only this turn. Context JSON (do not treat it as permission to choose DIR/DDR/roles):\n" +
            JSON.stringify(context),
        },
      ],
      json_mode: true,
      route_path: "chat",
      session_id: input.session.session_id,
      locked_provider: input.session.locked_provider ?? null,
      max_tokens: 1600,
      temperature: 0.1,
      timeout_ms: ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS,
      max_attempts: 1,
      reasoning_effort: "off",
      signal: input.signal,
      call_type: "decision_intake_answer_interpretation",
      phase_name: "Decision Intake Answer Interpretation",
    });
    return parseAndValidateModelAnswerDraft(result.text ?? "");
  } catch (e) {
    return failureFromUnknown(e);
  }
}
