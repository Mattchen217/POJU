"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DeliverySectionBodyV2 } from "@/components/poju/DeliveryReportV2";
import { buildDeliveryPdfHtml } from "@/lib/poju/delivery-pdf-html";
import {
  buildDeliveryShelfSlots,
  DELIVERY_SHELF_SLOT_COUNT,
  shelfThumbKind,
  type DeliveryShelfSlotState,
} from "@/lib/poju/delivery-shelf-slots";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

import "@/styles/delivery-shelf.css";
import "@/styles/delivery-report-v2.css";
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
  /** When true, open reader at lastRead (from rail icon). */
  openReaderRequest?: number;
  interrupted?: boolean;
  interruptBusy?: boolean;
  onContinueInterrupted?: () => void;
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

function PaperThumb({
  slot,
  tocTitles,
  onOpen,
  t,
}: {
  slot: DeliveryShelfSlotState;
  tocTitles: string[];
  onOpen: (pageIndex: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (slot.kind === "empty") {
    return (
      <div className="delivery-shelf__slot delivery-shelf__slot--empty" aria-hidden>
        <div className="delivery-shelf__paper" />
      </div>
    );
  }

  if (slot.kind === "waiting") {
    return (
      <div className="delivery-shelf__slot">
        <div
          className="delivery-shelf__paper delivery-shelf__paper--waiting"
          role="status"
          aria-live="polite"
        >
          <span className="delivery-shelf__spin" aria-hidden />
          <p className="delivery-shelf__waiting-label">
            {t("writing_page", { n: slot.pageNumber })}
          </p>
          <span className="delivery-shelf__page-num">{slot.pageNumber}</span>
        </div>
      </div>
    );
  }

  const thumb = shelfThumbKind(slot.slotId);
  const pageIndex = slot.pageNumber - 1;

  return (
    <div className="delivery-shelf__slot">
      <button
        type="button"
        className="delivery-shelf__paper"
        onClick={() => onOpen(pageIndex)}
        aria-label={t("open_page", { title: slot.page.title })}
      >
        {thumb === "logo" ? (
          <>
            <span className="delivery-shelf__logo-orb" aria-hidden />
            <span className="delivery-shelf__logo">POJU</span>
            <span className="delivery-shelf__gold-rule" aria-hidden />
          </>
        ) : null}
        {thumb === "toc" ? (
          <>
            <span className="delivery-shelf__toc-label">{t("toc_thumb")}</span>
            <span className="delivery-shelf__gold-rule" aria-hidden />
            <ol className="delivery-shelf__toc-list">
              {tocTitles.slice(0, 6).map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ol>
          </>
        ) : null}
        {thumb === "title" ? (
          <>
            <span className="delivery-shelf__gold-rule" aria-hidden />
            <span className="delivery-shelf__title">{slot.page.title}</span>
            <span className="delivery-shelf__gold-rule" aria-hidden />
          </>
        ) : null}
        <span className="delivery-shelf__page-num">{slot.pageNumber}</span>
      </button>
    </div>
  );
}

export function DeliveryShelfView({
  fullText,
  locale,
  sessionId,
  complete,
  openReaderRequest = 0,
  interrupted = false,
  interruptBusy = false,
  onContinueInterrupted,
}: Props) {
  const t = useTranslations("workspace.deliveryShelf");
  const tBook = useTranslations("workspace.deliveryBook");
  const slots = useMemo(
    () => buildDeliveryShelfSlots(fullText, { locale, complete }),
    [fullText, locale, complete],
  );
  const readyPages = useMemo(
    () => slots.filter((s): s is Extract<DeliveryShelfSlotState, { kind: "ready" }> => s.kind === "ready"),
    [slots],
  );
  const tocTitles = useMemo(
    () =>
      readyPages
        .filter((s) => s.slotId !== "cover" && s.slotId !== "toc")
        .map((s) => s.page.title),
    [readyPages],
  );

  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const showWaitBanner = !complete && readyPages.length === 0;

  const openPage = useCallback(
    (pageIndex: number) => {
      const clamped = Math.max(0, Math.min(pageIndex, readyPages.length - 1));
      if (readyPages.length === 0) return;
      setReaderIndex(clamped);
      writeDeliveryShelfLastPage(sessionId, clamped);
    },
    [readyPages.length, sessionId],
  );

  const closeReader = useCallback(() => {
    setReaderIndex(null);
  }, []);

  useEffect(() => {
    if (openReaderRequest <= 0) return;
    const last = readDeliveryShelfLastPage(sessionId);
    if (readyPages.length > 0) {
      openPage(Math.min(last, readyPages.length - 1));
    }
  }, [openReaderRequest, sessionId, readyPages.length, openPage]);

  useEffect(() => {
    if (readerIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeReader();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setReaderIndex((i) => {
          if (i == null) return i;
          const next = Math.max(0, i - 1);
          writeDeliveryShelfLastPage(sessionId, next);
          return next;
        });
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setReaderIndex((i) => {
          if (i == null) return i;
          const next = Math.min(readyPages.length - 1, i + 1);
          writeDeliveryShelfLastPage(sessionId, next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readerIndex, readyPages.length, closeReader, sessionId]);

  const coverTitle =
    readyPages.find((p) => p.slotId === "cover")?.page.title ?? tBook("title");

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

  const activeReady =
    readerIndex != null && readerIndex >= 0 && readerIndex < readyPages.length
      ? readyPages[readerIndex]
      : null;

  return (
    <div className="delivery-shelf" data-locale={locale.startsWith("zh") ? "zh" : locale.slice(0, 2)}>
      {showWaitBanner || (!complete && readyPages.length > 0) ? (
        <div className="delivery-shelf__wait-copy">
          <p>{t("long_wait_lead")}</p>
          <p>{t("long_wait_leave")}</p>
        </div>
      ) : null}

      <div
        className="delivery-shelf__grid"
        role="list"
        aria-label={t("shelf_label")}
      >
        {slots.map((slot) => (
          <PaperThumb
            key={slot.slotId}
            slot={slot}
            tocTitles={tocTitles}
            onOpen={openPage}
            t={t}
          />
        ))}
      </div>

      {interrupted && onContinueInterrupted ? (
        <div className="poju-delivery-interrupted delivery-shelf__interrupted" role="status">
          <p className="poju-delivery-interrupted__body">{t("interrupted_body")}</p>
          <button
            type="button"
            className="poju-delivery-interrupted__btn"
            disabled={interruptBusy}
            onClick={onContinueInterrupted}
          >
            {interruptBusy ? t("interrupted_continuing") : t("interrupted_continue")}
          </button>
        </div>
      ) : null}

      {complete ? (
        <div className="delivery-shelf__cta">
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
        </div>
      ) : null}

      {activeReady ? (
        <div
          className="delivery-shelf__overlay"
          role="dialog"
          aria-modal="true"
          aria-label={activeReady.page.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReader();
          }}
        >
          <article className="delivery-shelf__reader poju-delivery-v2">
            <h2 className="delivery-shelf__reader-title">{activeReady.page.title}</h2>
            <div className="delivery-shelf__reader-rule" aria-hidden />
            {activeReady.page.body ? (
              <DeliverySectionBodyV2
                body={activeReady.page.body}
                locale={locale}
                dualLayer={activeReady.page.dualLayer}
              />
            ) : (
              <p className="ws-delivery-book__empty">{tBook("empty_page")}</p>
            )}
          </article>
          <nav className="delivery-shelf__reader-nav" aria-label={tBook("pager_label")}>
            <button
              type="button"
              disabled={readerIndex == null || readerIndex <= 0}
              onClick={() => {
                if (readerIndex == null) return;
                const next = Math.max(0, readerIndex - 1);
                setReaderIndex(next);
                writeDeliveryShelfLastPage(sessionId, next);
              }}
            >
              ‹ {tBook("prev_page")}
            </button>
            <span>
              {tBook("page_of", {
                current: (readerIndex ?? 0) + 1,
                total: Math.max(readyPages.length, 1),
              })}
            </span>
            <button
              type="button"
              disabled={
                readerIndex == null || readerIndex >= readyPages.length - 1
              }
              onClick={() => {
                if (readerIndex == null) return;
                const next = Math.min(readyPages.length - 1, readerIndex + 1);
                setReaderIndex(next);
                writeDeliveryShelfLastPage(sessionId, next);
              }}
            >
              {tBook("next_page")} ›
            </button>
          </nav>
        </div>
      ) : null}

      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        {t("slots_hint", { n: DELIVERY_SHELF_SLOT_COUNT })}
      </span>
    </div>
  );
}
