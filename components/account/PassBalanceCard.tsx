"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type Props = {
  /** Purchased (flex) Passes remaining — permanent, refundable. */
  flexBalance: number;
  /** Total remaining (flex + sub) for quick glance. */
  totalBalance?: number;
};

export function PassBalanceCard({ flexBalance, totalBalance }: Props) {
  const t = useTranslations("account");
  return (
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("passBalance")}
      </p>
      <p className="m-0 text-4xl font-semibold tabular-nums text-[#f2ca50]">{flexBalance}</p>
      <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("passBalanceHint")}</p>
      {typeof totalBalance === "number" && totalBalance !== flexBalance ? (
        <p className="m-0 text-xs text-[var(--ws-text-muted,#71717a)]">
          {t("passTotalRemaining", { total: totalBalance })}
        </p>
      ) : null}
      <Link href="/#v2-pricing" className="workspace-link-btn self-start">
        {t("buyMorePasses")}
      </Link>
    </div>
  );
}
