from pathlib import Path
import re
path = Path(r"D:\POJU\pojulife\lib\poju\delivery-interactive-html.ts")
text = path.read_text(encoding="utf-8")

old_start = text.find("  return `<!DOCTYPE html>")
if old_start < 0:
    raise SystemExit("return template not found")
# find matching end of function - last `;\n} before EOF for this function
old_end = text.find("</html>`;\n}", old_start)
if old_end < 0:
    raise SystemExit("return end not found")
old_end = old_end + len("</html>`;\n}")

replacement = r'''  const metaCard = [
    metaQuestion,
    `<div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">`,
    metaProfile,
    `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">\u25a1</span><span class="delivery-book-stage__meta-text">${escapeHtml(reportDate)}</span></span>`,
    `</div>`,
    `<div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">`,
    `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">#</span><span class="delivery-book-stage__meta-text delivery-book-stage__meta-text--mono">${escapeHtml(reportId)}</span></span>`,
    `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">\u25ce</span><span class="delivery-book-stage__meta-text">${escapeHtml(localeDisplay(locale))}</span></span>`,
    `</div>`,
  ].join("\n");

  const leftFoot = `<p>${escapeHtml(readingHint)}</p><p>${escapeHtml(privacy)}</p><p>${escapeHtml(disclaimer)}</p>`;
  const closeLabel = opts?.closeLabel?.trim() || (zh ? "\u5173\u95ed" : "Close");
  const pageCount = prosePages.length || 1;

  return fillSlots(DECISION_REPORT_BLANK_TEMPLATE, {
    SLOT_LANG: langAttr(locale),
    SLOT_LOCALE_SHORT: zh ? "zh" : locale.slice(0, 2) || "en",
    SLOT_DOC_TITLE: escapeHtml(coverTitle),
    SLOT_EMBED: opts?.embed ? "1" : "0",
    SLOT_CLOSE_LABEL: escapeHtml(closeLabel),
    SLOT_CARD_ARIA: escapeHtml(coverTitle),
    SLOT_META_CARD: metaCard,
    SLOT_TOC_ARIA: escapeHtml(tocHead),
    SLOT_TOC_HEAD: escapeHtml(tocHead),
    SLOT_TOC_ITEMS: tocButtons,
    SLOT_LEFT_FOOT: leftFoot,
    SLOT_PANES: panes,
    SLOT_AUDIO_BLOCK: audioBlock,
    SLOT_FOOTER_ARIA: zh ? "\u7ffb\u9875" : "Pages",
    SLOT_PREV_LABEL: zh ? "\u4e0a\u4e00\u9875" : "Previous",
    SLOT_NEXT_LABEL: zh ? "\u4e0b\u4e00\u9875" : "Next",
    SLOT_PAGE_LABEL: `1 / ${pageCount}`,
  });
}

/** Alias — popup = file architecture name. */
export function buildDecisionReportOfflineHtml(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): string {
  return buildDeliveryInteractiveHtml(fullText, locale, opts);
}

/** Public download / email filename. */
export function decisionReportOfflineFilename(when: Date = new Date()): string {
  const d = when.toISOString().slice(0, 10);
  return `eastern-os-decision-report-${d}.html`;
}

/** Expose blank template for tests / smoke. */
export function getDecisionReportBlankTemplate(): string {
  return DECISION_REPORT_BLANK_TEMPLATE;
}
'''

text = text[:old_start] + replacement + text[old_end:]
# also update the offline HTML comment above build fn
text = text.replace(
    "/**\n * Offline HTML = the same fixed delivery card (shell + dual panes + dock).\n * Chapters switch inside the card; page does not reflow into a long document.\n */",
    "/**\n * Fill blank decision-report template from delivery fullText.\n * Output is one offline HTML document (same bytes for popup/download/email).\n */",
)

path.write_text(text, encoding="utf-8")
print("patched", len(text))
print("CARD refs", text.count("CARD_CSS"), text.count("CARD_JS"))
print("fillSlots call", "fillSlots(DECISION_REPORT_BLANK_TEMPLATE" in text)
print("filename export", "decisionReportOfflineFilename" in text)