/**
 * M4 — server-authoritative Decision Context ledger, Freeze receipts and profile
 * provenance (Decision Intake 2.0).
 *
 * Isomorphic types only (client mirror + server records). The ledger is a commit
 * audit + authoritative snapshot log of the existing DecisionContext — it is not a
 * second fact model. Facts, statuses and DIRs keep their meaning from decision-context.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import type { UserNaDeclarationAction } from "@/lib/poju/decision-context/na-declaration";
import type { AuthoritativeTopicEvalRecord } from "@/lib/poju/decision-context/topic-eval-authority";
import type { DecisionContext, DecisionContextStatus } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";

export const DC_LEDGER_SCHEMA_VERSION = "poju-dc-ledger-v1" as const;
export const FREEZE_RECORD_SCHEMA_VERSION = "poju-freeze-record-v1" as const;
export const PROFILE_RECORD_SCHEMA_VERSION = "poju-profile-record-v1" as const;
/**
 * Formal calculation chain the server re-executes: shunshi-bazi-core chart (true solar
 * time) → buildProfileStructured, plus the iztro Ziwei fact pack at the Freeze instant.
 * Bump when either calculation changes so old profile hashes never alias new ones.
 */
export const PROFILE_CALC_SCHEMA_VERSION =
  "poju-profile-calc-v1:shunshi-bazi-core@0.1:iztro@2.6.3" as const;

/** Server-classified (never client-declared) kind of a ledger commit. */
export type DcLedgerChangeType =
  | "genesis"
  | "draft_update"
  | "user_confirm"
  | "version_open"
  | "blueprint_update"
  | "freeze";

/** Lightweight pointer to one ledger commit (client mirror + API responses). */
export type DcLedgerHeadRef = {
  session_id: string;
  commit_version: number;
  entry_hash: string;
  context_id: string;
  dc_version: number;
  dc_status: DecisionContextStatus;
  content_hash: string;
  snapshot_hash: string;
  blueprint_hash: string | null;
  change_type: DcLedgerChangeType;
  committed_at: string;
};

export type DcLedgerProvenance = {
  /** Client operation label (C1 idempotency prefix / mutation kind). Audit only. */
  source_op: string;
  /** User confirmation events that back each fact / constraint promoted in this commit. */
  confirmation_events: ConfirmationEvent[];
  promoted_fact_ids: string[];
  promoted_constraint_ids: string[];
  /** Freeze commits only. */
  freeze?: {
    freeze_id: string;
    source_commit_version: number;
    source_entry_hash: string;
    frozen_at: string;
    receipt_id: string;
    profile_hash: string | null;
  } | null;
};

/** One immutable server ledger commit. `entry_hash` covers every other field. */
export type DcLedgerEntry = {
  schema_version: typeof DC_LEDGER_SCHEMA_VERSION;
  session_id: string;
  context_id: string;
  /** Continuous per-session commit sequence (1 = genesis). */
  commit_version: number;
  previous_commit_version: number | null;
  previous_entry_hash: string | null;
  /** DecisionContext.version (lifecycle version: confirm / N/A / V2 bumps). */
  dc_version: number;
  previous_dc_version: number | null;
  dc_status: DecisionContextStatus;
  /** Business content hash (computeContentHash) of `snapshot`. */
  content_hash: string;
  previous_content_hash: string | null;
  /** Hash of the full canonical snapshot (lifecycle fields included). */
  snapshot_hash: string;
  idempotency_key: string;
  change_type: DcLedgerChangeType;
  committed_at: string;
  snapshot: DecisionContext;
  blueprint_version: number | null;
  blueprint_hash: string | null;
  blueprint: DecisionBlueprint | null;
  provenance: DcLedgerProvenance;
  entry_hash: string;
};

/** Session-held authority rows the server needs to re-run the Freeze rules. */
export type FreezeAuthorityEnvelope = {
  confirmation_events: ConfirmationEvent[];
  na_declaration_actions: UserNaDeclarationAction[];
  topic_applicability_evals: AuthoritativeTopicEvalRecord[];
  profile_state: {
    selected_stored_profile_id: string | null;
    has_profile: boolean;
    birth_submitted_in_session: boolean;
    profile_skipped: boolean;
  };
};

/** Server-signed proof that a Freeze was sealed from the ledger. */
export type FreezeReceipt = {
  schema_version: typeof FREEZE_RECORD_SCHEMA_VERSION;
  receipt_id: string;
  session_id: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  blueprint_hash: string | null;
  frozen_at: string;
  ledger_commit_version: number;
  key_id: string;
  signature: string;
};

/** Server-signed proof that a profile was recomputed for one Freeze. */
export type ProfileReceipt = {
  schema_version: typeof PROFILE_RECORD_SCHEMA_VERSION;
  receipt_id: string;
  session_id: string;
  freeze_id: string;
  profile_id: string | null;
  profile_hash: string;
  calculation_schema_version: string;
  calculation_timestamp: string;
  key_id: string;
  signature: string;
};

