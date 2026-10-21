import type { AuthLocale } from "@/lib/auth/auth-locale";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";

/**
 * Keep `user_metadata.lang` / `locale` in sync so Auth email templates can
 * branch on `{{ .Data.lang }}` (zh | en | es | fr).
 */
export async function syncAuthLangMetadata(
  email: string,
  lang?: AuthLocale,
): Promise<void> {
  if (!lang || !isSupabaseAdminConfigured()) return;
  const found = await findAuthUserByEmail(email);
  if (!found) return;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    user_metadata: { lang, locale: lang },
  });
  if (error) {
    console.error("[auth/sync-lang]", error.name, error.message);
  }
}
