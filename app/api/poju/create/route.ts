import { NextResponse } from "next/server";
import { applyUserProfileToSession } from "@/lib/poju/apply-profile";
import { checkAndArchiveSessions, defaultExpiry } from "@/lib/poju/lifecycle";
import { getActiveByDevice, saveSession } from "@/lib/poju/session-store";
import type { CreateSessionInput, SessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

function makeSession(deviceId: string): SessionState {
  const now = Date.now();
  const sessionId = `poju_${now}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    sessionId,
    deviceId,
    status: "active",
    phase: 1,
    title: "POJU Session",
    createdAt: now,
    lastInteractionAt: now,
    expiresAt: defaultExpiry(),
    renewals: [],
    collection: {},
    actions: [],
    messages: [],
    abuse: {
      messageCount: 0,
      totalChars: 0,
      blockedCount: 0,
    },
  };
}

export async function POST(req: Request) {
  checkAndArchiveSessions();
  const body = (await req.json().catch(() => ({}))) as Partial<CreateSessionInput> & { userProfile?: UserProfile | null };
  const deviceId = String(body.deviceId ?? "device_local");

  const existing = getActiveByDevice(deviceId);
  if (existing) {
    return NextResponse.json({
      ok: true,
      reused: true,
      sessionId: existing.sessionId,
      status: existing.status,
      phase: existing.phase,
      expiresAt: existing.expiresAt,
    });
  }

  const session = makeSession(deviceId);
  if (body.userProfile && typeof body.userProfile.id === "string") {
    applyUserProfileToSession(session, body.userProfile);
  }
  saveSession(session);
  return NextResponse.json({
    ok: true,
    reused: false,
    sessionId: session.sessionId,
    status: session.status,
    phase: session.phase,
    expiresAt: session.expiresAt,
  });
}
