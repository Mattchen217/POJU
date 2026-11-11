/**
 * M4 — device side of the server Freeze seal. The device brings its ledger mirror up
 * to date, asks the server to seal the head it holds, and checks that the returned
 * final snapshot and receipt describe exactly that head. It never builds a Freeze.
 */

import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import { assertFrozenDcIntegrity, bindingFromDecisionContext } from "@/lib/poju/decision-context/read-bound";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import { DecisionAuthorityUnreachableError, getDecisionAuthorityTransport } from "./client-transport";
import { DcLedgerSyncError, syncDcLedgerBeforeWrite } from "./client-sync";
import { dcSnapshotHash } from "./hash";
import {
  DC_LEDGER_SCHEMA_VERSION,
  type DcLedgerMirror,
  type FreezeAuthorityEnvelope,
  type FreezeReceipt,
  type ProfileReceipt,
} from "./types";

export type SealedFreeze = {
  frozen_dc: DecisionContext;
  receipt: FreezeReceipt;
  profile_receipt: ProfileReceipt | null;
  mirror: DcLedgerMirror;
};

export type FreezeProfileInput = { profile_id: string | null; birth_info: unknown } | null;

export function freezeAuthorityEnvelope(session: POJUSessionState): FreezeAuthorityEnvelope {
  return {
    confirmation_events: session.confirmation_events ?? [],
    na_declaration_actions: session.na_declaration_actions ?? [],
    topic_applicability_evals: session.topic_applicability_evals ?? [],
    profile_state: {
      selected_stored_profile_id: session.selected_stored_profile_id?.trim() || null,
      has_profile: session.has_profile === true,
      birth_submitted_in_session: session.birth_submitted_in_session === true,
      profile_skipped: session.profile_skipped === true,
    },
  };
}

/** Birth input of the session's formal profile (device-only read). */
export async function loadFreezeProfileInput(session: POJUSessionState): Promise<FreezeProfileInput> {
  const { loadSessionProfileBundle } = await import("@/lib/poju/session-profile");
  const bundle = await loadSessionProfileBundle(session).catch(() => null);
  const birth = bundle?.profile?.birth ?? null;
  if (!birth) return null;
  return { profile_id: bundle?.resolved_profile_id ?? null, birth_info: birth };
}

export async function sealFreezeWithAuthority(
  session: POJUSessionState,
  opts?: { now?: string; profile?: FreezeProfileInput },
): Promise<SealedFreeze> {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") {
    throw new DcLedgerSyncError("FREEZE_TARGET_NOT_DRAFT", "only a draft Decision Context can be frozen");
  }
  // Ledger catch-up: the head the server seals must be this exact draft.
  const working: POJUSessionState = { ...session };
  await syncDcLedgerBeforeWrite({
    base: session,
    candidate: working,
    idempotency_key: `dc_ledger_catchup:${session.session_id}:${dcSnapshotHash(dc).slice(0, 32)}`,
    now: opts?.now,
  });
  const mirror = working.dc_ledger;
  if (!mirror?.head || mirror.head.snapshot_hash !== dcSnapshotHash(dc)) {
    throw new DcLedgerSyncError("DC_LEDGER_NOT_CURRENT", "ledger head does not hold the Decision Context to freeze");
  }

  const profile = opts?.profile !== undefined ? opts.profile : await loadFreezeProfileInput(session);
  let res;
  try {
    res = await getDecisionAuthorityTransport().freeze({
      session_id: session.session_id,
      writer_token: mirror.writer_token,
      expected: {
        commit_version: mirror.head.commit_version,
        entry_hash: mirror.head.entry_hash,
        context_id: dc.context_id,
        dc_version: dc.version,
        content_hash: computeContentHash(dc),
      },
      authority: freezeAuthorityEnvelope(session),
      profile,
    });
  } catch (e) {
    if (e instanceof DecisionAuthorityUnreachableError) throw new DcLedgerSyncError(e.code, e.message, true);
    throw e;
  }
  if (!res.ok) throw new DcLedgerSyncError(res.code, res.error, res.retryable);

  const frozen = res.frozen_dc;
  const r = res.receipt;
  try {
    assertFrozenDcIntegrity(frozen);
  } catch (e) {
    throw new DcLedgerSyncError("FREEZE_RESPONSE_INVALID", e instanceof Error ? e.message : String(e));
  }
  const binding = bindingFromDecisionContext(frozen);
  if (
    r.session_id !== session.session_id ||
    r.context_id !== dc.context_id ||
    r.context_version !== dc.version ||
    r.context_hash !== binding.context_hash ||
    r.freeze_id !== `${binding.context_id}@v${binding.context_version}` ||
    res.head.change_type !== "freeze" ||
    res.head.snapshot_hash !== dcSnapshotHash(frozen) ||
    (res.profile_receipt && res.profile_receipt.freeze_id !== r.freeze_id)
  ) {
    throw new DcLedgerSyncError("FREEZE_RESPONSE_INVALID", "server Freeze response does not match the requested head");
  }
  return {
    frozen_dc: frozen,
    receipt: r,
    profile_receipt: res.profile_receipt,
    mirror: {
      schema_version: DC_LEDGER_SCHEMA_VERSION,
      writer_token: mirror.writer_token,
      head: res.head,
      synced_at: opts?.now ?? new Date().toISOString(),
    },
  };
}

/** Receipt lists keep every historical Freeze; one entry per freeze_id. */
export function withFreezeReceipts(
  session: POJUSessionState,
  receipt: FreezeReceipt,
  profile: ProfileReceipt | null,
): Pick<POJUSessionState, "dc_freeze_receipts" | "dc_profile_receipts"> {
  const freezes = (session.dc_freeze_receipts ?? []).filter((x) => x.freeze_id !== receipt.freeze_id);
  const profiles = (session.dc_profile_receipts ?? []).filter((x) => !profile || x.freeze_id !== profile.freeze_id);
  return {
    dc_freeze_receipts: [...freezes, receipt],
    dc_profile_receipts: profile ? [...profiles, profile] : profiles,
  };
}

export function freezeReceiptFor(session: POJUSessionState, freeze_id: string): FreezeReceipt | null {
  return (session.dc_freeze_receipts ?? []).find((r) => r.freeze_id === freeze_id) ?? null;
}

export function profileReceiptFor(session: POJUSessionState, freeze_id: string): ProfileReceipt | null {
  return (session.dc_profile_receipts ?? []).find((r) => r.freeze_id === freeze_id) ?? null;
}
