"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onConfirm: () => void;
};

/**
 * First composer-focus gate — same shell / typography / CTA as site DisclaimerModal.
 */
export function QuestionBriefingDialog({ open, onConfirm }: Props) {
  const t = useTranslations("poju.chat.question_briefing");
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  const items = [
    { label: t("item_one_title"), body: t("item_one_body") },
    { label: t("item_two_title"), body: t("item_two_body") },
    { label: t("item_three_title"), body: t("item_three_body") },
    { label: t("item_four_title"), body: t("item_four_body") },
  ];

  const handleConfirm = () => {
    if (!checked) return;
    setChecked(false);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/70">
      <div className="flex min-h-full items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div
          aria-labelledby="pchat-question-briefing-title"
          aria-describedby="pchat-question-briefing-desc"
          aria-modal="true"
          className="poju-glass-card my-auto flex w-full max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden p-5 sm:p-8"
          role="dialog"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2
            id="pchat-question-briefing-title"
            className="shrink-0 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl"
          >
            {t("title")}
          </h2>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
            <div className="rounded-xl border border-glass-border bg-bg-layer-2/50 p-4 sm:p-5">
              <ul id="pchat-question-briefing-desc" className="space-y-4">
                {items.map((item) => (
                  <li key={item.label} className="text-sm leading-relaxed text-text-secondary">
                    <strong className="font-semibold text-text-primary">{item.label}</strong>
                    <span aria-hidden="true">: </span>
                    <span>{item.body}</span>
                  </li>
                ))}
                <li className="text-sm leading-relaxed text-text-secondary">
                  <strong className="font-semibold text-text-primary">{t("footer_label")}</strong>
                  <span aria-hidden="true">: </span>
                  <span>{t("footer")}</span>
                </li>
              </ul>
            </div>

            <Link
              className="mt-4 inline-flex text-sm font-medium text-text-accent transition-colors hover:text-purple-vivid"
              href="/privacy"
            >
              {t("privacy_link")}
            </Link>
          </div>

          <div className="mt-4 shrink-0 border-t border-glass-border/60 pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-text-secondary">
              <input
                checked={checked}
                className="mt-1 size-4 shrink-0 accent-purple-vivid"
                onChange={(event) => setChecked(event.target.checked)}
                type="checkbox"
              />
              <span>{t("acknowledge")}</span>
            </label>

            <button
              className="poju-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!checked}
              onClick={handleConfirm}
              type="button"
            >
              {t("confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
