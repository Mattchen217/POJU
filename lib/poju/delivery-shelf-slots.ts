/**
 * Reader shelf. cover → toc → 01 → 02 → 04 → 05 → 06 → (07) → 08 → 03.
 *
 * 07 is inserted only when the topic is 换场 / 迁移 / 合伙 / 亲密 / joint.
 * Cover and TOC are not prose pages. 03 is the package-end appendix.
 * Internal generators still use v1 segment keys; those papers fold onto these faces.
 */

import {
  readingOrderForTopic,
  resolveDecisionPage,
} from "@/lib/llm/pro/delivery/decision-page-bridge";
import { composePage07Markdown } from "@/lib/llm/pro/delivery/page-07-face";
import { remapRowForLegacyKey } from "@/lib/llm/pro/delivery/page-id-remap";
import { decisionFaceKicker } from "@/lib/llm/pro/delivery/page-schema/face-kicker";
import { shelfFaceForHeading } from "@/lib/llm/pro/delivery/shelf-face-map";
import { deliveryTopicFromSignals } from "@/lib/llm/pro/delivery/slice-for-page";
import { guessDeliverySegmentKey } from "@/lib/poju/parse-delivery";
import { deliveryCoverCopy } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  buildDeliveryBookPages,
  type DeliveryBookPage,
} from "@/lib/poju/delivery-book-pages";
import { extractPageSchemaFromMarkdown } from "@/lib/llm/pro/delivery/page-schema/render";
import { stripShapeExampleChrome } from "@/lib/llm/pro/delivery/display-chrome-strip";

/** Default reader order. 07 is absent until a topic asks for it. */
export const DELIVERY_SHELF_SLOT_IDS = [
  "cover",
  "toc",
  "01",
  "02",
  "04",
  "05",
  "06",
  "08",
  "03",
] as const;

export type DeliveryShelfSlotId = (typeof DELIVERY_SHELF_SLOT_IDS)[number] | "07";

export const DELIVERY_SHELF_SLOT_COUNT = DELIVERY_SHELF_SLOT_IDS.length;

/** Shelf order for this topic. 07 sits between 06 and 08 only when the topic gate opens. */
export function deliveryShelfSlotIds(topic?: string | null): readonly DeliveryShelfSlotId[] {
  return ["cover", "toc", ...readingOrderForTopic(topic)];
}

/** Prose pages shown to the reader — excludes cover + TOC. */
export function isDeliveryProseShelfSlot(id: DeliveryShelfSlotId): boolean {
  return id !== "cover" && id !== "toc";
}

/** 1…N along the active shelf. 0 for cover/toc, or when the id is not on this shelf. */
export function deliveryProsePageNumber(
  slotId: DeliveryShelfSlotId,
  order: readonly DeliveryShelfSlotId[] = DELIVERY_SHELF_SLOT_IDS,
): number {
  if (!isDeliveryProseShelfSlot(slotId)) return 0;
  let n = 0;
  for (const id of order) {
    if (!isDeliveryProseShelfSlot(id)) continue;
    n += 1;
    if (id === slotId) return n;
  }
  return 0;
}

function asShelfFace(id: string | null): DeliveryShelfSlotId | null {
  if (
    id === "cover" ||
    id === "toc" ||
    id === "01" ||
    id === "02" ||
    id === "03" ||
    id === "04" ||
    id === "05" ||
    id === "06" ||
    id === "07" ||
    id === "08"
  ) {
    return id;
  }
  return null;
}

function shelfFaceForSourceId(id: string): DeliveryShelfSlotId | null {
  if (id === "cover" || id === "toc") return id;
  if (id === "appendix") return "03";
  const route = resolveDecisionPage(id);
  return asShelfFace(route?.pageId ?? null);
}

function shelfFaceForPage(page: DeliveryBookPage): DeliveryShelfSlotId | null {
  return shelfFaceForSourceId(page.id) ?? asShelfFace(shelfFaceForHeading(page.title));
}

function alsoFeedFaces(page: DeliveryBookPage): DeliveryShelfSlotId[] {
  const key = remapRowForLegacyKey(page.id) ? page.id : guessDeliverySegmentKey(page.title);
  const feeds = key ? remapRowForLegacyKey(key)?.alsoFeeds ?? [] : [];
  return feeds.flatMap((id) => {
    const face = asShelfFace(id);
    return face ? [face] : [];
  });
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
  return decisionFaceKicker(id, locale);
}

