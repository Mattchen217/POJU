import "server-only";

import type { POJUSessionState } from "@/lib/poju/types";
import { blueprintHash, dcSnapshotHash } from "../hash";
import { readLedgerHead } from "./ledger-store";
import { getLocalIntakeTerminalReason, POJUIntakeTerminalError } from "../../intake-terminal";

export { POJUIntakeTerminalError };

/** Server authority check used immediately before every model execution. */
export async function assertSessionCanEnterIntake(session: POJUSessionState): Promise<void> {
  const localReason = getLocalIntakeTerminalReason(session);
  if (localReason) throw new POJUIntakeTerminalError(localReason);

  let head;
  try {
    head = await readLedgerHead(session.session_id);
  } catch {
    // A client can remove its local DI2 fields, so store failure cannot be used to infer legacy.
    throw new POJUIntakeTerminalError("context_state_unverified");
  }
  if (!head) return;
  if (head.change_type === "freeze" || head.dc_status === "final") {
    throw new POJUIntakeTerminalError("context_frozen");
  }
  const dc = session.decision_context;
  if (
    !dc ||
    dcSnapshotHash(dc) !== head.snapshot_hash ||
    (head.blueprint_hash !== null && blueprintHash(session.decision_blueprint ?? null) !== head.blueprint_hash)
  ) {
    throw new POJUIntakeTerminalError("context_state_unverified");
  }
}
