import { NextResponse } from "next/server";
import { loadSession, saveSession } from "@/lib/poju/session-store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = String(body.sessionId ?? "");
  const session = loadSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  session.status = "resolved";
  session.lastInteractionAt = Date.now();
  saveSession(session);
  return NextResponse.json({ ok: true, sessionId, status: "resolved" });
}
