"use client";

import { useTranslations } from "next-intl";

export type OffTopicActionProps = {
  driftReason?: string;
  onStartNewSession: () => void;
  onContinueCurrent: () => void;
};

export function OffTopicAction({ driftReason, onStartNewSession, onContinueCurrent }: OffTopicActionProps) {
  const t = useTranslations("poju.topic_drift");

  return (
    <div className="topic-drift-prompt">
      <div className="drift-icon" aria-hidden>
        ⚠️
      </div>
      <div className="drift-content">
        <p className="drift-title">{t("title")}</p>
        {driftReason ? <p className="drift-reason">{driftReason}</p> : null}
        <div className="drift-actions">
          <button type="button" onClick={onStartNewSession} className="primary">
            {t("start_new_session")}
          </button>
          <button type="button" onClick={onContinueCurrent} className="secondary">
            {t("continue_current")}
          </button>
        </div>
      </div>
    </div>
  );
}
