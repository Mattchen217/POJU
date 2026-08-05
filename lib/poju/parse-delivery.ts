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
  if (/^目录$|^contents$|^índice$|^inhalt$|^sommaire$/i.test(t)) return "toc";
  if (/附录|appendix|apéndice|anhang|annexe/i.test(t)) return "appendix";

  const letter = t.match(/^([A-F])\b/i);
  if (letter) {
    const mapped = LEGACY_LETTER_TO_SEGMENT[letter[1]!.toUpperCase()];
    if (mapped) return mapped;
  }

  const lower = t.toLowerCase();
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const h = DELIVERY_SECTION_HEADINGS[k];
    for (const label of [h.zh, h.en, h.es, h.de, h.fr]) {
      const tip = label.split("·")[0]!.trim();
      if (t.includes(tip) || lower.includes(tip.toLowerCase())) return k;
    }
  }

  if (/序言|preface|sobre este informe|über diesen bericht|à propos de ce rapport/i.test(lower)) {
    return "preface";
  }
  if (/能量结构|energy structure|estructura energética|energiestruktur|structure énergétique|第一部分/i.test(lower)) {
    return "energy";
  }
  if (/处境|situation|diagnóstico|situationsdiagnose|diagnostic de situation|第二部分/i.test(lower)) {
    return "situation";
  }
  if (/抉择|crossroad|encrucijada|weggabelung|carrefour|第三部分/i.test(lower)) {
    return "crossroads";
  }
  if (/现代行动|action plan|plan de acción|aktionsplan|plan d'action|第四部分/i.test(lower)) {
    return "action";
  }
  if (/调频|retune|nachstimm|第五部分/i.test(lower)) return "retune";
  if (/节奏|rhythm|ritmo|rythme|30|第六部分/i.test(lower)) return "rhythm";
  if (/觉察|awareness|autoobservación|selbstwahrnehmung|auto-observation|第七部分/i.test(lower)) {
    return "awareness";
  }
  if (/结语|epilogue|sigue por tu cuenta|geh deinen eigenen|avancez par vous|独立走/i.test(lower)) {
    return "epilogue";
  }
  if (/能量决策报告|energy decision report|informe de decisión|entscheidungsbericht|rapport de décision/i.test(t)) {
    return "cover";
  }

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
