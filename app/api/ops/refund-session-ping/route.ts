import { NextResponse } from "next/server";
import {
  isValidRefundCheckSessionId,
  recordRefundSessionPing,
  type RefundSessionPingSource,
} from "@/lib/ops/refund-session-ping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire-and-forget ping when unqualified L4 locks a session.
 * Stores session_id only (Never Stored — no chat body).
 */
export async function POST(req: Request) {
  let body: { session_id?: string; source?: string };
  try {
    body = (await req.json()) as { session_id?: string; source?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!isValidRefundCheckSessionId(session_id)) {
    return NextResponse.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
  }

  const source: RefundSessionPingSource =
    body.source === "unqualified_l4" ? "unqualified_l4" : "unqualified_l4";

  try {
    const entry = await recordRefundSessionPing({ session_id, source });
    if (!entry) {
      return NextResponse.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, session_id: entry.session_id, created_at: entry.created_at });
  } catch (e) {
    console.error("[ops/refund-session-ping]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "store_failed" }, { status: 500 });
  }
}
