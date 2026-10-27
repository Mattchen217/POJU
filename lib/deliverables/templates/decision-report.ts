/**
 * Blank decision-report deliverable HTML.
 * Chapter order matches the shelf: cover, 01, 02, 04, 05, 06, (07), 08, 03.
 * 07 is inserted only when the topic gate is open.
 * Mirrors the default (no 07) pane list in templates/deliverables/decision-report.template.html.
 * SoT16 baseline-profile is a different template and is not built here.
 */

import {
  BOOK_SHELL_CSS,
  BOOK_SHELL_JS,
} from "@/lib/deliverables/shared-book-assets";
import { readingOrderForTopic } from "@/lib/llm/pro/delivery/decision-page-bridge";

export type DecisionReportPane = {
  id: string;
  num: string;
  tag: string;
  toc: string;
  body: string;
};

export function decisionReportPanes(topic?: string | null): DecisionReportPane[] {
  return ["cover", ...readingOrderForTopic(topic)].map((id, index) => {
    const num = String(index + 1).padStart(2, "0");
    if (id === "cover") {
      return { id, num, tag: "P0", toc: "SLOT_TOC_COVER", body: "SLOT_BODY_COVER" };
    }
    return { id, num, tag: id, toc: `SLOT_TOC_${id}`, body: `SLOT_BODY_${id}` };
  });
}

const DEFAULT_PANES = decisionReportPanes(null);

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

export function renderDecisionReportTemplate(topic?: string | null): string {
  const panes = topic == null || topic === "" ? DEFAULT_PANES : decisionReportPanes(topic);
  return renderDecisionReportHtml(panes);
}

function renderDecisionReportHtml(panes: readonly DecisionReportPane[]): string {
  return `<!DOCTYPE html>
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
              ${panes.map((p, i) => tocItem(p.id, p.num, p.tag, p.toc, i === 0)).join("\n              ")}
            </ol>
          </nav>
          <div class="delivery-book-stage__left-foot">
            <p>{{SLOT_READING_HINT}}</p>
            <p>{{SLOT_PRIVACY}}</p>
            <p>{{SLOT_DISCLAIMER}}</p>
          </div>
        </aside>
        <section class="delivery-book-stage__right">
          ${panes.map((p, i) =>
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
}

/** Default pack: 07 omitted. */
export const DECISION_REPORT_TEMPLATE = renderDecisionReportTemplate(null);
