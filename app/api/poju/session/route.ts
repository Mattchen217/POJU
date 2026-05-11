import { NextResponse } from "next/server";
import { loadSession } from "@/lib/poju/session-store";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = String(url.searchParams.get("sessionId") ?? "");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });
  }
  const session = loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }
  const now = Date.now();
  const showRenewalPrompt =
    session.status === "active" && session.expiresAt > now && session.expiresAt - now < SEVEN_DAYS_MS;

  return NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    phase: session.phase,
    status: session.status,
    expiresAt: session.expiresAt,
    showRenewalPrompt,
  });
}
