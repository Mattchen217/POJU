"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  hasStripeCustomer: boolean;
};

export function BillingInvoicesCard({ hasStripeCustomer }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    if (busy) return;
    setBusy(true);
    setError(null);
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
        error?: string;
      };
      if (!res.ok || !data.ok || !data.portal_url) {
        setError(data.error ?? "portal_failed");
        return;
      }
      window.location.href = data.portal_url;
    } catch {
      setError("portal_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("billing")}
      </p>
      <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("billingHint")}</p>
      <button
        type="button"
        className="workspace-link-btn self-start border-0 cursor-pointer"
        disabled={busy || !hasStripeCustomer}
        onClick={() => void openPortal()}
      >
        {busy ? t("openingPortal") : t("manageBilling")}
      </button>
      {!hasStripeCustomer ? (
        <p className="m-0 text-xs text-[var(--ws-text-muted,#71717a)]">{t("billingUnavailable")}</p>
      ) : null}
      {error ? (
        <p className="m-0 text-xs text-[#fca5a5]" role="alert">
          {t("portalError")}
        </p>
      ) : null}
    </div>
  );
}
