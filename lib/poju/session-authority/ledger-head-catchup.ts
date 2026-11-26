/**
 * Adopt a durable DC ledger head into a working Session snapshot when the
 * ledger is ahead of the Session Authority mirror (e.g. ledger append succeeded
 * but the final Session CAS aborted or lost a race).
 *
 * Does not invent a second DC store — reads the existing ledger entry and
 * copies its validated snapshot into the working Session.
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

  const localVersion = session.dc_ledger?.head?.commit_version ?? 0;
  const localHash = session.dc_ledger?.head?.entry_hash ?? null;
  if (
    localVersion > verified.commit_version ||
    (localVersion === verified.commit_version && localHash === verified.entry_hash)
  ) {
    // Mirror already current (or ahead in the rare local-only case).
    if (
      localVersion === verified.commit_version &&
      localHash === verified.entry_hash &&
      session.decision_context &&
      verified.snapshot_hash
    ) {
      return {
        session,
        adopted: false,
        head_commit_version: verified.commit_version,
      };
    }
  }

  if (verified.commit_version < localVersion) {
    return {
      session,
      adopted: false,
      head_commit_version: verified.commit_version,
    };
  }

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
