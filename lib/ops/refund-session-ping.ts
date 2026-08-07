import { kv } from "@/lib/kv/client";

const REFUND_SESSION_PING_KEY = "ops:refund-session-pings";
/** Keep pings ~90 days for PASS refund reconciliation. */
const REFUND_PING_TTL_SEC = 90 * 24 * 60 * 60;
const MAX_ENTRIES = 5000;

export type RefundSessionPingSource = "unqualified_l4";

export interface RefundSessionPing {
  session_id: string;
  source: RefundSessionPingSource;
  created_at: string;
}

function isValidSessionId(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 8 || t.length > 128) return false;
  // UUID or opaque session tokens — no spaces / path chars.
  return /^[A-Za-z0-9_-]+$/.test(t);
}

export async function recordRefundSessionPing(input: {
  session_id: string;
  source?: RefundSessionPingSource;
}): Promise<RefundSessionPing | null> {
  const session_id = input.session_id.trim();
  if (!isValidSessionId(session_id)) return null;

  const entry: RefundSessionPing = {
    session_id,
    source: input.source ?? "unqualified_l4",
    created_at: new Date().toISOString(),
  };

  const existing =
    ((await kv.get(REFUND_SESSION_PING_KEY)) as RefundSessionPing[] | null) ?? [];
  const next = [
    entry,
    ...existing.filter((e) => e.session_id !== session_id),
  ].slice(0, MAX_ENTRIES);
  await kv.set(REFUND_SESSION_PING_KEY, next, { ex: REFUND_PING_TTL_SEC });
  return entry;
}

export async function listRefundSessionPings(): Promise<RefundSessionPing[]> {
  return ((await kv.get(REFUND_SESSION_PING_KEY)) as RefundSessionPing[] | null) ?? [];
}

export { isValidSessionId as isValidRefundCheckSessionId };
