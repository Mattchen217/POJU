"use client";

import { useTranslations } from "next-intl";

type Props = {
  busy?: boolean;
  onRegenerate: () => void;
};

/** Retry Call B (agenda + bridge question) after A already delivered. */
export function RegenerateQuestionAction({ busy = false, onRegenerate }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <div className="poju-understanding-gate" role="group" aria-label={t("segment2_regen_question_group_label")}>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onRegenerate}
      >
        {t("segment2_regenerate_question")}
      </button>
    </div>
  );
}
