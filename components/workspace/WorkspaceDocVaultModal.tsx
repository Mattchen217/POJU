"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import { DeliverableHtmlFrame } from "@/components/deliverables/DeliverableHtmlFrame";
import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { PojuCompanionFrame } from "@/components/poju/PojuCompanionFrame";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { getCompanionJobBySession } from "@/lib/companion";
import {
  ensureDeliveryFilledHtml,
  ensureRemindersFilledHtml,
  fillBaselineProfileHtml,
} from "@/lib/deliverables";
import { buildBaselineExportPlainText } from "@/lib/poju/baseline-interactive-html";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { DocVaultItem } from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault-modal.css";

const DOWNLOAD_ICON = "/v2/xiazaiicon.svg";
const EMAIL_ICON = "/v2/emailicon.svg";

type Props = {
  item: DocVaultItem | null;
  onClose: () => void;
};

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Vault read overlay (SoT 15): Buy-style portal.
 * Opening = 0 PASS. Close does not touch center session timeline.
 * Baseline actions align DeliveryShelf: download + email.
 */
export function WorkspaceDocVaultModal({ item, onClose }: Props) {
  const tPortrait = useTranslations("portrait");
  const tVault = useTranslations("workspace.docVault");
  const tShelf = useTranslations("workspace.deliveryShelf");
  const tBook = useTranslations("workspace.deliveryBook");
  const locale = useLocale();
  const { email: accountEmail, ready: authReady } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);
  const [baselineHtml, setBaselineHtml] = useState<string | null>(null);
  const [deliveryText, setDeliveryText] = useState<string | null>(null);
  const [deliveryHtml, setDeliveryHtml] = useState<string | null>(null);
  const [deliverySessionId, setDeliverySessionId] = useState<string | null>(null);
  const [deliveryQuestion, setDeliveryQuestion] = useState<string | null>(null);
  const [deliveryProfileId, setDeliveryProfileId] = useState<string | null>(null);
  const [remindersSessionId, setRemindersSessionId] = useState<string | null>(null);
  const [remindersHtml, setRemindersHtml] = useState<string | null>(null);
  const [remindersText, setRemindersText] = useState<string | null>(null);
  const [remindersProfileId, setRemindersProfileId] = useState<string | null>(null);
  const [remindersQuestion, setRemindersQuestion] = useState<string | null>(null);
  const [remindersStructured, setRemindersStructured] = useState<
    PojuMatrixPayload["structured"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!item) {
      setMatrixPayload(null);
      setBaselineHtml(null);
      setDeliveryText(null);
      setDeliveryHtml(null);
      setDeliverySessionId(null);
      setRemindersSessionId(null);
      setRemindersHtml(null);
      setRemindersText(null);
      setRemindersStructured(null);
      setError(null);
      setActionMsg(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setMatrixPayload(null);
      setBaselineHtml(null);
      setDeliveryText(null);
      setDeliveryHtml(null);
      setRemindersSessionId(null);
      setRemindersHtml(null);
      setRemindersText(null);
      setRemindersStructured(null);
      setActionMsg(null);
      try {
        const target = item.openTarget;
        if (target.type === "profile_matrix" || target.type === "profile_report") {
          const profile = await getStoredProfile(target.profileId);
          if (!profile?.user_profile) {
            if (!cancelled) setError("Profile not found");
            return;
          }
          const payload = buildMatrixPayloadFromProfile(target.profileId, profile.user_profile, {
            locale,
          });
          const html = fillBaselineProfileHtml(payload, locale, {
            title: tPortrait("title"),
            subtitle: tPortrait("subtitle"),
            subjectLabel: item.subjectLabel?.trim() || "",
          });
          if (!cancelled) {
            setMatrixPayload(payload);
            setBaselineHtml(html);
          }
          return;
        }
        if (target.type === "pivot_delivery") {
          const session = await loadPOJUSession(target.sessionId);
          const text = session?.main_delivery?.full_text?.trim() || "";
          if (!text || !session) {
            if (!cancelled) setError("Delivery not found");
            return;
          }
          const question = session.original_question?.trim() || "";
          const filled = ensureDeliveryFilledHtml(session, text, locale, {
            originalQuestion: question,
            reportId: `EOS-${session.session_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
            reportDate: new Date().toISOString().slice(0, 10),
          });
          if (filled.session !== session) {
            try {
              await savePOJUSession(filled.session);
            } catch {
              /* vault open still shows html */
            }
          }
          if (!cancelled) {
            setDeliveryText(text);
            setDeliveryHtml(filled.html);
            setDeliverySessionId(target.sessionId);
            setDeliveryQuestion(question || null);
            setDeliveryProfileId(
              session.agent_v2?.selected_profile_id ??
                session.selected_stored_profile_id ??
                null,
            );
          }
          return;
        }
        if (target.type === "pivot_reminders") {
          const session = await loadPOJUSession(target.sessionId);
          if (!session) {
            if (!cancelled) setError("Session not found");
            return;
          }
          const text = session.main_delivery?.full_text?.trim() || "";
          let structured = session.matrix_payload?.structured ?? null;
          let html = "";
          const job = await getCompanionJobBySession(target.sessionId);
          if (job) {
            const filled = ensureRemindersFilledHtml(session, job, locale);
            html = filled.html;
            if (filled.session !== session) {
              try {
                await savePOJUSession(filled.session);
              } catch {
                /* ignore */
              }
            }
          } else if (session.deliverable_html?.reminders?.trim()) {
            html = session.deliverable_html.reminders;
          }
          if (!structured) {
            const pid =
              session.agent_v2?.selected_profile_id ??
              session.selected_stored_profile_id ??
              null;
            if (pid) {
              const profile = await getStoredProfile(pid);
              if (profile?.user_profile) {
                const payload = buildMatrixPayloadFromProfile(pid, profile.user_profile, {
                  locale,
                });
                structured = payload.structured;
              }
            }
          }
          if (!cancelled) {
            setRemindersSessionId(target.sessionId);
            setRemindersHtml(html || null);
            setRemindersText(text || " ");
            setRemindersQuestion(session.original_question?.trim() || null);
            setRemindersProfileId(
              session.agent_v2?.selected_profile_id ??
                session.selected_stored_profile_id ??
                null,
            );
            setRemindersStructured(structured);
          }
          return;
        }
        if (!cancelled) setError("Unsupported document");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, locale, tPortrait]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const baselinePack = useMemo(() => {
    if (!matrixPayload || !baselineHtml) return null;
    return {
      title: tPortrait("title"),
      subtitle: tPortrait("subtitle"),
      subjectLabel: item?.subjectLabel?.trim() || "",
      bodyText: buildBaselineExportPlainText(matrixPayload, locale),
      html: baselineHtml,
    };
  }, [matrixPayload, baselineHtml, locale, tPortrait, item?.subjectLabel]);

  const handleBaselineDownload = () => {
    if (!baselinePack) return;
    setPackBusy(true);
    setActionMsg(null);
    try {
      downloadBlob(
        `baseline-profile-${new Date().toISOString().slice(0, 10)}.html`,
        baselinePack.html,
        "text/html;charset=utf-8",
      );
    } catch (e) {
      console.warn("[vault-modal] baseline download failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setPackBusy(false);
    }
  };

  const handleBaselineEmail = async () => {
    if (!baselinePack) return;
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setActionMsg(tShelf("email_no_account"));
      return;
    }
    setEmailBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title: baselinePack.title,
          body_text: baselinePack.bodyText,
          locale,
          html_attachment: baselinePack.html,
          pack: "baseline",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        setActionMsg(data.error || tBook("email_failed"));
        return;
      }
      setActionMsg(tBook("email_sent"));
    } catch (e) {
      console.warn("[vault-modal] baseline email failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setEmailBusy(false);
    }
  };

  if (!mounted || !item) return null;

  const title =
    item.kind === "energy_matrix"
      ? tPortrait("title")
      : item.kind === "pivot_delivery"
        ? tVault("type_delivery")
        : item.kind === "pivot_reminders"
          ? tVault("type_reminders")
          : item.title;

  const subtitle =
    item.kind === "energy_matrix"
      ? tPortrait("subtitle")
      : item.subjectLabel || undefined;

  const showBaselineActions = Boolean(baselineHtml) && !loading && item.kind === "energy_matrix";

  return createPortal(
    <div
      className="workspace-doc-vault-modal__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="workspace-doc-vault-modal__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="workspace-doc-vault-modal__header">
          <div className="workspace-doc-vault-modal__header-copy">
            <h2 className="workspace-doc-vault-modal__title">{title}</h2>
            {subtitle ? (
              <p className="workspace-doc-vault-modal__subtitle">{subtitle}</p>
            ) : null}
            {item.subjectLabel && item.kind === "energy_matrix" ? (
              <p className="workspace-doc-vault-modal__meta">{item.subjectLabel}</p>
            ) : null}
          </div>
          <div className="workspace-doc-vault-modal__header-actions">
            {showBaselineActions ? (
              <div className="workspace-doc-vault-modal__chrome-actions">
                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_download")}
                  disabled={packBusy}
                  onClick={handleBaselineDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_email")}
                  disabled={emailBusy || packBusy || !authReady}
                  aria-busy={emailBusy || packBusy || undefined}
                  onClick={() => void handleBaselineEmail()}
                />
                {actionMsg ? (
                  <span className="workspace-doc-vault-modal__action-msg" role="status">
                    {actionMsg}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className={
                item.kind === "energy_matrix"
                  ? "workspace-doc-vault-modal__close workspace-doc-vault-modal__close--primary"
                  : "workspace-doc-vault-modal__close"
              }
              onClick={onClose}
            >
              {tPortrait("close")}
            </button>
          </div>
        </header>
        <div className="workspace-doc-vault-modal__body">
          {loading ? (
            <p className="workspace-doc-vault-modal__status">{tVault("loading")}</p>
          ) : null}
          {error ? (
            <p className="workspace-doc-vault-modal__status is-error" role="alert">
              {error}
            </p>
          ) : null}
          {baselineHtml && !loading ? (
            <DeliverableHtmlFrame html={baselineHtml} title={title} />
          ) : null}
          {deliverySessionId && !loading && (deliveryHtml || deliveryText) ? (
            <DeliveryShelfView
              fullText={deliveryText || " "}
              locale={locale}
              sessionId={deliverySessionId}
              complete
              originalQuestion={deliveryQuestion ?? undefined}
              profileId={deliveryProfileId}
              filledHtml={deliveryHtml ?? undefined}
            />
          ) : null}
          {remindersSessionId && !loading ? (
            <div className="workspace-doc-vault-modal__reminders">
              {remindersHtml ? (
                <DeliverableHtmlFrame
                  html={remindersHtml}
                  title={tVault("type_reminders")}
                />
              ) : (
                <>
                  <PojuCompanionFrame
                    sessionId={remindersSessionId}
                    fullText={remindersText || " "}
                    structured={remindersStructured}
                    originalQuestion={remindersQuestion ?? undefined}
                    ready={Boolean(remindersStructured)}
                    profileId={remindersProfileId}
                    initialEmail={accountEmail ?? null}
                  />
                  {!remindersStructured ? (
                    <p className="workspace-doc-vault-modal__status">
                      {tVault("reminders_need_profile")}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
