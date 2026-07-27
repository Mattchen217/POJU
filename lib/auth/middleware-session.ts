import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/auth/supabase";

export type SessionRefreshResult = {
  response: NextResponse;
  user: User | null;
};

/**
 * Refresh Supabase auth cookies onto an existing middleware response
 * (e.g. next-intl's response). Returns the current user for optional guards.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionRefreshResult> {
  if (!isSupabaseConfigured()) {
    return { response, user: null };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Triggers token refresh when needed and writes updated cookies via setAll.
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : (data.user ?? null);
  return { response, user };
}
