/**
 * Blank decision-report deliverable HTML (8 fixed panes).
 * Mirrors templates/deliverables/decision-report.template.html
 */

import {
  BOOK_SHELL_CSS,
  BOOK_SHELL_JS,
} from "@/lib/deliverables/shared-book-assets";

const PANES = [
  { id: "cover", num: "01", tag: "P0", toc: "SLOT_TOC_COVER", body: "SLOT_BODY_COVER" },
  { id: "decision_brief", num: "02", tag: "01", toc: "SLOT_TOC_DECISION_BRIEF", body: "SLOT_BODY_DECISION_BRIEF" },
  { id: "situation_analysis", num: "03", tag: "02", toc: "SLOT_TOC_SITUATION", body: "SLOT_BODY_SITUATION" },
  { id: "personal_decision_patterns", num: "04", tag: "03", toc: "SLOT_TOC_PATTERNS", body: "SLOT_BODY_PATTERNS" },
  { id: "bottleneck_analysis", num: "05", tag: "04", toc: "SLOT_TOC_BOTTLENECK", body: "SLOT_BODY_BOTTLENECK" },
  { id: "strategic_options", num: "06", tag: "05", toc: "SLOT_TOC_OPTIONS", body: "SLOT_BODY_OPTIONS" },
  { id: "recommended_strategy", num: "07", tag: "06", toc: "SLOT_TOC_STRATEGY", body: "SLOT_BODY_STRATEGY" },
  { id: "execution_guidance", num: "08", tag: "07", toc: "SLOT_TOC_EXECUTION", body: "SLOT_BODY_EXECUTION" },
  { id: "self_regulation", num: "09", tag: "08", toc: "SLOT_TOC_SELF_REG", body: "SLOT_BODY_SELF_REG" },
  { id: "validation_risk", num: "10", tag: "09a", toc: "SLOT_TOC_VALIDATION_RISK", body: "SLOT_BODY_VALIDATION_RISK" },
  { id: "validation_close", num: "11", tag: "09b", toc: "SLOT_TOC_VALIDATION_CLOSE", body: "SLOT_BODY_VALIDATION_CLOSE" },
  { id: "appendix", num: "12", tag: "A", toc: "SLOT_TOC_APPENDIX", body: "SLOT_BODY_APPENDIX" },
] as const;

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

function pane(
  id: string,
  tocSlot: string,
  bodySlot: string,
  active: boolean,
  extra = "",
): string {
  const activeClass = active ? " is-active" : "";
  const hidden = active ? "" : " hidden";
  return `<section class="delivery-book-stage__pane${activeClass}" data-slot-pane="${id}" id="pane-${id}" aria-label="{{${tocSlot}}}"${hidden}>
  <h1 class="delivery-book-stage__page-title">{{${tocSlot}}}</h1>
  ${extra}<div class="deliverable-slot" data-slot-name="${bodySlot}">{{${bodySlot}}}</div>
</section>`;
}

export const DECISION_REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="{{SLOT_LOCALE}}">
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
<div class="delivery-book-stage" data-deliverable="decision-report">
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
              <span class="delivery-book-stage__product-title-line3">{{SLOT_QUESTION}}</span>
            </h1>
          </div>
          <div class="delivery-book-stage__meta-card">
            <p class="delivery-book-stage__meta-question" title="{{SLOT_QUESTION}}">{{SLOT_QUESTION}}</p>
            <div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">◎</span>
                <span class="delivery-book-stage__meta-text">{{SLOT_PROFILE}}</span>
              </span>
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-icon" aria-hidden="true">文</span>
                <span class="delivery-book-stage__meta-text">{{SLOT_LOCALE}}</span>
              </span>
            </div>
            <div class="delivery-book-stage__meta-row">
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-text">{{SLOT_DATE}}</span>
              </span>
              <span class="delivery-book-stage__meta-cell">
                <span class="delivery-book-stage__meta-text">{{SLOT_REPORT_ID}}</span>
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
          ${PANES.map((p, i) =>
            pane(
              p.id,
              p.toc,
              p.body,
              i === 0,
              p.id === "cover"
                ? `<div class="delivery-audio" data-slot-name="SLOT_AUDIO_HTML">{{SLOT_AUDIO_HTML}}</div>\n  `
                : "",
            ),
          ).join("\n          ")}
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
