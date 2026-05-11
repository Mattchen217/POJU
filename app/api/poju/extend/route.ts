import { NextResponse } from "next/server";
import { extendSession } from "@/lib/poju/lifecycle";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  const session = extendSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found_or_inactive" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    renewals: session.renewals.length,
    message: "Session extended for 30 more days",
  });
}
