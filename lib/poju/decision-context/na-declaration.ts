/**
 * Production ExplicitNaClassification creation (R6 Final Binding §3 / US §2.7 A3).
 * Distinct from ConfirmationEvent (E1). Not a new E1/E2 type.
 * Only a persisted user N/A declaration action may authorize classification.
 */

import type {
  DecisionContext,
  ExplicitNaClassification,
  NaSourceRef,
} from "./types";

export const NA_DECLARATION_INVALID = "NA_DECLARATION_INVALID";
export const NA_DECLARATION_SOURCE_INVALID = "NA_DECLARATION_SOURCE_INVALID";
export const NA_DECLARATION_CONTEXT_INVALID = "NA_DECLARATION_CONTEXT_INVALID";

export class NaDeclarationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NaDeclarationError";
    this.code = code;
  }
}

/**
 * Persisted user action that explicitly declares a catalog N/A condition.
 * Must be created by the production UI/control path — never by model/keyword/embedding.
 */
export type UserNaDeclarationAction = {
  declaration_action_id: string;
  session_id: string;
  context_id: string;
  actor: "user";
  /** Control that captured N/A intent (e.g. na_declare_chip) — not confirm_fact. */
  control_id: string;
  source_ref: NaSourceRef;
  dir_id: string;
  na_condition_code: string;
  declaration_turn_id: string;
  occurred_at: string;
  revoked: boolean;
  expires_at: string | null;
};

export type CreateNaClassificationInput = {
  action: UserNaDeclarationAction;
  dc: DecisionContext;
  /** Wall clock for expiry; must be valid ISO. */
  nowIso: string;
  /**
   * Catalog membership for the target DIR. Fail-closed if condition absent.
   */
  dirNaConditions: readonly string[];
  /**
   * Allowed N/A declaration control ids (code allowlist).
   * Model-proposed control ids outside this set are rejected.
   */
  allowedControlIds?: readonly string[];
};

export type CreateNaClassificationResult =
  | { ok: true; classification: ExplicitNaClassification; action: UserNaDeclarationAction }
  | { ok: false; reason_code: string };

const DEFAULT_NA_CONTROLS = ["na_declare", "na_declare_chip", "explicit_na_control"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

/** Parse ISO timestamp; null if invalid (NaN / non-finite). */
export function parseValidIsoMs(value: string): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Expiry check — fail-closed on invalid dates.
 * @returns true if expired; "invalid" if either timestamp cannot be parsed.
 */
export function checkExpiresAt(
  expiresAt: string | null | undefined,
  nowIso: string,
): boolean | "invalid" {
  if (expiresAt == null || expiresAt === "") return false;
  const exp = parseValidIsoMs(expiresAt);
  const now = parseValidIsoMs(nowIso);
  if (exp === null || now === null) return "invalid";
  return exp <= now;
}

export function sourceRefEquals(a: NaSourceRef, b: NaSourceRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "reality_fact" && b.kind === "reality_fact") {
    return a.fact_id === b.fact_id;
  }
  if (a.kind === "constraint" && b.kind === "constraint") {
    return a.constraint_id === b.constraint_id;
  }
  return false;
}

/** Validate / normalize a persisted UserNaDeclarationAction. */
export function validateUserNaDeclarationAction(
  raw: unknown,
): UserNaDeclarationAction {
  if (!isPlainObject(raw)) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "UserNaDeclarationAction must be an object",
    );
  }
  const declaration_action_id = requireNonEmptyString(
    raw.declaration_action_id,
    "declaration_action_id",
  );
  const session_id = requireNonEmptyString(raw.session_id, "session_id");
  const context_id = requireNonEmptyString(raw.context_id, "context_id");
  if (raw.actor !== "user") {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "actor must be user",
    );
  }
  const control_id = requireNonEmptyString(raw.control_id, "control_id");
  const dir_id = requireNonEmptyString(raw.dir_id, "dir_id");
  const na_condition_code = requireNonEmptyString(
    raw.na_condition_code,
    "na_condition_code",
  );
  const declaration_turn_id = requireNonEmptyString(
    raw.declaration_turn_id,
    "declaration_turn_id",
  );
  const occurred_at = requireNonEmptyString(raw.occurred_at, "occurred_at");
  if (parseValidIsoMs(occurred_at) === null) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "occurred_at must be valid ISO",
    );
  }
  if (typeof raw.revoked !== "boolean") {
    throw new NaDeclarationError(NA_DECLARATION_INVALID, "revoked must be boolean");
  }
  let expires_at: string | null;
  if (raw.expires_at === null || raw.expires_at === undefined) {
    expires_at = null;
  } else {
    expires_at = requireNonEmptyString(raw.expires_at, "expires_at");
    if (parseValidIsoMs(expires_at) === null) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "expires_at must be valid ISO or null",
      );
    }
  }

  const src = raw.source_ref;
  if (!isPlainObject(src)) {
    throw new NaDeclarationError(NA_DECLARATION_INVALID, "source_ref required");
  }
  let source_ref: NaSourceRef;
  if (src.kind === "reality_fact") {
    source_ref = {
      kind: "reality_fact",
      fact_id: requireNonEmptyString(src.fact_id, "source_ref.fact_id"),
    };
  } else if (src.kind === "constraint") {
    source_ref = {
      kind: "constraint",
      constraint_id: requireNonEmptyString(
        src.constraint_id,
        "source_ref.constraint_id",
      ),
    };
  } else {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "source_ref.kind must be reality_fact|constraint",
    );
  }

  return {
    declaration_action_id,
    session_id,
    context_id,
    actor: "user",
    control_id,
    source_ref,
    dir_id,
    na_condition_code,
    declaration_turn_id,
    occurred_at,
    revoked: raw.revoked,
    expires_at,
  };
}

