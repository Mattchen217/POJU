/**
 * Production ExplicitNaClassification creation (R6 Final Binding §3 / US §2.7 A3).
 * Distinct from ConfirmationEvent (E1). Not a new E1/E2 type.
 * Only a persisted user N/A declaration action may authorize classification.
 *
 * Production persist entry (mirrors confirmFact):
 *   declareDirNotApplicable(sessionId, input) → mutatePOJUSession
 *     writes session.na_declaration_actions + DC.explicit_na_classifications
 *     + DC.explicit_na_evidence (user_explicit_na)
 */

import {
  mutatePOJUSession,
  type CasWritePOJUSessionResult,
  type MutatePOJUSessionOptions,
} from "@/lib/poju/session-mutation";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  assertNaConditionInDirCatalog,
  loadDirNaCatalog,
  type DirNaCatalogLoadResult,
} from "./catalog";
import type {
  DecisionContext,
  ExplicitNaClassification,
  ExplicitNaEvidence,
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

/** Server allowlist — re-checked at validate time, not only at create. */
export const ALLOWED_NA_CONTROL_IDS: readonly string[] = [
  "na_declare",
  "na_declare_chip",
  "explicit_na_control",
];

const DEFAULT_NA_CONTROLS = ALLOWED_NA_CONTROL_IDS;

export function isAllowedNaControlId(controlId: string): boolean {
  return ALLOWED_NA_CONTROL_IDS.includes(controlId);
}

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
  if (!allowed.includes(action.control_id) || !isAllowedNaControlId(action.control_id)) {
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

function appendUserExplicitNaEvidence(
  dc: DecisionContext,
  evidence: ExplicitNaEvidence,
  nowIso: string,
): DecisionContext {
  const existing = dc.explicit_na_evidence ?? [];
  if (existing.some((e) => e.evidence_id === evidence.evidence_id)) {
    return dc;
  }
  return {
    ...dc,
    explicit_na_evidence: [...existing, evidence],
    updated_at: nowIso,
  };
}

/**
 * Client/UI may propose these fields only. Server fills actor/session/context.
 * Never accept model-authored actor or session_id.
 */
export type DeclareDirNaInput = {
  operation_id: string;
  declaration_action_id: string;
  /** Must be on ALLOWED_NA_CONTROL_IDS — server re-checks. */
  control_id: string;
  fact_id?: string;
  constraint_id?: string;
  dir_id: string;
  na_condition_code: string;
  declaration_turn_id: string;
  expires_at?: string | null;
  /**
   * @deprecated Ignored for authorization. Production membership comes only from
   * `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)` + assertNaConditionInDirCatalog.
   * Retained for caller compat; do not trust, merge, or fall back to this list.
   */
  dir_na_conditions: readonly string[];
  occurred_at?: string;
};

export type DeclareDirNaCatalogMembershipResult =
  | { ok: true; dirNaConditions: readonly string[] }
  | {
      ok: false;
      reason_code:
        | Extract<DirNaCatalogLoadResult, { ok: false }>["reason_code"]
        | "dir_not_in_catalog"
        | "na_condition_not_in_catalog";
    };

/**
 * Pure mapper — preserve loader reason codes; unit-testable without Registry injection.
 * On success, `dirNaConditions` come from the same validated load.entries snapshot.
 */
export function membershipFromCatalogLoad(
  load: DirNaCatalogLoadResult,
  dirId: string,
  naConditionCode: string,
): DeclareDirNaCatalogMembershipResult {
  if (!load.ok) {
    return { ok: false, reason_code: load.reason_code };
  }
  const membership = assertNaConditionInDirCatalog(load, dirId, naConditionCode);
  if (!membership.ok) {
    return { ok: false, reason_code: membership.reason_code };
  }
  const entry = load.entries.find((e) => e.dir_id === dirId);
  if (!entry) {
    return { ok: false, reason_code: "dir_not_in_catalog" };
  }
  return { ok: true, dirNaConditions: entry.na_conditions };
}

/** Production write join: load(ACTIVE) then membershipFromCatalogLoad. */
export function resolveDeclareDirNaCatalogMembership(
  dirId: string,
  naConditionCode: string,
): DeclareDirNaCatalogMembershipResult {
  return membershipFromCatalogLoad(
    loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION),
    dirId,
    naConditionCode,
  );
}

export type DeclareDirNaResult = CasWritePOJUSessionResult & {
  action: UserNaDeclarationAction;
  classification: ExplicitNaClassification;
  evidence: ExplicitNaEvidence;
  outcome: "appended" | "idempotent_skip";
};

export type ApplyDeclareDirNaResult = {
  session: POJUSessionState;
  action: UserNaDeclarationAction;
  classification: ExplicitNaClassification;
  evidence: ExplicitNaEvidence;
  outcome: "appended" | "idempotent_skip";
};

/**
 * Pure session apply used by declareDirNotApplicable CAS callback.
 * Server determines actor / session_id / context_id from `latest` — never from input.
 */
export function applyDeclareDirNaToSession(
  latest: POJUSessionState,
  expectedSessionId: string,
  input: DeclareDirNaInput,
  nowIso: string,
): ApplyDeclareDirNaResult {
  if (latest.session_id !== expectedSessionId) {
    throw new NaDeclarationError(
      NA_DECLARATION_SOURCE_INVALID,
      "session_id mismatch",
    );
  }
  if (!isAllowedNaControlId(input.control_id)) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      `control_id not allowlisted: ${input.control_id}`,
    );
  }
  if (!input.fact_id && !input.constraint_id) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "fact_id or constraint_id required",
    );
  }
  if (input.fact_id && input.constraint_id) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "fact_id and constraint_id are mutually exclusive",
    );
  }

  const dc = latest.decision_context;
  if (!dc) {
    throw new NaDeclarationError(
      NA_DECLARATION_CONTEXT_INVALID,
      "Decision Context missing",
    );
  }
  if (dc.status !== "draft") {
    throw new NaDeclarationError(
      NA_DECLARATION_CONTEXT_INVALID,
      "Decision Context is not writable",
    );
  }

  // Catalog join at write entry (design §4.1) — before idempotent branch.
  // input.dir_na_conditions is ignored for authorization.
  const catalogMembership = resolveDeclareDirNaCatalogMembership(
    input.dir_id,
    input.na_condition_code,
  );
  if (!catalogMembership.ok) {
    throw new NaDeclarationError(
      catalogMembership.reason_code,
      catalogMembership.reason_code,
    );
  }

  // Server-authored identity — never from client/model.
  const source_ref: NaSourceRef = input.fact_id
    ? { kind: "reality_fact", fact_id: input.fact_id }
    : { kind: "constraint", constraint_id: input.constraint_id! };

  const prior = (latest.na_declaration_actions ?? []).find(
    (a) => a.declaration_action_id === input.declaration_action_id,
  );
  if (prior) {
    // Revoked actions must not reactivate via replay.
    if (prior.revoked) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "action_revoked_replay",
      );
    }

    // Session / Decision Context ownership — fail-closed, never cross-session skip.
    if (
      prior.session_id !== latest.session_id ||
      prior.session_id !== expectedSessionId
    ) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_session_mismatch",
      );
    }
    if (prior.context_id !== dc.context_id) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_context_mismatch",
      );
    }

    const inputExpiresAt =
      input.expires_at === undefined ? null : input.expires_at;

    // Same action_id with different binding payload → hard reject (not silent prior).
    if (prior.control_id !== input.control_id) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_control_mismatch",
      );
    }
    if (prior.dir_id !== input.dir_id) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_dir_mismatch",
      );
    }
    if (prior.na_condition_code !== input.na_condition_code) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_condition_mismatch",
      );
    }
    if (!sourceRefEquals(prior.source_ref, source_ref)) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_source_mismatch",
      );
    }
    if (prior.declaration_turn_id !== input.declaration_turn_id) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_turn_mismatch",
      );
    }
    if (prior.expires_at !== inputExpiresAt) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_expires_mismatch",
      );
    }

    const cls = (dc.explicit_na_classifications ?? []).find(
      (c) => c.declaration_action_id === prior.declaration_action_id,
    );
    if (!cls) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_action_missing_classification",
      );
    }
    if (cls.revoked) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "classification_revoked_replay",
      );
    }
    // Classification must belong to the current DC (and match prior action binding).
    if (cls.context_id !== dc.context_id) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_classification_context_mismatch",
      );
    }
    if (
      cls.context_id !== prior.context_id ||
      cls.dir_id !== prior.dir_id ||
      cls.na_condition_code !== prior.na_condition_code ||
      cls.declaration_turn_id !== prior.declaration_turn_id ||
      cls.expires_at !== prior.expires_at ||
      !sourceRefEquals(cls.source_ref, prior.source_ref)
    ) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_classification_binding_mismatch",
      );
    }

    const expectedEvId = `na_ev_${prior.declaration_action_id}`;
    const ev = (dc.explicit_na_evidence ?? []).find(
      (e) => e.evidence_id === expectedEvId,
    );
    if (
      !ev ||
      ev.evidence_type !== "user_explicit_na" ||
      ev.target !== "dir"
    ) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_action_missing_evidence",
      );
    }
    if (ev.revoked) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "evidence_revoked_replay",
      );
    }
    // Evidence is looked up on current DC only; still require payload binding match.
    if (
      ev.dir_id !== prior.dir_id ||
      ev.na_condition_code !== prior.na_condition_code ||
      !sourceRefEquals(ev.source_ref, prior.source_ref)
    ) {
      throw new NaDeclarationError(
        NA_DECLARATION_INVALID,
        "idempotent_evidence_binding_mismatch",
      );
    }

    return {
      session: latest,
      action: prior,
      classification: cls,
      evidence: ev,
      outcome: "idempotent_skip",
    };
  }

  const actionDraft: UserNaDeclarationAction = {
    declaration_action_id: input.declaration_action_id,
    session_id: latest.session_id,
    context_id: dc.context_id,
    actor: "user",
    control_id: input.control_id,
    source_ref,
    dir_id: input.dir_id,
    na_condition_code: input.na_condition_code,
    declaration_turn_id: input.declaration_turn_id,
    occurred_at: nowIso,
    revoked: false,
    expires_at: input.expires_at === undefined ? null : input.expires_at,
  };

  const created = createExplicitNaClassificationFromUserDeclaration({
    action: actionDraft,
    dc,
    nowIso,
    dirNaConditions: catalogMembership.dirNaConditions,
  });
  if (!created.ok) {
    throw new NaDeclarationError(NA_DECLARATION_INVALID, created.reason_code);
  }

  const evidence: ExplicitNaEvidence = {
    evidence_id: `na_ev_${input.declaration_action_id}`,
    target: "dir",
    dir_id: input.dir_id,
    na_condition_code: input.na_condition_code,
    evidence_type: "user_explicit_na",
    source_ref,
    written_by: "code",
    revoked: false,
  };

  let nextDc = appendNaClassificationToDc(dc, created.classification, nowIso);
  nextDc = appendUserExplicitNaEvidence(nextDc, evidence, nowIso);
  nextDc = { ...nextDc, version: dc.version + 1 };

  return {
    session: {
      ...latest,
      na_declaration_actions: appendNaDeclarationAction(
        latest.na_declaration_actions,
        created.action,
      ),
      decision_context: nextDc,
    },
    action: created.action,
    classification: created.classification,
    evidence,
    outcome: "appended",
  };
}

