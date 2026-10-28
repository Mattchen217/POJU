import { NextResponse } from "next/server";

import { readServerSession } from "@/lib/auth/supabase-server";

/**
 * Lightweight session probe for landing / client resume flows.
 * GET → { ok, user: { id, email } | null }
 * Soft lookup failure → 503 { error: "session_uncertain" } (not a logged-out 200).
 */
export async function GET() {
  try {
    const { user, uncertain } = await readServerSession();
    if (uncertain) {
      // Soft lookup failure — client must not treat this as a logout.
      return NextResponse.json(
        { ok: false, error: "session_uncertain", user: null },
        { status: 503 },
      );
    }
    if (!user) {
      return NextResponse.json({ ok: true, user: null });
    }
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    });
  } catch (error) {
    console.error("[auth/me]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { ok: false, error: "session_uncertain", user: null },
      { status: 503 },
    );
  }
}
