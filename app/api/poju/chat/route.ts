import { NextResponse } from "next/server";
import { canLeavePhase2 } from "@/lib/poju/apply-profile";
import { runPojuTurn } from "@/lib/poju/engine";
import { checkAndArchiveSessions } from "@/lib/poju/lifecycle";
import { loadSession, saveSession } from "@/lib/poju/session-store";
import type { ChatInput } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export async function POST(req: Request) {
  checkAndArchiveSessions();
  const body = (await req.json().catch(() => ({}))) as Partial<ChatInput> & {
    locale?: string;
    userProfile?: UserProfile | null;
  };
  const sessionId = String(body.sessionId ?? "");
  const input = String(body.input ?? "").trim();
  if (!sessionId || !input) {
    return NextResponse.json({ error: "sessionId and input are required" }, { status: 400 });
  }
  const session = loadSession(sessionId);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "session_not_active", status: session.status }, { status: 400 });
  }

  session.messages.push({ role: "user", text: input, createdAt: Date.now() });
  const locale = String(body.locale ?? "en");
  const userProfile =
    body.userProfile && typeof body.userProfile === "object" && typeof body.userProfile.id === "string"
      ? body.userProfile
      : null;
  const out = await runPojuTurn(session, input, locale, userProfile);
  out.next.messages.push({ role: "assistant", text: out.reply, createdAt: Date.now() });
  saveSession(out.next);

  const showDataForm = out.next.phase === 2 && !canLeavePhase2(out.next);
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const showRenewalPrompt =
    out.next.status === "active" &&
    out.next.expiresAt > now &&
    out.next.expiresAt - now < SEVEN_DAYS_MS;

  return NextResponse.json({
    ok: true,
    sessionId: out.next.sessionId,
    phase: out.next.phase,
    status: out.next.status,
    reply: out.reply,
    actions: out.next.actions,
    shouldArchive: out.next.status === "archived",
    showDataForm,
    collection: out.next.collection,
    profileDeclined: !!out.next.profileDeclined,
    expiresAt: out.next.expiresAt,
    showRenewalPrompt,
  });
}
