"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { postAuthJson } from "@/lib/auth/post-auth-json";

export type AuthUserState = {
  user: User | null;
  email: string | null;
  ready: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) browserClient = createSupabaseBrowserClient();
  return browserClient;
}

/**
 * Cookie-session auth user for client components (workspace chip / profile).
 */
export function useAuthUser(): AuthUserState {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      setUser(null);
      setReady(true);
      return;
    }

    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    const supabase = getBrowserClient();
    if (!supabase) {
      setUser(null);
      setReady(true);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    setReady(true);
  }

  async function signOut() {
    await postAuthJson("/api/auth/logout", {});
    try {
      await getBrowserClient()?.auth.signOut();
    } catch {
      /* env unset */
    }
    setUser(null);
  }

  return {
    user,
    email: user?.email ?? null,
    ready,
    signOut,
    refresh,
  };
}
