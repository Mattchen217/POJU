/**
 * Collect unique gold terms from delivery evidence layers (order of first appearance).
 * Used by appendix page (in-app + offline HTML) — soft label + gloss, locale-aware.
 */

import { glossOf, pojuTermBySlug, termOf } from "@/lib/glossary/pojulife-terms";
import { toGlossaryLocale } from "@/lib/glossary/term-glossary";
import { termPolarityById, type TermPolarity } from "@/lib/glossary/term-polarity";
import { deliveryAppendixCopy } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  parseTermMarkers,
  plainByTermId,
  prepareTextForGlossaryRender,
  uiTermById,
} from "@/lib/llm/sanitize/term-marking";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
import { splitSectionBlocks } from "@/lib/poju/delivery-report-v2-split";

export type DeliveryEvidenceTerm = {
  id: string;
  soft: string;
  /** Closed-set traditional Han (真词); may equal soft for some locales. */
  traditional: string;
  gloss: string;
  polarity: TermPolarity;
};

/** True when appendix body is only the merge-time empty placeholder (any locale). */
export function isDeliveryAppendixEmptyPlaceholder(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  for (const loc of ["zh", "en", "es", "de", "fr"] as const) {
    if (t === deliveryAppendixCopy(loc).emptyBody.trim()) return true;
  }
  return (
    /No structured chart attached/i.test(t) ||
    /未附硬数据表/.test(t) ||
    /No se adjunta carta estructurada/i.test(t) ||
    /Keine strukturierte Karte/i.test(t) ||
    /Aucune carte structurée/i.test(t)
  );
}

function evidenceBlobsFromFullText(fullText: string): string[] {
  const pages = buildDeliveryBookPages(fullText);
  const blobs: string[] = [];
  for (const page of pages) {
    if (page.id === "cover" || page.id === "toc" || page.id === "appendix") continue;
    if (!page.dualLayer) continue;
    for (const blk of splitSectionBlocks(page.body)) {
      if (blk.kind === "evidence" && blk.text.trim()) blobs.push(blk.text);
    }
  }
  return blobs;
}

/**
 * Scan all evidence folds → unique term ids in first-seen order, with soft + gloss.
 */
export function formatEvidenceTermLabel(term: Pick<DeliveryEvidenceTerm, "soft" | "traditional">): string {
  const soft = term.soft.trim();
  const trad = term.traditional.trim();
  if (!trad || trad === soft) return soft;
  return `${soft}（${trad}）`;
}

export function collectDeliveryEvidenceTerms(
  fullText: string,
  locale: string,
): DeliveryEvidenceTerm[] {
  if (!fullText?.trim()) return [];
  const glossaryLocale = toGlossaryLocale(locale);
  const seen = new Set<string>();
  const out: DeliveryEvidenceTerm[] = [];

  for (const blob of evidenceBlobsFromFullText(fullText)) {
    const prepared = prepareTextForGlossaryRender(blob, locale);
    for (const m of parseTermMarkers(prepared)) {
      const id = m.id.trim();
      if (!id || seen.has(id)) continue;
      const ui = uiTermById(id, glossaryLocale);
      const soft = (termOf(id, glossaryLocale) || ui?.soft || m.visible || id).trim();
      if (!soft) continue;
      const gloss = (
        glossOf(id, glossaryLocale) ||
        ui?.plain ||
        plainByTermId(id, glossaryLocale) ||
        ""
      ).trim();
      seen.add(id);
      const traditional = (pojuTermBySlug(id)?.traditional ?? "").trim();
      out.push({
        id,
        soft,
        traditional,
        gloss,
        polarity: ui?.polarity ?? termPolarityById(id),
      });
    }
  }

  return out;
}
