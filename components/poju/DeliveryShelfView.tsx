"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DeliveryBookStage } from "@/components/poju/DeliveryBookStage";
import { buildDeliveryPdfHtml } from "@/lib/poju/delivery-pdf-html";
import { buildDeliveryShelfSlots } from "@/lib/poju/delivery-shelf-slots";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

import "@/styles/delivery-shelf.css";
import "@/styles/delivery-phase4-ritual.css";

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
  /** Extra footer actions (e.g. QA regenerate) — kept visible on delivery page. */
  extraActions?: ReactNode;
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
  extraActions = null,
}: Props) {
  const t = useTranslations("workspace.deliveryShelf");
  const tBook = useTranslations("workspace.deliveryBook");

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
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

  const handleDownloadPdf = () => {
    const html = buildDeliveryPdfHtml(fullText, locale, {
      title: coverTitle,
      autoPrint: true,
    });
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      downloadBlob(
        `pivot-delivery-${new Date().toISOString().slice(0, 10)}.html`,
        html,
        "text/html;charset=utf-8",
      );
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const handleSendEmail = async () => {
    const to = email.trim();
    if (!to || !to.includes("@")) {
      setEmailMsg(tBook("email_invalid"));
      return;
    }
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const html = buildDeliveryPdfHtml(fullText, locale, {
        title: coverTitle,
        autoPrint: false,
      });
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
          html_attachment: html.slice(0, 900_000),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setEmailMsg(data.error || tBook("email_failed"));
        return;
      }
      setEmailMsg(tBook("email_sent"));
      setEmail("");
    } catch {
      setEmailMsg(tBook("email_failed"));
    } finally {
      setEmailBusy(false);
    }
  };

  const footer =
    complete || extraActions ? (
      <>
        {complete ? (
          <>
            <button
              type="button"
              className="delivery-shelf__cta-btn delivery-shelf__cta-btn--primary"
              onClick={handleDownloadPdf}
            >
              {t("download_pdf")}
            </button>
            <button
              type="button"
              className="delivery-shelf__cta-btn delivery-shelf__cta-btn--secondary"
              onClick={() => setEmailOpen((v) => !v)}
              aria-expanded={emailOpen}
            >
              {t("email_report")}
            </button>
            {emailOpen ? (
              <div className="delivery-shelf__email">
                <div className="delivery-shelf__email-row">
                  <input
                    type="email"
                    className="delivery-shelf__email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tBook("email_placeholder")}
                    disabled={emailBusy}
                    aria-label={tBook("email_hint")}
                  />
                  <button
                    type="button"
                    className="delivery-shelf__cta-btn delivery-shelf__cta-btn--primary"
                    disabled={emailBusy}
                    onClick={() => void handleSendEmail()}
                  >
                    {emailBusy ? tBook("email_sending") : tBook("email_send")}
                  </button>
                </div>
                {emailMsg ? (
                  <p className="delivery-shelf__email-msg" role="status">
                    {emailMsg}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
        {extraActions}
      </>
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
      footer={footer}
      networkSlot={networkSlot}
      interruptedSlot={interruptedSlot}
    />
  );
}