export type FreezeRecord = {
  schema_version: typeof FREEZE_RECORD_SCHEMA_VERSION;
  session_id: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  frozen_at: string;
  frozen_dc: DecisionContext;
  blueprint_hash: string | null;
  blueprint: DecisionBlueprint | null;
  source_commit_version: number;
  source_entry_hash: string;
  freeze_commit_version: number;
  /** Profile recomputed during sealing (null when the session supplied none). */
  profile_hash: string | null;
  receipt: FreezeReceipt;
};

export type ProfileSourceMetadata = {
  kind: "server_recompute_from_birth";
  /** Hash of the coerced birth input — raw birth data is not stored. */
  birth_input_hash: string;
  bazi_engine: "shunshi-bazi-core";
  ziwei_engine: "iztro";
  used_true_solar_time: boolean;
  ziwei_status: "ok" | "failed" | "not_available";
};

export type ProfileRecord = {
  schema_version: typeof PROFILE_RECORD_SCHEMA_VERSION;
  session_id: string;
  freeze_id: string;
  profile_id: string | null;
  profile_hash: string;
  calculation_schema_version: string;
  calculation_timestamp: string;
  chart_structure: ProfileStructured;
  ziwei_closed_set: string | null;
  source: ProfileSourceMetadata;
  registered_at: string;
  receipt: ProfileReceipt;
};

/** Device-side mirror on POJUSessionState. Only ever reflects accepted commits. */
export type DcLedgerMirror = {
  schema_version: typeof DC_LEDGER_SCHEMA_VERSION;
  /** Per-session write capability issued at genesis (kept in the encrypted blob). */
  writer_token: string;
  head: DcLedgerHeadRef;
  synced_at: string;
};

// ─── API wire shapes ───────────────────────────────────────────────────────

export type DcLedgerAppendRequest = {
  session_id: string;
  writer_token: string | null;
  idempotency_key: string;
  source_op: string;
  expected_previous: { commit_version: number; entry_hash: string } | null;
  snapshot: DecisionContext;
  blueprint: DecisionBlueprint | null;
  confirmation_events: ConfirmationEvent[];
};

export type DcLedgerAppendResponse =
  | {
      ok: true;
      outcome: "committed" | "duplicate" | "unchanged";
      head: DcLedgerHeadRef;
      writer_token: string;
    }
  | DcAuthorityFailure;

export type FreezeSealRequest = {
  session_id: string;
  writer_token: string;
  expected: {
    commit_version: number;
    entry_hash: string;
    context_id: string;
    dc_version: number;
    content_hash: string;
  };
  authority: FreezeAuthorityEnvelope;
  profile: { profile_id: string | null; birth_info: unknown } | null;
};

export type FreezeSealResponse =
  | {
      ok: true;
      outcome: "sealed" | "duplicate";
      frozen_dc: DecisionContext;
      receipt: FreezeReceipt;
      head: DcLedgerHeadRef;
      profile_receipt: ProfileReceipt | null;
    }
  | DcAuthorityFailure;

export type ProfileRegisterRequest = {
  session_id: string;
  writer_token: string;
  freeze_receipt: FreezeReceipt;
  profile_id: string | null;
  birth_info: unknown;
};

export type ProfileRegisterResponse =
  | { ok: true; outcome: "registered" | "duplicate"; receipt: ProfileReceipt }
  | DcAuthorityFailure;

export type DcAuthorityFailure = {
  ok: false;
  code: string;
  error: string;
  retryable: boolean;
  /** Current server head when the failure is a sequencing conflict. */
  head?: DcLedgerHeadRef | null;
  /**
   * Idempotency conflict only: the commit that already took effect under this key.
   * The device may adopt it when it was built on the same base.
   */
  effective?: {
    head: DcLedgerHeadRef;
    previous_entry_hash: string | null;
    snapshot: DecisionContext;
    blueprint: DecisionBlueprint | null;
  } | null;
};

export function headRefFromEntry(entry: DcLedgerEntry): DcLedgerHeadRef {
  return {
    session_id: entry.session_id,
    commit_version: entry.commit_version,
    entry_hash: entry.entry_hash,
    context_id: entry.context_id,
    dc_version: entry.dc_version,
    dc_status: entry.dc_status,
    content_hash: entry.content_hash,
    snapshot_hash: entry.snapshot_hash,
    blueprint_hash: entry.blueprint_hash,
    change_type: entry.change_type,
    committed_at: entry.committed_at,
  };
}

/** DI2 sessions (Blueprint present) and anything already enrolled in the ledger. */
export function isDcLedgerEnrolled(session: {
  decision_blueprint?: unknown;
  dc_ledger?: DcLedgerMirror | null;
} | null | undefined): boolean {
  return Boolean(session?.decision_blueprint) || Boolean(session?.dc_ledger?.head);
}
