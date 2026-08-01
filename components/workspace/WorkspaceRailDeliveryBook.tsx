"use client";

/**
 * Right-rail Phase-4 delivery book — page-turn reading (not tabbed report chrome).
 * Page 1 cover → 2 TOC → 3+ chapters → last appendix.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { DeliverySectionBodyV2 } from "@/components/poju/DeliveryReportV2";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import { A4PaperSheet, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import {
  buildDeliveryBookPages,
  type DeliveryBookPage,
  type DeliveryBookPageId,
} from "@/lib/poju/delivery-book-pages";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintableHtml(pages: DeliveryBookPage[], locale: string, title: string): string {
  const parts = pages
    .map((p, i) => {
      const plain = toCompliantPlainText(
        p.id === "toc"
          ? `# ${p.title}\n\n${pages
              .filter((x) => x.id !== "cover" && x.id !== "toc")
              .map((x, n) => `${n + 1}. ${x.title}`)
              .join("\n")}`
          : `# ${p.title}\n\n${p.body}`,
        locale,
      );
      const bodyHtml = plain
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
      return `<section class="page" data-page="${i + 1}"><h2>${escapeHtml(p.title)}</h2>${bodyHtml}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${locale.startsWith("zh") ? "zh" : "en"}">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Georgia, "Source Han Serif SC", serif; color: #1a1525; line-height: 1.7; margin: 0; }
  .page { min-height: 100vh; padding: 12mm 10mm; box-sizing: border-box; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h2 { font-size: 18px; margin: 0 0 16px; font-weight: 600; }
  p { margin: 0 0 12px; font-size: 13px; }
</style>
</head>
<body>
${parts}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
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
  const [pageIndex, setPageIndex] = useState(0);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) {
      setPageIndex(0);
      setEmailOpen(false);
      setEmailMsg(null);
    }
  }, [expanded]);

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPageIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPageIndex((i) => Math.min(pages.length - 1, i + 1));
      } else if (e.key === "Escape") {
        onExpandedChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, pages.length, onExpandedChange]);

  if (pages.length === 0) return null;

  const active = pages[Math.min(pageIndex, pages.length - 1)]!;
  const coverTitle = pages.find((p) => p.id === "cover")?.title ?? t("title");
  const coverBody = pages.find((p) => p.id === "cover")?.body ?? "";
  const tocEntries = pages.filter((p) => p.id !== "cover" && p.id !== "toc");
  const pageLabel = t("page_of", { current: pageIndex + 1, total: pages.length });

  function goToId(id: DeliveryBookPageId) {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx >= 0) setPageIndex(idx);
    onExpandedChange(true);
  }

  function handleDownloadTxt() {
    const plain = toCompliantPlainText(fullText, locale);
    downloadTextFile(
      `pivot-delivery-${new Date().toISOString().slice(0, 10)}.txt`,
      plain,
      "text/plain;charset=utf-8",
    );
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
      <div className="ws-delivery-book ws-delivery-book--folded">
        {unread ? <ArchiveUnreadDot className="ws-delivery-book__unread" /> : null}
        <A4PaperSheet mode="folded" className="ws-delivery-book__icon-sheet">
          <button
            type="button"
            className="ws-delivery-book__icon-cover"
            onClick={() => {
              setPageIndex(0);
              onExpandedChange(true);
            }}
            aria-label={t("icon_label")}
          >
            <EnergyReportGlyph className="ws-delivery-book__glyph" />
            <span className="ws-delivery-book__icon-title">{t("icon_label")}</span>
          </button>
        </A4PaperSheet>
      </div>
    );
  }

  return (
    <div
      className="ws-delivery-book ws-delivery-book--open"
      data-locale={locale.startsWith("zh") ? "zh" : locale.slice(0, 2)}
      role="region"
      aria-label={t("title")}
    >
      <div className="ws-delivery-book__actions" role="toolbar" aria-label={t("toolbar_label")}>
        <button type="button" className="ws-delivery-book__tool" onClick={handleDownloadTxt}>
          {t("download")}
        </button>
        <button type="button" className="ws-delivery-book__tool" onClick={handlePrintPdf}>
          {t("print_pdf")}
        </button>
        <button
          type="button"
          className="ws-delivery-book__tool"
          onClick={() => setEmailOpen((v) => !v)}
          aria-expanded={emailOpen}
        >
          {t("email")}
        </button>
        <button
          type="button"
          className="ws-delivery-book__tool ws-delivery-book__tool--ghost"
          onClick={() => onExpandedChange(false)}
        >
          {t("close")}
        </button>
      </div>

      {emailOpen ? (
        <div className="ws-delivery-book__email">
          <label className="ws-delivery-book__email-label" htmlFor="ws-delivery-email">
            {t("email_hint")}
          </label>
          <div className="ws-delivery-book__email-row">
            <input
              id="ws-delivery-email"
              type="email"
              autoComplete="email"
              className="ws-delivery-book__email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email_placeholder")}
              disabled={emailBusy}
            />
            <button
              type="button"
              className="ws-delivery-book__tool ws-delivery-book__tool--primary"
              disabled={emailBusy}
              onClick={() => void handleSendEmail()}
            >
              {emailBusy ? t("email_sending") : t("email_send")}
            </button>
          </div>
          {emailMsg ? (
            <p className="ws-delivery-book__email-msg" role="status">
              {emailMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      <A4PaperSheet mode="flat" showFold={false} className="ws-delivery-book__sheet">
        <article
          className={`ws-delivery-book__page ws-delivery-book__page--${active.id}`}
          aria-live="polite"
        >
          {active.id === "cover" ? (
            <div className="ws-delivery-book__cover-page">
              <p className="ws-delivery-book__cover-mark">✦</p>
              <p className="ws-delivery-book__cover-eyebrow">{t("cover_eyebrow")}</p>
              <h1 className="ws-delivery-book__cover-title">{active.title || coverTitle}</h1>
              {coverBody ? (
                <div className="ws-delivery-book__cover-blurb">
                  <RichReadingText
                    text={coverBody}
                    locale={locale}
                    dualLayer={false}
                    density="delivery"
                  />
                </div>
              ) : (
                <p className="ws-delivery-book__cover-blurb-fallback">{t("description")}</p>
              )}
              <p className="ws-delivery-book__cover-turn">{t("turn_hint")}</p>
            </div>
          ) : null}

          {active.id === "toc" ? (
            <div className="ws-delivery-book__toc-page">
              <h2 className="ws-delivery-book__chapter-title">{active.title || t("toc_label")}</h2>
              <ol className="ws-delivery-book__toc-list">
                {tocEntries.map((p) => {
                  const physical = pages.findIndex((x) => x.id === p.id) + 1;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="ws-delivery-book__toc-row"
                        onClick={() => goToId(p.id)}
                      >
                        <span className="ws-delivery-book__toc-title">{p.title}</span>
                        <span className="ws-delivery-book__toc-dots" aria-hidden />
                        <span className="ws-delivery-book__toc-page">{physical}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {active.id !== "cover" && active.id !== "toc" ? (
            <div className="ws-delivery-book__chapter-page">
              <h2 className="ws-delivery-book__chapter-title">{active.title}</h2>
              {active.body ? (
                <div className="ws-delivery-book__chapter-body poju-delivery-v2">
                  <DeliverySectionBodyV2
                    body={active.body}
                    locale={locale}
                    dualLayer={active.dualLayer}
                  />
                </div>
              ) : (
                <p className="ws-delivery-book__empty">{t("empty_page")}</p>
              )}
            </div>
          ) : null}
        </article>
      </A4PaperSheet>

      <nav className="ws-delivery-book__pager" aria-label={t("pager_label")}>
        <button
          type="button"
          className="ws-delivery-book__page-btn"
          disabled={pageIndex <= 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          ‹ {t("prev_page")}
        </button>
        <span className="ws-delivery-book__page-num">{pageLabel}</span>
        <button
          type="button"
          className="ws-delivery-book__page-btn"
          disabled={pageIndex >= pages.length - 1}
          onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
        >
          {t("next_page")} ›
        </button>
      </nav>
    </div>
  );
}
