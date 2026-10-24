/**
 * Eastern OS — 决策报告 offline HTML (popup = file).
 * Blank template (chrome/CSS/JS/icons) + slot fill from delivery text.
 * Same string for vault/shelf iframe srcDoc, download, and email attachment.
 *
 * Implementation lives in delivery-interactive-html (content builders) +
 * decision-report-html/blank-template (generated chrome).
 */
export {
  buildDeliveryInteractiveHtml as buildDecisionReportOfflineHtml,
  buildDeliveryInteractiveHtml,
  buildDecisionReportBlankOpenHtml,
  buildDecisionReportProgressiveHtml,
  decisionReportOfflineFilename,
  getDecisionReportBlankTemplate,
  type BuildDeliveryInteractiveHtmlOptions as BuildDecisionReportOfflineHtmlOptions,
  type BuildDeliveryInteractiveHtmlOptions,
  type DeliveryInteractiveHtmlMeta,
} from "@/lib/poju/delivery-interactive-html";
