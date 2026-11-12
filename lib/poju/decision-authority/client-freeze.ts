/**
 * M4 — device side of the server Freeze seal. The device brings its ledger mirror up
 * to date, asks the server to seal the head it holds, and checks that the returned
 * final snapshot and receipt describe exactly that head. It never builds a Freeze.
 *
 * M4.1 — when the server already sealed a Freeze from this device's draft commit (the
 * device's local adoption failed), the device recovers that Freeze from the server
 * ledger instead of treating the frozen head as a draft conflict.
 */

import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import { assertFrozenDcIntegrity, bindingFromDecisionContext } from "@/lib/poju/decision-context/read-bound";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import { DecisionAuthorityUnreachableError, getDecisionAuthorityTransport } from "./client-transport";
import { DC_LEDGER_REMOTE_FROZEN, DcLedgerSyncError, isDcLedgerSyncError, syncDcLedgerBeforeWrite } from "./client-sync";
import { dcSnapshotHash } from "./hash";
import {
  DC_LEDGER_SCHEMA_VERSION,
  type DcLedgerHeadRef,
  type DcLedgerMirror,
  type FreezeAuthorityEnvelope,
  type FreezeReceipt,
  type ProfileReceipt,
} from "./types";

export type SealedFreeze = {
  /** sealed / duplicate = freeze action; recovered = Freeze already sealed from this draft. */
  outcome: "sealed" | "duplicate" | "recovered";
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

/** The draft's own ledger commit as the device knows it (null when the mirror lags). */
function draftAnchor(mirror: DcLedgerMirror | null | undefined, dc: DecisionContext): DcLedgerMirror | null {
  const h = mirror?.head;
  if (!h || h.dc_status !== "draft") return null;
  if (h.snapshot_hash !== dcSnapshotHash(dc) || h.context_id !== dc.context_id || h.dc_version !== dc.version) {
    return null;
  }
  return mirror!;
}

function sameCommit(a: { commit_version: number; entry_hash: string } | null | undefined, b: DcLedgerHeadRef): boolean {
  return !!a && a.commit_version === b.commit_version && a.entry_hash === b.entry_hash;
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DecisionAuthorityUnreachableError) throw new DcLedgerSyncError(e.code, e.message, true);
    throw e;
  }
}

/**
 * The server's Freeze must be exactly the Freeze of `dc` sealed from `anchor`:
 * integrity of the final snapshot, receipt identity, head = that Freeze commit.
 */
function assertServerFreezeFor(input: {
  session_id: string;
  dc: DecisionContext;
  anchor: DcLedgerMirror;
  frozen: DecisionContext;
  receipt: FreezeReceipt;
  head: DcLedgerHeadRef;
  profile_receipt: ProfileReceipt | null;
}): void {
  const { dc, frozen, receipt: r, head } = input;
  try {
    assertFrozenDcIntegrity(frozen);
  } catch (e) {
    throw new DcLedgerSyncError("FREEZE_RESPONSE_INVALID", e instanceof Error ? e.message : String(e));
  }
  const binding = bindingFromDecisionContext(frozen);
  if (
    r.session_id !== input.session_id ||
    r.context_id !== dc.context_id ||
    r.context_version !== dc.version ||
    r.context_hash !== binding.context_hash ||
    r.freeze_id !== `${binding.context_id}@v${binding.context_version}` ||
    r.ledger_commit_version !== head.commit_version ||
    head.session_id !== input.session_id ||
    head.change_type !== "freeze" ||
    head.dc_status !== "final" ||
    head.snapshot_hash !== dcSnapshotHash(frozen) ||
    (head.freeze_source != null && !sameCommit(head.freeze_source, input.anchor.head)) ||
    (input.profile_receipt &&
      (input.profile_receipt.freeze_id !== r.freeze_id ||
        input.profile_receipt.session_id !== input.session_id ||
        input.profile_receipt.calculation_timestamp !== r.frozen_at))
  ) {
    throw new DcLedgerSyncError("FREEZE_RESPONSE_INVALID", "server Freeze response does not match the requested draft");
  }
}

/**
 * The server head moved past this device's draft commit. If the server sealed a Freeze
 * from exactly that commit and it is still the head (the device's local adoption
 * failed), the server rebuilds it from its own ledger. Otherwise the server's typed
 * refusal is returned: FREEZE_NOT_CURRENT (that Freeze was superseded, e.g. V2 opened),
 * or a plain head mismatch when no Freeze was ever sealed from this draft.
 */
