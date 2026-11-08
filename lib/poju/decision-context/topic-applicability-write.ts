/**
 * Production Session writer for topic_applicability_evals (S9-A2 / S9-R1).
 *
 * Only explicit user confirmation controls may write. LLM "unrelated" and
 * user decline/skip MUST NOT auto-generate N/A authority rows.
 *
 * Call chain (production):
 *   UI confirm chip
 *     → confirmTopicApplicabilityEvalFromUiClick
 *       → mutatePOJUSession CAS
 *         → append bound user confirmation turn (client_id)
 *         → applyTopicApplicabilityEvalToSession
 *           → session.topic_applicability_evals + topic_catalog_version (ACTIVE)
 *
 * applyTopicApplicabilityEvalToSession REQUIRES the confirmation turn to already
 * exist on Session.messages as a user message whose meta.topic_applicability_confirm
 * binds session_id, rule_id, control_id, target_dir_id, and not_applicable.
 */

import {
  mutatePOJUSession,
  type CasWritePOJUSessionResult,
  type MutatePOJUSessionOptions,
} from "@/lib/poju/session-mutation";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import { findSessionMessageByTurnId } from "./confirmation-event";
import {
  ACTIVE_TOPIC_APPLICABILITY_VERSION,
  findTopicRuleDefinition,
  loadTopicApplicability,
} from "./catalog";
import { parseValidIsoMs, checkExpiresAt } from "./na-declaration";
import type { AuthoritativeTopicEvalRecord } from "./topic-eval-authority";

export const TOPIC_EVAL_WRITE_INVALID = "TOPIC_EVAL_WRITE_INVALID";
export const TOPIC_EVAL_WRITE_CONTEXT_INVALID = "TOPIC_EVAL_WRITE_CONTEXT_INVALID";
export const TOPIC_EVAL_WRITE_SOURCE_INVALID = "TOPIC_EVAL_WRITE_SOURCE_INVALID";

export class TopicEvalWriteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TopicEvalWriteError";
    this.code = code;
  }
}

/** Explicit user confirmation controls only — never model/keyword/decline/skip. */
export const ALLOWED_TOPIC_EVAL_CONTROL_IDS: readonly string[] = [
  "topic_applicability_confirm",
  "topic_na_confirm_chip",
];

/** Decline / skip / ordinary controls — must never mint N/A authority. */
export const FORBIDDEN_TOPIC_EVAL_CONTROL_IDS: readonly string[] = [
  "topic_applicability_decline",
  "topic_applicability_skip",
  "topic_na_decline_chip",
  "llm_unrelated",
  "user_skip",
  "user_decline",
  "ordinary_chat",
];

export function isAllowedTopicEvalControlId(controlId: string): boolean {
  return ALLOWED_TOPIC_EVAL_CONTROL_IDS.includes(controlId);
}

export type TopicApplicabilityConfirmMeta = {
  rule_id: string;
  control_id: string;
  not_applicable: boolean;
  session_id: string;
  target_dir_id: string;
};

export type ConfirmTopicApplicabilityInput = {
  operation_id: string;
  eval_id: string;
  rule_id: string;
  /** Must be on ALLOWED_TOPIC_EVAL_CONTROL_IDS. */
  control_id: string;
  confirmation_turn_id: string;
  /** Wall clock; also used as evaluated_at when omitted. */
  occurred_at?: string;
  expires_at: string;
  /** Only true authorizes N/A. false keeps applicable (no N/A authority). */
  not_applicable: boolean;
};

export type ApplyTopicApplicabilityEvalResult = {
  session: POJUSessionState;
  record: AuthoritativeTopicEvalRecord;
  outcome: "appended" | "idempotent_skip" | "superseded_prior";
};

function requireDraftDc(latest: POJUSessionState): void {
  const dc = latest.decision_context;
  if (!dc) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_CONTEXT_INVALID,
      "Decision Context missing",
    );
  }
  if (dc.status !== "draft") {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_CONTEXT_INVALID,
      "Decision Context is not writable",
    );
  }
}

