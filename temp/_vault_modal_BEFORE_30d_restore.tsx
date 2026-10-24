"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { BaselinePortraitBook } from "@/components/poju/BaselinePortraitBook";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import {
  buildReminderPackOfflineHtml,
  buildReminderPackProgressiveHtml,
  reminderPackOfflineFilename,
} from "@/lib/companion/reminder-day-offline-html";
import type { CompanionJob } from "@/lib/companion/types";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
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

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Offline HTML pack for baseline profile (align DeliveryShelf export chrome).
 *  Temporary download/email only — popup surface is live BaselinePortraitBook.
 *  Re-extract from real book tree later (SoT16); do not serve lookalike in UI.
 */
function buildBaselineExportHtml(input: {
  title: string;
  subtitle: string;
  meta: string;
  bodyText: string;
  locale: string;
}): string {
  const zh = input.locale.startsWith("zh");
  const paras = input.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.65">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
<style>
  body{margin:0;font-family:Georgia,"Songti SC",serif;background:#0a0a12;color:#e8e6df}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 48px}
  h1{font-size:1.45rem;margin:0 0 6px;color:#f2ca50}
  .sub{margin:0 0 4px;color:rgba(232,230,223,.72);font-size:.92rem}
  .meta{margin:0 0 22px;color:rgba(161,161,170,.9);font-size:.78rem}
  hr{border:none;border-top:1px solid rgba(242,202,80,.22);margin:0 0 22px}
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(input.title)}</h1>
  <p class="sub">${escapeHtml(input.subtitle)}</p>
  ${input.meta ? `<p class="meta">${escapeHtml(input.meta)}</p>` : ""}
  <hr/>
  ${paras}
</div>
</body>
</html>`;
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
  const prepare = useWorkspacePojuPrepareOptional();
  const liveDelivery = prepare?.liveDelivery ?? null;
  const [filledReminderHtml, setFilledReminderHtml] = useState<string | null>(null);
  const [reminderJob, setReminderJob] = useState<CompanionJob | null>(null);

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
  const [emailBusy, setEmailBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const typ = ev?.data?.type;
      if (
        typ === "eastern-os-baseline-close" ||
        typ === "eastern-os-decision-close" ||
        typ === "eastern-os-reminder-close"
      ) {
        onClose();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onClose]);

  useEffect(() => {
    if (!item) {
      setMatrixPayload(null);
      setDeliveryText(null);
      setDeliverySessionId(null);
      setRemindersSessionId(null);
      setRemindersText(null);
      setRemindersStructured(null);
      setFilledReminderHtml(null);
      setReminderJob(null);
      setError(null);
      setActionMsg(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setMatrixPayload(null);
      setDeliveryText(null);
      setRemindersSessionId(null);
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
          if (!cancelled) setMatrixPayload(payload);
          return;
        }
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
              // Try rebuild from stored profile so background seal can POST.
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
  }, [item, locale]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);


﻿  // SoT16 sec8: first seal opens blank pack HTML immediately; progressive day-slot fill.
  // Job create/GET may run in background — vault surface is offline pack HTML only (no live companion frame).
  useEffect(() => {
    if (!item || item.openTarget.type !== "pivot_reminders") {
      setFilledReminderHtml(null);
      setReminderJob(null);
      return;
    }
    setFilledReminderHtml(
      buildReminderPackProgressiveHtml(null, {
        locale,
        embed: true,
        closeLabel: tPortrait("close"),
      }),
    );
  }, [item, locale, tPortrait]);

  useEffect(() => {
    if (!item || item.openTarget.type !== "pivot_reminders") return;
    const sessionId = item.openTarget.sessionId;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const applyJob = (job: CompanionJob) => {
      setReminderJob(job);
      const html = buildReminderPackOfflineHtml(job, {
        embed: true,
        closeLabel: tPortrait("close"),
      });
      setFilledReminderHtml(html);
    };

    const fetchJob = async (): Promise<CompanionJob | null> => {
      const res = await fetch(
        `/api/companion/job?session_id=${encodeURIComponent(sessionId)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { job?: CompanionJob };
      return data.job ?? null;
    };

    const ensureAndFill = async () => {
      try {
        let job = await fetchJob();
        if (cancelled) return;

        // Background seal when job missing and session payload is ready.
        if (
          !job &&
          remindersSessionId === sessionId &&
          remindersStructured &&
          (remindersText || "").trim()
        ) {
          const timezone =
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
              : "UTC";
          const res = await fetch("/api/companion/job", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              profile_id: remindersProfileId ?? null,
              full_text: remindersText,
              locale,
              original_question: remindersQuestion ?? undefined,
              structured: remindersStructured,
              timezone,
              email: accountEmail ?? null,
              mail_opt_in: true,
              deliver_day_zero: true,
            }),
          });
          const data = (await res.json()) as { job?: CompanionJob; error?: string };
          if (res.ok && data.job) job = data.job;
          else if (!res.ok) {
            console.warn("[vault-modal] reminder seal failed", data.error || res.status);
          }
        }

        if (cancelled) return;
        if (job) applyJob(job);

        // Progressive day-slot fill: poll while days still pending.
        const schedulePoll = (current: CompanionJob | null) => {
          if (cancelled || !current) return;
          const status = (current as CompanionJob & { batch_status?: string }).batch_status;
          const readyCount = current.days.filter((d) => Boolean(d.cards)).length;
          const pendingLeft = current.days.some(
            (d) => d.status === "pending" || (!d.cards && d.status !== "failed" && d.status !== "purged"),
          );
          const shouldPoll =
            status === "pending" ||
            status === "filling" ||
            (status == null && readyCount < current.days.length && pendingLeft);
          if (!shouldPoll) return;
          pollTimer = setTimeout(() => {
            void (async () => {
              try {
                const next = await fetchJob();
                if (cancelled || !next) return;
                applyJob(next);
                schedulePoll(next);
              } catch (e) {
                console.warn("[vault-modal] reminder poll failed", e);
              }
            })();
          }, 2500);
        };
        schedulePoll(job);
      } catch (e) {
        console.warn("[vault-modal] reminder pack fill failed", e);
        // Keep blank pack HTML already shown; do not fall back to a live companion frame.
      }
    };

    void ensureAndFill();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    item,
    locale,
    tPortrait,
    remindersSessionId,
    remindersText,
    remindersStructured,
    remindersProfileId,
    remindersQuestion,
    accountEmail,
  ]);

  // SoT16 §9: popup surface = live React BaselinePortraitBook (production f3c087f).
  // Do NOT mount baseline-profile offline HTML lookalike in the vault iframe.
  const baselinePack = useMemo(() => {
    if (!matrixPayload) return null;
    const display = resolveMatrixDisplay(matrixPayload, locale);
    const bodyText = getMatrixSynopsisPlainText(display, locale);
    return {
      title: tPortrait("title"),
      subtitle: tPortrait("subtitle"),
      meta: item?.subjectLabel?.trim() || "",
      bodyText,
    };
  }, [matrixPayload, locale, tPortrait, item?.subjectLabel]);

  const handleBaselineDownload = () => {
    if (!baselinePack) return;
    setPackBusy(true);
    setActionMsg(null);
    try {
      const html = buildBaselineExportHtml({ ...baselinePack, locale });
      downloadBlob(
        `baseline-profile-${new Date().toISOString().slice(0, 10)}.html`,
        html,
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
      const html = buildBaselineExportHtml({ ...baselinePack, locale });
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title: baselinePack.title,
          body_text: baselinePack.bodyText,
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
      console.warn("[vault-modal] baseline email failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleReminderDownload = () => {
    if (!filledReminderHtml) return;
    setPackBusy(true);
    setActionMsg(null);
    try {
      downloadBlob(reminderPackOfflineFilename(), filledReminderHtml, "text/html;charset=utf-8");
    } catch (e) {
      console.warn("[vault-modal] reminder download failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setPackBusy(false);
    }
  };

  const handleReminderEmail = async () => {
    if (!filledReminderHtml) return;
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
          title: tVault("type_reminders"),
          body_text: item?.subjectLabel?.trim() || "",
          locale,
          html_attachment: filledReminderHtml,
          pack: "reminders",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        setActionMsg(data.error || tBook("email_failed"));
        return;
      }
      setActionMsg(tBook("email_sent"));
    } catch (e) {
      console.warn("[vault-modal] reminder email failed", e);
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

  const showBaselineActions = Boolean(matrixPayload) && !loading && item.kind === "energy_matrix";
  const showReminderActions =
    Boolean(reminderJob && filledReminderHtml) &&
    !loading &&
    item.kind === "pivot_reminders";

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
            {showReminderActions ? (
              <div className="workspace-doc-vault-modal__chrome-actions">
                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_download")}
                  disabled={packBusy}
                  onClick={handleReminderDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_email")}
                  disabled={emailBusy || packBusy || !authReady}
                  aria-busy={emailBusy || packBusy || undefined}
                  onClick={() => void handleReminderEmail()}
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
          {matrixPayload && !loading ? (
            <BaselinePortraitBook
              payload={matrixPayload}
              locale={locale}
              suppressNarrative
            />
          ) : null}
          {deliverySessionId && (liveDelivery?.sessionId === deliverySessionId ? true : !loading) && (liveDelivery?.sessionId === deliverySessionId || deliveryText || (liveDelivery && liveDelivery.sessionId === deliverySessionId)) ? (
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
              embed
            />
          ) : null}
          {item.kind === "pivot_reminders" ? (
            filledReminderHtml ? (
              <div
                className="workspace-doc-vault-modal__reminder-frame"
                data-reminder="1"
                data-reminder-blank={reminderJob ? "0" : "1"}
              >
                <iframe
                  className="workspace-doc-vault-modal__reminder-iframe"
                  title={tVault("type_reminders")}
                  srcDoc={filledReminderHtml}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : (
              <p className="workspace-doc-vault-modal__status">{tVault("loading")}</p>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
