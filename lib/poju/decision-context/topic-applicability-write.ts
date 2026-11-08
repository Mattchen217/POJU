/**
 * Production Session writer for topic_applicability_evals (S9-A2).
 *
 * Only explicit user confirmation controls may write. LLM "unrelated" and
 * user decline/skip MUST NOT auto-generate N/A authority rows.
 *
 * Call chain: UI confirm �?confirmTopicApplicabilityEval �?mutatePOJUSession
 *   �?applyTopicApplicabilityEvalToSession �?session.topic_applicability_evals
 *   + session.topic_catalog_version (ACTIVE).
 */

import {
  mutatePOJUSession,
  type CasWritePOJUSessionResult,
  type MutatePOJUSessionOptions,
} from "@/lib/poju/session-mutation";
import type { POJUSessionState } from "@/lib/poju/types";
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

/** Explicit user confirmation controls only — never model/keyword/decline. */
export const ALLOWED_TOPIC_EVAL_CONTROL_IDS: readonly string[] = [
  "topic_applicability_confirm",
  "topic_na_confirm_chip",
];

export function isAllowedTopicEvalControlId(controlId: string): boolean {
  return ALLOWED_TOPIC_EVAL_CONTROL_IDS.includes(controlId);
}

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
  /** Only true authorizes N/A. false keeps applicable (no authority). */
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
 * Pure Session apply used by confirmTopicApplicabilityEval CAS callback.
 * Rule membership comes only from ACTIVE Topic Applicability loader.
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
  if (!input.confirmation_turn_id.trim()) {
    throw new TopicEvalWriteError(
      TOPIC_EVAL_WRITE_INVALID,
      "confirmation_turn_id required",
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
 * Production entry — persist explicit user topic applicability confirmation (CAS).
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
