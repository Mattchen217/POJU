"use client";

import { useTranslations } from "next-intl";

type Props = {
  busy?: boolean;
  /** `retry` when Phase 4 failed with no delivery bubble yet. */
  mode?: "regenerate" | "retry";
  onRegenerate: () => void;
};

/** Re-run Phase 4 delivery book without walking stages 1–3 (QA / polish / failed-run retry). */
export function RegenerateDeliveryAction({
  busy = false,
  mode = "regenerate",
  onRegenerate,
}: Props) {
  const t = useTranslations("poju.chat");
  const isRetry = mode === "retry";

  return (
    <div
      className="poju-understanding-gate"
      role="group"
      aria-label={
        isRetry ? t("delivery_retry_group_label") : t("delivery_regenerate_group_label")
      }
    >
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onRegenerate}
      >
        {busy
          ? t("delivery_regenerating")
          : isRetry
            ? t("delivery_retry")
            : t("delivery_regenerate")}
      </button>
    </div>
  );
}
