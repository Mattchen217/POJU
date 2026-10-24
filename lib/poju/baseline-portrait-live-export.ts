"use client";

/**
 * SoT16 §11 preferred path: offscreen createRoot mount of live BaselinePortraitBook /
 * PojuEnergyMatrix (bodyOnly per B1–B5), inline real CSS, serialize to one self-contained HTML.
 * Vault popup stays on live React (no lookalike iframe).
 *
 * SoT16 §12: download/email stay disabled until this export passes visual acceptance vs f3c087f.
 * Do not fall back to buildBaselineProfileOfflineHtml lookalike for final acceptance.
 *
 * SoT16 §14: offline pack must include full B1–B5 DOM + layout CSS that does not depend on
 * Tailwind utilities / vault modal host. Gate stays CLOSED until Max re-verifies.
 */

import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

import { BaselinePortraitBook } from "@/components/poju/BaselinePortraitBook";
import {
  BASELINE_MATRIX_BLOCKS,
  PojuEnergyMatrix,
  type BaselineMatrixBlockId,
} from "@/components/poju/PojuEnergyMatrix";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { BASELINE_PORTRAIT_LIVE_EXPORT_CSS } from "@/lib/poju/baseline-portrait-live-export-css";

export type CaptureBaselinePortraitLiveHtmlOptions = {
  payload: PojuMatrixPayload;
  locale: string;
  messages: AbstractIntlMessages;
  subjectLabel?: string;
  coverTitle?: string;
  /** Width of offscreen mount (px). */
  mountWidth?: number;
};

export type CaptureBaselinePortraitLiveHtmlResult = {
  html: string;
  filename: string;
  paneCount: number;
  cssChars: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFrames(n = 2): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

function wrapIntl(
  locale: string,
  messages: AbstractIntlMessages,
  child: ReactElement,
): ReactElement {
  return createElement(
    NextIntlClientProvider,
    { locale, messages },
    child,
  );
}

async function renderAndSettle(root: Root, node: ReactElement): Promise<void> {
  root.render(node);
  await waitFrames(3);
  await sleep(80);
}

/**
 * Wait until a pane mount has real matrix body (not empty / logo-only stub).
 * PojuEnergyMatrix bodyOnly paints `.pcm` sections per block.
 */
async function waitForPaneReady(
  host: HTMLElement,
  blockId: string,
  timeoutMs = 4000,
): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const mount = host.querySelector(
      ".baseline-live-export-pane-mount",
    ) as HTMLElement | null;
    if (mount) {
      const pcm = mount.querySelector(".pcm");
      const section = mount.querySelector(
        ".pcm__section, .pcm-shell__panel, .pcm-calibration, .pcm-energy, .pcm-pillars, .pcm-facts-extra",
      );
      const textLen = (mount.textContent || "").replace(/\s+/g, " ").trim().length;
      if (pcm && section && textLen > 40) {
        await waitFrames(2);
        return mount;
      }
    }
    await sleep(50);
    await waitFrames(1);
  }
  throw new Error(
    `live export: pane not ready for block ${blockId} (no painted .pcm body)`,
  );
}

/**
 * Wait until BaselinePortraitBook shell has TOC + right page body (full book chrome).
 */
async function waitForBookShellReady(
  host: HTMLElement,
  timeoutMs = 4000,
): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const stage = host.querySelector(".delivery-book-stage") as HTMLElement | null;
    if (stage) {
      const tocItems = stage.querySelectorAll(".delivery-book-stage__toc-item");
      const slots =
        stage.querySelector(".baseline-portrait-book__page") ||
        stage.querySelector(".delivery-book-stage__page-slots");
      const pcm = stage.querySelector(".pcm");
      const pager = stage.querySelector(".delivery-book-stage__pager-pos");
      if (
        tocItems.length >= BASELINE_MATRIX_BLOCKS.length &&
        slots &&
        pcm &&
        pager
      ) {
        await waitFrames(2);
        return stage;
      }
    }
    await sleep(50);
    await waitFrames(1);
  }
  throw new Error(
    "live export: BaselinePortraitBook shell not fully ready (TOC/pcm/pager)",
  );
}

function baselinePortraitLiveFilename(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `eastern-os-baseline-profile-live-${y}-${m}-${day}.html`;
}