function proseShelfTitle(
  slotId: DeliveryShelfSlotId,
  body: string,
  locale: string,
): string {
  if (!isDeliveryProseShelfSlot(slotId) || slotId === "03") {
    return defaultTitleForSlot(slotId, locale);
  }
  const schema = extractPageSchemaFromMarkdown(body);
  if (schema && "page_title" in schema && typeof schema.page_title === "string") {
    const t = stripShapeExampleChrome(schema.page_title);
    if (t) return t;
  }
  return defaultTitleForSlot(slotId, locale);
}

/**
 * Map streamed / persisted markdown onto fixed slots.
 * Waiting occupies the first empty slot.
 * pageNumber = user-facing prose index (1–7), not cover/toc.
 */
function mergeShelfBodies(pages: readonly DeliveryBookPage[]): string {
  if (pages.length === 1) return pages[0]?.body ?? "";
  return pages
    .map((page) => {
      const heading = page.title.trim();
      return heading ? `## ${heading}\n\n${page.body}` : page.body;
    })
    .filter((part) => part.trim())
    .join("\n\n");
}

export function buildDeliveryShelfSlots(
  fullText: string | null | undefined,
  opts: { locale: string; complete?: boolean; topic?: string | null; question?: string | null },
): DeliveryShelfSlotState[] {
  const topic = deliveryTopicFromSignals({ topic: opts.topic, question: opts.question });
  const order = deliveryShelfSlotIds(topic);
  const pages = fullText?.trim() ? buildDeliveryBookPages(fullText) : [];
  const slots: DeliveryShelfSlotState[] = order.map((slotId) => ({
    kind: "empty" as const,
    slotId,
    pageNumber: deliveryProsePageNumber(slotId, order),
  }));
  const buckets = new Map<DeliveryShelfSlotId, DeliveryBookPage[]>();

  for (const page of pages) {
    const face = shelfFaceForPage(page);
    if (face && order.includes(face)) {
      const list = buckets.get(face) ?? [];
      list.push(page);
      buckets.set(face, list);
    }
    for (const extra of alsoFeedFaces(page)) {
      if (extra === face || !order.includes(extra)) continue;
      const list = buckets.get(extra) ?? [];
      list.push(page);
      buckets.set(extra, list);
    }
  }

  for (let i = 0; i < slots.length; i++) {
    const slotId = order[i]!;
    const grouped = buckets.get(slotId);
    if (!grouped?.length) continue;
    const body = mergeShelfBodies(grouped);
    const dualLayer = grouped.some((page) => page.dualLayer);
    slots[i] = {
      kind: "ready",
      slotId,
      pageNumber: deliveryProsePageNumber(slotId, order),
      page: {
        id: slotId,
        title: isDeliveryProseShelfSlot(slotId)
          ? proseShelfTitle(slotId, body, opts.locale)
          : grouped[0]?.title || defaultTitleForSlot(slotId, opts.locale),
        body,
        dualLayer,
      },
    };
  }

  const page07 = composePage07Markdown({ topic, question: opts.question });
  if (page07 && order.includes("07")) {
    const idx = order.indexOf("07");
    const current = slots[idx];
    if (current && current.kind !== "ready") {
      slots[idx] = {
        kind: "ready",
        slotId: "07",
        pageNumber: deliveryProsePageNumber("07", order),
        page: {
          id: "07",
          title: proseShelfTitle("07", page07, opts.locale),
          body: page07,
          dualLayer: true,
        },
      };
    }
  }

  const readyCount = slots.filter((s) => s.kind === "ready").length;
  if (!opts.complete && readyCount < order.length) {
    // Progressive unlock: all remaining empty prose slots show as waiting skeleton
    // (not a single blank spinner). Cover/toc stay empty until written.
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      if (s.kind !== "empty") continue;
      if (!isDeliveryProseShelfSlot(s.slotId)) continue;
      slots[i] = {
        kind: "waiting",
        slotId: s.slotId,
        pageNumber: deliveryProsePageNumber(s.slotId, order),
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
  const out: Extract<DeliveryShelfSlotState, { kind: "ready" }>[] = [];
  for (const slot of slots) {
    if (!isDeliveryProseShelfSlot(slot.slotId)) continue;
    if (slot.kind !== "ready") break;
    out.push(slot);
  }
  return out;
}

/** First prose page not yet unlocked in sequential order (for corner wait). */
export function nextSequentialProseGap(
  slots: DeliveryShelfSlotState[],
): { slotId: DeliveryShelfSlotId; pageNumber: number } | null {
  for (const slot of slots) {
    if (!isDeliveryProseShelfSlot(slot.slotId)) continue;
    if (slot.kind !== "ready") {
      return { slotId: slot.slotId, pageNumber: slot.pageNumber };
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

export {
  primaryShelfKeyForPage,
  readingOrderForTopic,
  resolveDecisionPage,
  shelfKeysForPage,
} from "@/lib/llm/pro/delivery/decision-page-bridge";
