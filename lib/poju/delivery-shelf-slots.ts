/**
 * Fixed 12-slot shelf order for Phase-4 center delivery papers.
 * cover → toc → 9 segments → appendix.
 *
 * User-facing page numbers (corner wait / pager) count only prose:
 * 「关于这份报告」= 1 … 附录 = 10. Cover + TOC are not pages.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryAppendixCopy,
  deliveryCoverCopy,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import {
  buildDeliveryBookPages,
  type DeliveryBookPage,
} from "@/lib/poju/delivery-book-pages";

export const DELIVERY_SHELF_SLOT_IDS = [
  "cover",
  "toc",
  ...DELIVERY_SEGMENT_KEYS,
  "appendix",
] as const;

export type DeliveryShelfSlotId = (typeof DELIVERY_SHELF_SLOT_IDS)[number];

export const DELIVERY_SHELF_SLOT_COUNT = DELIVERY_SHELF_SLOT_IDS.length;

/** Prose pages shown to the reader — excludes cover + TOC. */
export function isDeliveryProseShelfSlot(id: DeliveryShelfSlotId): boolean {
  return id !== "cover" && id !== "toc";
}

/** 1–10 for preface…appendix; 0 for cover/toc (not user-facing pages). */
export function deliveryProsePageNumber(slotId: DeliveryShelfSlotId): number {
  if (!isDeliveryProseShelfSlot(slotId)) return 0;
  let n = 0;
  for (const id of DELIVERY_SHELF_SLOT_IDS) {
    if (!isDeliveryProseShelfSlot(id)) continue;
    n += 1;
    if (id === slotId) return n;
  }
  return 0;
}

export type DeliveryShelfSlotState =
  | { kind: "empty"; slotId: DeliveryShelfSlotId; pageNumber: number }
  | { kind: "waiting"; slotId: DeliveryShelfSlotId; pageNumber: number }
  | {
      kind: "ready";
      slotId: DeliveryShelfSlotId;
      page: DeliveryBookPage;
      pageNumber: number;
    };

function defaultTitleForSlot(id: DeliveryShelfSlotId, locale: string): string {
  if (id === "cover") {
    const b = locale.toLowerCase();
    if (b.startsWith("zh")) return "封面";
    if (b.startsWith("es")) return "Portada";
    if (b.startsWith("de")) return "Titelseite";
    if (b.startsWith("fr")) return "Couverture";
    return "Cover";
  }
  if (id === "toc") return deliveryCoverCopy(locale).tocTitle;
  if (id === "appendix") return deliveryAppendixCopy(locale).heading;
  return deliverySectionHeading(id as DeliverySegmentKey, locale);
}

/**
 * Map streamed / persisted markdown onto 12 fixed slots.
 * Waiting occupies the first empty slot.
 * pageNumber = user-facing prose index (1–10), not cover/toc.
 */
export function buildDeliveryShelfSlots(
  fullText: string | null | undefined,
  opts: { locale: string; complete?: boolean },
): DeliveryShelfSlotState[] {
  const pages = fullText?.trim() ? buildDeliveryBookPages(fullText) : [];
  const slots: DeliveryShelfSlotState[] = DELIVERY_SHELF_SLOT_IDS.map((slotId) => ({
    kind: "empty" as const,
    slotId,
    pageNumber: deliveryProsePageNumber(slotId),
  }));

  const usedSlot = new Set<number>();

  for (const p of pages) {
    const typedIdx = DELIVERY_SHELF_SLOT_IDS.indexOf(p.id as DeliveryShelfSlotId);
    let idx =
      typedIdx >= 0 && !usedSlot.has(typedIdx)
        ? typedIdx
        : slots.findIndex((s, i) => s.kind === "empty" && !usedSlot.has(i));
    if (idx < 0) break;
    usedSlot.add(idx);
    const slotId = DELIVERY_SHELF_SLOT_IDS[idx]!;
    slots[idx] = {
      kind: "ready",
      slotId,
      pageNumber: deliveryProsePageNumber(slotId),
      page: {
        ...p,
        id: slotId,
        title: p.title || defaultTitleForSlot(slotId, opts.locale),
      },
    };
  }

  const readyCount = slots.filter((s) => s.kind === "ready").length;
  if (!opts.complete && readyCount < DELIVERY_SHELF_SLOT_COUNT) {
    const waitIdx = slots.findIndex((s) => s.kind === "empty");
    if (waitIdx >= 0) {
      const slotId = DELIVERY_SHELF_SLOT_IDS[waitIdx]!;
      slots[waitIdx] = {
        kind: "waiting",
        slotId,
        pageNumber: deliveryProsePageNumber(slotId),
      };
    }
  }

  return slots;
}

/**
 * Reader / TOC unlock: only consecutive ready prose from preface onward.
 * Later pages may already be buffered as ready, but stay locked until gaps fill.
 */
export function sequentialDeliveryProseReady(
  slots: DeliveryShelfSlotState[],
): Extract<DeliveryShelfSlotState, { kind: "ready" }>[] {
  const readyById = new Map<
    DeliveryShelfSlotId,
    Extract<DeliveryShelfSlotState, { kind: "ready" }>
  >();
  for (const s of slots) {
    if (s.kind === "ready") readyById.set(s.slotId, s);
  }
  const out: Extract<DeliveryShelfSlotState, { kind: "ready" }>[] = [];
  for (const id of DELIVERY_SHELF_SLOT_IDS) {
    if (!isDeliveryProseShelfSlot(id)) continue;
    const hit = readyById.get(id);
    if (!hit) break;
    out.push(hit);
  }
  return out;
}

/** First prose page not yet unlocked in sequential order (for corner wait). */
export function nextSequentialProseGap(
  slots: DeliveryShelfSlotState[],
): { slotId: DeliveryShelfSlotId; pageNumber: number } | null {
  const readyIds = new Set(
    slots.filter((s) => s.kind === "ready").map((s) => s.slotId),
  );
  for (const id of DELIVERY_SHELF_SLOT_IDS) {
    if (!isDeliveryProseShelfSlot(id)) continue;
    if (!readyIds.has(id)) {
      return { slotId: id, pageNumber: deliveryProsePageNumber(id) };
    }
  }
  return null;
}

export function shelfThumbKind(slotId: DeliveryShelfSlotId): "logo" | "toc" | "title" {
  if (slotId === "cover") return "logo";
  if (slotId === "toc") return "toc";
  return "title";
}

/**
 * Split "序言 · 关于这份报告" / "Part I · Your Energy Structure" for paper thumbs:
 * primary (larger, top) + secondary (bottom).
 */
export function splitShelfTitle(title: string): { primary: string; secondary?: string } {
  const raw = title.trim();
  if (!raw) return { primary: "" };
  const parts = raw.split(/\s*[·|]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0]!, secondary: parts.slice(1).join(" · ") };
  }
  return { primary: raw };
}

export { defaultTitleForSlot };
