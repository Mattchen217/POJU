"use client";

import { IconX } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import type { ActivePojuSessionPickerRow } from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import {
  formatSessionListDateTime,
  sessionListTopicLine,
} from "@/lib/poju/session-list-label";

import "@/styles/poju-session-picker.css";

type Props = {
  sessions: ActivePojuSessionPickerRow[];
  onClose: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  newSessionBusy?: boolean;
};

export function PojuSessionPickerModal({
  sessions,
  onClose,
  onNewSession,
  onSelectSession,
  newSessionBusy = false,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("poju.chat.session_picker");

  return (
    <div
      className="poju-session-picker-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="poju-session-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poju-session-picker-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="poju-session-picker-close" onClick={onClose} aria-label={t("close")}>
          <IconX size={20} stroke={1.75} />
        </button>

        <button
          type="button"
          className="poju-new-session-btn poju-new-session-btn--modal"
          disabled={newSessionBusy}
          onClick={onNewSession}
        >
          <span>{t("new_poju")}</span>
        </button>

        <div className="poju-session-picker-body">
          <p id="poju-session-picker-title" className="poju-session-picker-label">
            {t("existing_label")}
          </p>
          <ul className="poju-session-picker-list">
            {sessions.map((session) => (
              <li key={session.session_id}>
                <button
                  type="button"
                  className="poju-session-picker-item"
                  onClick={() => onSelectSession(session.session_id)}
                >
                  <span className="poju-session-picker-item__title">
                    {sessionListTopicLine(session.original_question)}
                  </span>
                  <span className="poju-session-picker-item__meta">
                    {formatSessionListDateTime(session.last_interaction_at, locale)}
                    {" · "}
                    {t("days_left", { count: session.days_left })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
