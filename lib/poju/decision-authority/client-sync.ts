/**
 * M4 — device-side ledger sync, run inside the Session CAS writers before the local
 * encrypted blob is written. A DI2 Decision Context change is only persisted locally
 * after the server ledger accepted it; the device mirror (`dc_ledger`) only ever
 * reflects an accepted server commit. Any refusal or unreachable server fails the
 * local write — never a silent local-only commit.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { blueprintHash, dcSnapshotHash } from "./hash";
import { DecisionAuthorityUnreachableError, getDecisionAuthorityTransport } from "./client-transport";
import { DC_LEDGER_SCHEMA_VERSION, isDcLedgerEnrolled, type DcLedgerHeadRef, type DcLedgerMirror } from "./types";

/** The server ledger head is already a Freeze; a draft write can never land on it. */
export const DC_LEDGER_REMOTE_FROZEN = "DC_LEDGER_REMOTE_FROZEN";

export class DcLedgerSyncError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  /** Server head reported with a sequencing refusal (e.g. a Freeze already sealed). */
  readonly head: DcLedgerHeadRef | null;
  constructor(code: string, message: string, retryable = false, head: DcLedgerHeadRef | null = null) {
    super(message);
    this.name = "DcLedgerSyncError";
    this.code = code;
    this.retryable = retryable;
    this.head = head;
  }
}

export function isDcLedgerSyncError(e: unknown): e is DcLedgerSyncError {
  return e instanceof DcLedgerSyncError;
}

function newerMirror(a: DcLedgerMirror | null | undefined, b: DcLedgerMirror | null | undefined): DcLedgerMirror | null {
  if (!a?.head) return b?.head ? b : null;
  if (!b?.head) return a;
  return b.head.commit_version > a.head.commit_version ? b : a;
}

/** Content-derived key for whole-state saves without an operation id (stable across retries). */
export function contentDerivedLedgerKey(state: POJUSessionState): string {
  const dc = state.decision_context;
  const snap = dc ? dcSnapshotHash(dc).slice(0, 32) : "none";
  const bp = blueprintHash(state.decision_blueprint ?? null)?.slice(0, 16) ?? "none";
  return `dc_auto:${state.session_id}:${snap}:${bp}`;
}

/**
 * Commit the candidate's DC (and Blueprint) to the server ledger when it differs from
 * the last accepted commit. Mutates `candidate.dc_ledger` (and, when the server already
 * holds the effective commit for this key, the DC / Blueprint) in place.
 */
export async function syncDcLedgerBeforeWrite(input: {
  base: POJUSessionState;
  candidate: POJUSessionState;
  idempotency_key: string;
  source_op?: string;
  now?: string;
}): Promise<void> {
  const { base, candidate } = input;
  if (!isDcLedgerEnrolled(candidate) && !isDcLedgerEnrolled(base)) return;
  const dc = candidate.decision_context;
  if (!dc) return;

  const mirror = newerMirror(base.dc_ledger, candidate.dc_ledger);
  const snapHash = dcSnapshotHash(dc);
  const bpHash = blueprintHash(candidate.decision_blueprint ?? null);
  if (mirror && mirror.head.snapshot_hash === snapHash && (bpHash == null || mirror.head.blueprint_hash === bpHash)) {
    candidate.dc_ledger = mirror;
    return;
  }

  const send = async (head: DcLedgerMirror["head"] | null) => {
    try {
      return await getDecisionAuthorityTransport().append({
        session_id: candidate.session_id,
        writer_token: mirror?.writer_token ?? null,
        idempotency_key: input.idempotency_key,
        source_op: input.source_op ?? input.idempotency_key.split(":")[0] ?? "unknown",
        expected_previous: head ? { commit_version: head.commit_version, entry_hash: head.entry_hash } : null,
        snapshot: dc,
        blueprint: candidate.decision_blueprint ?? null,
        confirmation_events: candidate.confirmation_events ?? [],
      });
    } catch (e) {
      if (e instanceof DecisionAuthorityUnreachableError) {
        throw new DcLedgerSyncError(e.code, e.message, true);
      }
      throw e;
    }
  };

  const now = input.now ?? new Date().toISOString();
  let anchor = mirror;
  let res = await send(anchor?.head ?? null);
  // Self-heal a lost local mirror write: the server head already holds exactly the
  // base state this write starts from (same snapshot + Blueprint) → rebase once on it.
  const baseDc = base.decision_context;
  if (
    !res.ok &&
    res.code === "DC_LEDGER_HEAD_MISMATCH" &&
    res.head &&
    anchor &&
    baseDc &&
    res.head.commit_version > anchor.head.commit_version &&
    res.head.snapshot_hash === dcSnapshotHash(baseDc) &&
    res.head.blueprint_hash === (blueprintHash(base.decision_blueprint ?? null) ?? res.head.blueprint_hash)
  ) {
    anchor = { ...anchor, head: res.head };
    res = await send(anchor.head);
  }
  // Lost local write re-sent under another key: the server head already is this exact state.
  if (
    !res.ok &&
    res.code === "DC_LEDGER_HEAD_MISMATCH" &&
    res.head &&
    anchor &&
    res.head.commit_version > anchor.head.commit_version &&
    res.head.snapshot_hash === snapHash &&
    (bpHash == null || res.head.blueprint_hash === bpHash)
  ) {
    candidate.dc_ledger = { ...anchor, head: res.head, synced_at: now };
    return;
  }

  if (res.ok) {
    candidate.dc_ledger = {
      schema_version: DC_LEDGER_SCHEMA_VERSION,
      writer_token: res.writer_token,
      head: res.head,
      synced_at: now,
    };
    return;
  }

  // The op already took effect server-side (lost response, then a local CAS retry
  // recomputed slightly different content): adopt the server's commit for this key.
  const eff = res.code === "DC_LEDGER_IDEMPOTENCY_CONFLICT" ? res.effective : null;
  if (
    eff &&
    anchor &&
    eff.previous_entry_hash === anchor.head.entry_hash &&
    eff.head.commit_version === anchor.head.commit_version + 1
  ) {
    candidate.decision_context = eff.snapshot;
    if (eff.blueprint) candidate.decision_blueprint = eff.blueprint;
    candidate.dc_ledger = { ...anchor, head: eff.head, synced_at: now };
    return;
  }
  if (res.code === "DC_LEDGER_HEAD_MISMATCH" && res.head?.change_type === "freeze") {
    throw new DcLedgerSyncError(
      DC_LEDGER_REMOTE_FROZEN,
      `server ledger head is Freeze ${res.head.context_id}@v${res.head.dc_version}; the local draft is behind it`,
      false,
      res.head,
    );
  }
  throw new DcLedgerSyncError(res.code, res.error, res.retryable, res.head ?? null);
}
