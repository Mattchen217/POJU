"use client";

import { useTranslations } from "next-intl";

type Props = {
  busy?: boolean;
  onRetry: () => void;
};

/** Retry segment-1 opening after bad JSON / empty resends exhausted. */
export function RegenerateOpeningAction({ busy = false, onRetry }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <div className="poju-understanding-gate" role="group" aria-label={t("opening_understanding_retry_group_label")}>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onRetry}
      >
        {t("opening_understanding_retry")}
      </button>
    </div>
  );
}
