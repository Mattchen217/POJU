/**
 * Adopt a durable DC ledger head into a working Session snapshot when the
 * ledger is ahead of the Session Authority mirror (e.g. ledger append succeeded
 * but the final Session CAS aborted or lost a race).
 *
 * Does not invent a second DC store — reads the existing ledger entry and
 * copies its validated snapshot into the working Session.
 *
 * Integrity conflicts fail closed — never silently adopt either side:
 * - same commit_version, different entry_hash
 * - local commit_version ahead of durable ledger head (version skew)
 */

import {
  loadLedgerEntry,
  readLedgerHead,
  writerTokenForGenesis,
} from "@/lib/poju/decision-authority/server/ledger-store";
import {
  DC_LEDGER_SCHEMA_VERSION,
  headRefFromEntry,
} from "@/lib/poju/decision-authority/types";
import type { POJUSessionState } from "@/lib/poju/types";

export const DC_LEDGER_HEAD_INTEGRITY_CONFLICT = "DC_LEDGER_HEAD_INTEGRITY_CONFLICT";

export class LedgerHeadIntegrityError extends Error {
  readonly code = DC_LEDGER_HEAD_INTEGRITY_CONFLICT;
  readonly session_id: string;
  readonly commit_version: number;
  readonly local_entry_hash: string | null;
  readonly ledger_entry_hash: string;
  readonly local_commit_version: number | null;
  readonly ledger_commit_version: number | null;

  constructor(input: {
    session_id: string;
    commit_version: number;
    local_entry_hash: string | null;
    ledger_entry_hash: string;
    local_commit_version?: number | null;
    ledger_commit_version?: number | null;
  }) {
    const localVer = input.local_commit_version ?? null;
    const ledgerVer = input.ledger_commit_version ?? null;
    const skew =
      localVer != null && ledgerVer != null && localVer > ledgerVer;
    super(
      skew
        ? `ledger head version skew: local_commit=${localVer} durable_commit=${ledgerVer}`
        : `ledger head integrity conflict at commit ${input.commit_version}: ` +
            `local=${input.local_entry_hash?.slice(0, 12) ?? "none"} ` +
            `ledger=${input.ledger_entry_hash.slice(0, 12)}`,
    );
    this.name = "LedgerHeadIntegrityError";
    this.session_id = input.session_id;
    this.commit_version = input.commit_version;
    this.local_entry_hash = input.local_entry_hash;
    this.ledger_entry_hash = input.ledger_entry_hash;
    this.local_commit_version = localVer;
    this.ledger_commit_version = ledgerVer;
  }
}

export type LedgerHeadCatchupResult = {
  session: POJUSessionState;
  adopted: boolean;
  head_commit_version: number | null;
};

/**
 * If the durable ledger head is ahead of session.dc_ledger (or the session has
 * no mirror), adopt that head's snapshot/blueprint into the working session.
 * Validates session_id and entry_hash via loadLedgerEntry.
 */
export async function adoptLedgerHeadIntoSessionIfAhead(
  session: POJUSessionState,
  now = new Date().toISOString(),
): Promise<LedgerHeadCatchupResult> {
  const sessionId = session.session_id?.trim();
  if (!sessionId) {
    return { session, adopted: false, head_commit_version: null };
  }

  const head = await readLedgerHead(sessionId);
  if (!head) {
    return { session, adopted: false, head_commit_version: null };
  }

  // Re-load by commit_version to enforce entry_hash integrity checks.
  const verified = await loadLedgerEntry(sessionId, head.commit_version);
  if (!verified || verified.session_id !== sessionId) {
    return { session, adopted: false, head_commit_version: null };
  }
  if (verified.entry_hash !== head.entry_hash) {
    return { session, adopted: false, head_commit_version: null };
  }

  const localVersion = session.dc_ledger?.head?.commit_version;
  const localHash = session.dc_ledger?.head?.entry_hash?.trim() || null;
  const hasLocalMirror =
    typeof localVersion === "number" && Number.isFinite(localVersion) && localVersion > 0;

  if (hasLocalMirror && localVersion === verified.commit_version) {
    if (localHash === verified.entry_hash) {
      // Mirror already matches the durable head.
      return {
        session,
        adopted: false,
        head_commit_version: verified.commit_version,
      };
    }
    // Same version, different hash — integrity conflict, never silent adopt.
    throw new LedgerHeadIntegrityError({
      session_id: sessionId,
      commit_version: verified.commit_version,
      local_entry_hash: localHash,
      ledger_entry_hash: verified.entry_hash,
      local_commit_version: localVersion,
      ledger_commit_version: verified.commit_version,
    });
  }

  if (hasLocalMirror && localVersion! > verified.commit_version) {
    // Local mirror ahead of durable head — fail closed; do not adopt older ledger
    // and do not let the request continue on an inconsistent pair.
    throw new LedgerHeadIntegrityError({
      session_id: sessionId,
      commit_version: localVersion!,
      local_entry_hash: localHash,
      ledger_entry_hash: verified.entry_hash,
      local_commit_version: localVersion!,
      ledger_commit_version: verified.commit_version,
    });
  }

  // local missing/behind (localVersion < verified, or no mirror) → catch-up.
  const headRef = headRefFromEntry(verified);
  const genesis =
    verified.commit_version === 1
      ? verified
      : await loadLedgerEntry(sessionId, 1);
  const writerToken =
    session.dc_ledger?.writer_token?.trim() ||
    (genesis
      ? writerTokenForGenesis(sessionId, genesis.entry_hash)
      : writerTokenForGenesis(sessionId, verified.entry_hash));

  return {
    session: {
      ...session,
      decision_context: verified.snapshot,
      decision_blueprint: verified.blueprint ?? session.decision_blueprint,
      dc_ledger: {
        schema_version: DC_LEDGER_SCHEMA_VERSION,
        writer_token: writerToken,
        head: headRef,
        synced_at: now,
      },
    },
    adopted: true,
    head_commit_version: verified.commit_version,
  };
}
