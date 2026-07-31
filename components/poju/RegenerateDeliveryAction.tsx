"use client";

import { useTranslations } from "next-intl";

type Props = {
  busy?: boolean;
  onRegenerate: () => void;
};

/** Re-run Phase 4 delivery book without walking stages 1–3 (QA / polish). */
export function RegenerateDeliveryAction({ busy = false, onRegenerate }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <div className="poju-understanding-gate" role="group" aria-label={t("delivery_regenerate_group_label")}>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onRegenerate}
      >
        {busy ? t("delivery_regenerating") : t("delivery_regenerate")}
      </button>
    </div>
  );
}
