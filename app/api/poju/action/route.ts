import { NextResponse } from "next/server";
import { updateActionStatus } from "@/lib/poju/actions";
import { loadSession, saveSession } from "@/lib/poju/session-store";
import type { ActionItem } from "@/lib/poju/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    actionId?: string;
    status?: ActionItem["status"];
  };
  const sessionId = String(body.sessionId ?? "");
  const actionId = String(body.actionId ?? "");
  const status = body.status;
  if (!sessionId || !actionId || !status) {
    return NextResponse.json({ error: "sessionId, actionId, status required" }, { status: 400 });
  }
  if (!["todo", "doing", "done", "skipped"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const session = loadSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "session_not_active" }, { status: 400 });
  }
  updateActionStatus(session, actionId, status);
  saveSession(session);
  return NextResponse.json({ ok: true, actions: session.actions });
}
