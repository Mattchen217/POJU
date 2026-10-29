"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useMessages, useTranslations } from "next-intl";
import {
  BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED,
  BASELINE_LIVE_EXPORT_VISUAL_PASS,
  captureBaselinePortraitLiveHtml,
} from "@/lib/poju/baseline-portrait-live-export";
// SoT16 §12: lookalike buildBaselineProfileOfflineHtml must NOT be served as download/email.

import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { PojuCompanionFrame } from "@/components/poju/PojuCompanionFrame";
import { BaselinePortraitBook } from "@/components/poju/BaselinePortraitBook";
import { BaselineZiweiLens } from "@/components/poju/BaselineZiweiLens";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { DocVaultItem } from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault-modal.css";

const DOWNLOAD_ICON = "/v2/xiazaiicon.svg";
const EMAIL_ICON = "/v2/emailicon.svg";

type Props = {
  item: DocVaultItem | null;
  onClose: () => void;
};

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
  const prepare = useWorkspacePojuPrepareOptional();
  const liveDelivery = prepare?.liveDelivery ?? null;
  const [mounted, setMounted] = useState(false);
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);
  const [deliveryText, setDeliveryText] = useState<string | null>(null);
  const [deliverySessionId, setDeliverySessionId] = useState<string | null>(null);
  const [deliveryQuestion, setDeliveryQuestion] = useState<string | null>(null);
  const [deliveryProfileId, setDeliveryProfileId] = useState<string | null>(null);
  const [remindersSessionId, setRemindersSessionId] = useState<string | null>(null);
  const [remindersText, setRemindersText] = useState<string | null>(null);
  const [remindersProfileId, setRemindersProfileId] = useState<string | null>(null);
  const [remindersQuestion, setRemindersQuestion] = useState<string | null>(null);
  const [remindersStructured, setRemindersStructured] = useState<
    PojuMatrixPayload["structured"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!item) {
      setMatrixPayload(null);
      setDeliveryText(null);
      setDeliverySessionId(null);
      setRemindersSessionId(null);
      setRemindersText(null);
      setRemindersStructured(null);
      setError(null);
      setActionMsg(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setError(null);
      setDeliveryText(null);
      setRemindersSessionId(null);
      setRemindersText(null);
      setRemindersStructured(null);
      setActionMsg(null);
      try {
        const target = item.openTarget;
        if (target.type === "profile_matrix" || target.type === "profile_report") {
          // Prefer payload computed during the 10s prepare wait — paint book immediately.
          const preloaded =
            item.matrixPayload &&
            item.matrixPayload.profile_id === target.profileId
              ? item.matrixPayload
              : prepare?.matrixPayload?.profile_id === target.profileId
                ? prepare.matrixPayload
                : null;
          if (preloaded) {
            if (!cancelled) {
              setMatrixPayload(preloaded);
              setLoading(false);
            }
            return;
          }
          setLoading(true);
          setMatrixPayload(null);
          const profile = await getStoredProfile(target.profileId);
          if (!profile?.user_profile) {
            if (!cancelled) setError("Profile not found");
            return;
          }
          const payload = buildMatrixPayloadFromProfile(target.profileId, profile.user_profile, {
            locale,
          });
          if (!cancelled) setMatrixPayload(payload);
          return;
        }
        setLoading(true);
        setMatrixPayload(null);
        if (target.type === "pivot_delivery") {
          const session = await loadPOJUSession(target.sessionId);
          const text = session?.main_delivery?.full_text?.trim() || "";
          // SoT16: allow empty text while live progressive fill streams via liveDelivery.
          if (!cancelled) {
            setDeliveryText(text || null);
            setDeliverySessionId(target.sessionId);
            setDeliveryQuestion(session?.original_question?.trim() || null);
            setDeliveryProfileId(
              session?.agent_v2?.selected_profile_id ??
                session?.selected_stored_profile_id ??
                null,
            );
            if (!text && !session) setError("Delivery not found");
            else setError(null);
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
          const structured =
            session.matrix_payload?.structured ??
            null;
          if (!cancelled) {
            setRemindersSessionId(target.sessionId);
            setRemindersText(text || " ");
            setRemindersQuestion(session.original_question?.trim() || null);
            setRemindersProfileId(
              session.agent_v2?.selected_profile_id ??
                session.selected_stored_profile_id ??
                null,
            );
            setRemindersStructured(structured);
            if (!structured) {
              // Try rebuild from stored profile so companion frame can seal.
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
                  if (!cancelled) setRemindersStructured(payload.structured);
                }
              }
            }
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
  }, [item, locale, prepare?.matrixPayload]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

    /**
   * SoT16 §13: createRoot capture is implemented. VISUAL_PASS stays false until Max accepts
   * the live export vs vault popup. For local Max verify we unlock download/email whenever
   * CAPTURE_IMPLEMENTED is true — still ONLY captureBaselinePortraitLiveHtml (never lookalike).
   * Product messaging: verify-only banner while VISUAL_PASS is false. No push / no PASS flip.
   */
  const messages = useMessages();
  const baselineVisualPass = BASELINE_LIVE_EXPORT_VISUAL_PASS;
  const baselineExportUnlocked = BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED;
  const baselineExportLockMsg = useMemo(() => {
    try {
      return tShelf("export_live_pending");
    } catch {
      return locale.startsWith("zh")
        ? "下载/邮件暂不可用：需等真实书本导出与弹窗一致，通过验收。不提供仿制离线包。"
        : "Download/email paused until live book export matches the vault popup. Lookalike offline packs are not shipped.";
    }
  }, [tShelf, locale]);
  const baselineVerifyOnlyMsg = useMemo(() => {
    if (baselineVisualPass) return null;
    return locale.startsWith("zh")
      ? "本地验收导出（createRoot 真实书本）。视觉门闸仍为未通过 — 非产品正式开放。"
      : "Local verify export (createRoot live book). Visual gate still CLOSED — not product PASS.";
  }, [baselineVisualPass, locale]);

  const [exportBusy, setExportBusy] = useState(false);

  const runLiveBaselineExport = async (): Promise<string | null> => {
    if (!matrixPayload) return null;
    const result = await captureBaselinePortraitLiveHtml({
      payload: matrixPayload,
      locale,
      messages,
      subjectLabel: item?.subjectLabel?.trim() || undefined,
      coverTitle: tPortrait("title"),
    });
    return result.html;
  };

  const handleBaselineDownload = () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    if (!matrixPayload || exportBusy) return;
    setExportBusy(true);
    setActionMsg(null);
    void (async () => {
      try {
        const html = await runLiveBaselineExport();
        if (!html) throw new Error("empty live export");
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const d = new Date();
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        a.download = `eastern-os-baseline-profile-live-${stamp}.html`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("[vault-modal] live baseline export failed", e);
        setActionMsg(baselineExportLockMsg);
      } finally {
        setExportBusy(false);
      }
    })();
  };

  const handleBaselineEmail = async () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    if (!matrixPayload || exportBusy) return;
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setActionMsg(tShelf("email_no_account"));
      return;
    }
    setExportBusy(true);
    setActionMsg(null);
    try {
      const html = await runLiveBaselineExport();
      if (!html) throw new Error("empty live export");
      const title = tPortrait("title");
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title,
          body_text: title,
          locale,
          html_attachment: html,
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
      console.warn("[vault-modal] live baseline email failed", e);
      setActionMsg(baselineExportLockMsg);
    } finally {
      setExportBusy(false);
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
      : item.kind === "pivot_delivery" || item.kind === "pivot_reminders"
        ? item.title
        : item.subjectLabel || undefined;

  const showBaselineActions = Boolean(matrixPayload) && !loading && item.kind === "energy_matrix";

  return createPortal(
    <div
      className="workspace-doc-vault-modal__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={
          item.kind === "pivot_delivery"
            ? "workspace-doc-vault-modal__sheet workspace-doc-vault-modal__sheet--decision"
            : "workspace-doc-vault-modal__sheet"
        }
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
                  tip={
                    baselineExportUnlocked
                      ? (baselineVerifyOnlyMsg ?? tShelf("tip_download"))
                      : baselineExportLockMsg
                  }
                  disabled={!baselineExportUnlocked || exportBusy}
                  onClick={handleBaselineDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={
                    baselineExportUnlocked
                      ? (baselineVerifyOnlyMsg ?? tShelf("tip_email"))
                      : baselineExportLockMsg
                  }
                  disabled={!baselineExportUnlocked || exportBusy || !authReady}
                  aria-busy={exportBusy || undefined}
                  onClick={() => void handleBaselineEmail()}
                />
                <span className="workspace-doc-vault-modal__action-msg" role="status">
                  {actionMsg ??
                    (baselineExportUnlocked
                      ? baselineVerifyOnlyMsg
                      : baselineExportLockMsg)}
                </span>
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
          {matrixPayload && !loading ? (
            <BaselinePortraitBook
              payload={matrixPayload}
              locale={locale}
              suppressNarrative
            />
          ) : null}
          {matrixPayload && !loading && item?.kind === "energy_matrix" ? (
            <BaselineZiweiLens birth={matrixPayload.user_profile.birth} locale={locale} />
          ) : null}
          {deliverySessionId &&
          (liveDelivery?.sessionId === deliverySessionId ? true : !loading) &&
          (liveDelivery?.sessionId === deliverySessionId ||
            deliveryText ||
            (liveDelivery && liveDelivery.sessionId === deliverySessionId)) ? (
            <DeliveryShelfView
              fullText={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.fullText
                  : (deliveryText ?? "")
              }
              locale={locale}
              sessionId={deliverySessionId}
              complete={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.complete
                  : true
              }
              originalQuestion={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.originalQuestion
                  : (deliveryQuestion ?? undefined)
              }
              profileId={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.profileId
                  : deliveryProfileId
              }
              interrupted={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.interrupted
                  : false
              }
              interruptReason={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.interruptReason
                  : null
              }
              interruptAction={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.interruptAction
                  : "continue"
              }
              interruptBusy={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.interruptBusy
                  : false
              }
              networkIssue={
                liveDelivery?.sessionId === deliverySessionId
                  ? liveDelivery.networkIssue
                  : false
              }
            />
          ) : null}
          {remindersSessionId && remindersText && !loading ? (
            <div className="workspace-doc-vault-modal__reminders">
              <PojuCompanionFrame
                sessionId={remindersSessionId}
                fullText={remindersText}
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
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
