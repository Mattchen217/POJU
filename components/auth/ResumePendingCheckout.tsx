"use client";

import { useEffect, useRef } from "react";

import { PENDING_INTENT_KEY, PendingIntentSchema } from "@/lib/auth/pending-intent";

/**
 * After login/signup, if V2 landing saved a purchase intent, start checkout once.
 * Mount on `/` (workspace landing) and optionally `/app`.
 */
export function ResumePendingCheckout() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(PENDING_INTENT_KEY);
      } catch {
        return;
      }
      if (!raw) return;

      let intentUnknown: unknown;
      try {
        intentUnknown = JSON.parse(raw);
      } catch {
        try {
          window.localStorage.removeItem(PENDING_INTENT_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      const parsed = PendingIntentSchema.safeParse(intentUnknown);
      if (!parsed.success) {
        try {
          window.localStorage.removeItem(PENDING_INTENT_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
      const me = (await meRes.json().catch(() => ({}))) as { user?: { id?: string } | null };
      if (!me.user?.id) return;

      const locale =
        document.documentElement.lang?.slice(0, 2) ||
        (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en");

      const checkoutRes = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ intent: parsed.data, locale }),
      });
      const data = (await checkoutRes.json().catch(() => ({}))) as {
        ok?: boolean;
        checkout_url?: string;
        error?: string;
      };

      if (!checkoutRes.ok || !data.ok || !data.checkout_url) {
        return;
      }

      try {
        window.localStorage.removeItem(PENDING_INTENT_KEY);
      } catch {
        /* ignore */
      }
      window.location.href = data.checkout_url;
    })();
  }, []);

  return null;
}
