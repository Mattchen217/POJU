import { NextResponse } from "next/server";
import { checkAndArchiveSessions } from "@/lib/poju/lifecycle";
import { getActiveByDevice } from "@/lib/poju/session-store";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  checkAndArchiveSessions();
  const body = (await req.json().catch(() => ({}))) as { deviceId?: string };
  const deviceId = String(body.deviceId ?? "");
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }
  const active = getActiveByDevice(deviceId);
  if (!active) {
    return NextResponse.json({ ok: true, active: false });
  }
  const now = Date.now();
  const showRenewalPrompt =
    active.status === "active" && active.expiresAt > now && active.expiresAt - now < SEVEN_DAYS_MS;
  return NextResponse.json({
    ok: true,
    active: true,
    sessionId: active.sessionId,
    phase: active.phase,
    status: active.status,
    expiresAt: active.expiresAt,
    showRenewalPrompt,
  });
}
