/**
 * Eastern OS — 决策报告 offline HTML (popup = file).
 * Blank template (chrome/CSS/JS/icons) + slot fill from delivery text.
 * Same string for vault/shelf iframe srcDoc, download, and email attachment.
 */

import { fillDecisionReportHtml } from "@/lib/deliverables/fill-delivery";
import { DECISION_REPORT_TEMPLATE } from "@/lib/deliverables/templates/decision-report";
import {
  buildDeliveryInteractiveHtml,
  type BuildDeliveryInteractiveHtmlOptions,
  type DeliveryInteractiveHtmlMeta,
} from "@/lib/poju/delivery-interactive-html";

export type {
  BuildDeliveryInteractiveHtmlOptions,
  BuildDeliveryInteractiveHtmlOptions as BuildDecisionReportOfflineHtmlOptions,
  DeliveryInteractiveHtmlMeta,
};

export {
  buildDeliveryInteractiveHtml,
  buildDeliveryInteractiveHtml as buildDecisionReportOfflineHtml,
};

/** Public download / email filename. */
export function decisionReportOfflineFilename(when: Date = new Date()): string {
  const d = when.toISOString().slice(0, 10);
  return `eastern-os-decision-report-${d}.html`;
}

/** Expose blank template for tests / smoke. */
export function getDecisionReportBlankTemplate(): string {
  return DECISION_REPORT_TEMPLATE;
}

/**
 * Path C: open popup on blank chrome (empty bodies / generating placeholders),
 * then progressive fill by re-calling buildDeliveryInteractiveHtml as fullText grows.
 */
export function buildDecisionReportBlankOpenHtml(
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): string {
  return fillDecisionReportHtml("", locale, opts);
}

/** Progressive srcDoc: blank chrome when empty, else filled template from current fullText. */
export function buildDecisionReportProgressiveHtml(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): string {
  if (!(fullText || "").trim()) {
    return buildDecisionReportBlankOpenHtml(locale, opts);
  }
  return buildDeliveryInteractiveHtml(fullText, locale, opts);
}
