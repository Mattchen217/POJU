"use client";

import { useState } from "react";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  listActivePojuSessionsForPicker,
  type ActivePojuSessionPickerRow,
} from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { stashToolResultForHandoff } from "@/lib/cross-product/from-tool-pending";
import { loadPojuToolHandoff } from "@/lib/poju/poju-tool-handoff";
import type { ToolName } from "@/lib/poju/types";
import "@/styles/poju-deep-dive.css";

type ProductId = ToolName;

type Props = {
  productId: ProductId;
  result_id: string;
  result_data: Record<string, unknown>;
};

export function PojuDeepDiveCTA({ productId, result_id, result_data }: Props) {
  const router = useRouter();
  const t = useTranslations(`cross_product.${productId}_to_poju`);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActivePojuSessionPickerRow[]>([]);
  const [busy, setBusy] = useState(false);

  if (loadPojuToolHandoff(productId)) return null;

  function navigateToPoju(path: string) {
    stashToolResultForHandoff(productId, result_id, result_data);
    router.push(path);
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const sessions = await listActivePojuSessionsForPicker();
      if (sessions.length === 0) {
        navigateToPoju(`/poju?from_tool=${productId}&result_id=${encodeURIComponent(result_id)}`);
        return;
      }
      setActiveSessions(sessions);
      setShowSessionPicker(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="poju-deep-dive-cta">
        <div className="pdd-content">
          <div className="pdd-title">{t("title")}</div>
          <div className="pdd-description">{t("description")}</div>
          <div className="pdd-price-line">
            <span className="pdd-price">$9.99</span>
            <span className="pdd-period">/ 30 days</span>
          </div>
          <div className="pdd-value">{t("value_prop")}</div>
        </div>
        <button type="button" className="pdd-cta-btn" onClick={() => void handleClick()} disabled={busy}>
          <span>{t("button")}</span>
          <IconArrowRight size={18} stroke={1.75} aria-hidden />
        </button>
      </div>

      {showSessionPicker ? (
        <SessionPickerModal
          sessions={activeSessions}
          productId={productId}
          result_id={result_id}
          result_data={result_data}
          onClose={() => setShowSessionPicker(false)}
        />
      ) : null}
    </>
  );
}

function SessionPickerModal({
  sessions,
  productId,
  result_id,
  result_data,
  onClose,
}: {
  sessions: ActivePojuSessionPickerRow[];
  productId: ProductId;
  result_id: string;
  result_data: Record<string, unknown>;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("cross_product.session_picker");

  function go(path: string) {
    stashToolResultForHandoff(productId, result_id, result_data);
    router.push(path);
    onClose();
  }

  function joinExisting(session_id: string) {
    go(
      `/poju/session/${session_id}?from_tool=${productId}&result_id=${encodeURIComponent(result_id)}`,
    );
  }

  function createNew() {
    go(`/poju?from_tool=${productId}&result_id=${encodeURIComponent(result_id)}`);
  }

  return (
    <div className="session-picker-overlay" role="presentation" onClick={onClose}>
      <div
        className="session-picker-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <IconX size={20} stroke={1.75} />
        </button>

        <div className="picker-header">
          <div className="picker-title">{t("title")}</div>
          <div className="picker-subtitle">{t("subtitle")}</div>
        </div>

        <div className="existing-sessions">
          <div className="section-label">{t("existing_sessions")}</div>
          {sessions.map((session) => (
            <button
              key={session.session_id}
              type="button"
              className="session-card"
              onClick={() => joinExisting(session.session_id)}
            >
              <div className="session-topic">
                {session.original_question.length > 60
                  ? `${session.original_question.slice(0, 60)}…`
                  : session.original_question}
              </div>
              <div className="session-meta">
                <span>{session.cycle_count} cycles</span>
                <span>·</span>
                <span>{t("days_left", { count: session.days_left })}</span>
              </div>
              <div className="session-action">
                {t("join_this")} · <span className="free">{t("free")}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="picker-divider">
          <span>{t("or")}</span>
        </div>

        <button type="button" className="create-new-card" onClick={createNew}>
          <div className="create-title">{t("start_new")}</div>
          <div className="create-subtitle">{t("start_new_subtitle")}</div>
          <div className="create-price">$9.99 · 30 days</div>
        </button>
      </div>
    </div>
  );
}
