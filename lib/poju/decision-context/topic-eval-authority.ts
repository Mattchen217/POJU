/**
 * Authoritative Topic Applicability evaluation store (Phase 2 / R6 US §2.7 A2).
 * Embedded evaluation.status alone is not proof — must resolve eval_id here.
 */

import { checkExpiresAt, parseValidIsoMs } from "./na-declaration";

export type TopicEvalRecordStatus =
  | "current"
  | "stale"
  | "superseded"
  | "revoked";

/** Persisted authority row — session or catalog registry SoT. */
export type AuthoritativeTopicEvalRecord = {
  eval_id: string;
  rule_id: string;
  topic_code: string;
  target_dir_id: string;
  catalog_version: string;
  not_applicable: boolean;
  evaluated_at: string;
  /**
   * Required for Gate effect. Missing / invalid → fail-closed
   * (no unverifiable open-ended freshness).
   */
  expires_at: string;
  record_status: TopicEvalRecordStatus;
};

export type TopicAuthorityLookupResult =
  | { ok: true; record: AuthoritativeTopicEvalRecord }
  | { ok: false; reason_code: string };

/**
 * Resolve and re-verify an embedded topic evaluation against authority.
 */
export function resolveAuthoritativeTopicEval(args: {
  eval_id: string;
  rule_id: string;
  topic_code: string;
  target_dir_id: string;
  claimed_catalog_version: string;
  /** Live catalog version for the Topic Applicability catalog. */
  current_catalog_version: string;
  authority:
    | ReadonlyMap<string, AuthoritativeTopicEvalRecord>
    | readonly AuthoritativeTopicEvalRecord[]
    | undefined;
  nowIso: string;
}): TopicAuthorityLookupResult {
  if (!args.eval_id) {
    return { ok: false, reason_code: "topic_eval_id_missing" };
  }
  if (!args.current_catalog_version) {
    return { ok: false, reason_code: "topic_catalog_version_missing" };
  }
  if (parseValidIsoMs(args.nowIso) === null) {
    return { ok: false, reason_code: "topic_now_iso_invalid" };
  }

  let record: AuthoritativeTopicEvalRecord | undefined;
  if (!args.authority) {
    return { ok: false, reason_code: "topic_authority_missing" };
  }
  const rows: readonly AuthoritativeTopicEvalRecord[] = Array.isArray(
    args.authority,
  )
    ? args.authority
    : Array.from(args.authority.values());
  record = rows.find((r) => r.eval_id === args.eval_id);
  if (!record) {
    return { ok: false, reason_code: "topic_eval_id_unknown" };
  }

  if (record.record_status !== "current") {
    return { ok: false, reason_code: `topic_authority_${record.record_status}` };
  }
  if (record.rule_id !== args.rule_id) {
    return { ok: false, reason_code: "topic_authority_rule_mismatch" };
  }
  if (record.topic_code !== args.topic_code) {
    return { ok: false, reason_code: "topic_authority_topic_mismatch" };
  }
  if (record.target_dir_id !== args.target_dir_id) {
    return { ok: false, reason_code: "topic_authority_dir_mismatch" };
  }
  if (record.catalog_version !== args.claimed_catalog_version) {
    return { ok: false, reason_code: "topic_claimed_catalog_mismatch" };
  }
  if (record.catalog_version !== args.current_catalog_version) {
    return { ok: false, reason_code: "topic_catalog_version_stale" };
  }
  if (!record.expires_at) {
    return { ok: false, reason_code: "topic_authority_expiry_missing" };
  }
  const expiry = checkExpiresAt(record.expires_at, args.nowIso);
  if (expiry === "invalid") {
    return { ok: false, reason_code: "topic_authority_expiry_invalid" };
  }
  if (expiry === true) {
    return { ok: false, reason_code: "topic_authority_expired" };
  }
  if (parseValidIsoMs(record.evaluated_at) === null) {
    return { ok: false, reason_code: "topic_authority_evaluated_at_invalid" };
  }
  if (!record.not_applicable) {
    return { ok: false, reason_code: "topic_authority_still_applicable" };
  }

  return { ok: true, record };
}
