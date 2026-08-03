/**
 * Fixed 12-slot shelf order for Phase-4 center delivery papers.
 * cover → toc → 9 segments → appendix.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
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
  const zh = locale.startsWith("zh");
  if (id === "cover") return zh ? "封面" : "Cover";
  if (id === "toc") return zh ? "目录" : "Contents";
  if (id === "appendix") {
    return zh ? "附录 · 命盘数据与术语" : "Appendix · Chart Data & Terms";
  }
  const h = DELIVERY_SECTION_HEADINGS[id as DeliverySegmentKey];
  return zh ? h.zh : h.en;
}

/**
 * Map streamed / persisted markdown onto 12 fixed slots.
 * Waiting occupies the first empty slot (pageNumber = that slot's 1-based index).
 */
export function buildDeliveryShelfSlots(
  fullText: string | null | undefined,
  opts: { locale: string; complete?: boolean },
): DeliveryShelfSlotState[] {
  const pages = fullText?.trim() ? buildDeliveryBookPages(fullText) : [];
  const slots: DeliveryShelfSlotState[] = DELIVERY_SHELF_SLOT_IDS.map((slotId, i) => ({
    kind: "empty" as const,
    slotId,
    pageNumber: i + 1,
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
      pageNumber: idx + 1,
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
        pageNumber: waitIdx + 1,
      };
    }
  }

  return slots;
}

export function shelfThumbKind(slotId: DeliveryShelfSlotId): "logo" | "toc" | "title" {
  if (slotId === "cover") return "logo";
  if (slotId === "toc") return "toc";
  return "title";
}

export { defaultTitleForSlot };
