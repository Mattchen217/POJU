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

type AdminUserRow = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

function toLookup(user: AdminUserRow, email: string): AuthUserEmailLookup {
  return {
    id: user.id,
    email: user.email ?? email,
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}

function matchEmail(users: AdminUserRow[] | undefined, email: string): AdminUserRow | null {
  if (!users?.length) return null;
  return users.find((u) => normalizeEmail(u.email ?? "") === email) ?? null;
}

/**
 * Admin lookup by email. Used to distinguish unconfirmed accounts from
 * bad passwords / hard "already registered" when Auth only returns a generic error.
 *
 * Important: GoTrue's `?email=` filter is not reliable on all versions — when the
 * response is OK but the first row is a different user, we must fall through to a
 * scanned `listUsers` match instead of treating the account as missing.
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

    if (res.ok) {
      const json = (await res.json()) as {
        users?: AdminUserRow[];
        user?: AdminUserRow;
      };
      const candidates = Array.isArray(json.users)
        ? json.users
        : json.user
          ? [json.user]
          : [];
      const matched = matchEmail(candidates, email);
      if (matched?.id) return toLookup(matched, email);
      // Filter ignored / empty — do not trust users[0]; scan below.
    }

    const admin = createSupabaseAdminClient();
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      const matched = matchEmail(data.users as AdminUserRow[], email);
      if (matched?.id) return toLookup(matched, email);
      if (data.users.length < 200) break;
    }
    return null;
  } catch {
    return null;
  }
}