/** Collect same-origin stylesheet rules that style the book / matrix. */
export function collectLiveBookCssFromDocument(): string {
  const chunks: string[] = [];
  const re =
    /delivery-book-stage|\.pcm\b|pcm--|workspace-scroll|material-symbols|poju-logo|baseline-portrait/i;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText;
      // Drop broken empty declarations from browser cssText expansion
      if (/:\s*;/.test(text)) continue;
      if (re.test(text)) chunks.push(text);
    }
  }
  return chunks.join("\n");
}

async function inlineSameOriginAssets(rootEl: HTMLElement): Promise<void> {
  const imgs = Array.from(rootEl.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      try {
        const url = new URL(src, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
        img.removeAttribute("srcset");
      } catch {
        /* keep original src */
      }
    }),
  );
}

/**
 * PojuLogo / next/image emit width/height + Tailwind h-[Npx] classes.
 * Offline pack does not include Tailwind → intrinsic 711×711 / 1134×198 logos
 * explode into a blurry splash and crush the book chrome. Force sizes inline.
 */
function normalizeOfflineImages(rootEl: HTMLElement): void {
  rootEl
    .querySelectorAll<HTMLImageElement>(
      ".delivery-book-stage__header-logo-link img, a.delivery-book-stage__header-logo-link img",
    )
    .forEach((img) => {
      img.removeAttribute("width");
      img.removeAttribute("height");
      img.style.height = "18px";
      img.style.width = "auto";
      img.style.maxHeight = "22px";
      img.style.objectFit = "contain";
      img.style.display = "block";
    });

  rootEl.querySelectorAll<HTMLImageElement>("img[data-nimg]").forEach((img) => {
    // Already handled header logos above; clamp any other next/image without pcm CSS.
    if (img.closest(".delivery-book-stage__header-logo-link")) return;
    if (img.classList.contains("pcm-zodiac__art-img")) return;
    const cls = img.getAttribute("class") || "";
    if (/h-\[(\d+)px\]/.test(cls)) {
      const h = RegExp.$1;
      img.style.height = `${h}px`;
      img.style.width = "auto";
      img.style.objectFit = "contain";
      img.removeAttribute("width");
      img.removeAttribute("height");
    }
  });
}

function stripReactNoise(html: string): string {
  return html
    .replace(/\s+data-reactroot(?:="")?/g, "")
    .replace(/\s+style=""/g, "");
}

function buildPagerScript(pageCount: number): string {
  return `(function(){
  var root=document.querySelector('[data-baseline-live-export="1"]');
  if(!root) return;
  var panes=Array.prototype.slice.call(root.querySelectorAll('[data-export-page]'));
  var tocBtns=Array.prototype.slice.call(root.querySelectorAll('[data-export-toc]'));
  var prev=root.querySelector('[data-export-prev]');
  var next=root.querySelector('[data-export-next]');
  var pos=root.querySelector('[data-export-pos]');
  var i=0;
  var n=${pageCount};
  function show(idx){
    i=Math.max(0,Math.min(n-1,idx));
    panes.forEach(function(p,k){ if(k===i) p.removeAttribute('hidden'); else p.setAttribute('hidden',''); });
    tocBtns.forEach(function(b,k){
      var on=k===i;
      b.classList.toggle('delivery-book-stage__toc-item--active', on);
      b.classList.toggle('delivery-book-stage__toc-item--ready', !on);
      if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    var titleEl=root.querySelector('.delivery-book-stage__page-title');
    var tocTitle=tocBtns[i] && tocBtns[i].querySelector('.delivery-book-stage__toc-title');
    if(titleEl && tocTitle) titleEl.textContent=tocTitle.textContent || titleEl.textContent;
    if(pos) pos.textContent=(i+1)+' / '+n;
    if(prev) prev.disabled=i<=0;
    if(next) next.disabled=i>=n-1;
    var vp=root.querySelector('.delivery-book-stage__right-scroll .workspace-scroll__viewport, .delivery-book-stage__right-scroll');
    if(vp) vp.scrollTop=0;
  }
  tocBtns.forEach(function(b,k){ b.addEventListener('click', function(){ show(k); }); });
  if(prev) prev.addEventListener('click', function(){ show(i-1); });
  if(next) next.addEventListener('click', function(){ show(i+1); });
  show(0);
})();`;
}

