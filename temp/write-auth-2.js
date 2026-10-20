const fs = require("fs");
const path = require("path");
function write(rel, content) {
  const p = path.join("D:/POJU/pojulife", rel);
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

write("lib/auth/find-user-by-email.ts", `import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { normalizeEmail } from "@/lib/auth/auth-helpers";

export type AuthUserEmailLookup = {
  id: string;
  email: string;
  emailConfirmed: boolean;
};

/**
 * Admin lookup by email (GoTrue \`?email=\` filter). Used to distinguish
 * unconfirmed accounts from bad passwords when login returns invalid_credentials.
 */
export async function findAuthUserByEmail(
  emailRaw: string,
): Promise<AuthUserEmailLookup | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const email = normalizeEmail(emailRaw);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return null;

  try {
    const url = new URL(\`\${base}/auth/v1/admin/users\`);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: \`Bearer \${key}\`,
        apikey: key,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      // Fallback: list a page and match (small projects / older GoTrue).
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error || !data?.users) return null;
      const user = data.users.find((u) => normalizeEmail(u.email ?? "") === email);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email ?? email,
        emailConfirmed: Boolean(user.email_confirmed_at),
      };
    }
    const json = (await res.json()) as {
      users?: Array<{ id: string; email?: string; email_confirmed_at?: string | null }>;
      user?: { id: string; email?: string; email_confirmed_at?: string | null };
    };
    const user = json.users?.[0] ?? json.user ?? null;
    if (!user?.id) return null;
    if (user.email && normalizeEmail(user.email) !== email) return null;
    return {
      id: user.id,
      email: user.email ?? email,
      emailConfirmed: Boolean(user.email_confirmed_at),
    };
  } catch {
    return null;
  }
}
`);

write("app/api/auth/login/route.ts", `import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { assertLoginAttemptAllowed } from "@/lib/auth/auth-rate-limit";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Email + password login. Writes Cookie session on success.
 * Unconfirmed users are returned as \`email_not_confirmed\` even when Supabase
 * only says "Invalid login credentials".
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;
    const ip = clientIpFromRequest(req);

    const rate = await assertLoginAttemptAllowed(email, ip);
    if (!rate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          retry_after_sec: rate.retryAfterSec,
        },
        { status: 429 },
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        user: {
          id: \`mock-user-\${Buffer.from(email).toString("base64url").slice(0, 16)}\`,
          email,
        },
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const mapped = mapAuthErrorCode(
        error?.message,
        (error as { code?: string } | null)?.code,
      );
      let code = mapped;
      // Supabase often returns invalid_credentials for unconfirmed emails.
      if (code === "invalid_credentials" || code === "auth_failed") {
        const found = await findAuthUserByEmail(email);
        if (found && !found.emailConfirmed) {
          code = "email_not_confirmed";
        }
      }
      console.error("[auth/login]", error?.name ?? "no_user", code);
      return NextResponse.json({ ok: false, error: code }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
    });
  } catch (error) {
    console.error("[auth/login] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
`);

write("app/api/auth/signup/route.ts", `import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { createSupabaseAnonClient, isSupabaseConfigured } from "@/lib/auth/supabase";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Email + password signup. Supabase sends confirmation OTP/email per dashboard templates.
 * Session is not established until verify-signup (when confirm email is enabled).
 *
 * If the email is already registered but unconfirmed, resends the signup OTP and
 * returns \`needs_verification: true\` so the client can collect the code on /signup.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        needs_verification: true,
        email,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const mapped = mapAuthErrorCode(
        error.message,
        (error as { code?: string }).code,
      );
      console.error("[auth/signup]", error.name, error.message, mapped);

      if (mapped === "email_taken") {
        const found = await findAuthUserByEmail(email);
        if (found && !found.emailConfirmed) {
          const anon = createSupabaseAnonClient();
          const { error: resendError } = await anon.auth.resend({
            type: "signup",
            email,
          });
          if (resendError) {
            console.error("[auth/signup] resend", resendError.name, resendError.message);
            const resendMapped = mapAuthErrorCode(
              resendError.message,
              (resendError as { code?: string }).code,
            );
            if (resendMapped === "rate_limited") {
              return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
            }
          }
          return NextResponse.json({
            ok: true,
            needs_verification: true,
            existing_unconfirmed: true,
            email,
          });
        }
      }

      return NextResponse.json({ ok: false, error: mapped }, { status: 400 });
    }

    // When email confirm is on, session is null until OTP/link confirmed.
    const needsVerification = !data.session;

    return NextResponse.json({
      ok: true,
      needs_verification: needsVerification,
      email,
      user: data.user
        ? { id: data.user.id, email: data.user.email ?? email }
        : null,
    });
  } catch (error) {
    console.error("[auth/signup] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
`);

write("app/api/auth/verify-signup/route.ts", `import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  OtpTokenSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  token: OtpTokenSchema,
});

/**
 * Confirm signup with 6-digit email OTP (\`type: "signup"\`). Writes Cookie session.
 * Used from /signup (inline OTP) and /verify (fallback for half-registered users).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const token = parsed.data.token;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        user: {
          id: \`mock-user-\${Buffer.from(email).toString("base64url").slice(0, 16)}\`,
          email,
        },
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error || !data.user) {
      console.error("[auth/verify-signup]", error?.name ?? "no_user");
      return NextResponse.json(
        {
          ok: false,
          error:
            mapAuthErrorCode(error?.message, (error as { code?: string } | null)?.code) ||
            "invalid_code",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
    });
  } catch (error) {
    console.error(
      "[auth/verify-signup] unexpected",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
`);

console.log("api done");
