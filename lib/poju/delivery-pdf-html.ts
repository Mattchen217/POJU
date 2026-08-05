/**
 * Phase-4 delivery → printable / previewable HTML (A4 pages).
 * Layout: cover → TOC → one argument+evidence per page → glossary appendix.
 * Visual: deep cosmic purple (POJU), not a second brand system.
 */

import { glossOf, termOf } from "@/lib/glossary/pojulife-terms";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import {
  parseTermMarkers,
  TERM_MARKER_PATTERN,
} from "@/lib/llm/sanitize/term-marking";
import { DELIVERY_TRANSITION_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { deliveryEvidenceLabelPlain } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  buildDeliveryBookPages,
  type DeliveryBookPage,
} from "@/lib/poju/delivery-book-pages";
import {
  splitProseWithH3,
  splitSectionBlocks,
} from "@/lib/poju/delivery-report-v2-split";

export type DeliveryPdfPageKind =
  | "cover"
  | "toc"
  | "chapter"
  | "argument"
  | "glossary";

export type DeliveryPdfPage = {
  kind: DeliveryPdfPageKind;
  /** Section / chapter title (H2). */
  sectionTitle: string;
  /** Argument H3 or empty. */
  argumentTitle?: string;
  bodyHtml: string;
  evidenceHtml?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainParasHtml(text: string, locale: string): string {
  const plain = toCompliantPlainText(text, locale).trim();
  if (!plain) return "";
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="pdf-p">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/** Evidence: keep [软译] gold marks; strip raw ⟦t:⟧. */
function evidenceHtml(text: string, locale: string): string {
  if (!text?.trim()) return "";
  TERM_MARKER_PATTERN.lastIndex = 0;
  let cursor = 0;
  let out = "";
  const src = text;
  for (const m of parseTermMarkers(src)) {
    const idx = src.indexOf(m.raw, cursor);
    if (idx < 0) continue;
    if (idx > cursor) {
      out += escapeHtml(src.slice(cursor, idx));
    }
    const soft = (termOf(m.id, locale) || m.visible || m.id).trim();
    out += `<span class="pdf-term">[${escapeHtml(soft)}]</span>`;
    cursor = idx + m.raw.length;
  }
  if (cursor < src.length) out += escapeHtml(src.slice(cursor));
  // Flatten leftover newlines inside evidence to spaces for compact box.
  const flat = out.replace(/\s*\n+\s*/g, " ").trim();
  return flat ? `<p class="pdf-evidence-p">${flat}</p>` : "";
}

function bodyBlockHtml(text: string, locale: string): {
  argumentTitle: string;
  bodyHtml: string;
} {
  const parts = splitProseWithH3(text);
  let argumentTitle = "";
  const chunks: string[] = [];
  for (const p of parts) {
    if (p.kind === "h3") {
      if (!argumentTitle) argumentTitle = p.text;
      else chunks.push(`<h4 class="pdf-h4">${escapeHtml(p.text)}</h4>`);
    } else {
      chunks.push(plainParasHtml(p.text, locale));
    }
  }
  return { argumentTitle, bodyHtml: chunks.join("\n") };
}

function collectSlugsInOrder(fullText: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const m of parseTermMarkers(fullText)) {
    const id = m.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  return order;
}

/**
 * Expand book sections into PDF pages:
 * cover, toc, (transition = 1 page), (dual-layer = 1 page per body+evidence pair), glossary.
 */
export function buildDeliveryPdfPages(
  fullText: string,
  locale: string,
): DeliveryPdfPage[] {
  const book = buildDeliveryBookPages(fullText);
  const zh = locale.startsWith("zh");
  const pages: DeliveryPdfPage[] = [];

  for (const sec of book) {
    if (sec.id === "cover") {
      pages.push({
        kind: "cover",
        sectionTitle: sec.title || (zh ? "能量决策报告" : "Energy Decision Report"),
        bodyHtml: plainParasHtml(sec.body, locale),
      });
      continue;
    }
    if (sec.id === "toc") {
      const entries = book.filter((p) => p.id !== "cover" && p.id !== "toc");
      const list = entries
        .map(
          (p, i) =>
            `<li><span class="pdf-toc-num">${i + 1}</span><span class="pdf-toc-title">${escapeHtml(p.title)}</span></li>`,
        )
        .join("\n");
      pages.push({
        kind: "toc",
        sectionTitle: zh ? "目录" : "Contents",
        bodyHtml: `<ol class="pdf-toc">${list}</ol>`,
      });
      continue;
    }
    if (sec.id === "appendix") {
      // Engine appendix data page (if present) — before glossary.
      if (sec.body.trim()) {
        pages.push({
          kind: "chapter",
          sectionTitle: sec.title || (zh ? "附录" : "Appendix"),
          bodyHtml: plainParasHtml(sec.body, locale),
        });
      }
      continue;
    }

    const isTransition = DELIVERY_TRANSITION_KEYS.has(sec.id as DeliverySegmentKey);
    if (isTransition || !sec.dualLayer) {
      const { argumentTitle, bodyHtml } = bodyBlockHtml(sec.body, locale);
      pages.push({
        kind: "chapter",
        sectionTitle: sec.title,
        argumentTitle: argumentTitle || undefined,
        bodyHtml: bodyHtml || plainParasHtml(sec.body, locale),
      });
      continue;
    }

    // Dual-layer: one PDF page per body + following evidence.
    const blocks = splitSectionBlocks(sec.body);
    let i = 0;
    let emitted = 0;
    while (i < blocks.length) {
      const blk = blocks[i]!;
      if (blk.kind === "body") {
        const next = blocks[i + 1];
        const ev = next?.kind === "evidence" ? next.text : "";
        if (next?.kind === "evidence") i += 2;
        else i += 1;
        const { argumentTitle, bodyHtml } = bodyBlockHtml(blk.text, locale);
        pages.push({
          kind: "argument",
          sectionTitle: sec.title,
          argumentTitle: argumentTitle || undefined,
          bodyHtml: bodyHtml || plainParasHtml(blk.text, locale),
          evidenceHtml: ev ? evidenceHtml(ev, locale) : undefined,
        });
        emitted += 1;
        continue;
      }
      // Lone evidence — attach as its own page under section title.
      pages.push({
        kind: "argument",
        sectionTitle: sec.title,
        bodyHtml: "",
        evidenceHtml: evidenceHtml(blk.text, locale),
      });
      emitted += 1;
      i += 1;
    }
    if (emitted === 0 && sec.body.trim()) {
      const { argumentTitle, bodyHtml } = bodyBlockHtml(sec.body, locale);
      pages.push({
        kind: "chapter",
        sectionTitle: sec.title,
        argumentTitle: argumentTitle || undefined,
        bodyHtml: bodyHtml || plainParasHtml(sec.body, locale),
      });
    }
  }

  // Glossary appendix — terms used in this report.
  const slugs = collectSlugsInOrder(fullText);
  if (slugs.length > 0) {
    const rows = slugs
      .map((slug) => {
        const soft = termOf(slug, locale) || slug;
        const gloss = glossOf(slug, locale) || "";
        return `<tr><td class="pdf-gloss-term">[${escapeHtml(soft)}]</td><td class="pdf-gloss-def">${escapeHtml(gloss)}</td></tr>`;
      })
      .join("\n");
    pages.push({
      kind: "glossary",
      sectionTitle: zh ? "附录 · 本报告术语" : "Appendix · Terms in this report",
      bodyHtml: `<p class="pdf-gloss-lead">${
        zh
          ? "下列金字为本报告依据层出现过的术语软译与释义。"
          : "Gold terms that appeared in this report’s evidence layer, with definitions."
      }</p><table class="pdf-gloss-table"><tbody>${rows}</tbody></table>`,
    });
  }

  return pages;
}

function renderPdfPage(page: DeliveryPdfPage, index: number, locale: string): string {
  const zh = locale.startsWith("zh");
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);

  if (page.kind === "cover") {
    return `<section class="pdf-page pdf-page--cover" data-page="${index + 1}">
  <p class="pdf-cover-mark">✦</p>
  <p class="pdf-cover-eyebrow">POJU · Pivot</p>
  <h1 class="pdf-cover-title">${escapeHtml(page.sectionTitle)}</h1>
  <div class="pdf-cover-body">${page.bodyHtml || ""}</div>
  <p class="pdf-cover-foot">${zh ? "能量决策报告" : "Energy Decision Report"}</p>
</section>`;
  }

  if (page.kind === "toc") {
    return `<section class="pdf-page pdf-page--toc" data-page="${index + 1}">
  <p class="pdf-kicker">CONTENTS</p>
  <h2 class="pdf-h2">${escapeHtml(page.sectionTitle)}</h2>
  ${page.bodyHtml}
</section>`;
  }

  if (page.kind === "glossary") {
    return `<section class="pdf-page pdf-page--glossary" data-page="${index + 1}">
  <p class="pdf-kicker">APPENDIX</p>
  <h2 class="pdf-h2">${escapeHtml(page.sectionTitle)}</h2>
  ${page.bodyHtml}
</section>`;
  }

  const arg =
    page.argumentTitle?.trim()
      ? `<h3 class="pdf-h3">${escapeHtml(page.argumentTitle.trim())}</h3>`
      : "";
  const ev = page.evidenceHtml?.trim()
    ? `<aside class="pdf-evidence">
  <p class="pdf-evidence-label">▾ ${escapeHtml(evidenceLabel)}</p>
  <div class="pdf-evidence-body">${page.evidenceHtml}</div>
</aside>`
    : "";

  return `<section class="pdf-page pdf-page--content" data-page="${index + 1}">
  <header class="pdf-page-head">
    <span class="pdf-brand">POJU</span>
    <span class="pdf-page-num">${index + 1}</span>
  </header>
  <p class="pdf-kicker">${escapeHtml(page.sectionTitle)}</p>
  ${arg}
  <div class="pdf-body">${page.bodyHtml || ""}</div>
  ${ev}
</section>`;
}

const PDF_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #0B0815;
    color: #E4E4E7;
    font-family: "Inter", "Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 16mm 20mm;
    page-break-after: always;
    break-after: page;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.18), transparent 55%),
      #0B0815;
    position: relative;
  }
  .pdf-page:last-child { page-break-after: auto; break-after: auto; }
  .pdf-page-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(167, 139, 250, 0.22);
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #A1A1AA;
    text-transform: uppercase;
  }
  .pdf-brand { color: #C084FC; font-weight: 600; }
  .pdf-kicker {
    margin: 0 0 10px;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #A78BFA;
  }
  .pdf-h2 {
    margin: 0 0 20px;
    font-size: 22px;
    font-weight: 600;
    color: #FFFFFF;
    line-height: 1.35;
  }
  .pdf-h3 {
    margin: 0 0 14px;
    font-size: 18px;
    font-weight: 600;
    color: #FFFFFF;
    line-height: 1.4;
  }
  .pdf-h4 {
    margin: 16px 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: #E4E4E7;
  }
  .pdf-p {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.75;
    color: #E4E4E7;
  }
  .pdf-body { margin-bottom: 18px; }
  .pdf-evidence {
    margin-top: 8px;
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(167, 139, 250, 0.28);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .pdf-evidence-label {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    color: #C5A880;
    letter-spacing: 0.04em;
  }
  .pdf-evidence-p {
    margin: 0;
    font-size: 12px;
    line-height: 1.7;
    color: #D4D4D8;
  }
  .pdf-term {
    color: #C5A880;
    font-weight: 500;
    border-bottom: 1px dashed rgba(197, 168, 128, 0.55);
    white-space: nowrap;
  }
  .pdf-page--cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 28mm 20mm;
    background:
      radial-gradient(ellipse 70% 55% at 60% 40%, rgba(168, 85, 247, 0.28), transparent 60%),
      radial-gradient(ellipse 50% 40% at 20% 80%, rgba(139, 92, 246, 0.2), transparent 55%),
      #0B0815;
  }
  .pdf-cover-mark {
    margin: 0 0 16px;
    font-size: 22px;
    color: #C084FC;
  }
  .pdf-cover-eyebrow {
    margin: 0 0 12px;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #A1A1AA;
  }
  .pdf-cover-title {
    margin: 0 0 24px;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.35;
    color: #FFFFFF;
    max-width: 16em;
  }
  .pdf-cover-body .pdf-p { color: #A1A1AA; font-size: 13px; }
  .pdf-cover-foot {
    margin-top: auto;
    padding-top: 40px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #71717A;
  }
  .pdf-toc {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .pdf-toc li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(167, 139, 250, 0.16);
  }
  .pdf-toc-num {
    color: #C084FC;
    font-weight: 600;
    font-size: 12px;
    min-width: 1.5em;
  }
  .pdf-toc-title {
    color: #E4E4E7;
    font-size: 14px;
  }
  .pdf-gloss-lead {
    margin: 0 0 16px;
    font-size: 12px;
    color: #A1A1AA;
    line-height: 1.6;
  }
  .pdf-gloss-table {
    width: 100%;
    border-collapse: collapse;
  }
  .pdf-gloss-table tr {
    border-bottom: 1px solid rgba(167, 139, 250, 0.14);
  }
  .pdf-gloss-term {
    width: 28%;
    padding: 10px 12px 10px 0;
    vertical-align: top;
    color: #C5A880;
    font-weight: 500;
    font-size: 12px;
    white-space: nowrap;
  }
  .pdf-gloss-def {
    padding: 10px 0;
    vertical-align: top;
    color: #D4D4D8;
    font-size: 12px;
    line-height: 1.55;
  }
  @media screen {
    body { padding: 16px 0 40px; }
    .pdf-page {
      margin: 0 auto 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.45);
      border: 1px solid rgba(167, 139, 250, 0.2);
      border-radius: 4px;
    }
  }
`;

export type BuildDeliveryPdfHtmlOptions = {
  /** When true, auto-open print dialog (export). Preview should pass false. */
  autoPrint?: boolean;
  title?: string;
};

/** Full HTML document for iframe preview or print-to-PDF. */
export function buildDeliveryPdfHtml(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryPdfHtmlOptions,
): string {
  const pages = buildDeliveryPdfPages(fullText, locale);
  const zh = locale.startsWith("zh");
  const title =
    opts?.title?.trim() ||
    pages.find((p) => p.kind === "cover")?.sectionTitle ||
    (zh ? "能量决策报告" : "Energy Decision Report");
  const body = pages.map((p, i) => renderPdfPage(p, i, locale)).join("\n");
  const printScript = opts?.autoPrint
    ? `<script>window.onload=function(){window.print();}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${zh ? "zh" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${PDF_CSS}</style>
</head>
<body>
${body}
${printScript}
</body>
</html>`;
}

/** @deprecated internal — kept for tests that want page count. */
export function countDeliveryPdfPages(fullText: string, locale: string): number {
  return buildDeliveryPdfPages(fullText, locale).length;
}

export type { DeliveryBookPage };