/**
 * Bind confirmation_turn_id to a real Session user confirmation event.
 * Rejects missing / assistant / forged / cross-session / unbound rule turns.
 */
export function assertTopicConfirmTurnBound(
  latest: POJUSessionState,
  expectedSessionId: string,
  input: ConfirmTopicApplicabilityInput,
  expectedTargetDirId: string,
): POJUMessage {
  if (latest.session_id !== expectedSessionId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "session_id mismatch",
    );
  }
  const turnId = input.confirmation_turn_id.trim();
  if (!turnId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "confirmation_turn_id required",
    );
  }
  const message = findSessionMessageByTurnId(latest.messages, turnId);
  if (!message) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      `confirmation_turn_id does not map to a message in current Session: ${turnId}`,
    );
  }
  if (message.role !== "user") {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      `confirmation_turn_id must reference a user message, got role=${message.role}`,
    );
  }
  const meta = message.meta?.topic_applicability_confirm;
  if (!meta) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn missing topic_applicability_confirm meta (ordinary chat cannot mint N/A)",
    );
  }
  if (meta.session_id !== expectedSessionId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn session_id mismatch (cross-session)",
    );
  }
  if (meta.rule_id !== input.rule_id) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn rule_id mismatch",
    );
  }
  if (meta.control_id !== input.control_id) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn control_id mismatch",
    );
  }
  if (meta.target_dir_id !== expectedTargetDirId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn target_dir_id mismatch",
    );
  }
  if (meta.not_applicable !== input.not_applicable) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "confirmation turn not_applicable mismatch",
    );
  }
  if (FORBIDDEN_TOPIC_EVAL_CONTROL_IDS.includes(meta.control_id)) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      `control_id forbidden for N/A authority: ${meta.control_id}`,
    );
  }
  return message;
}

/**
 * Pure Session apply used by confirmTopicApplicabilityEval CAS callback.
 * Rule membership comes only from ACTIVE Topic Applicability loader.
 * Confirmation turn MUST already exist on Session.messages (user + bound meta).
 */
