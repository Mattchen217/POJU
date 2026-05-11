import { NextResponse } from "next/server";
import { restoreSession } from "@/lib/poju/session-store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  const restored = restoreSession(sessionId);
  if (!restored) return NextResponse.json({ error: "archived_session_not_found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    sessionId: restored.sessionId,
    status: restored.status,
    expiresAt: restored.expiresAt,
  });
}
