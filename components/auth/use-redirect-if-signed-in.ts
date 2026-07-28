"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

/**
 * If a Cookie session already exists (e.g. OAuth finished in another window,
 * or callback set cookies but the UI stayed on /login), leave auth pages.
 */
export function useRedirectIfSignedIn(nextPath: string): void {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const go = () => {
      if (cancelled) return;
      router.replace(nextPath);
      router.refresh();
    };

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) go();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        go();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [nextPath, router]);
}