/**
 * Standalone file:// CSS — must NOT rely on Tailwind utilities or vault modal host.
 * Root cause of Max FAIL 2026-10-21: header logo imgs used h-[22px]/h-[17px] only;
 * without Tailwind they rendered at intrinsic 711×711 / 1134×198 → blurry logo splash + pager.
 */
function buildOfflineExportLayoutCss(): string {
  return `
/* ==== offline createRoot export layout (SoT16 §14) ==== */
html, body { margin:0; padding:0; height:100%; overflow:hidden; background:#0B0815; }
.delivery-book-stage {
  --delivery-inset: 0 !important;
  padding: 12px !important;
  height: 100% !important;
  width: 100% !important;
  max-width: none !important;
  max-height: none !important;
  min-height: 0 !important;
  box-sizing: border-box;
  animation: none !important;
}
.delivery-book-stage__shell {
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
.delivery-book-stage__card {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
}
.delivery-book-stage__panes {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
.baseline-live-export-root { height:100%; }
.baseline-live-export-pane[hidden] { display:none !important; }
.delivery-book-stage__icon-btn img { width:18px; height:18px; display:block; filter: invert(86%) sepia(18%) saturate(600%) hue-rotate(6deg) brightness(95%); }
/* PojuLogo: replace missing Tailwind h-[22px] / h-[17px] */
.delivery-book-stage__header-logo-link {
  display: inline-flex !important;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  line-height: 0;
  text-decoration: none;
  color: inherit;
}
.delivery-book-stage__header-logo-link img {
  display: block !important;
  height: 18px !important;
  width: auto !important;
  max-height: 22px !important;
  object-fit: contain !important;
}
/* Avoid Chromium backdrop-filter + overflow clip veil over card body */
.delivery-book-stage__card,
.delivery-book-stage__card * {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
`.trim();
}

