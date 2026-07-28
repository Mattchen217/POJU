"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * After checkout return (?checkout=mock|success), credit Passes then refresh account UI.
 * Stripe gateway may be a placeholder — mock path still completes the ledger.
 */
export function CheckoutConfirmBanner({ onCredited }: { onCredited: () => void }) {
  const t = useTranslations("account");
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "mock" && checkout !== "success") return;
    if (started.current) return;
    started.current = true;

    const sessionId = searchParams.get("session_id")?.trim();
    if (!sessionId) {
      setStatus("err");
      setMessage(t("checkoutMissingSession"));
      return;
    }

    setStatus("working");
    const plan = searchParams.get("plan") ?? undefined;
    const qtyRaw = searchParams.get("qty");
    const quantity = qtyRaw ? Number.parseInt(qtyRaw, 10) : undefined;

    void fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        session_id: sessionId,
        plan,
        quantity: Number.isFinite(quantity) ? quantity : undefined,
        mocked: checkout === "mock",
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          already?: boolean;
        };
        if (!res.ok || !data.ok) {
          setStatus("err");
          setMessage(data.error ?? t("checkoutCreditFailed"));
          return;
        }
        setStatus("ok");
        setMessage(data.already ? t("checkoutAlreadyCredited") : t("checkoutCredited"));
        onCredited();
        // Strip checkout query without full reload
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          ["checkout", "session_id", "plan", "qty", "passes"].forEach((k) =>
            url.searchParams.delete(k),
          );
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }
      })
      .catch(() => {
        setStatus("err");
        setMessage(t("checkoutCreditFailed"));
      });
  }, [searchParams, onCredited, t]);

  if (status === "idle") return null;

  return (
    <div
      className="workspace-glass-card mb-2"
      role="status"
      aria-live="polite"
    >
      <p className="m-0 text-sm text-[var(--ws-text-body,#e0e2e8)]">
        {status === "working"
          ? t("checkoutWorking")
          : message}
      </p>
    </div>
  );
}
