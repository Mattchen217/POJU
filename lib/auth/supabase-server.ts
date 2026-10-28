import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  eachStagedAuthCookie,
  hasSupabaseSessionCookie,
  resolveMiddlewareAuthOutcome,
} from "@/lib/auth/session-cookie-policy";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

/**
 * Server (RSC / route handler) Cookie-session client.
 * Next 16: `cookies()` is async — must await.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // RSC render is read-only for cookies; ignore. Writes happen in
            // Route Handlers / middleware via updateSupabaseSession.
          }
        },
      },
    },
  );
}

export type ServerSessionRead = {
  user: User | null;
  /** Cookie still present; lookup failed without a definitive logout. Do not treat as signed-out. */
  uncertain: boolean;
};

/**
 * Read the cookie session for route handlers.
 * Soft failures do not flush Set-Cookie clears (a blip on `/api/joint/list`
 * or `/api/auth/me` must not log the workbench out before Continue).
 */
export async function readServerSession(): Promise<ServerSessionRead> {
  if (!isSupabaseConfigured()) return { user: null, uncertain: false };

  const cookieStore = await cookies();
  const hadSessionCookie = hasSupabaseSessionCookie(cookieStore.getAll());
  const staged: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            staged.push({
              name: cookie.name,
              value: cookie.value,
              options: cookie.options as Record<string, unknown> | undefined,
            });
          }
        },
      },
    },
  );

  let user: User | null = null;
  let error: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    error = result.error;
    user = result.error ? null : (result.data.user ?? null);
  } catch (err) {
    error = err;
    user = null;
  }

  const outcome = resolveMiddlewareAuthOutcome({ user, error, hadSessionCookie });
  if (outcome.commitCookieWrites && staged.length > 0) {
    eachStagedAuthCookie(staged, (cookie) => {
      try {
        if (cookie.options) cookieStore.set(cookie.name, cookie.value, cookie.options);
        else cookieStore.set(cookie.name, cookie.value);
      } catch {
        // RSC render is read-only for cookies. Route handlers succeed.
      }
    });
  }

  return {
    user: outcome.sessionUncertain ? null : user,
    uncertain: outcome.sessionUncertain,
  };
}

/** Current signed-in user, or null when logged out / Supabase unset / soft lookup failure. */
export async function getServerUser(): Promise<User | null> {
  const { user } = await readServerSession();
  return user;
}