async function recoverFreezeWithAuthority(input: {
  session: POJUSessionState;
  dc: DecisionContext;
  anchor: DcLedgerMirror | null;
  remoteHead: DcLedgerHeadRef;
  now?: string;
}): Promise<SealedFreeze> {
  const { session, dc, anchor, remoteHead } = input;
  if (!anchor) {
    throw new DcLedgerSyncError(
      "FREEZE_RECOVERY_ANCHOR_UNKNOWN",
      "server ledger moved on but the device holds no ledger commit for its draft",
      false,
      remoteHead,
    );
  }
  const res = await call(() =>
    getDecisionAuthorityTransport().recoverFreeze({
      session_id: session.session_id,
      writer_token: anchor.writer_token,
      expected: {
        commit_version: anchor.head.commit_version,
        entry_hash: anchor.head.entry_hash,
        context_id: dc.context_id,
        dc_version: dc.version,
        content_hash: computeContentHash(dc),
      },
    }),
  );
  if (!res.ok) {
    if (res.code === "FREEZE_RECOVERY_NOT_FOUND") {
      throw new DcLedgerSyncError(
        "DC_LEDGER_HEAD_MISMATCH",
        "server ledger moved past this draft without sealing it",
        false,
        res.head ?? remoteHead,
      );
    }
    throw new DcLedgerSyncError(res.code, res.error, res.retryable, res.head ?? null);
  }
  if (res.outcome !== "recovered" || !sameCommit(res.head.freeze_source, anchor.head)) {
    throw new DcLedgerSyncError("FREEZE_RESPONSE_INVALID", "recovered Freeze was not sealed from this draft");
  }
  assertServerFreezeFor({
    session_id: session.session_id,
    dc,
    anchor,
    frozen: res.frozen_dc,
    receipt: res.receipt,
    head: res.head,
    profile_receipt: res.profile_receipt,
  });
  return {
    outcome: "recovered",
    frozen_dc: res.frozen_dc,
    receipt: res.receipt,
    profile_receipt: res.profile_receipt,
    mirror: {
      schema_version: DC_LEDGER_SCHEMA_VERSION,
      writer_token: anchor.writer_token,
      head: res.head,
      synced_at: input.now ?? new Date().toISOString(),
    },
  };
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
  try {
    await syncDcLedgerBeforeWrite({
      base: session,
      candidate: working,
      idempotency_key: `dc_ledger_catchup:${session.session_id}:${dcSnapshotHash(dc).slice(0, 32)}`,
      now: opts?.now,
    });
  } catch (e) {
    if (isDcLedgerSyncError(e) && e.code === DC_LEDGER_REMOTE_FROZEN && e.head) {
      return recoverFreezeWithAuthority({
        session,
        dc,
        anchor: draftAnchor(session.dc_ledger, dc),
        remoteHead: e.head,
        now: opts?.now,
      });
    }
    throw e;
  }
  const mirror = draftAnchor(working.dc_ledger, dc);
  if (!mirror) {
    throw new DcLedgerSyncError("DC_LEDGER_NOT_CURRENT", "ledger head does not hold the Decision Context to freeze");
  }

  // A Freeze may already be sealed from this draft (local adoption failed last time),
  // or the ledger may have moved past it; only a head equal to this draft is sealable.
  const remote = await call(() =>
    getDecisionAuthorityTransport().head({ session_id: session.session_id, writer_token: mirror.writer_token }),
  );
  if (!remote.ok) throw new DcLedgerSyncError(remote.code, remote.error, remote.retryable, remote.head ?? null);
  if (remote.head && !sameCommit(mirror.head, remote.head)) {
    return recoverFreezeWithAuthority({ session, dc, anchor: mirror, remoteHead: remote.head, now: opts?.now });
  }

  const profile = opts?.profile !== undefined ? opts.profile : await loadFreezeProfileInput(session);
  const res = await call(() =>
    getDecisionAuthorityTransport().freeze({
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
    }),
  );
  if (!res.ok) throw new DcLedgerSyncError(res.code, res.error, res.retryable, res.head ?? null);
  assertServerFreezeFor({
    session_id: session.session_id,
    dc,
    anchor: mirror,
    frozen: res.frozen_dc,
    receipt: res.receipt,
    head: res.head,
    profile_receipt: res.profile_receipt,
  });
  return {
    outcome: res.outcome,
    frozen_dc: res.frozen_dc,
    receipt: res.receipt,
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
