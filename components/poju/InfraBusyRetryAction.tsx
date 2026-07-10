"use client";

import { useTranslations } from "next-intl";

type Props = {
  onRetry: () => void;
  disabled?: boolean;
};

/** One-click retry below infra-busy assistant placeholder. */
export function InfraBusyRetryAction({ onRetry, disabled = false }: Props) {
  const t = useTranslations("poju.chat");
  return (
    <button
      type="button"
      className="poju-infra-busy-retry"
      disabled={disabled}
      onClick={onRetry}
    >
      {t("infra_busy_retry")}
    </button>
  );
}
