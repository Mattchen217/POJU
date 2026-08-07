/**
 * Phase-4 delivery → offline HTML that is the same fixed card as DeliveryBookStage.
 * One shell (header + dual panes + footer dock); chapters switch inside the card.
 * Optional audioBase64 reserved for wave-2 TTS embed.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryAppendixCopy,
  deliveryEvidenceLabelPlain,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
import {
  collectDeliveryEvidenceTerms,
  isDeliveryAppendixEmptyPlaceholder,
} from "@/lib/poju/collect-delivery-evidence-terms";
import {
  renderDeliveryBodyMarkedHtml,
  renderDeliveryEvidenceMarkedHtml,
} from "@/lib/poju/delivery-marked-html";
import { splitProseWithH3 } from "@/lib/poju/delivery-report-v2-split";
import {
  parsePojuStructPayloads,
  stripPojuStructFences,
  type EnergyDashboardStruct,
  type ThirtyDayGanttStruct,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";

export type DeliveryInteractiveHtmlMeta = {
  originalQuestion?: string;
  profileLine?: string;
  reportId?: string;
  reportDate?: string;
  /** Cover / document title override. */
  title?: string;
};

export type BuildDeliveryInteractiveHtmlOptions = DeliveryInteractiveHtmlMeta & {
  /** Raw MP3/base64 without data: prefix — wave-2 TTS. */
  audioBase64?: string;
  /** MIME for embedded audio (default audio/mpeg). */
  audioMime?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function renderEnergyDashboardHtml(data: EnergyDashboardStruct): string {
  if (data.source === "empty") {
    return `<section class="delivery-energy-dash"><h3 class="delivery-energy-dash__title">${escapeHtml(data.labels.title)}</h3><p class="delivery-energy-dash__empty">${escapeHtml(data.labels.empty_note)}</p></section>`;
  }
  const row = (label: string, value: number, tone: string) => {
    const v = clampPct(value);
    return `<div class="delivery-energy-dash__row delivery-energy-dash__row--${tone}"><div class="delivery-energy-dash__row-head"><span class="delivery-energy-dash__label">${escapeHtml(label)}</span><span class="delivery-energy-dash__value">${v}</span></div><div class="delivery-energy-dash__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><div class="delivery-energy-dash__fill" style="width:${v}%"></div></div></div>`;
  };
  return `<section class="delivery-energy-dash" aria-label="${escapeHtml(data.labels.title)}"><h3 class="delivery-energy-dash__title">${escapeHtml(data.labels.title)}</h3><div class="delivery-energy-dash__bars">${row(data.labels.output, data.output_capacity, "gold")}${row(data.labels.sustain, data.sustain_capacity, "cyan")}${row(data.labels.resistance, data.resistance_load, "warn")}</div></section>`;
}

function renderThirtyDayGanttHtml(data: ThirtyDayGanttStruct): string {
  const rows = data.weeks
    .map((w) => {
      const sci = w.science
        .map(
          (item) =>
            `<li><label class="delivery-thirty-gantt__check"><input type="checkbox"/><span>${escapeHtml(item)}</span></label></li>`,
        )
        .join("");
      const meta = w.metaphysics
        .map(
          (item) =>
            `<li><label class="delivery-thirty-gantt__check"><input type="checkbox"/><span>${escapeHtml(item)}</span></label></li>`,
        )
        .join("");
      return `<tr><th scope="row"><span class="delivery-thirty-gantt__week-num">${w.week}</span><span class="delivery-thirty-gantt__phase">${escapeHtml(w.phase_label)}</span></th><td><ul class="delivery-thirty-gantt__list">${sci}</ul></td><td><ul class="delivery-thirty-gantt__list">${meta}</ul></td></tr>`;
    })
    .join("");
  return `<section class="delivery-thirty-gantt" aria-label="${escapeHtml(data.labels.title)}"><h3 class="delivery-thirty-gantt__title">${escapeHtml(data.labels.title)}</h3><div class="delivery-thirty-gantt__scroll"><table class="delivery-thirty-gantt__table"><thead><tr><th scope="col">${escapeHtml(data.labels.week_col)}</th><th scope="col">${escapeHtml(data.labels.science_col)}</th><th scope="col">${escapeHtml(data.labels.metaphysics_col)}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderStructWidgetsHtml(pageBody: string): string {
  const payloads = parsePojuStructPayloads(pageBody);
  const chunks: string[] = [];
  for (const p of payloads) {
    if (p.kind === "energy_dashboard") chunks.push(renderEnergyDashboardHtml(p));
    if (p.kind === "thirty_day_gantt") chunks.push(renderThirtyDayGanttHtml(p));
  }
  return chunks.join("\n");
}

function stripPartPrefix(title: string): string {
  return title
    .replace(/^第[一二三四五六七八九十百零〇两\d]+部分\s*[·•\-—–]\s*/u, "")
    .replace(/^Part\s+[IVXLCDM\d]+\s*[·•\-—–]\s*/iu, "")
    .trim();
}

function bodyBlockHtml(text: string, locale: string): string {
  const parts = splitProseWithH3(text);
  const chunks: string[] = [];
  for (const p of parts) {
    if (p.kind === "h3") {
      chunks.push(
        `<h3 class="delivery-book-stage__inline-h3">${escapeHtml(stripPartPrefix(p.text))}</h3>`,
      );
    } else {
      chunks.push(renderDeliveryBodyMarkedHtml(p.text, locale));
    }
  }
  return chunks.join("\n");
}

function tocLabelForPage(id: string, title: string, locale: string): string {
  if (id === "appendix") return deliveryAppendixCopy(locale).heading;
  if ((DELIVERY_SEGMENT_KEYS as readonly string[]).includes(id)) {
    return stripPartPrefix(deliverySectionHeading(id as DeliverySegmentKey, locale));
  }
  return stripPartPrefix(title) || title;
}

function langAttr(locale: string): string {
  if (locale.startsWith("zh")) return "zh-Hans";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("fr")) return "fr";
  return "en";
}

function localeDisplay(locale: string): string {
  if (locale.startsWith("zh")) return "中文";
  return locale.slice(0, 2).toUpperCase();
}

/** CSS mirrors delivery-book-stage.css — one fixed card, not a long scroll page. */
const CARD_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: #0B0815;
  color: #e0e2e8;
  font-family: Inter, "Segoe UI", system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.delivery-book-stage {
  --delivery-inset: 64px;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: var(--delivery-inset);
  box-sizing: border-box;
}
.delivery-book-stage__shell {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(242, 202, 80, 0.35);
  background: #111827;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(242, 202, 80, 0.12);
}
.delivery-book-stage__card {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #111827;
  isolation: isolate;
}
.delivery-book-stage__panes {
  display: grid;
  grid-template-columns: minmax(260px, 380px) 1fr;
  flex: 1;
  min-height: 0;
}
.delivery-book-stage__left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 24px 16px;
  min-height: 0;
  overflow: hidden;
  background: #0c1219;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.delivery-book-stage__product-title {
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  gap: 0;
  font-size: clamp(28px, 3.2vw, 40px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: transparent;
  background: linear-gradient(
    135deg,
    #8a6a1a 0%, #bf953f 16%, #fcf6ba 36%,
    #d4af37 50%, #fbf5b7 66%, #b38728 82%, #aa771c 100%
  );
  background-size: 140% 140%;
  background-position: 30% 40%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 12px rgba(212, 175, 55, 0.28));
}
.delivery-book-stage__product-title span { display: block; }
.delivery-book-stage__meta-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 4px;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}
.delivery-book-stage__meta-question {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.delivery-book-stage__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.delivery-book-stage__meta-row--pair { gap: 12px; }
.delivery-book-stage__meta-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 0;
}
.delivery-book-stage__meta-icon {
  flex: 0 0 auto;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.delivery-book-stage__meta-text {
  min-width: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.delivery-book-stage__meta-text--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.02em;
}
.delivery-book-stage__toc {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
  overflow: hidden;
}
.delivery-book-stage__toc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 12px;
}
.delivery-book-stage__toc-head-rule {
  display: inline-block;
  width: 12px;
  height: 1px;
  background: #6b7280;
}
.delivery-book-stage__toc-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.delivery-book-stage__toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.delivery-book-stage__toc-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.delivery-book-stage__toc-item:hover {
  color: #fff;
  background: rgba(31, 41, 55, 0.5);
}
.delivery-book-stage__toc-item--ready {
  color: #ffffff;
}
.delivery-book-stage__toc-item--ready .delivery-book-stage__toc-num {
  color: #ffffff;
}
.delivery-book-stage__toc-item--ready:hover {
  color: #ffffff;
}
.delivery-book-stage__toc-item.is-active,
.delivery-book-stage__toc-item--active {
  color: #fde047;
  font-weight: 500;
  background: rgba(253, 224, 71, 0.06);
  border-left-color: #fde047;
  box-shadow: 0 0 10px rgba(253, 224, 71, 0.1);
}
.delivery-book-stage__toc-num {
  flex: 0 0 auto;
  width: 1.1em;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  color: #4b5563;
}
.delivery-book-stage__toc-item.is-active .delivery-book-stage__toc-num,
.delivery-book-stage__toc-item--active .delivery-book-stage__toc-num {
  color: #fde047;
}
.delivery-book-stage__toc-label {
  font-size: 13px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.delivery-book-stage__left-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 10px;
  line-height: 1.45;
  color: #ffffff;
}
.delivery-book-stage__left-foot p { margin: 0 0 4px; color: #ffffff; }
.delivery-book-stage__right {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
.delivery-book-stage__pane {
  display: none;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 40px 40px 32px 36px;
  scroll-behavior: smooth;
}
.delivery-book-stage__pane.is-active { display: block; }
.delivery-book-stage__page-title {
  margin: 0 auto 36px;
  width: 100%;
  max-width: min(720px, 100%);
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 700;
  line-height: 1.25;
  color: transparent;
  background: linear-gradient(90deg, #ffffff 0%, #9ca3af 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
.delivery-book-stage__modules {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
  width: 100%;
}
.delivery-book-stage__module {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: min(720px, 100%);
  min-width: 0;
}
.delivery-book-stage__section-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 20px;
  padding: 0 0 0 28px;
}
.delivery-book-stage__section-dot {
  position: absolute;
  left: 8px;
  top: 0.55em;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fde047;
  box-shadow: 0 0 8px rgba(253, 224, 71, 0.6);
  flex-shrink: 0;
}
.delivery-book-stage__section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 400;
  color: #ffffff;
  line-height: 1.75;
}
.delivery-book-stage__section-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 28px 32px;
  border-radius: 6px;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.delivery-book-stage__section-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 16px; height: 16px;
  border-top: 1px solid rgba(253, 224, 71, 0.3);
  border-left: 1px solid rgba(253, 224, 71, 0.3);
  border-radius: 6px 0 0 0;
  pointer-events: none;
}
.delivery-book-stage__section-card::after {
  content: "";
  position: absolute;
  bottom: 0; right: 0;
  width: 16px; height: 16px;
  border-bottom: 1px solid rgba(253, 224, 71, 0.3);
  border-right: 1px solid rgba(253, 224, 71, 0.3);
  border-radius: 0 0 6px 0;
  pointer-events: none;
}
.poju-delivery-v2__prose { color: #e5e7eb; }
.poju-delivery-v2__p {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 1.7;
  color: #e5e7eb;
}
.poju-delivery-v2__p:last-child { margin-bottom: 0; }
.delivery-book-stage__inline-h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fde047;
}
/* EvidenceBlock — same as styles/evidence-block.css + delivery-book-stage overrides */
.evidence-block.delivery-book-stage__evidence {
  margin: 0.85rem 0 0;
  border-left: none;
  padding-left: 0;
}
.evidence-block__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: #fde047;
  font: inherit;
  font-size: 0.95em;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  text-align: left;
}
.evidence-block__chevron {
  display: inline-flex;
  color: #fde047;
  font-weight: 700;
  line-height: 1;
  width: 1em;
}
.evidence-block__label {
  color: #fde047;
  border-bottom: none;
}
.evidence-block__panel {
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(11, 15, 18, 0.72);
  border: 1px solid rgba(253, 224, 71, 0.18);
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
  text-align: left;
}
.evidence-block__panel[hidden] { display: none; }
.poju-delivery-v2__evidence-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
}
.poju-delivery-v2__evidence-body .poju-delivery-v2__prose {
  white-space: normal;
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
}
/* Term marks — same as styles/glossary.css (page gold letters) */
.term-mark { display: inline; position: relative; }
.term-mark__word { font-weight: 500; white-space: normal; }
.term-mark__word--interactive {
  border-bottom: 1px dotted currentColor;
  border-bottom-color: color-mix(in srgb, currentColor 45%, transparent);
  cursor: help;
}
.term-mark--bracket .term-mark__word--interactive,
.term-mark__word--bracket.term-mark__word--interactive {
  border-bottom-style: dashed;
  letter-spacing: 0.01em;
}
.term-mark--neutral .term-mark__word { color: #c5a880; }
.term-mark--favorable .term-mark__word { color: #7fc4a8; }
.term-mark--caution .term-mark__word { color: #e07a5f; }
.term-mark:not([class*="term-mark--"]) .term-mark__word { color: #d4af37; }
.delivery-book-stage__evidence .term-mark__word { letter-spacing: 0.02em; }
.reading-strong { font-weight: 600; color: #fff; }
.delivery-book-stage__term-lead {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: #9ca3af;
}
.delivery-book-stage__term-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
  line-height: 1.55;
}
.delivery-book-stage__term-table th,
.delivery-book-stage__term-table td {
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 12px;
  vertical-align: top;
  text-align: left;
}
.delivery-book-stage__term-table thead th {
  color: #9ca3af;
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.03);
}
.delivery-book-stage__term-table-term {
  width: 28%;
  max-width: 9.5rem;
  color: #d4af37;
  font-weight: 500;
}
.delivery-book-stage__term-table-gloss {
  color: #e5e7eb;
  font-weight: 400;
}
.delivery-energy-dash,
.delivery-thirty-gantt {
  margin: 0 0 20px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 15, 18, 0.72);
}
.delivery-energy-dash__title,
.delivery-thirty-gantt__title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: #f2ca50;
}
.delivery-energy-dash__empty { margin: 0; font-size: 13px; color: #9ca3af; }
.delivery-energy-dash__bars { display: flex; flex-direction: column; gap: 12px; }
.delivery-energy-dash__row-head { display: flex; justify-content: space-between; margin-bottom: 6px; gap: 12px; }
.delivery-energy-dash__label { font-size: 13px; color: #e5e7eb; }
.delivery-energy-dash__value { font-size: 13px; color: #f2ca50; font-variant-numeric: tabular-nums; }
.delivery-energy-dash__track { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
.delivery-energy-dash__fill { height: 100%; border-radius: 4px; }
.delivery-energy-dash__row--gold .delivery-energy-dash__fill { background: linear-gradient(90deg, #d4af37, #f2ca50); }
.delivery-energy-dash__row--cyan .delivery-energy-dash__fill { background: linear-gradient(90deg, #0e7490, #9cf0ff); }
.delivery-energy-dash__row--warn .delivery-energy-dash__fill { background: linear-gradient(90deg, #9a3412, #fb923c); }
.delivery-thirty-gantt__scroll { overflow-x: auto; }
.delivery-thirty-gantt__table { width: 100%; min-width: 420px; border-collapse: collapse; font-size: 13px; }
.delivery-thirty-gantt__table th,
.delivery-thirty-gantt__table td { border: 1px solid rgba(255,255,255,0.08); padding: 10px; vertical-align: top; text-align: left; }
.delivery-thirty-gantt__table thead th { font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.03); }
.delivery-thirty-gantt__table tbody th { width: 28%; font-weight: 500; color: #e5e7eb; background: rgba(0,0,0,0.2); }
.delivery-thirty-gantt__week-num { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.5rem; margin-right: 8px; border-radius: 4px; background: rgba(242,202,80,0.15); color: #f2ca50; font-size: 12px; }
.delivery-thirty-gantt__phase { color: #a1a1aa; font-size: 12px; font-weight: 400; }
.delivery-thirty-gantt__list { margin: 0; padding: 0; list-style: none; }
.delivery-thirty-gantt__check { display: flex; align-items: flex-start; gap: 8px; color: #e5e7eb; cursor: pointer; }
.delivery-thirty-gantt__check input { margin-top: 3px; accent-color: #f2ca50; }
.delivery-book-stage__chrome {
  --delivery-chrome-bg: #1a2336;
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(180px, 1.5fr) minmax(120px, 1fr);
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 4px 14px;
  min-height: 44px;
  border: none;
  background: var(--delivery-chrome-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
.delivery-book-stage__chrome--header {
  border-radius: 16px 16px 0 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}
.delivery-book-stage__chrome--footer {
  border-radius: 0 0 16px 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}
.delivery-book-stage__chrome-left,
.delivery-book-stage__chrome-center,
.delivery-book-stage__chrome-right {
  display: flex;
  align-items: center;
  min-width: 0;
}
.delivery-book-stage__chrome-left { justify-content: flex-start; }
.delivery-book-stage__chrome-center { justify-content: center; }
.delivery-book-stage__chrome-right { justify-content: flex-end; }
.delivery-book-stage__header-logo-text {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  font-weight: 600;
}
.delivery-book-stage__audio {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(100%, 420px);
}
.delivery-book-stage__audio audio {
  width: 100%;
  height: 28px;
}
.delivery-book-stage__pager {
  display: flex;
  align-items: center;
  gap: 4px;
}
.delivery-book-stage__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.delivery-book-stage__icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
}
.delivery-book-stage__icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.delivery-book-stage__pager-pos {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
  min-width: 3.5em;
  text-align: center;
}
@media (max-width: 900px) {
  .delivery-book-stage { --delivery-inset: 24px; }
  .delivery-book-stage__panes { grid-template-columns: 1fr; }
  .delivery-book-stage__left {
    max-height: 42%;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .delivery-book-stage__chrome {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .delivery-book-stage__chrome-left,
  .delivery-book-stage__chrome-center,
  .delivery-book-stage__chrome-right { justify-content: center; }
  .delivery-book-stage__pane { padding: 24px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .delivery-book-stage__pane { scroll-behavior: auto; }
  .delivery-book-stage__toc-item {
    transition: none;
  }
}
`;

const CARD_JS = `
(function(){
  var panes = Array.prototype.slice.call(document.querySelectorAll("[data-slot-pane]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-slot]"));
  var label = document.getElementById("dib-page-label");
  var prev = document.getElementById("dib-prev");
  var next = document.getElementById("dib-next");
  if (!panes.length) return;
  var ids = panes.map(function(p){ return p.getAttribute("data-slot-pane"); });
  function indexOf(id){
    var i = ids.indexOf(id);
    return i < 0 ? 0 : i;
  }
  function show(id){
    var idx = indexOf(id);
    id = ids[idx];
    panes.forEach(function(p){
      var on = p.getAttribute("data-slot-pane") === id;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    buttons.forEach(function(b){
      var on = b.getAttribute("data-slot") === id;
      b.classList.toggle("is-active", on);
      b.classList.toggle("delivery-book-stage__toc-item--active", on);
      b.classList.toggle("delivery-book-stage__toc-item--ready", !on);
    });
    if (label) label.textContent = (idx + 1) + " / " + ids.length;
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= ids.length - 1;
    try {
      if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id));
    } catch (e) {}
    var active = panes[idx];
    if (active) active.scrollTop = 0;
  }
  buttons.forEach(function(b){
    b.addEventListener("click", function(){
      var id = b.getAttribute("data-slot");
      if (id) show(id);
    });
  });
  if (prev) prev.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur > 0) show(ids[cur - 1]);
  });
  if (next) next.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur >= 0 && cur < ids.length - 1) show(ids[cur + 1]);
  });
  var hash = (location.hash || "").replace(/^#/, "");
  var start = hash ? decodeURIComponent(hash) : ids[0];
  if (ids.indexOf(start) < 0) start = ids[0];
  show(start);
  document.querySelectorAll(".evidence-block__toggle").forEach(function(btn){
    btn.addEventListener("click", function(){
      var root = btn.closest(".evidence-block");
      if (!root) return;
      var panel = root.querySelector(".evidence-block__panel");
      var open = root.classList.toggle("evidence-block--open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (panel) panel.hidden = !open;
      var chev = btn.querySelector(".evidence-block__chevron");
      if (chev) chev.textContent = open ? "▾" : "▸";
    });
  });
})();
`;

/**
 * Offline HTML = the same fixed delivery card (shell + dual panes + dock).
 * Chapters switch inside the card; page does not reflow into a long document.
 */
export function buildDeliveryInteractiveHtml(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): string {
  const pages = buildDeliveryBookPages(fullText);
  const prosePages = pages.filter((p) => p.id !== "cover" && p.id !== "toc");
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  const zh = locale.startsWith("zh");

  const coverTitle =
    opts?.title?.trim() ||
    pages.find((p) => p.id === "cover")?.title ||
    (zh ? "能量决策报告" : "Energy Decision Report");

  const question =
    (opts?.originalQuestion || "").trim() ||
    coverTitle
      .replace(/^关于「|」的能量决策报告$/g, "")
      .replace(/^Energy Decision Report ·\s*/i, "")
      .trim();

  const reportId =
    (opts?.reportId || "").trim().replace(/^POJU-/i, "PIVOT-") || "PIVOT-LOCAL";
  const reportDate = (opts?.reportDate || new Date().toISOString().slice(0, 10)).trim();
  const profileLine = (opts?.profileLine || "").trim();

  const tocHead = zh ? "目录" : "Contents";
  const privacy = zh
    ? "本文件保存在你的设备上；打开无需登录。"
    : "This file stays on your device; no sign-in required.";
  const disclaimer = zh
    ? "内容供决策参考，不构成医疗、法律或投资建议。"
    : "For decision support only — not medical, legal, or investment advice.";
  const readingHint = zh
    ? "点目录切换章节；依据默认收起。"
    : "Use the TOC to switch chapters; evidence stays collapsed.";

  const tocButtons = prosePages
    .map((p, i) => {
      const label = tocLabelForPage(p.id, p.title, locale);
      const num = String(i + 1).padStart(2, "0");
      const stateClass =
        i === 0
          ? " delivery-book-stage__toc-item--active is-active"
          : " delivery-book-stage__toc-item--ready";
      return `<li><button type="button" class="delivery-book-stage__toc-item${stateClass}" data-slot="${escapeHtml(p.id)}"><span class="delivery-book-stage__toc-num">${num}</span><span class="delivery-book-stage__toc-label">${escapeHtml(label)}</span></button></li>`;
    })
    .join("\n");

  const evidenceTerms = collectDeliveryEvidenceTerms(fullText, locale);
  const appendixCopy = deliveryAppendixCopy(locale);

  const panes = prosePages
    .map((page, pageIndex) => {
      const structHtml = renderStructWidgetsHtml(page.body);
      const modules = buildDeliveryBookModules({
        pageTitle: page.title,
        body: stripPojuStructFences(page.body),
        dualLayer: page.dualLayer,
        pageIndex,
      });
      const pageTitleDisplay = stripPartPrefix(page.title);
      const isAppendix = page.id === "appendix";
      const hideEmptyAppendix =
        isAppendix &&
        evidenceTerms.length > 0 &&
        modules.every((m) => isDeliveryAppendixEmptyPlaceholder(m.body));

      const modsHtml = hideEmptyAppendix
        ? ""
        : modules
            .map((mod) => {
              const modTitle = stripPartPrefix(mod.title);
              const hideTitle =
                Boolean(pageTitleDisplay) &&
                modTitle.trim() === pageTitleDisplay.trim();
              const head = hideTitle
                ? ""
                : `<header class="delivery-book-stage__section-head"><span class="delivery-book-stage__section-dot" aria-hidden="true"></span><h2 class="delivery-book-stage__section-title">${escapeHtml(modTitle)}</h2></header>`;
              const bodyHtml = mod.body.trim()
                ? `<div class="delivery-book-stage__section-body poju-delivery-v2__body"><div class="poju-delivery-v2__prose">${bodyBlockHtml(mod.body, locale)}</div></div>`
                : "";
              const evidenceHtml = mod.evidence.trim()
                ? `<div class="evidence-block delivery-book-stage__evidence">
  <button type="button" class="evidence-block__toggle" aria-expanded="false">
    <span class="evidence-block__chevron" aria-hidden="true">▸</span>
    <span class="evidence-block__label">${escapeHtml(evidenceLabel)}</span>
  </button>
  <div class="evidence-block__panel" role="region" hidden>
    <div class="poju-delivery-v2__evidence-body">
      <div class="poju-delivery-v2__prose">${renderDeliveryEvidenceMarkedHtml(mod.evidence, locale, { bracketSoft: false })}</div>
    </div>
  </div>
</div>`
                : "";
              return `<article class="delivery-book-stage__module">${head}<div class="delivery-book-stage__section-card">${bodyHtml}${evidenceHtml}</div></article>`;
            })
            .join("\n");

      const glossaryHtml =
        isAppendix && evidenceTerms.length > 0
          ? `<article class="delivery-book-stage__module is-last">
  ${
    hideEmptyAppendix
      ? ""
      : `<header class="delivery-book-stage__section-head"><span class="delivery-book-stage__section-dot" aria-hidden="true"></span><h2 class="delivery-book-stage__section-title">${escapeHtml(appendixCopy.terms)}</h2></header>`
  }
  <div class="delivery-book-stage__section-card">
    <p class="delivery-book-stage__term-lead">${escapeHtml(appendixCopy.evidenceGlossaryLead)}</p>
    <table class="delivery-book-stage__term-table">
      <thead>
        <tr>
          <th scope="col">${escapeHtml(appendixCopy.termCol)}</th>
          <th scope="col">${escapeHtml(appendixCopy.glossCol)}</th>
        </tr>
      </thead>
      <tbody>
      ${evidenceTerms
        .map(
          (t) =>
            `<tr><th scope="row" class="delivery-book-stage__term-table-term">${escapeHtml(t.soft)}</th><td class="delivery-book-stage__term-table-gloss">${escapeHtml(t.gloss || "—")}</td></tr>`,
        )
        .join("\n")}
      </tbody>
    </table>
  </div>
</article>`
          : "";

      const active = pageIndex === 0;
      const activeClass = active ? " is-active" : "";
      const hidden = active ? "" : " hidden";
      const inner =
        modsHtml || glossaryHtml
          ? `${modsHtml}${glossaryHtml}`
          : `<div class="delivery-book-stage__section-card"><p class="poju-delivery-v2__p">${escapeHtml(zh ? "（本章暂无正文）" : "(No body for this chapter.)")}</p></div>`;
      return `<section class="delivery-book-stage__pane${activeClass}" data-slot-pane="${escapeHtml(page.id)}" id="pane-${escapeHtml(page.id)}" aria-label="${escapeHtml(pageTitleDisplay)}"${hidden}>
  ${pageTitleDisplay ? `<h1 class="delivery-book-stage__page-title">${escapeHtml(pageTitleDisplay)}</h1>` : ""}
  ${structHtml}
  <div class="delivery-book-stage__modules">${inner}</div>
</section>`;
    })
    .join("\n");

  const hasAudio = Boolean(opts?.audioBase64 && opts.audioBase64.trim().length > 32);
  const audioBlock = hasAudio
    ? `<div class="delivery-book-stage__audio" id="dib-audio-mount">
  <audio id="dib-audio" controls preload="metadata" src="data:${escapeHtml(opts?.audioMime || "audio/mpeg")};base64,${opts!.audioBase64!.trim()}"></audio>
</div>`
    : `<div class="delivery-book-stage__audio" id="dib-audio-mount" hidden aria-hidden="true"></div>`;

  const metaQuestion = question
    ? `<p class="delivery-book-stage__meta-question" title="${escapeHtml(question)}">${escapeHtml(question)}</p>`
    : "";
  const metaProfile = profileLine
    ? `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">◎</span><span class="delivery-book-stage__meta-text">${escapeHtml(profileLine)}</span></span>`
    : "";

  return `<!DOCTYPE html>
<html lang="${langAttr(locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>${escapeHtml(coverTitle)}</title>
<style>${CARD_CSS}</style>
</head>
<body>
<div class="delivery-book-stage" data-locale="${zh ? "zh" : locale.slice(0, 2)}">
  <div class="delivery-book-stage__shell">
    <header class="delivery-book-stage__chrome delivery-book-stage__chrome--header" aria-label="Eastern OS">
      <div class="delivery-book-stage__chrome-left" aria-hidden="true"></div>
      <div class="delivery-book-stage__chrome-center">
        <span class="delivery-book-stage__header-logo-text">Eastern OS</span>
      </div>
      <div class="delivery-book-stage__chrome-right" aria-hidden="true"></div>
    </header>
    <div class="delivery-book-stage__card" role="region" aria-label="${escapeHtml(coverTitle)}">
      <div class="delivery-book-stage__panes">
        <aside class="delivery-book-stage__left">
          <div class="delivery-book-stage__brand">
            <h1 class="delivery-book-stage__product-title">
              <span>Pivot</span>
              <span>Breakthrough</span>
              <span>Plan</span>
            </h1>
          </div>
          <div class="delivery-book-stage__meta-card">
            ${metaQuestion}
            <div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
              ${metaProfile}
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">◷</span>
                <span class="delivery-book-stage__meta-text">${escapeHtml(reportDate)}</span>
              </span>
            </div>
            <div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">#</span>
                <span class="delivery-book-stage__meta-text delivery-book-stage__meta-text--mono">${escapeHtml(reportId)}</span>
              </span>
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">文</span>
                <span class="delivery-book-stage__meta-text">${escapeHtml(localeDisplay(locale))}</span>
              </span>
            </div>
          </div>
          <nav class="delivery-book-stage__toc" aria-label="${escapeHtml(tocHead)}">
            <div class="delivery-book-stage__toc-head">
              <span class="delivery-book-stage__toc-head-rule" aria-hidden="true"></span>
              ${escapeHtml(tocHead)}
            </div>
            <div class="delivery-book-stage__toc-scroll">
              <ol class="delivery-book-stage__toc-list">
                ${tocButtons}
              </ol>
            </div>
          </nav>
          <div class="delivery-book-stage__left-foot">
            <p>${escapeHtml(readingHint)}</p>
            <p>${escapeHtml(privacy)}</p>
            <p>${escapeHtml(disclaimer)}</p>
          </div>
        </aside>
        <section class="delivery-book-stage__right">
          ${panes}
        </section>
      </div>
    </div>
    <footer class="delivery-book-stage__chrome delivery-book-stage__chrome--footer" role="navigation" aria-label="Pager">
      <div class="delivery-book-stage__chrome-left" aria-hidden="true"></div>
      <div class="delivery-book-stage__chrome-center">${audioBlock}</div>
      <div class="delivery-book-stage__chrome-right">
        <div class="delivery-book-stage__pager">
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-prev" aria-label="${zh ? "上一章" : "Previous"}">‹</button>
          <span class="delivery-book-stage__pager-pos" id="dib-page-label">1 / ${prosePages.length || 1}</span>
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-next" aria-label="${zh ? "下一章" : "Next"}">›</button>
        </div>
      </div>
    </footer>
  </div>
</div>
<script>${CARD_JS}</script>
</body>
</html>`;
}
