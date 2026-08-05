/**
 * Phase-4 delivery book → ordered pages for the right-rail reader.
 *
 * **Same section split as center `DeliveryReportV2`** (`splitSections` on `##`).
 * Do not drop pages that fail typed-key guess — page count must match center sections.
 */

import { guessDeliverySegmentKey } from "@/lib/poju/parse-delivery";
import { splitSections } from "@/lib/poju/delivery-report-v2-split";

/** Typed keys when guessable; otherwise `sec-<index>` so every center section keeps a page. */
export type DeliveryBookPageId = string;

export type DeliveryBookPage = {
  id: DeliveryBookPageId;
  title: string;
  body: string;
  /** cover / toc / appendix are meta; prose uses dual-layer evidence. */
  dualLayer: boolean;
};

/**
 * Meta pages: no evidence fold — mirrors `DeliveryReportV2` `isMeta`.
 * Criterion: no `**依据与推理:**` / `**Evidence & reasoning:**` label in body
 * (backend transition segments never emit it; content segments always do).
 */
function isMetaPage(title: string, body: string, id: string): boolean {
  if (id === "cover" || id === "toc" || id === "appendix") return true;
  if (/^目录$|^contents$/i.test(title)) return true;
  if (/附录|appendix/i.test(title)) return true;
  const hasEvidenceLabel = /\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*/.test(body);
  return !hasEvidenceLabel;
}

/**
 * Build rail pages from the same H2 split the center chat uses.
 * 1 section in center = 1 page in rail (no fixed 12-slot skip).
 */
export function buildDeliveryBookPages(fullText: string): DeliveryBookPage[] {
  const sections = splitSections(fullText);
  const used = new Set<string>();
  const pages: DeliveryBookPage[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!;
    const rawTitle = sec.title.trim();
    const title = rawTitle.replace(/^#+\s*/, "").trim() || rawTitle;
    const body = sec.body?.trim() ?? "";

    const guessed = guessDeliverySegmentKey(rawTitle.startsWith("#") ? title : rawTitle);
    let id: string;
    if (i === 0 && (rawTitle.startsWith("#") || guessed === "cover")) {
      id = "cover";
    } else if (guessed && !used.has(guessed)) {
      id = guessed;
    } else {
      id = `sec-${i}`;
    }
    used.add(id);

    pages.push({
      id,
      title,
      body,
      dualLayer: !isMetaPage(title, body, id),
    });
  }

  return pages;
}

export function deliveryBookHasContent(fullText: string | null | undefined): boolean {
  return Boolean(fullText?.trim()) && buildDeliveryBookPages(fullText!).length > 0;
}
