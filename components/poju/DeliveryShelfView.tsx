"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DeliveryBookStage } from "@/components/poju/DeliveryBookStage";
import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { buildDeliveryInteractiveHtml } from "@/lib/poju/delivery-interactive-html";
import { buildDeliveryShelfSlots } from "@/lib/poju/delivery-shelf-slots";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

import "@/styles/delivery-shelf.css";
import "@/styles/delivery-phase4-ritual.css";

const DOWNLOAD_ICON = "/v2/xiazaiicon.svg";
const EMAIL_ICON = "/v2/emaiicon.svg";

const LAST_PAGE_KEY = "poju-delivery-shelf-page";

function lastPageStorageKey(sessionId: string): string {
  return `${LAST_PAGE_KEY}:${sessionId}`;
}

export function readDeliveryShelfLastPage(sessionId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(lastPageStorageKey(sessionId));
    const n = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeDeliveryShelfLastPage(sessionId: string, pageIndex: number): void {
  try {
    sessionStorage.setItem(lastPageStorageKey(sessionId), String(Math.max(0, pageIndex)));
  } catch {
    // optional
  }
}

type Props = {
  fullText: string;
  locale: string;
  sessionId: string;
  complete: boolean;
  originalQuestion?: string;
  profileId?: string | null;
  /** When bumped, open book at last-read prose page (from rail icon). */
  openReaderRequest?: number;
  interrupted?: boolean;
  interruptBusy?: boolean;
  onContinueInterrupted?: () => void;
  /** Client lost connectivity while server job may still run — auto-recovers on reconnect. */
  networkIssue?: boolean;
};

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DeliveryShelfView({
  fullText,
  locale,
  sessionId,
  complete,
  originalQuestion = "",
  profileId = null,
  openReaderRequest = 0,
  interrupted = false,
  interruptBusy = false,
  onContinueInterrupted,
  networkIssue = false,
}: Props) {
  const t = useTranslations("workspace.deliveryShelf");
  const tBook = useTranslations("workspace.deliveryBook");
  const { email: accountEmail, ready: authReady } = useAuthUser();

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const coverTitle = useMemo(() => {
    const slots = buildDeliveryShelfSlots(fullText, { locale, complete });
    const cover = slots.find((s) => s.kind === "ready" && s.slotId === "cover");
    return cover && cover.kind === "ready" ? cover.page.title : tBook("title");
  }, [fullText, locale, complete, tBook]);

  const handleProseIndexChange = useCallback(
    (index: number) => {
      writeDeliveryShelfLastPage(sessionId, index);
    },
    [sessionId],
  );

  const buildInteractiveHtml = () =>
    buildDeliveryInteractiveHtml(fullText, locale, {
      title: coverTitle,
      originalQuestion,
      reportId: `PIVOT-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      reportDate: new Date().toISOString().slice(0, 10),
    });

  const handleDownloadHtml = () => {
    const html = buildInteractiveHtml();
    downloadBlob(
      `pivot-delivery-${new Date().toISOString().slice(0, 10)}.html`,
      html,
      "text/html;charset=utf-8",
    );
  };

  const handleSendEmail = async () => {
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setEmailMsg(t("email_no_account"));
      return;
    }
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const html = buildInteractiveHtml();
      const plain = toCompliantPlainText(fullText, locale);
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          to,
          locale,
          title: coverTitle,
          body_text: plain.slice(0, 80_000),
          html_attachment: html.slice(0, 10_000_000),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setEmailMsg(data.error || tBook("email_failed"));
        return;
      }
      setEmailMsg(tBook("email_sent"));
    } catch {
      setEmailMsg(tBook("email_failed"));
    } finally {
      setEmailBusy(false);
    }
  };

  const chromeLeft = complete ? (
    <div className="delivery-book-stage__chrome-actions">
      <DeliveryChromeIconBtn
        src={DOWNLOAD_ICON}
        label={t("tip_download")}
        tip={t("tip_download")}
        onClick={handleDownloadHtml}
      />
      <DeliveryChromeIconBtn
        src={EMAIL_ICON}
        label={t("tip_email")}
        tip={t("tip_email")}
        disabled={emailBusy || !authReady}
        aria-busy={emailBusy || undefined}
        onClick={() => void handleSendEmail()}
      />
      {emailMsg ? (
        <span className="delivery-book-stage__chrome-email-msg" role="status">
          {emailMsg}
        </span>
      ) : null}
    </div>
  ) : null;

  const networkSlot =
    networkIssue && !interrupted ? (
      <div className="delivery-shelf__network" role="status" aria-live="polite">
        <p>{t("network_issue_body")}</p>
      </div>
    ) : null;

  const interruptedSlot =
    interrupted && onContinueInterrupted ? (
      <div className="poju-delivery-interrupted delivery-shelf__interrupted" role="status">
        <p className="poju-delivery-interrupted__body">{t("interrupted_network_body")}</p>
        <button
          type="button"
          className="poju-delivery-interrupted__btn"
          disabled={interruptBusy}
          onClick={onContinueInterrupted}
        >
          {interruptBusy ? t("interrupted_continuing") : t("interrupted_continue")}
        </button>
      </div>
    ) : null;

  return (
    <DeliveryBookStage
      fullText={fullText}
      locale={locale}
      sessionId={sessionId}
      complete={complete}
      originalQuestion={originalQuestion}
      profileId={profileId}
      jumpRequest={openReaderRequest}
      initialProseIndex={readDeliveryShelfLastPage(sessionId)}
      onProseIndexChange={handleProseIndexChange}
      chromeLeft={chromeLeft}
      networkSlot={networkSlot}
      interruptedSlot={interruptedSlot}
    />
  );
}
