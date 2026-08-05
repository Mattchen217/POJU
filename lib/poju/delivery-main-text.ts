/**
 * Body-only plain text from a Phase-4 delivery book (no evidence folds).
 * Used by future TTS and any export that must not speak the evidence layer.
 */

import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import { DELIVERY_EVIDENCE_LABEL_PLAINS } from "@/lib/llm/pro/delivery/delivery-locale";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";

/**
 * Extract compliant plain text from section bodies only (evidence omitted).
 * Pages are joined with blank lines; modules within a page with single newlines.
 */
export function extractDeliveryMainText(fullText: string, locale: string): string {
  const pages = buildDeliveryBookPages(fullText);
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (page.id === "cover" || page.id === "toc") continue;

    const modules = buildDeliveryBookModules({
      pageTitle: page.title,
      body: page.body,
      dualLayer: page.dualLayer,
      pageIndex: i,
    });

    for (const mod of modules) {
      const body = mod.body.trim();
      if (!body) continue;
      const plain = toCompliantPlainText(body, locale).trim();
      if (plain) chunks.push(plain);
    }
  }

  return chunks.join("\n\n").trim();
}

/** True when text still contains an evidence lead label (should not appear in main text). */
export function deliveryMainTextContainsEvidenceLead(text: string): boolean {
  const lower = text.toLowerCase();
  return DELIVERY_EVIDENCE_LABEL_PLAINS.some((label) =>
    lower.includes(label.toLowerCase()),
  );
}
