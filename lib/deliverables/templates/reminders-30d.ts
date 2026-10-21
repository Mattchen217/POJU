/**
 * Blank 30-day reminders deliverable HTML.
 * Book shell + TOC days 01–30 + day panes (empty = dashed card via blank preview / fill).
 * Mirrors templates/deliverables/reminders-30d.template.html
 */

import {
  BOOK_SHELL_CSS,
  BOOK_SHELL_JS,
} from "@/lib/deliverables/shared-book-assets";

const DAYS = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: `day_${n}`,
    num: n,
    tag: `D${n}`,
    toc: `SLOT_TOC_DAY_${n}`,
    body: `SLOT_DAY_${n}`,
  };
});

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

function dayPane(
  id: string,
  num: string,
  tocSlot: string,
  bodySlot: string,
  active: boolean,
): string {
  const activeClass = active ? " is-active" : "";
  const hidden = active ? "" : " hidden";
  return `<section class="delivery-book-stage__pane${activeClass}" data-slot-pane="${id}" id="pane-${id}" aria-label="Day ${num}"${hidden}>
  <h1 class="delivery-book-stage__page-title">{{${tocSlot}}}</h1>
  <p class="delivery-book-stage__page-subtitle">{{SLOT_SUBTITLE}}</p>
  <div class="day-card day-card--empty" data-day="${num}">
    <p class="day-card__label">Day ${num}</p>
    <div class="deliverable-slot" data-slot-name="${bodySlot}">{{${bodySlot}}}</div>
  </div>
</section>`;
}

export const REMINDERS_30D_TEMPLATE = `<!DOCTYPE html>
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
<div class="delivery-book-stage" data-deliverable="reminders-30d">
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
            <p class="delivery-book-stage__meta-question" title="{{SLOT_ANCHOR}}">{{SLOT_ANCHOR}}</p>
          </div>
          <nav class="delivery-book-stage__toc" aria-label="Days">
            <div class="delivery-book-stage__toc-head">
              <span class="delivery-book-stage__toc-head-rule" aria-hidden="true"></span>
              Days 01–30
            </div>
            <ol class="delivery-book-stage__toc-list">
              ${DAYS.map((d, i) => tocItem(d.id, d.num, d.tag, d.toc, i === 0)).join("\n              ")}
            </ol>
          </nav>
          <div class="delivery-book-stage__left-foot">
            <p>{{SLOT_READING_HINT}}</p>
            <p>{{SLOT_PRIVACY}}</p>
            <p>{{SLOT_DISCLAIMER}}</p>
          </div>
        </aside>
        <section class="delivery-book-stage__right">
          ${DAYS.map((d, i) => dayPane(d.id, d.num, d.toc, d.body, i === 0)).join("\n          ")}
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
