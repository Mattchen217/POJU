/**
 * Phase-4 delivery book → ordered pages for the right-rail reader.
 */

import {
  parseDeliveryContent,
  type DeliverySection,
  type DeliverySectionType,
} from "@/lib/poju/parse-delivery";
import { DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";

export type DeliveryBookPageId = DeliverySectionType;

export type DeliveryBookPage = {
  id: DeliveryBookPageId;
  title: string;
  body: string;
  /** cover / toc are meta; prose uses dual-layer evidence. */
  dualLayer: boolean;
};

const PAGE_ORDER: readonly DeliveryBookPageId[] = [
  "cover",
  "toc",
  ...DELIVERY_SEGMENT_KEYS,
  "appendix",
] as const;

function dualLayerFor(id: DeliveryBookPageId): boolean {
  return id !== "cover" && id !== "toc" && id !== "appendix";
}

/**
 * Build pages in book order. Missing sections are skipped.
 * TOC body stays as model markdown; UI also builds a clickable index from page titles.
 */
export function buildDeliveryBookPages(fullText: string): DeliveryBookPage[] {
  const parsed = parseDeliveryContent(fullText);
  const byType = new Map<DeliverySectionType, DeliverySection>();
  for (const s of parsed) {
    if (!byType.has(s.type)) byType.set(s.type, s);
  }

  const pages: DeliveryBookPage[] = [];
  for (const id of PAGE_ORDER) {
    const sec = byType.get(id);
    if (!sec) continue;
    pages.push({
      id,
      title: sec.title?.trim() || id,
      body: sec.body?.trim() ?? "",
      dualLayer: dualLayerFor(id),
    });
  }
  return pages;
}

export function deliveryBookHasContent(fullText: string | null | undefined): boolean {
  return Boolean(fullText?.trim()) && buildDeliveryBookPages(fullText!).length > 0;
}
