import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";

/**
 * Lightweight session probe for landing / client resume flows.
 * GET → { ok, user: { id, email } | null }
 */
export async function GET() {
  try {
    const user = await getServerUser();
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
    return NextResponse.json({ ok: true, user: null });
  }
}
