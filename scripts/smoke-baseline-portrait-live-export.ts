/**
 * Smoke (SoT16 §11 live export scaffolding):
 * - Confirms embedded real CSS + capture module gates (text check; no browser)
 * - Writes temp/eastern-os-baseline-profile-live-smoke-shell.html
 *
 * Full pane serialize: browser `captureBaselinePortraitLiveHtml` (createRoot).
 * Download/email stay disabled until BASELINE_LIVE_EXPORT_VISUAL_PASS (§12).
 *
 * Run: pnpm tsx scripts/smoke-baseline-portrait-live-export.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { BASELINE_PORTRAIT_LIVE_EXPORT_CSS } from "@/lib/poju/baseline-portrait-live-export-css";

function main() {
  const exportSrc = readFileSync(
    join(process.cwd(), "lib/poju/baseline-portrait-live-export.ts"),
    "utf8",
  );
  if (!exportSrc.includes("export const BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED = true")) {
    throw new Error("expected BASELINE_LIVE_EXPORT_CAPTURE_IMPLEMENTED = true");
  }
  const visualPass = /export const BASELINE_LIVE_EXPORT_VISUAL_PASS = (true|false)/.exec(
    exportSrc,
  )?.[1];
  if (visualPass == null) {
    throw new Error("BASELINE_LIVE_EXPORT_VISUAL_PASS not found");
  }
  if (visualPass === "true") {
    console.warn(
      "[smoke] VISUAL_PASS is true — download/email would unlock. Confirm f3c087f parity first.",
    );
  } else {
    console.log("[smoke] §12 gate: VISUAL_PASS=false (download/email stay disabled)");
  }

  // SoT16 §14: offline layout must constrain PojuLogo without Tailwind
  for (const needle of [
    "buildOfflineExportLayoutCss",
    "normalizeOfflineImages",
    "waitForPaneReady",
    "waitForBookShellReady",
    "header-logo-link img",
    "BASELINE_LIVE_EXPORT_VISUAL_PASS = false",
  ]) {
    if (!exportSrc.includes(needle)) {
      throw new Error(`§14 export missing marker: ${needle}`);
    }
  }
  console.log("[smoke] §14 offline layout + wait-ready markers present; gate CLOSED");

  const modalSrc = readFileSync(
    join(process.cwd(), "components/workspace/WorkspaceDocVaultModal.tsx"),
    "utf8",
  );
  if (modalSrc.includes("buildBaselineProfileOfflineHtml(")) {
    throw new Error("vault modal must not call buildBaselineProfileOfflineHtml");
  }
  if (!modalSrc.includes("BASELINE_LIVE_EXPORT_VISUAL_PASS")) {
    throw new Error("vault modal missing live export gate");
  }
  if (!modalSrc.includes("baselineExportUnlocked")) {
    throw new Error("vault modal missing baselineExportUnlocked");
  }

  if (BASELINE_PORTRAIT_LIVE_EXPORT_CSS.length < 50_000) {
    throw new Error("embedded CSS unexpectedly small");
  }
  if (!BASELINE_PORTRAIT_LIVE_EXPORT_CSS.includes("delivery-book-stage")) {
    throw new Error("embedded CSS missing delivery-book-stage");
  }
  if (!BASELINE_PORTRAIT_LIVE_EXPORT_CSS.includes(".pcm")) {
    throw new Error("embedded CSS missing .pcm");
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
    Pane bodies require browser createRoot (captureBaselinePortraitLiveHtml).
    §12: download/email disabled until visual pass. VISUAL_PASS=${visualPass}.
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
                Vault popup BaselinePortraitBook is visual truth (f3c087f).
                Live createRoot serialize fills panes for download once §12 passes.
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
