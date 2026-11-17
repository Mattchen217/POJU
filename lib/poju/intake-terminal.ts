import type { POJUSessionState } from "@/lib/poju/types";

export type IntakeTerminalReason =
  | "context_frozen"
  | "session_expired"
  | "session_expiry_invalid"
  | "context_state_unverified";

/** Fast, isomorphic guard for every Intake turn. Server callers also verify the durable ledger head. */
export function getLocalIntakeTerminalReason(
  session: POJUSessionState,
  now = Date.now(),
): IntakeTerminalReason | null {
  const dc = session.decision_context;
  const matchingReceipt = Boolean(dc && (session.dc_freeze_receipts ?? []).some((receipt) =>
    receipt.session_id === session.session_id &&
    receipt.context_id === dc.context_id &&
    receipt.context_version === dc.version &&
    receipt.context_hash === dc.content_hash));
  if (dc?.status === "final" || matchingReceipt) return "context_frozen";

  const expiry = typeof session.expires_at === "string" ? Date.parse(session.expires_at) : Number.NaN;
  if (!Number.isFinite(expiry)) return "session_expiry_invalid";
  if (expiry <= now) return "session_expired";
  return null;
}

export class POJUIntakeTerminalError extends Error {
  readonly reason: IntakeTerminalReason;
  constructor(reason: IntakeTerminalReason) {
    super(`poju_intake_terminal:${reason}`);
    this.name = "POJUIntakeTerminalError";
    this.reason = reason;
  }
}