export function applyTopicApplicabilityEvalToSession(
  latest: POJUSessionState,
  expectedSessionId: string,
  input: ConfirmTopicApplicabilityInput,
  nowIso: string,
): ApplyTopicApplicabilityEvalResult {
  if (latest.session_id !== expectedSessionId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "session_id mismatch",
    );
  }
  if (FORBIDDEN_TOPIC_EVAL_CONTROL_IDS.includes(input.control_id)) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      `control_id forbidden for N/A authority: ${input.control_id}`,
    );
  }
  if (!isAllowedTopicEvalControlId(input.control_id)) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      `control_id not allowlisted: ${input.control_id}`,
    );
  }
  if (!input.eval_id.trim() || !input.rule_id.trim()) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "eval_id and rule_id required",
    );
  }
  if (parseValidIsoMs(nowIso) === null) {
    throw new TopicEvalWriteError(TOPIC_EVAL_WRITE_INVALID, "nowIso invalid");
  }
  if (parseValidIsoMs(input.expires_at) === null) {
    throw new TopicEvalWriteError(TOPIC_EVAL_WRITE_INVALID, "expires_at invalid");
  }
  const expiry = checkExpiresAt(input.expires_at, nowIso);
  if (expiry === "invalid" || expiry === true) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "expires_at already expired or invalid",
    );
  }

  requireDraftDc(latest);

  const load = loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION);
  if (!load.ok) {
    throw new TopicEvalWriteError(load.reason_code, load.reason_code);
  }
  const rule = findTopicRuleDefinition(load, input.rule_id);
  if (!rule) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "topic_rule_not_registered",
    );
  }

  // Real Session user confirmation event binding (S9-R1).
  assertTopicConfirmTurnBound(latest, expectedSessionId, input, rule.target_dir_id);

  // Decline/skip path: allowlisted confirm with not_applicable:false may record
  // applicability, but never mints N/A-authorizing rows via this writer when false
  // is paired with a non-confirm control (already rejected above). not_applicable
  // false still writes a non-authorizing record (validator requires not_applicable).

  const prior = (latest.topic_applicability_evals ?? []).find(
    (r) => r.eval_id === input.eval_id,
  );
  if (prior) {
    if (prior.record_status === "revoked") {
      throw new TopicEvalWriteError(
        TOPIC_EVAL_WRITE_INVALID,
        "eval_revoked_replay",
      );
    }
    if (
      prior.rule_id !== rule.rule_id ||
      prior.topic_code !== rule.topic_code ||
      prior.target_dir_id !== rule.target_dir_id ||
      prior.catalog_version !== rule.catalog_version ||
      prior.not_applicable !== input.not_applicable
    ) {
      throw new TopicEvalWriteError(
        TOPIC_EVAL_WRITE_INVALID,
        "idempotent_payload_mismatch",
      );
    }
    if (prior.expires_at !== input.expires_at) {
      throw new TopicEvalWriteError(
        TOPIC_EVAL_WRITE_INVALID,
        "idempotent_expiry_mismatch",
      );
    }
    return {
      session: latest,
      record: prior,
      outcome: "idempotent_skip",
    };
  }

  const record: AuthoritativeTopicEvalRecord = {
    eval_id: input.eval_id,
    rule_id: rule.rule_id,
    topic_code: rule.topic_code,
    target_dir_id: rule.target_dir_id,
    catalog_version: rule.catalog_version,
    not_applicable: input.not_applicable,
    evaluated_at: nowIso,
    expires_at: input.expires_at,
    record_status: "current",
  };

  // Same rule_id with a different eval_id supersedes prior current rows.
  const nextEvals = (latest.topic_applicability_evals ?? []).map((r) =>
    r.rule_id === rule.rule_id && r.record_status === "current"
      ? { ...r, record_status: "superseded" as const }
      : r,
  );
  nextEvals.push(record);

  // Stale after rule catalog version change: pin Session to ACTIVE.
  const session: POJUSessionState = {
    ...latest,
    topic_catalog_version: ACTIVE_TOPIC_APPLICABILITY_VERSION,
    topic_applicability_evals: nextEvals,
  };

  const superseded = (latest.topic_applicability_evals ?? []).some(
    (r) => r.rule_id === rule.rule_id && r.record_status === "current",
  );

  return {
    session,
    record,
    outcome: superseded ? "superseded_prior" : "appended",
  };
}

/**
 * Revoke a topic eval by eval_id. Revoked rows must not authorize.
 */
export function applyRevokeTopicApplicabilityEvalToSession(
  latest: POJUSessionState,
  expectedSessionId: string,
  evalId: string,
): POJUSessionState {
  if (latest.session_id !== expectedSessionId) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_SOURCE_INVALID,
      "session_id mismatch",
    );
  }
  requireDraftDc(latest);
  const evals = latest.topic_applicability_evals ?? [];
  const found = evals.some((r) => r.eval_id === evalId);
  if (!found) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "topic_eval_id_unknown",
    );
  }
  return {
    ...latest,
    topic_applicability_evals: evals.map((r) =>
      r.eval_id === evalId ? { ...r, record_status: "revoked" as const } : r,
    ),
  };
}

export type ConfirmTopicApplicabilityResult = CasWritePOJUSessionResult & {
  record: AuthoritativeTopicEvalRecord;
  outcome: ApplyTopicApplicabilityEvalResult["outcome"];
};

/**
 * Production CAS entry — persist explicit user topic applicability confirmation.
 * Caller must have already appended the bound user confirmation turn to Session.
 */
