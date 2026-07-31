"use client";

/**
 * Right-rail Phase-4 delivery book.
 * Folded = document icon. Expanded = cover / TOC / one section per page + download / email.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import { A4PaperSheet, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import {
  buildDeliveryBookPages,
  type DeliveryBookPage,
  type DeliveryBookPageId,
} from "@/lib/poju/delivery-book-pages";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

import "@/styles/workspace-rail-report.css";
import "@/styles/workspace-rail-delivery-book.css";

type Props = {
  fullText: string;
  locale: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  unread?: boolean;
};

function downloadTextFile(filename: string, content: string, mime: string) {
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

function buildPrintableHtml(pages: DeliveryBookPage[], locale: string, title: string): string {
  const parts = pages
    .map((p) => {
      const plain = toCompliantPlainText(
        `# ${p.title}\n\n${p.body}`,
        locale,
      );
      const bodyHtml = plain
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
      return `<section class="page"><h2>${escapeHtml(p.title)}</h2>${bodyHtml}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${locale.startsWith("zh") ? "zh" : "en"}">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Source Han Sans SC", "Segoe UI", sans-serif; color: #1a1525; line-height: 1.65; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 0 0 12px; page-break-before: always; }
  .page:first-of-type h2 { page-break-before: avoid; }
  p { margin: 0 0 12px; font-size: 13px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(new Date().toISOString().slice(0, 10))}</p>
${parts}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function WorkspaceRailDeliveryBook({
  fullText,
  locale,
  expanded,
  onExpandedChange,
  unread = false,
}: Props) {
  const t = useTranslations("workspace.deliveryBook");
  const pages = useMemo(() => buildDeliveryBookPages(fullText), [fullText]);
  const [pageId, setPageId] = useState<DeliveryBookPageId>("cover");
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) {
      setPageId(pages[0]?.id ?? "cover");
      setEmailOpen(false);
      setEmailMsg(null);
    }
  }, [expanded, pages]);

  useEffect(() => {
    if (!pages.some((p) => p.id === pageId) && pages[0]) {
      setPageId(pages[0].id);
    }
  }, [pages, pageId]);

  if (pages.length === 0) return null;

  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === pageId),
  );
  const active = pages[activeIndex]!;
  const prev = activeIndex > 0 ? pages[activeIndex - 1] : null;
  const next = activeIndex < pages.length - 1 ? pages[activeIndex + 1] : null;
  const localeAttr = locale.startsWith("zh") ? "zh" : locale.slice(0, 2);
  const coverTitle = pages.find((p) => p.id === "cover")?.title ?? t("title");

  function openBook(id?: DeliveryBookPageId) {
    setPageId(id ?? pages[0]!.id);
    onExpandedChange(true);
  }

  function handleDownloadTxt() {
    const plain = toCompliantPlainText(fullText, locale);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`pivot-delivery-${stamp}.txt`, plain, "text/plain;charset=utf-8");
  }

  function handlePrintPdf() {
    const html = buildPrintableHtml(pages, locale, coverTitle);
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      downloadTextFile(
        `pivot-delivery-${new Date().toISOString().slice(0, 10)}.html`,
        html,
        "text/html;charset=utf-8",
      );
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function handleSendEmail() {
    const to = email.trim();
    if (!to || !to.includes("@")) {
      setEmailMsg(t("email_invalid"));
      return;
    }
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const plain = toCompliantPlainText(fullText, locale);
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          to,
          locale,
          title: coverTitle,
          body_text: plain.slice(0, 100_000),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setEmailMsg(data.error || t("email_failed"));
        return;
      }
      setEmailMsg(t("email_sent"));
      setEmail("");
    } catch {
      setEmailMsg(t("email_failed"));
    } finally {
      setEmailBusy(false);
    }
  }

  if (!expanded) {
    return (
      <div className="ws-rail-report ws-rail-report--folded ws-rail-delivery-book--folded">
        {unread ? <ArchiveUnreadDot className="ws-rail-report__unread" /> : null}
        <A4PaperSheet mode="folded" className="ws-rail-report__icon-sheet">
          <button
            type="button"
            className="ws-rail-report__icon-cover"
            onClick={() => openBook("cover")}
            aria-label={t("icon_label")}
          >
            <EnergyReportGlyph className="ws-rail-report__glyph" />
            <span className="ws-rail-report__icon-title">{t("icon_label")}</span>
          </button>
        </A4PaperSheet>
      </div>
    );
  }

  return (
    <div
      className="ws-rail-report ws-rail-report--open ws-rail-delivery-book"
      data-locale={localeAttr}
    >
      <div className="ws-rail-report__chrome">
        <div className="ws-rail-report__title-row">
          <h2 className="ws-rail-report__title">{t("title")}</h2>
          <p className="ws-rail-report__desc">{t("description")}</p>
        </div>

        <div className="ws-rail-delivery-book__toolbar" role="toolbar" aria-label={t("toolbar_label")}>
          <button type="button" className="ws-rail-delivery-book__tool" onClick={handleDownloadTxt}>
            {t("download")}
          </button>
          <button type="button" className="ws-rail-delivery-book__tool" onClick={handlePrintPdf}>
            {t("print_pdf")}
          </button>
          <button
            type="button"
            className="ws-rail-delivery-book__tool"
            onClick={() => setEmailOpen((v) => !v)}
            aria-expanded={emailOpen}
          >
            {t("email")}
          </button>
        </div>

        {emailOpen ? (
          <div className="ws-rail-delivery-book__email">
            <label className="ws-rail-delivery-book__email-label" htmlFor="ws-delivery-email">
              {t("email_hint")}
            </label>
            <div className="ws-rail-delivery-book__email-row">
              <input
                id="ws-delivery-email"
                type="email"
                autoComplete="email"
                className="ws-rail-delivery-book__email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email_placeholder")}
                disabled={emailBusy}
              />
              <button
                type="button"
                className="ws-rail-delivery-book__tool ws-rail-delivery-book__tool--primary"
                disabled={emailBusy}
                onClick={() => void handleSendEmail()}
              >
                {emailBusy ? t("email_sending") : t("email_send")}
              </button>
            </div>
            {emailMsg ? (
              <p className="ws-rail-delivery-book__email-msg" role="status">
                {emailMsg}
              </p>
            ) : null}
          </div>
        ) : null}

        <nav className="ws-rail-report__tabs" role="tablist" aria-label={t("toc_label")}>
          {pages.map((p) => {
            const selected = p.id === pageId;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`ws-delivery-tab-${p.id}`}
                aria-selected={selected}
                aria-controls={`ws-delivery-panel-${p.id}`}
                tabIndex={selected ? 0 : -1}
                className={`ws-rail-report__tab${selected ? " is-active" : ""}`}
                onClick={() => openBook(p.id)}
              >
                <span className="ws-rail-report__tab-label">{p.title}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div
        className="ws-rail-report__panel"
        role="tabpanel"
        id={`ws-delivery-panel-${active.id}`}
        aria-labelledby={`ws-delivery-tab-${active.id}`}
      >
        <div className="ws-rail-report__body ws-rail-delivery-book__body">
          {active.id === "cover" ? (
            <header className="ws-rail-delivery-book__cover">
              <p className="ws-rail-delivery-book__cover-eyebrow">{t("cover_eyebrow")}</p>
              <h3 className="ws-rail-delivery-book__cover-title">{active.title}</h3>
            </header>
          ) : (
            <h3 className="ws-rail-delivery-book__page-title">{active.title}</h3>
          )}

          {active.id === "toc" ? (
            <ol className="ws-rail-delivery-book__toc">
              {pages
                .filter((p) => p.id !== "cover" && p.id !== "toc")
                .map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="ws-rail-delivery-book__toc-link"
                      onClick={() => openBook(p.id)}
                    >
                      <span className="ws-rail-delivery-book__toc-num">{i + 1}</span>
                      <span>{p.title}</span>
                    </button>
                  </li>
                ))}
            </ol>
          ) : null}

          {active.body ? (
            <RichReadingText
              text={active.body}
              locale={locale}
              dualLayer={active.dualLayer}
              density="delivery"
            />
          ) : active.id !== "toc" ? (
            <p className="ws-rail-report__empty">{t("empty_page")}</p>
          ) : null}
        </div>

        <div className="ws-rail-report__footer">
          <div className="ws-rail-report__footer-slot ws-rail-report__footer-slot--start">
            {prev ? (
              <button
                type="button"
                className="ws-rail-report__nav"
                onClick={() => openBook(prev.id)}
              >
                <span aria-hidden>‹</span>
                {t("prev_page")}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="ws-rail-report__close"
            onClick={() => onExpandedChange(false)}
          >
            {t("close")}
            <span aria-hidden>▴</span>
          </button>
          <div className="ws-rail-report__footer-slot ws-rail-report__footer-slot--end">
            {next ? (
              <button
                type="button"
                className="ws-rail-report__nav"
                onClick={() => openBook(next.id)}
              >
                {t("next_page")}
                <span aria-hidden>›</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
