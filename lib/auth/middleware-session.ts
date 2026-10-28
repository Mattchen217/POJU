import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  commitStagedAuthCookies,
  hasSupabaseSessionCookie,
  resolveMiddlewareAuthOutcome,
} from "@/lib/auth/session-cookie-policy";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

export type SessionRefreshResult = {
  response: NextResponse;
  user: User | null;
  /**
   * Session cookie is present but `getUser()` failed without a definitive logout.
   * The route guard must not bounce `/app` to `/login`.
   */
  sessionUncertain: boolean;
};

type StagedCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Refresh Supabase auth cookies onto an existing middleware response
 * (e.g. next-intl's response). Returns the current user for optional guards.
 *
 * Cookie writes are staged. A soft `getUser()` failure (timeout, 5xx, unreadable
 * chunk) discards them so a refresh blip cannot clear the browser session.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionRefreshResult> {
  if (!isSupabaseConfigured()) {
    return { response, user: null, sessionUncertain: false };
  }

  const hadSessionCookie = hasSupabaseSessionCookie(request.cookies.getAll());
  const staged: StagedCookie[] = [];
  const stagedHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const cookie of cookiesToSet) {
            staged.push({
              name: cookie.name,
              value: cookie.value,
              options: cookie.options as Record<string, unknown> | undefined,
            });
          }
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              if (typeof value === "string") stagedHeaders[key] = value;
            }
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

  const outcome = resolveMiddlewareAuthOutcome({
    user,
    error,
    hadSessionCookie,
  });

  if (outcome.commitCookieWrites && staged.length > 0) {
    commitStagedAuthCookies(response, staged, stagedHeaders);
    // Downstream of this middleware sees the rotated cookie on the request.
    for (const cookie of staged) {
      if (!cookie.value) continue;
      try {
        request.cookies.set(cookie.name, cookie.value);
      } catch {
        // Response Set-Cookie already carries the rotation.
      }
    }
  }

  return {
    response,
    user: outcome.sessionUncertain ? null : user,
    sessionUncertain: outcome.sessionUncertain,
  };
}
