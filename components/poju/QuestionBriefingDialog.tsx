"use client";

import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onConfirm: () => void;
};

export function QuestionBriefingDialog({ open, onConfirm }: Props) {
  const t = useTranslations("poju.chat.question_briefing");

  if (!open) return null;

  const items = [
    { title: t("item_one_title"), body: t("item_one_body") },
    { title: t("item_two_title"), body: t("item_two_body") },
    { title: t("item_three_title"), body: t("item_three_body") },
    { title: t("item_four_title"), body: t("item_four_body") },
  ];

  return (
    <div className="pchat-expiry-overlay pchat-question-briefing-overlay" role="presentation">
      <div
        className="pchat-expiry-dialog pchat-question-briefing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pchat-question-briefing-title"
        aria-describedby="pchat-question-briefing-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="pchat-question-briefing-dialog__header">
          <h2 id="pchat-question-briefing-title" className="pchat-question-briefing-dialog__title">
            {t("title")}
          </h2>
          <p className="pchat-question-briefing-dialog__intro">{t("intro")}</p>
        </header>

        <div className="pchat-question-briefing-dialog__scroll">
          <ol id="pchat-question-briefing-desc" className="pchat-question-briefing-dialog__list">
            {items.map((item, index) => (
              <li key={item.title} className="pchat-question-briefing-dialog__item">
                <span className="pchat-question-briefing-dialog__item-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="pchat-question-briefing-dialog__item-content">
                  <p className="pchat-question-briefing-dialog__item-title">{item.title}</p>
                  <p className="pchat-question-briefing-dialog__item-body">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <footer className="pchat-question-briefing-dialog__foot">
            <p className="pchat-question-briefing-dialog__footer">{t("footer")}</p>
            <p className="pchat-question-briefing-dialog__privacy">{t("privacy_footer")}</p>
          </footer>
        </div>

        <div className="pchat-expiry-dialog__actions pchat-question-briefing-dialog__actions">
          <button type="button" className="pchat-expiry-dialog__primary" onClick={onConfirm}>
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
