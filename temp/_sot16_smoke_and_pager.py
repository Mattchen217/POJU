# -*- coding: utf-8 -*-
from pathlib import Path

# Improve pager script to update page title from TOC
path = Path(r"D:\POJU\pojulife\lib\poju\baseline-portrait-live-export.ts")
t = path.read_text(encoding="utf-8")
old = """  function show(idx){
    i=Math.max(0,Math.min(n-1,idx));
    panes.forEach(function(p,k){ if(k===i) p.removeAttribute('hidden'); else p.setAttribute('hidden',''); });
    tocBtns.forEach(function(b,k){
      var on=k===i;
      b.classList.toggle('delivery-book-stage__toc-item--active', on);
      b.classList.toggle('delivery-book-stage__toc-item--ready', !on);
      if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    if(pos) pos.textContent=(i+1)+' / '+n;
    if(prev) prev.disabled=i<=0;
    if(next) next.disabled=i>=n-1;
    var vp=root.querySelector('.delivery-book-stage__right-scroll .workspace-scroll__viewport, .delivery-book-stage__right-scroll');
    if(vp) vp.scrollTop=0;
  }"""
new = """  function show(idx){
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
  }"""
if old not in t:
    raise SystemExit("pager show() not found")
path.write_text(t.replace(old, new, 1), encoding="utf-8")
print("pager title sync ok")

# Write smoke script
smoke = Path(r"D:\POJU\pojulife\scripts\smoke-baseline-portrait-live-export.ts")
smoke.write_text(r'''/**
 * Smoke (SoT16 §11 live export scaffolding):
 * - Confirms embedded real CSS + capture module gates
 * - Writes temp/eastern-os-baseline-profile-live-smoke-shell.html (CSS shell; panes need browser createRoot)
 *
 * Full pane serialize requires a browser (captureBaselinePortraitLiveHtml).
 * Download/email stay disabled until BASELINE_LIVE_EXPORT_VISUAL_PASS (SoT16 §12).
 *
 * Run: pnpm tsx scripts/smoke-baseline-portrait-live-export.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { BASELINE_PORTRAIT_LIVE_EXPORT_CSS } from "@/lib/poju/baseline-portrait-live-export-css";
import {
  BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED,
  BASELINE_LIVE_EXPORT_VISUAL_PASS,
} from "@/lib/poju/baseline-portrait-live-export";

function main() {
  if (!BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED) {
    throw new Error("expected capture implementation flag true");
  }
  if (BASELINE_LIVE_EXPORT_VISUAL_PASS) {
    console.warn(
      "[smoke] VISUAL_PASS is true — download/email would unlock. Confirm f3c087f parity first.",
    );
  } else {
    console.log("[smoke] §12 gate: VISUAL_PASS=false (download/email stay disabled)");
  }
  if (BASELINE_PORTRAIT_LIVE_EXPORT_CSS.length < 50_000) {
    throw new Error("embedded CSS unexpectedly small");
  }
  if (!BASELINE_PORTRAIT_LIVE_EXPORT_CSS.includes("delivery-book-stage")) {
    throw new Error("embedded CSS missing delivery-book-stage");
  }
  if (!BASELINE_PORTRAIT_LIVE_EXPORT_CSS.includes("pcm")) {
    throw new Error("embedded CSS missing pcm");
  }

  const tempDir = join(process.cwd(), "temp");
  mkdirSync(tempDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="eastern-os-deliverable" content="baseline-profile-live-smoke-shell"/>
<title>Eastern OS · live export smoke shell (CSS only)</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"/>
<style>
${BASELINE_PORTRAIT_LIVE_EXPORT_CSS}
.smoke-banner {
  position: fixed; z-index: 9999; left: 12px; right: 12px; top: 12px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(20,16,30,0.92); border: 1px solid rgba(242,202,80,0.45);
  color: #f2ca50; font: 600 13px/1.4 system-ui, sans-serif;
}
</style>
</head>
<body>
  <div class="smoke-banner">
    SoT16 §11 smoke shell — real delivery-book-stage + pcm CSS embedded.
    Pane bodies are NOT included here; they come from browser createRoot
    (captureBaselinePortraitLiveHtml). §12: download/email disabled until visual pass.
    VISUAL_PASS=${String(BASELINE_LIVE_EXPORT_VISUAL_PASS)}.
  </div>
  <div class="delivery-book-stage" data-baseline="1" data-bootstrap="1" style="padding-top:64px">
    <div class="delivery-book-stage__shell">
      <header class="delivery-book-stage__chrome delivery-book-stage__chrome--header">
        <div class="delivery-book-stage__chrome-center">
          <span class="delivery-book-stage__header-logo-text">Eastern OS</span>
        </div>
      </header>
      <div class="delivery-book-stage__card" role="region" aria-label="smoke">
        <div class="delivery-book-stage__panes">
          <aside class="delivery-book-stage__left">
            <div class="delivery-book-stage__brand">
              <h1 class="delivery-book-stage__product-title">
                <span>个人基础画像</span>
                <span class="delivery-book-stage__product-title-line3">CSS smoke — not lookalike panes</span>
              </h1>
            </div>
            <nav class="delivery-book-stage__toc" aria-label="toc">
              <div class="delivery-book-stage__toc-head">Contents</div>
              <ol class="delivery-book-stage__toc-list">
                <li><button type="button" class="delivery-book-stage__toc-item delivery-book-stage__toc-item--active"><span class="delivery-book-stage__toc-num">01</span><span class="delivery-book-stage__toc-text"><span class="delivery-book-stage__toc-tag">B1</span><span class="delivery-book-stage__toc-title">Calibration (shell)</span></span></button></li>
              </ol>
            </nav>
          </aside>
          <section class="delivery-book-stage__right">
            <div class="delivery-book-stage__page-slots">
              <p style="color:#ccc;padding:24px">
                Open vault popup BaselinePortraitBook for visual truth (f3c087f).
                Live createRoot serialize writes full panes into the download HTML once §12 passes.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const out = join(tempDir, "eastern-os-baseline-profile-live-smoke-shell.html");
  writeFileSync(out, html, "utf8");
  console.log("[smoke] wrote", out);
  console.log("[smoke] css chars", BASELINE_PORTRAIT_LIVE_EXPORT_CSS.length);
}

main();
''', encoding="utf-8")
print("wrote smoke", smoke)

