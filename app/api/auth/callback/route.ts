import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/auth-helpers";
import { OAUTH_POPUP_MESSAGE_TYPE } from "@/lib/auth/oauth-popup";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { userNeedsEmail } from "@/lib/auth/user-identity";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

function popupDoneHtml(origin: string, status: "ok" | "error", next: string): string {
  const message =
    status === "ok"
      ? "Signed in. You can close this window."
      : "Sign-in failed. You can close this window.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Eastern OS</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0b0815; color: #a1a1aa; font: 14px/1.5 system-ui, sans-serif; }
  </style>
</head>
<body>
  <p>${message}</p>
  <script>
    (function () {
      var payload = {
        type: ${JSON.stringify(OAUTH_POPUP_MESSAGE_TYPE)},
        status: ${JSON.stringify(status)},
        next: ${JSON.stringify(next)}
      };
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, ${JSON.stringify(origin)});
        }
      } catch (e) {}
      try { window.close(); } catch (e) {}
      // Some browsers ignore the first close(); retry briefly.
      setTimeout(function () { try { window.close(); } catch (e) {} }, 120);
      setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
    })();
  </script>
</body>
</html>`;
}

function applyCookies(response: NextResponse, cookies: CookieToSet[]): void {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });
}

function popupResponse(
  origin: string,
  status: "ok" | "error",
  next: string,
  cookies: CookieToSet[],
): NextResponse {
  const response = new NextResponse(popupDoneHtml(origin, status, next), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
  applyCookies(response, cookies);
  return response;
}

function completeEmailPath(next: string, isPopup: boolean): string {
  const q = new URLSearchParams({ next });
  if (isPopup) q.set("popup", "1");
  return `/complete-email?${q.toString()}`;
}

/**
 * OAuth / magic-link code exchange → Cookie session → redirect (or popup close).
 * Users without email are forced to `/complete-email` before the app.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/app");
  const isPopup = url.searchParams.get("popup") === "1";
  const cookiesToSet: CookieToSet[] = [];

  if (!code) {
    if (isPopup) return popupResponse(origin, "error", next, []);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  if (!isSupabaseConfigured()) {
    if (isPopup) return popupResponse(origin, "error", next, []);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(incoming) {
            incoming.forEach((cookie) => {
              cookiesToSet.push(cookie);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback]", error.name, error.message);
      if (isPopup) return popupResponse(origin, "error", next, cookiesToSet);
      return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (userNeedsEmail(user)) {
      const gate = NextResponse.redirect(new URL(completeEmailPath(next, isPopup), origin));
      applyCookies(gate, cookiesToSet);
      return gate;
    }

    if (isPopup) {
      return popupResponse(origin, "ok", next, cookiesToSet);
    }

    const redirect = NextResponse.redirect(new URL(next, origin));
    applyCookies(redirect, cookiesToSet);
    return redirect;
  } catch (error) {
    console.error("[auth/callback] unexpected", error instanceof Error ? error.name : "unknown");
    if (isPopup) return popupResponse(origin, "error", next, cookiesToSet);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
