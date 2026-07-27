import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeNextPath, siteOrigin } from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Email link confirm (reset password / email confirm) via token_hash.
 * Writes Cookie session then redirects to `next` (e.g. /reset-password).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin();
  const tokenHash = url.searchParams.get("token_hash");
  const typeRaw = url.searchParams.get("type") ?? "recovery";
  const next = safeNextPath(url.searchParams.get("next"), "/reset-password");

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  const type = (ALLOWED_TYPES.has(typeRaw as EmailOtpType) ? typeRaw : "recovery") as EmailOtpType;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      console.error("[auth/confirm]", error.name, error.message);
      return NextResponse.redirect(new URL("/login?error=link_expired", origin));
    }
    return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    console.error("[auth/confirm] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }
}