function assembleDocument(opts: {
  locale: string;
  title: string;
  shellHtml: string;
  css: string;
  pageCount: number;
}): string {
  const lang = opts.locale.slice(0, 2) || "en";
  const css =
    buildOfflineExportLayoutCss() +
    "\n" +
    (opts.css || BASELINE_PORTRAIT_LIVE_EXPORT_CSS);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="eastern-os-deliverable" content="baseline-profile-live"/>
<meta name="eastern-os-export" content="createRoot-BaselinePortraitBook"/>
<title>${opts.title.replace(/</g, "&lt;")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"/>
<style>
${css}
</style>
</head>
<body>
${opts.shellHtml}
<script>
${buildPagerScript(opts.pageCount)}
</script>
</body>
</html>`;
}

/**
 * Preferred §11 capture. Throws on failure — callers must not fall back to lookalike pack.
 */
export async function captureBaselinePortraitLiveHtml(
  opts: CaptureBaselinePortraitLiveHtmlOptions,
): Promise<CaptureBaselinePortraitLiveHtmlResult> {
  if (typeof document === "undefined") {
    throw new Error("captureBaselinePortraitLiveHtml requires a browser document");
  }

  const width = opts.mountWidth ?? 1100;
  const host = document.createElement("div");
  host.setAttribute("data-baseline-live-export-host", "1");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;height:800px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;`;
  document.body.appendChild(host);

  const root = createRoot(host);
  const paneHtml: string[] = [];

  try {
    for (const block of BASELINE_MATRIX_BLOCKS) {
      const pane = createElement(
        "div",
        {
          className: "baseline-live-export-pane-mount",
          "data-block": block.id,
        },
        createElement(PojuEnergyMatrix, {
          payload: opts.payload,
          locale: opts.locale,
          suppressNarrative: true,
          bodyOnly: true,
          activeBlockId: block.id as BaselineMatrixBlockId,
          coverTitle: opts.coverTitle,
          expanded: true,
        }),
      );
      await renderAndSettle(root, wrapIntl(opts.locale, opts.messages, pane));
      const mount = await waitForPaneReady(host, block.id);
      await inlineSameOriginAssets(mount);
      normalizeOfflineImages(mount);
      const html = mount.innerHTML.trim();
      if (!html || !html.includes("pcm")) {
        throw new Error(`live export pane empty/incomplete for block ${block.id}`);
      }
      paneHtml.push(html);
    }

    const book = createElement(BaselinePortraitBook, {
      payload: opts.payload,
      locale: opts.locale,
      suppressNarrative: true,
      coverTitle: opts.coverTitle,
    });
    await renderAndSettle(root, wrapIntl(opts.locale, opts.messages, book));
    const stage = await waitForBookShellReady(host);
    await inlineSameOriginAssets(stage);
    normalizeOfflineImages(stage);

    const clone = stage.cloneNode(true) as HTMLElement;
    clone.setAttribute("data-baseline-live-export", "1");

    // Replace single live page body with all captured panes (full B1–B5 offline).
    const slots =
      clone.querySelector(".baseline-portrait-book__page") ||
      clone.querySelector(".delivery-book-stage__page-slots");
    if (!slots) {
      throw new Error("live export: page slots not found in shell");
    }
    slots.innerHTML = paneHtml
      .map(
        (html, idx) =>
          `<div class="baseline-live-export-pane" data-export-page="${idx}"${idx === 0 ? "" : " hidden"}>${html}</div>`,
      )
      .join("");

    // Rewire TOC buttons for offline vanilla pager.
    const tocBtns = Array.from(
      clone.querySelectorAll(".delivery-book-stage__toc-item"),
    );
    tocBtns.forEach((btn, idx) => {
      btn.setAttribute("data-export-toc", String(idx));
      btn.removeAttribute("onclick");
    });
    if (tocBtns.length < BASELINE_MATRIX_BLOCKS.length) {
      throw new Error(
        `live export: TOC count ${tocBtns.length} < ${BASELINE_MATRIX_BLOCKS.length}`,
      );
    }

    // Rewire pager buttons.
    const pager = clone.querySelector(".delivery-book-stage__pager");
    if (pager) {
      const buttons = Array.from(pager.querySelectorAll("button"));
      if (buttons[0]) buttons[0].setAttribute("data-export-prev", "1");
      if (buttons[1]) buttons[1].setAttribute("data-export-next", "1");
      const pos = pager.querySelector(".delivery-book-stage__pager-pos");
      if (pos) pos.setAttribute("data-export-pos", "1");
    }

    // Drop Next.js link navigation from logo for offline file.
    clone.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("href", "#");
      a.removeAttribute("onclick");
    });

    normalizeOfflineImages(clone);

    const liveCss = collectLiveBookCssFromDocument();
    const css =
      BASELINE_PORTRAIT_LIVE_EXPORT_CSS +
      (liveCss ? `\n/* ==== document.styleSheets (live) ==== */\n${liveCss}\n` : "");

    const title =
      opts.coverTitle?.trim() ||
      (opts.locale.startsWith("zh") ? "个人基础画像" : "Personal baseline portrait");

    const html = assembleDocument({
      locale: opts.locale,
      title,
      shellHtml: stripReactNoise(clone.outerHTML),
      css,
      pageCount: BASELINE_MATRIX_BLOCKS.length,
    });

    if (!html.includes("data-baseline-live-export")) {
      throw new Error("live export assemble failed");
    }
    if (paneHtml.length !== BASELINE_MATRIX_BLOCKS.length) {
      throw new Error("live export pane count mismatch");
    }
    // Sanity: offline pack must carry all five pane markers + TOC tags.
    for (let i = 0; i < BASELINE_MATRIX_BLOCKS.length; i++) {
      if (!html.includes(`data-export-page="${i}"`)) {
        throw new Error(`live export missing data-export-page=${i}`);
      }
    }
    if (!html.includes("delivery-book-stage__toc") || !html.includes(">B1<")) {
      throw new Error("live export missing TOC / B1 marker");
    }

    return {
      html,
      filename: baselinePortraitLiveFilename(),
      paneCount: paneHtml.length,
      cssChars: css.length,
    };
  } finally {
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
  }
}

/** True when §11 capture is implemented; UI still gated by §12 visual pass flag. */
export const BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED = true;

/**
 * SoT16 §13/§14 gate — CLOSED after Max FAIL (logo splash offline).
 * true = vault download/email use createRoot captureBaselinePortraitLiveHtml.
 * Keep false until Max re-verifies full B1–B5 offline vs vault popup.
 */
export const BASELINE_LIVE_EXPORT_VISUAL_PASS = false;
