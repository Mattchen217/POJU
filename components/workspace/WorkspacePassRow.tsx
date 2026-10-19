"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import {
  PASSES_CREDITED_EVENT,
  PASS_SPEND_TOAST_EVENT,
} from "@/lib/passes/pass-client-events";

type Props = {
  collapsed?: boolean;
  /** Open account/profile (PASS · n tap). */
  onOpenAccount?: () => void;
  className?: string;
};

/**
 * Left-rail PASS row (SoT 08-left-rail): under User, above Legal.
 * Signed-in: PASS · n + Buy/+ → existing PassPurchaseModal.
 * Signed-out: muted login hint, no fake balance.
 */
export function WorkspacePassRow({
  collapsed = false,
  onOpenAccount,
  className,
}: Props) {
  const t = useTranslations("workspace.passRow");
  const { user, ready } = useAuthUser();
  const [balance, setBalance] = useState<number | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(null);
      return;
    }
    try {
      const res = await fetch("/api/account/summary", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pass_balance?: number;
      };
      if (data.ok && typeof data.pass_balance === "number") {
        setBalance(Math.max(0, Math.floor(data.pass_balance)));
      } else {
        setBalance(null);
      }
    } catch {
      setBalance(null);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onCredit = () => void refresh();
    window.addEventListener(PASSES_CREDITED_EVENT, onCredit);
    window.addEventListener(PASS_SPEND_TOAST_EVENT, onCredit);
    return () => {
      window.removeEventListener(PASSES_CREDITED_EVENT, onCredit);
      window.removeEventListener(PASS_SPEND_TOAST_EVENT, onCredit);
    };
  }, [refresh]);

  if (!ready) return null;

  const rootClass = [
    "workspace-pass-row",
    collapsed ? "is-collapsed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!user) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="workspace-pass-row__hint"
          onClick={onOpenAccount}
          data-tooltip={t("loginHint")}
          title={t("loginHint")}
          aria-label={t("loginHint")}
        >
          <span className="material-symbols-outlined workspace-pass-row__icon" aria-hidden>
            confirmation_number
          </span>
          {!collapsed ? (
            <span className="workspace-pass-row__label workspace-pass-row__label--muted">
              {t("loginHint")}
            </span>
          ) : null}
        </button>
      </div>
    );
  }

  const n = balance ?? 0;
  const balanceLabel = t("balance", { n });
  const balanceAria = t("balanceAria", { n });
  const buyLabel = collapsed ? t("buyShort") : t("buy");
  const buyAria = t("buyAria");
  const buyTitle = t("buyTitle");

  return (
    <>
      <div className={rootClass}>
        <button
          type="button"
          className="workspace-pass-row__balance"
          onClick={onOpenAccount}
          data-tooltip={balanceAria}
          title={balanceAria}
          aria-label={balanceAria}
        >
          <span className="material-symbols-outlined workspace-pass-row__icon" aria-hidden>
            confirmation_number
          </span>
          {!collapsed ? (
            <span className="workspace-pass-row__label">{balanceLabel}</span>
          ) : n > 0 ? (
            <span className="workspace-pass-row__badge" aria-hidden>
              {n > 99 ? "99+" : n}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="workspace-pass-row__buy"
          onClick={() => setBuyOpen(true)}
          data-tooltip={buyTitle}
          title={buyTitle}
          aria-label={buyAria}
        >
          {collapsed ? (
            <span className="material-symbols-outlined" aria-hidden>
              add
            </span>
          ) : (
            <span>{buyLabel}</span>
          )}
        </button>
      </div>
      <PassPurchaseModal
        open={buyOpen}
        onClose={() => {
          setBuyOpen(false);
          void refresh();
        }}
        reason="choose"
        variant="full"
      />
    </>
  );
}
