/**
 * Phase-4 delivery → offline interactive HTML (dual-pane card SSOT).
 * Mirrors center DeliveryBookStage: left TOC/meta, right modules + details evidence.
 * Optional audioBase64 reserved for wave-2 TTS embed.
 */

import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
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
import { splitProseWithH3 } from "@/lib/poju/delivery-report-v2-split";

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

function stripPartPrefix(title: string): string {
  return title
    .replace(/^第[一二三四五六七八九十百零〇两\d]+部分\s*[·•\-—–]\s*/u, "")
    .replace(/^Part\s+[IVXLCDM\d]+\s*[·•\-—–]\s*/iu, "")
    .trim();
}

function plainParasHtml(text: string, locale: string): string {
  const plain = toCompliantPlainText(text, locale).trim();
  if (!plain) return "";
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="dib-p">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function bodyBlockHtml(text: string, locale: string): string {
  const parts = splitProseWithH3(text);
  const chunks: string[] = [];
  for (const p of parts) {
    if (p.kind === "h3") {
      chunks.push(`<h3 class="dib-h3">${escapeHtml(stripPartPrefix(p.text))}</h3>`);
    } else {
      chunks.push(plainParasHtml(p.text, locale));
    }
  }
  return chunks.join("\n");
}

function tocLabelForPage(
  id: string,
  title: string,
  locale: string,
): string {
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

const INTERACTIVE_CSS = `
:root {
  --dib-bg: #0B0815;
  --dib-left: #0c1219;
  --dib-card: #111827;
  --dib-border: rgba(255,255,255,0.08);
  --dib-gold: #d4af37;
  --dib-gold-soft: #bf953f;
  --dib-text: #e4e4e7;
  --dib-muted: #9ca3af;
  --dib-dim: #71717a;
  --dib-accent: #fcf6ba;
  --font-ui: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-zh: "Source Han Sans SC", "PingFang SC", "Noto Sans SC", sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: var(--dib-bg);
  color: var(--dib-text);
  font-family: var(--font-ui), var(--font-zh);
  -webkit-font-smoothing: antialiased;
}
.dib-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 80% 50% at 70% 20%, rgba(212,175,55,0.06), transparent 55%),
    var(--dib-bg);
}
.dib-chrome {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dib-border);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dib-dim);
}
.dib {
  display: grid;
  grid-template-columns: minmax(240px, 340px) 1fr;
  flex: 1;
  min-height: 0;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  border-left: 1px solid var(--dib-border);
  border-right: 1px solid var(--dib-border);
}
.dib-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px 16px;
  background: var(--dib-left);
  border-right: 1px solid var(--dib-border);
  min-height: 0;
}
.dib-brand {
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  font-size: clamp(26px, 3vw, 36px);
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
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.dib-brand span { display: block; }
.dib-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--dib-card);
  border: 1px solid var(--dib-border);
}
.dib-meta-q {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dib-text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dib-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 12px;
  color: var(--dib-muted);
}
.dib-meta-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.dib-toc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dib-gold-soft);
}
.dib-toc-head::before {
  content: "";
  flex: 0 0 24px;
  height: 1px;
  background: linear-gradient(90deg, var(--dib-gold), transparent);
}
.dib-toc {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  flex: 1;
  min-height: 120px;
}
.dib-toc button {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--dib-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.dib-toc button:hover {
  color: var(--dib-text);
  background: rgba(212,175,55,0.06);
}
.dib-toc button.is-active {
  color: var(--dib-accent);
  border-color: rgba(212,175,55,0.28);
  background: rgba(212,175,55,0.08);
}
.dib-toc-num {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dib-gold-soft);
  opacity: 0.85;
}
.dib-foot {
  margin-top: auto;
  padding-top: 12px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--dib-dim);
}
.dib-foot p { margin: 0 0 6px; }
.dib-audio-wrap {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--dib-border);
}
.dib-audio-wrap audio { width: 100%; height: 32px; }
.dib-right {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
.dib-pane {
  display: none;
  height: 100%;
  overflow-y: auto;
  padding: 36px 36px 28px 32px;
  scroll-behavior: smooth;
}
.dib-pane.is-active { display: block; }
.dib-page-title {
  margin: 0 auto 28px;
  max-width: 720px;
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 700;
  line-height: 1.25;
  color: transparent;
  background: linear-gradient(90deg, #fff 0%, #9ca3af 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
.dib-modules {
  display: flex;
  flex-direction: column;
  gap: 40px;
  max-width: 720px;
  margin: 0 auto;
}
.dib-module { display: flex; flex-direction: column; gap: 12px; }
.dib-mod-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dib-mod-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dib-gold);
  box-shadow: 0 0 10px rgba(212,175,55,0.45);
  flex: 0 0 auto;
}
.dib-mod-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--dib-text);
}
.dib-card {
  padding: 20px 22px;
  border-radius: 8px;
  background: rgba(17,24,39,0.92);
  border: 1px solid var(--dib-border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.28);
}
.dib-p {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--dib-text);
}
.dib-p:last-child { margin-bottom: 0; }
.dib-h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--dib-accent);
}
.dib-details {
  margin-top: 16px;
  border-top: 1px solid var(--dib-border);
  padding-top: 8px;
}
.dib-details summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--dib-gold-soft);
  user-select: none;
}
.dib-details summary::-webkit-details-marker { display: none; }
.dib-details summary::before {
  content: "▸";
  display: inline-block;
  transition: transform 200ms ease;
  color: var(--dib-gold);
}
.dib-details[open] summary::before { transform: rotate(90deg); }
.dib-evidence-body {
  padding: 4px 0 8px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--dib-muted);
}
.dib-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px 20px;
  border-top: 1px solid var(--dib-border);
}
.dib-pager button {
  min-width: 88px;
  padding: 8px 18px;
  border-radius: 9999px;
  border: 1px solid rgba(212,175,55,0.35);
  background: rgba(212,175,55,0.08);
  color: var(--dib-accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dib-pager button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.dib-pager button:not(:disabled):hover {
  background: rgba(212,175,55,0.16);
}
.dib-page-label {
  font-size: 12px;
  color: var(--dib-muted);
  font-variant-numeric: tabular-nums;
  min-width: 72px;
  text-align: center;
}
@media (max-width: 767px) {
  .dib {
    grid-template-columns: 1fr;
  }
  .dib-left {
    border-right: none;
    border-bottom: 1px solid var(--dib-border);
    max-height: none;
  }
  .dib-toc { max-height: 200px; }
  .dib-pane { padding: 24px 16px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .dib-pane { scroll-behavior: auto; }
  .dib-toc button, .dib-details summary::before, .dib-pager button {
    transition: none;
  }
}
`;

const INTERACTIVE_JS = `
(function(){
  var panes = Array.prototype.slice.call(document.querySelectorAll("[data-dib-pane]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-dib-toc]"));
  var label = document.getElementById("dib-page-label");
  var prev = document.getElementById("dib-prev");
  var next = document.getElementById("dib-next");
  if (!panes.length) return;
  var ids = panes.map(function(p){ return p.getAttribute("data-dib-pane"); });
  function indexOf(id){
    var i = ids.indexOf(id);
    return i < 0 ? 0 : i;
  }
  function show(id){
    var idx = indexOf(id);
    id = ids[idx];
    panes.forEach(function(p){
      p.classList.toggle("is-active", p.getAttribute("data-dib-pane") === id);
    });
    buttons.forEach(function(b){
      b.classList.toggle("is-active", b.getAttribute("data-dib-toc") === id);
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
      var id = b.getAttribute("data-dib-toc");
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
})();
`;

/**
 * Build a self-contained interactive HTML document mirroring the delivery card.
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

  const tocButtons = prosePages
    .map((p, i) => {
      const label = tocLabelForPage(p.id, p.title, locale);
      const num = String(i + 1).padStart(2, "0");
      const active = i === 0 ? " is-active" : "";
      return `<li><button type="button" class="${active.trim()}" data-dib-toc="${escapeHtml(p.id)}"><span class="dib-toc-num">${num}</span><span>${escapeHtml(label)}</span></button></li>`;
    })
    .join("\n");

  const panes = prosePages
    .map((page, pageIndex) => {
      const modules = buildDeliveryBookModules({
        pageTitle: page.title,
        body: page.body,
        dualLayer: page.dualLayer,
        pageIndex,
      });
      const pageTitleDisplay = stripPartPrefix(page.title);
      const modsHtml = modules
        .map((mod) => {
          const modTitle = stripPartPrefix(mod.title);
          const hideTitle =
            Boolean(pageTitleDisplay) &&
            modTitle.trim() === pageTitleDisplay.trim();
          const head = hideTitle
            ? ""
            : `<header class="dib-mod-head"><span class="dib-mod-dot" aria-hidden="true"></span><h2 class="dib-mod-title">${escapeHtml(modTitle)}</h2></header>`;
          const bodyHtml = mod.body.trim()
            ? bodyBlockHtml(mod.body, locale)
            : "";
          const evidenceHtml = mod.evidence.trim()
            ? `<details class="dib-details"><summary>${escapeHtml(evidenceLabel)}</summary><div class="dib-evidence-body">${plainParasHtml(mod.evidence, locale)}</div></details>`
            : "";
          return `<article class="dib-module">${head}<div class="dib-card">${bodyHtml}${evidenceHtml}</div></article>`;
        })
        .join("\n");

      const active = pageIndex === 0 ? " is-active" : "";
      return `<section class="dib-pane${active}" data-dib-pane="${escapeHtml(page.id)}" id="pane-${escapeHtml(page.id)}" aria-label="${escapeHtml(pageTitleDisplay)}">
  ${pageTitleDisplay ? `<h1 class="dib-page-title">${escapeHtml(pageTitleDisplay)}</h1>` : ""}
  <div class="dib-modules">${modsHtml || `<div class="dib-card"><p class="dib-p">${escapeHtml(zh ? "（本章暂无正文）" : "(No body for this chapter.)")}</p></div>`}</div>
</section>`;
    })
    .join("\n");

  const audioBlock =
    opts?.audioBase64 && opts.audioBase64.trim().length > 32
      ? `<div class="dib-audio-wrap" id="dib-audio-mount">
  <audio id="dib-audio" controls preload="metadata" src="data:${escapeHtml(opts.audioMime || "audio/mpeg")};base64,${opts.audioBase64.trim()}"></audio>
</div>`
      : `<div class="dib-audio-wrap" id="dib-audio-mount" hidden aria-hidden="true"></div>`;

  const footHint = zh
    ? "离线交互报告 · 目录可点 · 依据可展开"
    : "Offline interactive report · tap TOC · expand evidence";
  const privacy = zh
    ? "本文件保存在你的设备上；打开无需登录。"
    : "This file stays on your device; no sign-in required.";
  const disclaimer = zh
    ? "内容供决策参考，不构成医疗、法律或投资建议。"
    : "For decision support only — not medical, legal, or investment advice.";
  const tocHead = zh ? "目录" : "Contents";
  const prevLabel = zh ? "上一章" : "Previous";
  const nextLabel = zh ? "下一章" : "Next";

  const metaQuestion = question
    ? `<p class="dib-meta-q" title="${escapeHtml(question)}">${escapeHtml(question)}</p>`
    : "";
  const metaProfile = profileLine
    ? `<span>${escapeHtml(profileLine)}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="${langAttr(locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>${escapeHtml(coverTitle)}</title>
<style>${INTERACTIVE_CSS}</style>
</head>
<body>
<div class="dib-shell">
  <header class="dib-chrome">Eastern OS · Pivot</header>
  <div class="dib" role="main">
    <aside class="dib-left">
      <h1 class="dib-brand"><span>Pivot</span><span>Breakthrough</span><span>Plan</span></h1>
      <div class="dib-meta">
        ${metaQuestion}
        <div class="dib-meta-row">
          ${metaProfile}
          <span>${escapeHtml(reportDate)}</span>
        </div>
        <div class="dib-meta-row">
          <span class="dib-meta-mono">${escapeHtml(reportId)}</span>
          <span>${escapeHtml(localeDisplay(locale))}</span>
        </div>
      </div>
      <div class="dib-toc-head">${escapeHtml(tocHead)}</div>
      <ol class="dib-toc" aria-label="${escapeHtml(tocHead)}">
        ${tocButtons}
      </ol>
      ${audioBlock}
      <div class="dib-foot">
        <p>${escapeHtml(footHint)}</p>
        <p>${escapeHtml(privacy)}</p>
        <p>${escapeHtml(disclaimer)}</p>
      </div>
    </aside>
    <div class="dib-right">
      ${panes}
    </div>
  </div>
  <nav class="dib-pager" aria-label="Chapter navigation">
    <button type="button" id="dib-prev">${escapeHtml(prevLabel)}</button>
    <span class="dib-page-label" id="dib-page-label">1 / ${prosePages.length || 1}</span>
    <button type="button" id="dib-next">${escapeHtml(nextLabel)}</button>
  </nav>
</div>
<script>${INTERACTIVE_JS}</script>
</body>
</html>`;
}