/**
 * Production entry — persist user DIR N/A declaration (CAS, mirrors confirmFact).
 * Call chain: UI control → declareDirNotApplicable → mutatePOJUSession
 *   → applyDeclareDirNaToSession → session.na_declaration_actions + DC writes.
 */
export async function declareDirNotApplicable(
  sessionId: string,
  input: DeclareDirNaInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<DeclareDirNaResult> {
  const box: { value: ApplyDeclareDirNaResult | null } = { value: null };
  const now = input.occurred_at ?? new Date().toISOString();

  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        const applied = applyDeclareDirNaToSession(latest, sessionId, input, now);
        box.value = applied;
        return applied.session;
      },
    },
    opts,
  );

  if (!box.value) {
    throw new NaDeclarationError(
      NA_DECLARATION_INVALID,
      "declareDirNotApplicable produced no action",
    );
  }

  return {
    ...result,
    action: box.value.action,
    classification: box.value.classification,
    evidence: box.value.evidence,
    outcome: box.value.outcome,
  };
}

/**
 * Production revoke — marks action + classification + matching evidence revoked.
 * Syncs so subsequent validate fail-closed.
 */
export async function revokeDirNaDeclaration(
  sessionId: string,
  input: {
    operation_id: string;
    declaration_action_id: string;
    revoked_at?: string;
  },
  opts: MutatePOJUSessionOptions = {},
): Promise<CasWritePOJUSessionResult> {
  const now = input.revoked_at ?? new Date().toISOString();
  return mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => {
        if (latest.session_id !== sessionId) {
          throw new NaDeclarationError(
            NA_DECLARATION_SOURCE_INVALID,
            "session_id mismatch",
          );
        }
        const dc = latest.decision_context;
        if (!dc) {
          throw new NaDeclarationError(
            NA_DECLARATION_CONTEXT_INVALID,
            "Decision Context missing",
          );
        }
        if (dc.status !== "draft") {
          throw new NaDeclarationError(
            NA_DECLARATION_CONTEXT_INVALID,
            "Decision Context is not writable",
          );
        }
        const actions = (latest.na_declaration_actions ?? []).map((a) =>
          a.declaration_action_id === input.declaration_action_id
            ? { ...a, revoked: true }
            : a,
        );
        const classifications = (dc.explicit_na_classifications ?? []).map(
          (c) =>
            c.declaration_action_id === input.declaration_action_id
              ? { ...c, revoked: true }
              : c,
        );
        const evidence = (dc.explicit_na_evidence ?? []).map((e) => {
          if (e.evidence_type !== "user_explicit_na") return e;
          if (e.evidence_id !== `na_ev_${input.declaration_action_id}`) return e;
          return { ...e, revoked: true };
        });
        return {
          ...latest,
          na_declaration_actions: actions,
          decision_context: {
            ...dc,
            explicit_na_classifications: classifications,
            explicit_na_evidence: evidence,
            version: dc.version + 1,
            updated_at: now,
          },
        };
      },
    },
    opts,
  );
}
