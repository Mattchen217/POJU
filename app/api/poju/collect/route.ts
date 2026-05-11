import { NextResponse } from "next/server";
import { calculateProfile } from "@/lib/calculations";
import { applyUserProfileToSession, canLeavePhase2 } from "@/lib/poju/apply-profile";
import { getPojuPhaseCopy } from "@/lib/poju/phase-messages";
import { loadSession, saveSession } from "@/lib/poju/session-store";
import type { UserProfile } from "@/lib/profile/types";
import { normalizeBirthInfoInput } from "@/lib/profile/normalize-birth-input";

const CURRENT_YEAR = new Date().getFullYear();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    locale?: string;
    skip?: boolean;
    displayName?: string;
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    gender?: string;
    city?: string;
  };
  const sessionId = String(body.sessionId ?? "");
  const locale = String(body.locale ?? "en");
  const copy = getPojuPhaseCopy(locale);

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });
  }

  const session = loadSession(sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ ok: false, error: "session_not_active" }, { status: 400 });
  }
  if (session.phase !== 2) {
    return NextResponse.json({ ok: false, error: "collect_only_in_phase_2" }, { status: 400 });
  }

  if (body.skip === true) {
    session.profileDeclined = true;
    session.phase = 3;
    session.lastInteractionAt = Date.now();
    saveSession(session);
    return NextResponse.json({
      ok: true,
      phase: session.phase,
      reply: copy.skipToGeneric,
      showDataForm: false,
      profileDeclined: true,
      profile: null as UserProfile | null,
    });
  }

  const displayName = String(body.displayName ?? "").trim();
  if (!displayName) {
    return NextResponse.json({ ok: false, error: "displayName required" }, { status: 400 });
  }

  const city = String(body.city ?? "").trim();
  if (!city) {
    return NextResponse.json({ ok: false, error: "city required" }, { status: 400 });
  }

  const birth = normalizeBirthInfoInput({
    year: body.year,
    month: body.month,
    day: body.day,
    hour: body.hour,
    minute: body.minute,
    gender: body.gender as "male" | "female" | "other" | undefined,
    city,
  });

  if (birth.year < 1900 || birth.year > CURRENT_YEAR || birth.month < 1 || birth.month > 12 || birth.day < 1 || birth.day > 31) {
    return NextResponse.json({ ok: false, error: "invalid_birth_date" }, { status: 400 });
  }
  if (birth.hour < 0 || birth.hour > 23 || (birth.minute ?? 0) < 0 || (birth.minute ?? 0) > 59) {
    return NextResponse.json({ ok: false, error: "invalid_birth_time" }, { status: 400 });
  }

  let profile: UserProfile;
  try {
    profile = await calculateProfile(birth);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "calculate_failed" },
      { status: 500 },
    );
  }

  session.profileDeclined = false;
  applyUserProfileToSession(session, profile);
  session.collection.name = displayName.slice(0, 80);

  if (!canLeavePhase2(session)) {
    return NextResponse.json({ ok: false, error: "collection_incomplete" }, { status: 500 });
  }

  session.phase = 3;
  session.lastInteractionAt = Date.now();
  saveSession(session);

  return NextResponse.json({
    ok: true,
    phase: session.phase,
    reply: copy.phase2To3Complete,
    showDataForm: false,
    profileDeclined: false,
    profile,
  });
}
