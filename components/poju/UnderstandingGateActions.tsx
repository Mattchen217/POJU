"use client";

import { useTranslations } from "next-intl";

type Props = {
  busy?: boolean;
  onConfirm: () => void;
  onSupplement: () => void;
};

export function UnderstandingGateActions({ busy = false, onConfirm, onSupplement }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <div
      className="poju-understanding-gate"
      role="group"
      aria-label={t("understanding_gate_group_label")}
    >
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onConfirm}
      >
        {t("understanding_gate_confirm")}
      </button>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--secondary"
        disabled={busy}
        onClick={onSupplement}
      >
        {t("understanding_gate_supplement")}
      </button>
    </div>
  );
}