export async function confirmTopicApplicabilityEval(
  sessionId: string,
  input: ConfirmTopicApplicabilityInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<ConfirmTopicApplicabilityResult> {
  const box: { value: ApplyTopicApplicabilityEvalResult | null } = { value: null };
  const now = input.occurred_at ?? new Date().toISOString();

  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        const applied = applyTopicApplicabilityEvalToSession(
          latest,
          sessionId,
          input,
          now,
        );
        box.value = applied;
        return applied.session;
      },
    },
    opts,
  );

  if (!box.value) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "confirmTopicApplicabilityEval produced no record",
    );
  }

  return {
    ...result,
    record: box.value.record,
    outcome: box.value.outcome,
  };
}

export type ConfirmTopicApplicabilityFromUiInput = ConfirmTopicApplicabilityInput & {
  /** Visible user echo for the confirmation chip. */
  confirmation_content: string;
};

/**
 * Production UI entry — atomically append bound user confirmation turn + write eval (CAS).
 * Decline/skip chips must NOT call this with forbidden control_ids.
 */
export async function confirmTopicApplicabilityEvalFromUiClick(
  sessionId: string,
  input: ConfirmTopicApplicabilityFromUiInput,
  opts: MutatePOJUSessionOptions = {},
): Promise<ConfirmTopicApplicabilityResult> {
  if (FORBIDDEN_TOPIC_EVAL_CONTROL_IDS.includes(input.control_id)) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      `control_id forbidden for N/A authority: ${input.control_id}`,
    );
  }
  if (!isAllowedTopicEvalControlId(input.control_id)) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      `control_id not allowlisted: ${input.control_id}`,
    );
  }
  if (!input.not_applicable) {
    // Explicit: decline "topic still applies" must not mint N/A authority via this entry.
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "UI N/A confirm entry requires not_applicable:true",
    );
  }

  const box: { value: ApplyTopicApplicabilityEvalResult | null } = { value: null };
  const now = input.occurred_at ?? new Date().toISOString();

  const result = await mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => {
        if (latest.session_id !== sessionId) {
          throw new TopicEvalWriteError(
            TOPIC_EVAL_WRITE_SOURCE_INVALID,
            "session_id mismatch",
          );
        }
        const load = loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION);
        if (!load.ok) {
          throw new TopicEvalWriteError(load.reason_code, load.reason_code);
        }
        const rule = findTopicRuleDefinition(load, input.rule_id);
        if (!rule) {
          throw new TopicEvalWriteError(
            TOPIC_EVAL_WRITE_INVALID,
            "topic_rule_not_registered",
          );
        }

        const turnId = input.confirmation_turn_id.trim();
        let withTurn: POJUSessionState = latest;
        const existing = findSessionMessageByTurnId(latest.messages, turnId);
        if (!existing) {
          const confirmMsg: POJUMessage = {
            role: "user",
            content: input.confirmation_content,
            timestamp: now,
            client_id: turnId,
            meta: {
              topic_applicability_confirm: {
                rule_id: rule.rule_id,
                control_id: input.control_id,
                not_applicable: true,
                session_id: sessionId,
                target_dir_id: rule.target_dir_id,
              },
            },
          };
          withTurn = {
            ...latest,
            messages: [...(latest.messages ?? []), confirmMsg],
          };
        }

        const applied = applyTopicApplicabilityEvalToSession(
          withTurn,
          sessionId,
          input,
          now,
        );
        box.value = applied;
        return applied.session;
      },
    },
    opts,
  );

  if (!box.value) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "confirmTopicApplicabilityEvalFromUiClick produced no record",
    );
  }

  return {
    ...result,
    record: box.value.record,
    outcome: box.value.outcome,
  };
}

export async function revokeTopicApplicabilityEval(
  sessionId: string,
  input: { operation_id: string; eval_id: string },
  opts: MutatePOJUSessionOptions = {},
): Promise<CasWritePOJUSessionResult> {
  return mutatePOJUSession(
    sessionId,
    {
      operation_id: input.operation_id,
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) =>
        applyRevokeTopicApplicabilityEvalToSession(
          latest,
          sessionId,
          input.eval_id,
        ),
    },
    opts,
  );
}
