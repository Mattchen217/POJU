/**
 * Heading → shelf face. Generation still guesses v1 keys.
 * The reader uses this so a section lands on 01–08, or on no face at all.
 */

import { readingOrderForTopic, resolveDecisionPage } from "@/lib/llm/pro/delivery/decision-page-bridge";
import { remapRowForLegacyKey } from "@/lib/llm/pro/delivery/page-id-remap";
import { deliveryTopicFromSignals } from "@/lib/llm/pro/delivery/slice-for-page";
import { composePage07Markdown } from "@/lib/llm/pro/delivery/page-07-face";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import { guessDeliverySegmentKey } from "@/lib/poju/parse-delivery";

const FACE_IDS = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "cover", "toc"]);

export function shelfFaceForHeading(title: string | null | undefined): string | null {
  const raw = (title ?? "").trim().replace(/^#+\s*/, "").trim();
  if (!raw) return null;
  if (/^目录$|^contents$|^índice$|^inhalt$|^sommaire$/i.test(raw)) return "toc";
  if (FACE_IDS.has(raw)) return raw;

  for (const schema of Object.values(DECISION_PAGE_SCHEMAS)) {
    if (raw.includes(schema.title)) return schema.pageId;
  }
  if (/场域与关系|场域判断/.test(raw)) return "07";

  const guessed = guessDeliverySegmentKey(title ?? "");
  if (!guessed || guessed === "thirty_day") return null;
  if (guessed === "cover" || guessed === "toc") return guessed;
  if (guessed === "appendix") return "03";
  return resolveDecisionPage(guessed)?.pageId ?? null;
}

export type ShelfFaceSection = { id: string; title: string; body: string };

/**
 * Fold H2 sections onto shelf faces in reading order.
 * A heading that is not a face stays after the faces. It is not poured into the next empty face.
 * 07 is composed from the page schema when the topic gate is open and the draft has no 07 section.
 */
export function groupDeliverySectionsByFace(
  sections: readonly { title: string; body: string }[],
  opts?: { topic?: string | null; question?: string | null },
): ShelfFaceSection[] {
  const topic = deliveryTopicFromSignals({ topic: opts?.topic, question: opts?.question });
  const buckets = new Map<string, { title: string; body: string }[]>();
  const unmapped: ShelfFaceSection[] = [];

  sections.forEach((section, index) => {
    const title = section.title.trim();
    const face =
      index === 0 && /^#\s+/.test(title) ? "cover" : shelfFaceForHeading(title);
    if (!face) {
      unmapped.push({ id: `unmapped-${index}`, title, body: section.body });
      return;
    }
    const list = buckets.get(face) ?? [];
    list.push(section);
    buckets.set(face, list);
    const guessed = guessDeliverySegmentKey(title);
    const feeds = guessed ? remapRowForLegacyKey(guessed)?.alsoFeeds ?? [] : [];
    for (const feed of feeds) {
      if (feed === face) continue;
      const extra = buckets.get(feed) ?? [];
      extra.push(section);
      buckets.set(feed, extra);
    }
  });

  const merge = (id: string, parts: readonly { title: string; body: string }[]): ShelfFaceSection => {
    if (parts.length === 1) {
      return { id, title: parts[0]!.title.replace(/^#+\s*/, "").trim() || id, body: parts[0]!.body };
    }
    const body = parts
      .map((part) => {
        const heading = part.title.replace(/^#+\s*/, "").trim();
        return heading ? `## ${heading}\n\n${part.body}` : part.body;
      })
      .filter((part) => part.trim())
      .join("\n\n");
    const schemaTitle =
      id === "cover" || id === "toc" ? parts[0]?.title ?? id : DECISION_PAGE_SCHEMAS[id as "01"]?.title;
    return { id, title: schemaTitle || id, body };
  };

  const out: ShelfFaceSection[] = [];
  for (const id of ["cover", "toc"] as const) {
    const parts = buckets.get(id);
    if (parts?.length) out.push(merge(id, parts));
  }
  for (const id of readingOrderForTopic(topic)) {
    const parts = buckets.get(id);
    if (parts?.length) {
      out.push(merge(id, parts));
      continue;
    }
    if (id === "07") {
      const composed = composePage07Markdown({ topic, question: opts?.question });
      if (composed) {
        const schema = DECISION_PAGE_SCHEMAS["07"];
        out.push({ id: "07", title: schema.title, body: composed });
      }
    }
  }
  return [...out, ...unmapped];
}
