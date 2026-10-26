/**
 * Verify a partner account's password / signup OTP without writing any auth cookies.
 * Tokens from GoTrue are discarded on purpose — seat A must stay signed in.
 */

function goTrueBase(): { base: string; anon: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!base || !anon) return null;
  return { base, anon };
}

type TokenResponse = {
  user?: { id?: string };
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

/**
 * Password grant against GoTrue. Never stores refresh/access tokens.
 */
export async function verifyPartnerPasswordNoSession(params: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_credentials" | "email_not_confirmed" | "unconfigured" }
> {
  const cfg = goTrueBase();
  if (!cfg) return { ok: false, reason: "unconfigured" };

  const res = await fetch(`${cfg.base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: cfg.anon,
      Authorization: `Bearer ${cfg.anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: params.email, password: params.password }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const msg = `${data.error_description ?? data.error ?? data.msg ?? data.message ?? ""}`.toLowerCase();
    if (msg.includes("confirm") || msg.includes("not confirmed")) {
      return { ok: false, reason: "email_not_confirmed" };
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  const userId = data.user?.id ?? null;
  if (!userId) return { ok: false, reason: "invalid_credentials" };
  return { ok: true, userId };
}

/**
 * Signup OTP verify via GoTrue. Session tokens in the body are discarded.
 */
export async function verifyPartnerSignupOtpNoSession(params: {
  email: string;
  token: string;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_code" | "unconfigured" }
> {
  const cfg = goTrueBase();
  if (!cfg) return { ok: false, reason: "unconfigured" };

  const res = await fetch(`${cfg.base}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: cfg.anon,
      Authorization: `Bearer ${cfg.anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      token: params.token,
      type: "signup",
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  const userId = data.user?.id ?? null;
  if (!res.ok || !userId) {
    return { ok: false, reason: "invalid_code" };
  }
  return { ok: true, userId };
}
