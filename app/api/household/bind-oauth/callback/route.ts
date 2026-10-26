import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { requestOrigin } from "@/lib/auth/auth-helpers";
import { OAUTH_BIND_MESSAGE_TYPE } from "@/lib/auth/oauth-bind";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { acceptSeatInvite } from "@/lib/passes/household";

export const runtime = "nodejs";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * OAuth return for binding seat B.
 * Exchanges the code to learn the partner user id, binds via invite token,
 * then returns a popup-close page WITHOUT writing partner session cookies —
 * seat A must stay signed in in the opener.
 */
function doneHtml(origin: string, status: "ok" | "error", errorCode?: string): string {
  const message =
    status === "ok"
      ? "Bound. You can close this window."
      : "Bind failed. You can close this window.";
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
        type: ${JSON.stringify(OAUTH_BIND_MESSAGE_TYPE)},
        status: ${JSON.stringify(status)},
        error: ${JSON.stringify(errorCode ?? null)}
      };
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, ${JSON.stringify(origin)});
        }
      } catch (e) {}
      try { window.close(); } catch (e) {}
      setTimeout(function () { try { window.close(); } catch (e) {} }, 120);
      setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
    })();
  </script>
</body>
</html>`;
}

function htmlResponse(origin: string, status: "ok" | "error", errorCode?: string): NextResponse {
  return new NextResponse(doneHtml(origin, status, errorCode), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const invite = url.searchParams.get("invite")?.trim() ?? "";
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code) {
    return htmlResponse(origin, "error", "oauth_failed");
  }
  if (!invite) {
    return htmlResponse(origin, "error", "missing_token");
  }
  if (!isSupabaseConfigured()) {
    return htmlResponse(origin, "error", "supabase_unconfigured");
  }

  // Collect cookies from exchange but never apply them — keep seat A session.
  const discarded: CookieToSet[] = [];

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
              discarded.push(cookie);
            });
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user?.id) {
      console.error("[bind-oauth/callback]", error?.name, error?.message);
      return htmlResponse(origin, "error", "oauth_failed");
    }

    const partnerId = data.user.id;
    const result = await acceptSeatInvite({ token: invite, userId: partnerId });
    if (!result.ok) {
      console.error("[bind-oauth/callback] accept", result.reason);
      return htmlResponse(origin, "error", result.reason);
    }

    // Intentionally ignore `discarded` partner cookies so opener stays on seat A.
    void discarded;
    return htmlResponse(origin, "ok");
  } catch (e) {
    console.error("[bind-oauth/callback]", e instanceof Error ? e.message : e);
    return htmlResponse(origin, "error", "server_error");
  }
}
