"use client";

import { useLocale } from "next-intl";
import { useState } from "react";

export function useStripePortal() {
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function openPortal(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/account/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        portal_url?: string;
      };
      if (!res.ok || !data.ok || !data.portal_url) {
        setError(true);
        return false;
      }
      window.location.href = data.portal_url;
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, openPortal, clearError: () => setError(false) };
}