# Approach note in temp
note = Path(r"D:\POJU\pojulife\temp\SOT16-BASELINE-LIVE-EXPORT.md")
note.write_text("""# SoT16 §11 / §12 — Baseline live export

## Approach (preferred §11)
On download (client, when visual pass unlocks):
1. `createRoot` offscreen mount live `PojuEnergyMatrix` bodyOnly for each B1–B5
2. `createRoot` mount live `BaselinePortraitBook` for chrome shell
3. Inline real CSS (`baseline-portrait-live-export-css.ts` from delivery-book-stage.css + poju-celestial-matrix.css + workspace-scroll) plus live `document.styleSheets` rules
4. Inline same-origin `<img>` as data URLs
5. Assemble one self-contained HTML with vanilla TOC/pager
6. That string = download + email attachment

## §12 LOCK (current)
- `BASELINE_LIVE_EXPORT_VISUAL_PASS = false` in `lib/poju/baseline-portrait-live-export.ts`
- Vault modal download/email **disabled** with honest `export_live_pending` message
- Does **not** serve `buildBaselineProfileOfflineHtml` lookalike (Max-rejected)

## Vault
- Popup stays live React: `BaselinePortraitBook` / `DeliveryBookStage` / `PojuCompanionFrame`
- No lookalike iframes in vault

## Files
- `lib/poju/baseline-portrait-live-export.ts` — createRoot capture
- `lib/poju/baseline-portrait-live-export-css.ts` — embedded real CSS
- `components/workspace/WorkspaceDocVaultModal.tsx` — §12 disable + gated wire
- `lib/poju/baseline-profile-offline-html.ts` — TODO lookalike only; not shipped path
- `scripts/smoke-baseline-portrait-live-export.ts`
- `temp/eastern-os-baseline-profile-live-smoke-shell.html` (after smoke)

## No push
Work stays local on machine; do not push.
""", encoding="utf-8")
print("wrote note")
