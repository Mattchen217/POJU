import {
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
 * Admin lookup by email (GoTrue `?email=` filter). Used to distinguish
 * unconfirmed accounts from bad passwords when login returns invalid_credentials.
 */
export async function findAuthUserByEmail(
  emailRaw: string,
): Promise<AuthUserEmailLookup | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const email = normalizeEmail(emailRaw);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return null;

  try {
    const url = new URL(`${base}/auth/v1/admin/users`);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
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
