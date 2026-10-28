import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isTransientAuthFetchError } from "@/lib/client/transient-network-retry";

/**
 * Chunked Supabase session cookies (`sb-<ref>-auth-token`, `.0`, `.1`, …).
 * Code-verifier cookies are not a session.
 */
export function isSupabaseSessionCookieName(name: string): boolean {
  return /(^|-)auth-token(\.\d+)?$/.test(name);
}

export function hasSupabaseSessionCookie(
  cookies: { name: string; value: string }[],
): boolean {
  return cookies.some(
    (cookie) => isSupabaseSessionCookieName(cookie.name) && cookie.value.trim().length > 0,
  );
}

type AuthErrorLike = {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
};

function asAuthError(error: unknown): AuthErrorLike | null {
  if (!error || typeof error !== "object") return null;
  return error as AuthErrorLike;
}

/**
 * Transport / upstream blips. The browser cookie may still be a live session.
 * Must not be treated as a logout.
 */
export function isSoftAuthFailure(error: unknown): boolean {
  if (!error) return false;
  if (isTransientAuthFetchError(error)) return true;
  const e = asAuthError(error);
  if (!e) return false;
  if (e.status === 0 || (typeof e.status === "number" && e.status >= 500)) return true;
  const name = String(e.name ?? "");
  if (/retryable|timeout|network|abort|fetch/i.test(name)) return true;
  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("err_connection") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
}

const DEFINITIVE_LOGOUT_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "bad_jwt",
  "invalid_jwt",
  "user_not_found",
  "user_banned",
  "user_deleted",
]);

/**
 * Auth server rejected the credential. Cookie clears and a login redirect are appropriate.
 * Local "session missing" (cookie present but unreadable) is not definitive — wiping it
 * turns a parse/refresh blip into a permanent logout.
 */
export function isDefinitiveAuthLogout(error: unknown): boolean {
  if (!error) return false;
  if (isSoftAuthFailure(error)) return false;
  const e = asAuthError(error);
  if (!e) return false;
  const code = String(e.code ?? "")
    .toLowerCase()
    .replace(/-/g, "_");
  if (DEFINITIVE_LOGOUT_CODES.has(code)) return true;
  if (e.status === 401 || e.status === 403) return true;
  const msg = String(e.message ?? "").toLowerCase();
  if (
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found") ||
    msg.includes("refresh token is not valid") ||
    msg.includes("session not found") ||
    msg.includes("session from session_id") ||
    msg.includes("user from sub claim in jwt does not exist") ||
    msg.includes("invalid claim")
  ) {
    return true;
  }
  if (e.name === "AuthSessionMissingError" || msg.includes("auth session missing")) {
    return false;
  }
  if (e.status === 400 && e.name && /auth/i.test(e.name)) return true;
  return false;
}

export type MiddlewareAuthOutcome = {
  /** Keep the current response. Do not send the browser to /login. */
  sessionUncertain: boolean;
  /** Persist staged Set-Cookie (refresh or explicit clear). Soft-fail discards them. */
  commitCookieWrites: boolean;
};

/**
 * Signed-in document requests (including Continue on `/app?tab=poju`) re-enter middleware.
 * A transient `getUser()` error used to look identical to logged-out and 307 to
 * `/login?next=/app?tab=poju`, often after a refresh write that cleared the cookie.
 */
export function resolveMiddlewareAuthOutcome(input: {
  user: User | null;
  error: unknown;
  hadSessionCookie: boolean;
}): MiddlewareAuthOutcome {
  if (input.user) {
    return { sessionUncertain: false, commitCookieWrites: true };
  }
  if (input.hadSessionCookie && !isDefinitiveAuthLogout(input.error)) {
    return { sessionUncertain: true, commitCookieWrites: false };
  }
  return { sessionUncertain: false, commitCookieWrites: true };
}

type StagedCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function sanitizeCookieOptions(
  options?: Record<string, unknown>,
): {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
} | undefined {
  if (!options) return undefined;
  const sameSiteRaw = options.sameSite;
  const sameSite =
    sameSiteRaw === "lax" || sameSiteRaw === "strict" || sameSiteRaw === "none"
      ? sameSiteRaw
      : sameSiteRaw === true
        ? "strict"
        : sameSiteRaw === false
          ? "lax"
          : undefined;
  const out: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  } = {};
  if (typeof options.domain === "string") out.domain = options.domain;
  if (options.expires instanceof Date) out.expires = options.expires;
  if (typeof options.httpOnly === "boolean") out.httpOnly = options.httpOnly;
  if (typeof options.maxAge === "number") out.maxAge = options.maxAge;
  if (typeof options.path === "string") out.path = options.path;
  if (sameSite) out.sameSite = sameSite;
  if (typeof options.secure === "boolean") out.secure = options.secure;
  return out;
}

const AUTH_RESPONSE_HEADERS = ["cache-control", "expires", "pragma"] as const;

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct) return direct;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1];
}

export function eachStagedAuthCookie(
  staged: StagedCookie[],
  write: (
    cookie: {
      name: string;
      value: string;
      options?: ReturnType<typeof sanitizeCookieOptions>;
    },
  ) => void,
): void {
  for (const cookie of staged) {
    write({
      name: cookie.name,
      value: cookie.value,
      options: sanitizeCookieOptions(cookie.options),
    });
  }
}

/** Write staged Supabase cookies onto the response that the browser will actually receive. */
export function commitStagedAuthCookies(
  response: NextResponse,
  staged: StagedCookie[],
  headers?: Record<string, string>,
): void {
  eachStagedAuthCookie(staged, (cookie) => {
    if (cookie.options) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    } else {
      response.cookies.set(cookie.name, cookie.value);
    }
  });
  if (!headers || staged.length === 0) return;
  for (const name of AUTH_RESPONSE_HEADERS) {
    const value = headerValue(headers, name);
    if (value) response.headers.set(name, value);
  }
}

/**
 * Redirects (`NextResponse.redirect`) drop `Set-Cookie` unless copied.
 * `cookies.set(name, value)` strips HttpOnly / Max-Age / Secure and can turn a
 * refresh into an empty session cookie. Copy the serialized header instead.
 */
export function copyResponseCookies(from: NextResponse, to: NextResponse): void {
  const raw =
    typeof from.headers.getSetCookie === "function" ? from.headers.getSetCookie() : [];
  if (raw.length > 0) {
    for (const line of raw) {
      to.headers.append("set-cookie", line);
    }
  } else {
    for (const cookie of from.cookies.getAll()) {
      to.cookies.set(cookie.name, cookie.value);
    }
  }
  for (const name of AUTH_RESPONSE_HEADERS) {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  }
}
