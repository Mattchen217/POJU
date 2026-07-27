import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/auth-helpers";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

/**
 * OAuth / magic-link code exchange → Cookie session → redirect.
 * Cookies must be written onto the redirect Response (not only cookies()).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Prefer the host the browser actually hit so session cookies stick.
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/app");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  try {
    const response = NextResponse.redirect(new URL(next, origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback]", error.name, error.message);
      return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
    }
    return response;
  } catch (error) {
    console.error("[auth/callback] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
