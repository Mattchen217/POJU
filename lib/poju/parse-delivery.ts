import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";
import { reflowParagraphList, type ReflowOptions } from "@/lib/reading/reflow-paragraphs";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
  LEGACY_LETTER_TO_SEGMENT,
} from "@/lib/llm/pro/delivery/delivery-schema";

const DELIVERY_REFLOW_OPTS: ReflowOptions = { maxChars: 72, maxSentences: 2 };

export type DeliverySectionType = DeliverySegmentKey | "cover" | "toc" | "appendix";

export interface DeliverySection {
  type: DeliverySectionType;
  title: string;
  body: string;
}

function reflowBody(body: string): string {
  return reflowParagraphList(
    body.split(/\n\n+/).filter((p) => p.trim()),
    "body",
    DELIVERY_REFLOW_OPTS,
  ).join("\n\n");
}

function splitH2Sections(text: string): Array<{ title: string; body: string }> {
  const prepared = prepareReadingLayoutText(text).trim();
  if (!prepared) return [];
  const parts = prepared.split(/^##\s+/m).filter((p) => p.trim());
  const out: Array<{ title: string; body: string }> = [];
  for (const part of parts) {
    // Drop leading H1 cover chunk (no ## yet)
    if (part.startsWith("# ")) continue;
    const nl = part.indexOf("\n");
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
    if (!title) continue;
    out.push({ title, body });
  }
  return out;
}

function extractCover(text: string): DeliverySection | null {
  const prepared = prepareReadingLayoutText(text).trim();
  const m = prepared.match(/^#\s+([^\n]+)\n([\s\S]*?)(?=^##\s+)/m);
  if (!m) return null;
  return {
    type: "cover",
    title: m[1]!.trim(),
    body: m[2]!.trim(),
  };
}

export function guessDeliverySegmentKey(title: string): DeliverySectionType | null {
  const t = title.trim();
  if (/^目录$|^contents$/i.test(t)) return "toc";
  if (/附录|appendix/i.test(t)) return "appendix";

  const letter = t.match(/^([A-F])\b/i);
  if (letter) {
    const mapped = LEGACY_LETTER_TO_SEGMENT[letter[1]!.toUpperCase()];
    if (mapped) return mapped;
  }

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const zh = DELIVERY_SECTION_HEADINGS[k].zh;
    const en = DELIVERY_SECTION_HEADINGS[k].en;
    if (t.includes(zh.split("·")[0]!.trim()) || t.includes(en.split("·")[0]!.trim())) {
      return k;
    }
  }

  const lower = t.toLowerCase();
  if (/序言|preface|关于这份报告/.test(lower)) return "preface";
  if (/能量结构|energy structure|第一部分/.test(lower)) return "energy";
  if (/处境|situation|诊断|第二部分/.test(lower)) return "situation";
  if (/抉择|crossroad|第三部分/.test(lower)) return "crossroads";
  if (/现代行动|action plan|第四部分/.test(lower)) return "action";
  if (/调频|retune|第五部分/.test(lower)) return "retune";
  if (/节奏|rhythm|30|第六部分/.test(lower)) return "rhythm";
  if (/觉察|awareness|锦囊|toolkit|第七部分/.test(lower)) return "awareness";
  if (/结语|epilogue|独立走/.test(lower)) return "epilogue";
  if (/能量决策报告|energy decision report/i.test(t)) return "cover";

  return null;
}

export type ParseDeliveryOptions = {
  /**
   * Sentence reflow for legacy bubble layout. Default true.
   * Right-rail book / v2 dual-layer must use `false` — reflow inserts `\n\n`
   * inside evidence and breaks `splitSectionBlocks` (body swallowed into 依据).
   */
  reflow?: boolean;
};

export function parseDeliveryContent(
  fullText: string,
  opts?: ParseDeliveryOptions,
): DeliverySection[] {
  const doReflow = opts?.reflow !== false;
  const sections: DeliverySection[] = [];
  const used = new Set<string>();

  const cover = extractCover(fullText);
  if (cover) {
    sections.push({
      ...cover,
      body: doReflow ? reflowBody(cover.body) || cover.body : cover.body,
    });
    used.add("cover");
  }

  for (const chunk of splitH2Sections(fullText)) {
    const key = guessDeliverySegmentKey(chunk.title);
    if (!key || used.has(key)) continue;
    used.add(key);
    sections.push({
      type: key,
      title:
        chunk.title
          .replace(/^[A-F]\s*[·•.\-—–]\s*/i, "")
          .trim() || chunk.title,
      body: doReflow ? reflowBody(chunk.body) || chunk.body : chunk.body,
    });
  }

  if (sections.length === 0 && fullText.trim()) {
    sections.push({
      type: "situation",
      title: "处境深度剖析",
      body: fullText.trim(),
    });
  }

  const order = ["cover", "toc", ...DELIVERY_SEGMENT_KEYS, "appendix"] as const;
  sections.sort(
    (a, b) =>
      order.indexOf(a.type as (typeof order)[number]) -
      order.indexOf(b.type as (typeof order)[number]),
  );
  return sections;
}

export function parseDeliveryContentFallback(fullText: string): DeliverySection[] {
  return parseDeliveryContent(fullText);
}

/** @deprecated Prefer parseDeliveryContent */
export function parseDeliverySections(fullText: string): {
  opening: string;
  analysis: string;
  conclusion: string;
  whatToDo: string;
  comingBack: string;
} {
  const sections = parseDeliveryContent(fullText);
  const by = (k: DeliverySectionType) => sections.find((s) => s.type === k)?.body ?? "";
  return {
    opening: by("preface"),
    analysis: by("situation") || by("energy"),
    conclusion: by("crossroads"),
    whatToDo: by("action"),
    comingBack: by("rhythm") || by("awareness"),
  };
}
