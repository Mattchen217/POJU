import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";
import { reflowParagraphList, type ReflowOptions } from "@/lib/reading/reflow-paragraphs";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";

const DELIVERY_REFLOW_OPTS: ReflowOptions = { maxChars: 72, maxSentences: 2 };

export type DeliverySectionType = DeliverySegmentKey;

export interface DeliverySection {
  type: DeliverySectionType;
  title: string;
  /** Full section body including evidence lead (for dualLayer RichReadingText). */
  body: string;
}

function splitSectionsByHeading(text: string): Array<{ title: string; body: string }> {
  const prepared = prepareReadingLayoutText(text).trim();
  if (!prepared) return [];
  const parts = prepared.split(/^##\s+/m).filter((p) => p.trim());
  const out: Array<{ title: string; body: string }> = [];
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
    if (!title) continue;
    out.push({ title, body });
  }
  return out;
}

export function guessDeliverySegmentKey(title: string): DeliverySegmentKey | null {
  const m = title.trim().match(/^([A-F])\b/i);
  if (m) return m[1]!.toUpperCase() as DeliverySegmentKey;
  const lower = title.toLowerCase();
  if (/处境|situation|回答问题|answer/.test(lower)) return "A";
  if (/抉择|crossroad|决策/.test(lower)) return "B";
  if (/行动|action|现代/.test(lower)) return "C";
  if (/调频|retune|能量/.test(lower)) return "D";
  if (/节奏|rhythm|30|提醒/.test(lower)) return "E";
  if (/锦囊|toolkit|自检|signal/.test(lower)) return "F";
  return null;
}

/**
 * Parse Phase 4 six-section delivery markdown (## A · …).
 * No legacy ═══ ANALYSIS fallback — old shape is retired.
 */
export function parseDeliveryContent(fullText: string): DeliverySection[] {
  const chunks = splitSectionsByHeading(fullText);
  const sections: DeliverySection[] = [];
  const used = new Set<DeliverySegmentKey>();

  for (const chunk of chunks) {
    const key = guessDeliverySegmentKey(chunk.title);
    if (!key || used.has(key)) continue;
    used.add(key);
    const body = reflowParagraphList(
      chunk.body.split(/\n\n+/).filter((p) => p.trim()),
      "body",
      DELIVERY_REFLOW_OPTS,
    ).join("\n\n");
    sections.push({
      type: key,
      title: chunk.title.replace(/^[A-F]\s*[·•.\-—–]\s*/i, "").trim() || chunk.title,
      body: body || chunk.body,
    });
  }

  // If heading parse failed entirely, treat whole text as A.
  if (sections.length === 0 && fullText.trim()) {
    sections.push({
      type: "A",
      title: "回答问题与处境洞察",
      body: fullText.trim(),
    });
  }

  // Stable A–F order
  sections.sort(
    (a, b) => DELIVERY_SEGMENT_KEYS.indexOf(a.type) - DELIVERY_SEGMENT_KEYS.indexOf(b.type),
  );
  return sections;
}

/**
 * Alias for tests / callers that previously used a separate fallback path.
 * Phase 4: only ## A–F parsing remains (legacy ═══ retired).
 */
export function parseDeliveryContentFallback(fullText: string): DeliverySection[] {
  return parseDeliveryContent(fullText);
}

/** @deprecated Prefer parseDeliveryContent — maps A–F into legacy field names for old scripts. */
export function parseDeliverySections(fullText: string): {
  opening: string;
  analysis: string;
  conclusion: string;
  whatToDo: string;
  comingBack: string;
} {
  const sections = parseDeliveryContent(fullText);
  const by = (k: DeliverySegmentKey) => sections.find((s) => s.type === k)?.body ?? "";
  return {
    opening: "",
    analysis: by("A"),
    conclusion: by("B"),
    whatToDo: by("C"),
    comingBack: [by("E"), by("F")].filter(Boolean).join("\n\n"),
  };
}
