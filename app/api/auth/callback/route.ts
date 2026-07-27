import { NextResponse } from "next/server";

import { safeNextPath, siteOrigin } from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

/**
 * OAuth / magic-link code exchange → Cookie session → redirect.
 * Lives under /api so next-intl matcher does not rewrite the URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin();
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/app");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(`/login?error=oauth_failed`, origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback]", error.name, error.message);
      return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
    }
    return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    console.error("[auth/callback] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
