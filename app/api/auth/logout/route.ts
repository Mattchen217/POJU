import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { requestOrigin, safeNextPath } from "@/lib/auth/auth-helpers";

/**
 * Sign out and clear Cookie session. Supports POST (JSON) and GET (redirect).
 */
export async function POST(req: Request) {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"), "/");
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error("[auth/logout] unexpected", error instanceof Error ? error.name : "unknown");
  }
  return NextResponse.redirect(new URL(next, requestOrigin(req)));
}
