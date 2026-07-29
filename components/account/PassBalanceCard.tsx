"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type Props = {
  /** Purchased (flex) Passes remaining — permanent, refundable. */
  flexBalance: number;
  /** Total remaining (flex + sub) for quick glance. */
  totalBalance?: number;
};

function formatUnits(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "00";
  if (n > 99) return String(Math.floor(n));
  return String(Math.floor(n)).padStart(2, "0");
}

export function PassBalanceCard({ flexBalance, totalBalance }: Props) {
  const t = useTranslations("account");
  return (
    <article className="acct-card acct-mgt__span-4 group">
      <div className="acct-card__grid-bg" aria-hidden />
      <p className="acct-card__label">{t("passAllocation")}</p>
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="acct-pass__value">{formatUnits(flexBalance)}</span>
        <span className="acct-pass__caption">{t("unitsAvailable")}</span>
        {typeof totalBalance === "number" && totalBalance !== flexBalance ? (
          <p className="acct-pass__hint">{t("passTotalRemaining", { total: totalBalance })}</p>
        ) : null}
      </div>
      <div className="relative z-[1]">
        <Link href="/#v2-pricing" className="acct-btn acct-btn--primary">
          {t("acquirePass")}
        </Link>
      </div>
    </article>
  );
}
