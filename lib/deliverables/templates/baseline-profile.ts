/**
 * Blank baseline-profile deliverable HTML (B1–B5).
 * Mirrors templates/deliverables/baseline-profile.template.html
 */

import {
  BOOK_SHELL_CSS,
  BOOK_SHELL_JS,
} from "@/lib/deliverables/shared-book-assets";

const EMPTY_BODY = `<p class="slot-empty">—</p>`;

function pane(
  id: string,
  tocSlot: string,
  bodySlot: string,
  active: boolean,
): string {
  const activeClass = active ? " is-active" : "";
  const hidden = active ? "" : " hidden";
  return `<section class="delivery-book-stage__pane${activeClass}" data-slot-pane="${id}" id="pane-${id}" aria-label="{{${tocSlot}}}"${hidden}>
  <h1 class="delivery-book-stage__page-title">{{${tocSlot}}}</h1>
  <div class="deliverable-slot" data-slot-name="${bodySlot}">{{${bodySlot}}}</div>
</section>`;
}

function tocItem(
  id: string,
  num: string,
  tag: string,
  tocSlot: string,
  active: boolean,
): string {
  const stateClass = active
    ? " delivery-book-stage__toc-item--active is-active"
    : " delivery-book-stage__toc-item--ready";
  return `<li><button type="button" class="delivery-book-stage__toc-item${stateClass}" data-slot="${id}"><span class="delivery-book-stage__toc-num">${num}</span><span class="delivery-book-stage__toc-text"><span class="delivery-book-stage__toc-tag">${tag}</span><span class="delivery-book-stage__toc-title">{{${tocSlot}}}</span></span></button></li>`;
}

const PANES = [
  { id: "calibration", num: "01", tag: "B1", toc: "SLOT_TOC_1", body: "SLOT_BODY_CALIBRATION" },
  { id: "energy", num: "02", tag: "B2", toc: "SLOT_TOC_2", body: "SLOT_BODY_ENERGY" },
  { id: "trajectory", num: "03", tag: "B3", toc: "SLOT_TOC_3", body: "SLOT_BODY_TRAJECTORY" },
  { id: "markers", num: "04", tag: "B4", toc: "SLOT_TOC_4", body: "SLOT_BODY_MARKERS" },
  { id: "core", num: "05", tag: "B5", toc: "SLOT_TOC_5", body: "SLOT_BODY_CORE" },
] as const;

/** Empty-body marker for callers filling blank baselines. */
export const BASELINE_EMPTY_BODY = EMPTY_BODY;

export const BASELINE_PROFILE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{SLOT_LANG}}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>{{SLOT_TITLE}}</title>
<style>
${BOOK_SHELL_CSS}
</style>
</head>
<body>
<div class="delivery-book-stage" data-deliverable="baseline-profile">
  <div class="delivery-book-stage__shell">
    <header class="delivery-book-stage__chrome delivery-book-stage__chrome--header" aria-label="Eastern OS">
      <div class="delivery-book-stage__chrome-left" aria-hidden="true"></div>
      <div class="delivery-book-stage__chrome-center">
        <span class="delivery-book-stage__header-logo-text">Eastern OS</span>
      </div>
      <div class="delivery-book-stage__chrome-right" aria-hidden="true"></div>
    </header>
    <div class="delivery-book-stage__card" role="region" aria-label="{{SLOT_TITLE}}">
      <div class="delivery-book-stage__panes">
        <aside class="delivery-book-stage__left">
          <div class="delivery-book-stage__brand">
            <h1 class="delivery-book-stage__product-title">
              <span>{{SLOT_TITLE}}</span>
              <span class="delivery-book-stage__product-title-line3">{{SLOT_SUBTITLE}}</span>
            </h1>
          </div>
          <div class="delivery-book-stage__meta-card">
            <p class="delivery-book-stage__meta-question" title="{{SLOT_META_BORN}}">{{SLOT_META_BORN}}</p>
            <div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">◎</span>
                <span class="delivery-book-stage__meta-text">{{SLOT_META_PLACE}}</span>
              </span>
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">文</span>
                <span class="delivery-book-stage__meta-text">{{SLOT_META_LOCALE}}</span>
              </span>
            </div>
          </div>
          <nav class="delivery-book-stage__toc" aria-label="Contents">
            <div class="delivery-book-stage__toc-head">
              <span class="delivery-book-stage__toc-head-rule" aria-hidden="true"></span>
              Contents
            </div>
            <ol class="delivery-book-stage__toc-list">
              ${PANES.map((p, i) => tocItem(p.id, p.num, p.tag, p.toc, i === 0)).join("\n              ")}
            </ol>
          </nav>
          <div class="delivery-book-stage__left-foot">
            <p>{{SLOT_READING_HINT}}</p>
            <p>{{SLOT_PRIVACY}}</p>
            <p>{{SLOT_DISCLAIMER}}</p>
          </div>
        </aside>
        <section class="delivery-book-stage__right">
          ${PANES.map((p, i) => pane(p.id, p.toc, p.body, i === 0)).join("\n          ")}
        </section>
      </div>
    </div>
    <footer class="delivery-book-stage__chrome delivery-book-stage__chrome--footer" role="navigation" aria-label="Pager">
      <div class="delivery-book-stage__chrome-left" aria-hidden="true"></div>
      <div class="delivery-book-stage__chrome-center"></div>
      <div class="delivery-book-stage__chrome-right">
        <div class="delivery-book-stage__pager">
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-prev" aria-label="Previous">‹</button>
          <span class="delivery-book-stage__pager-pos" id="dib-page-label">{{SLOT_PAGE_LABEL}}</span>
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-next" aria-label="Next">›</button>
        </div>
      </div>
    </footer>
  </div>
</div>
<script type="application/json" id="gloss-data">{{SLOT_GLOSSARY_JSON}}</script>
<script>
${BOOK_SHELL_JS}
</script>
</body>
</html>
`;
