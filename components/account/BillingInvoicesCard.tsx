"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CreditCard, Receipt } from "lucide-react";

type Props = {
  hasStripeCustomer: boolean;
  loading?: boolean;
};

export function BillingInvoicesCard({ hasStripeCustomer, loading = false }: Props) {
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
    <section className="acct-strip">
      <h3 className="acct-strip__title">{t("financialProtocols")}</h3>
      <div className="acct-strip__body">
        <div className="acct-finance">
          <button
            type="button"
            className="acct-finance__tile"
            disabled={busy || loading || !hasStripeCustomer}
            onClick={() => void openPortal()}
          >
            <CreditCard className="acct-finance__icon" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="acct-finance__title">{t("externalBilling")}</p>
              <p className="acct-finance__hint">{t("externalBillingHint")}</p>
            </div>
          </button>
          <button
            type="button"
            className="acct-finance__tile"
            disabled={busy || loading || !hasStripeCustomer}
            onClick={() => void openPortal()}
          >
            <Receipt className="acct-finance__icon acct-finance__icon--cyan" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="acct-finance__title acct-finance__title--cyan">{t("invoiceRegistry")}</p>
              <p className="acct-finance__hint">{t("invoiceRegistryHint")}</p>
            </div>
          </button>
        </div>
        {loading ? (
          <p className="acct-empty is-loading">{t("loading")}</p>
        ) : !hasStripeCustomer ? (
          <p className="acct-empty">{t("billingUnavailable")}</p>
        ) : null}
        {busy ? <p className="acct-empty">{t("openingPortal")}</p> : null}
        {error ? (
          <p className="acct-alert" role="alert">
            {t("portalError")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