function assertSourceLiveOnDc(
  dc: DecisionContext,
  source_ref: NaSourceRef,
  dir_id: string,
): void {
  if (source_ref.kind === "reality_fact") {
    const fact = dc.reality_facts.find((f) => f.fact_id === source_ref.fact_id);
    if (!fact) {
      throw new NaDeclarationError(
        NA_DECLARATION_SOURCE_INVALID,
        `fact not on DC: ${source_ref.fact_id}`,
      );
    }
    if (!(fact.related_dir_ids ?? []).includes(dir_id)) {
      throw new NaDeclarationError(
        NA_DECLARATION_SOURCE_INVALID,
        "fact not associated to target DIR",
      );
    }
    return;
  }
  const constraint = dc.constraints.find(
    (c) => c.constraint_id === source_ref.constraint_id,
  );
  if (!constraint) {
    throw new NaDeclarationError(
      NA_DECLARATION_SOURCE_INVALID,
      `constraint not on DC: ${source_ref.constraint_id}`,
    );
  }
  if (!(constraint.related_dir_ids ?? []).includes(dir_id)) {
    throw new NaDeclarationError(
      NA_DECLARATION_SOURCE_INVALID,
      "constraint not associated to target DIR",
    );
  }
}

/**
 * Production create path: only a validated user declaration action may mint
 * ExplicitNaClassification. Model / keyword / embedding cannot set authority.
 */
export function createExplicitNaClassificationFromUserDeclaration(
  input: CreateNaClassificationInput,
): CreateNaClassificationResult {
  let action: UserNaDeclarationAction;
  try {
    action = validateUserNaDeclarationAction(input.action);
  } catch (e) {
    return {
      ok: false,
      reason_code:
        e instanceof NaDeclarationError ? e.code.toLowerCase() : "action_invalid",
    };
  }

  if (action.context_id !== input.dc.context_id) {
    return { ok: false, reason_code: "context_id_mismatch" };
  }
  if (action.actor !== "user") {
    return { ok: false, reason_code: "actor_not_user" };
  }
  if (action.revoked) {
    return { ok: false, reason_code: "action_revoked" };
  }

  const expiry = checkExpiresAt(action.expires_at, input.nowIso);
  if (expiry === "invalid") {
    return { ok: false, reason_code: "action_expiry_invalid" };
  }
  if (expiry === true) {
    return { ok: false, reason_code: "action_expired" };
  }
  if (parseValidIsoMs(input.nowIso) === null) {
    return { ok: false, reason_code: "now_iso_invalid" };
  }

  const allowed = input.allowedControlIds ?? DEFAULT_NA_CONTROLS;
  if (!allowed.includes(action.control_id)) {
    return { ok: false, reason_code: "control_id_not_allowlisted" };
  }

  if (!input.dirNaConditions.includes(action.na_condition_code)) {
    return { ok: false, reason_code: "na_condition_not_in_catalog" };
  }

  const dir = input.dc.dirs.find((d) => d.dir_id === action.dir_id);
  if (!dir || dir.id_lifecycle === "deprecated") {
    return { ok: false, reason_code: "dir_missing_or_deprecated" };
  }

  try {
    assertSourceLiveOnDc(input.dc, action.source_ref, action.dir_id);
  } catch (e) {
    return {
      ok: false,
      reason_code:
        e instanceof NaDeclarationError
          ? "source_invalid"
          : "source_invalid",
    };
  }

  const classification: ExplicitNaClassification = {
    classification_id: `na_cls_${action.declaration_action_id}`,
    context_id: action.context_id,
    source_ref: action.source_ref,
    dir_id: action.dir_id,
    na_condition_code: action.na_condition_code,
    authority: "user_declared",
    written_by: "code",
    declaration_action_id: action.declaration_action_id,
    declaration_turn_id: action.declaration_turn_id,
    revoked: false,
    expires_at: action.expires_at,
    created_at: input.nowIso,
  };

  return { ok: true, classification, action };
}

/**
 * Append classification to DC when create succeeded (version bump left to caller persist).
 */
export function appendNaClassificationToDc(
  dc: DecisionContext,
  classification: ExplicitNaClassification,
  nowIso: string,
): DecisionContext {
  const existing = dc.explicit_na_classifications ?? [];
  if (existing.some((c) => c.classification_id === classification.classification_id)) {
    return dc;
  }
  return {
    ...dc,
    explicit_na_classifications: [...existing, classification],
    updated_at: nowIso,
  };
}

/** Append action to session store (idempotent by declaration_action_id). */
export function appendNaDeclarationAction(
  existing: UserNaDeclarationAction[] | null | undefined,
  action: UserNaDeclarationAction,
): UserNaDeclarationAction[] {
  const list = existing ?? [];
  if (list.some((a) => a.declaration_action_id === action.declaration_action_id)) {
    return list;
  }
  return [...list, action];
}
