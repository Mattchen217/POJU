import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";
import { reflowParagraphList, type ReflowOptions } from "@/lib/reading/reflow-paragraphs";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
  LEGACY_LETTER_TO_SEGMENT,
  resolveDeliverySegmentKey,
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

  // New 9-page patterns
  if (/能量底座|黄金直答|energy base|direct answer|第一部分|Part I\b/i.test(lower)) {
    return "energy_base";
  }
  if (/先天潜能|十神图谱|talent map|ten gods|第二部分|Part II\b/i.test(lower)) {
    return "talent_map";
  }
  if (/天赋助力|神煞|能量阶段|spirit gifts|第三部分|Part III\b/i.test(lower)) {
    return "spirit_gifts";
  }
  if (/宏观周期|战略窗口|macro cycle|strategic window|第四部分|Part IV\b/i.test(lower)) {
    return "macro_cycle";
  }
  if (/科学实操|science action|modern action|第五部分|Part V\b/i.test(lower)) {
    return "science_action";
  }
  if (/玄学实操|metaphysics|调频|retune|方位|第六部分|Part VI\b/i.test(lower)) {
    return "metaphysics_action";
  }
  if (/30\s*天|双轨|thirty.?day|rhythm|第七部分|Part VII\b/i.test(lower)) {
    return "thirty_day";
  }
  if (/避坑|红线|预警|risk.?guard|red line|第八部分|Part VIII\b/i.test(lower)) {
    return "risk_guard";
  }
  if (/正向信号|收尾|signals.?close|positive signal|第九部分|Part IX\b/i.test(lower)) {
    return "signals_close";
  }

  // Legacy book headings → current keys
  if (/序言|preface|关于这份报告|sobre este informe|über diesen bericht|à propos de ce rapport/i.test(lower)) {
    return "energy_base";
  }
  if (/能量结构|energy structure|estructura energética|energiestruktur|structure énergétique/i.test(lower)) {
    return "energy_base";
  }
  if (/处境|situation|diagnóstico|situationsdiagnose|diagnostic de situation/i.test(lower)) {
    return "talent_map";
  }
  if (/抉择|crossroad|encrucijada|weggabelung|carrefour/i.test(lower)) {
    return "spirit_gifts";
  }
  if (/觉察|awareness|autoobservación|selbstwahrnehmung|auto-observation/i.test(lower)) {
    return "risk_guard";
  }
  if (/结语|epilogue|独立走|sigue por tu cuenta|geh deinen eigenen|avancez par vous/i.test(lower)) {
    return "signals_close";
  }
  if (/能量决策报告|energy decision report|informe de decisión|entscheidungsbericht|rapport de décision/i.test(t)) {
    return "cover";
  }

  const resolved = resolveDeliverySegmentKey(t);
  return resolved;
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
      type: "talent_map",
      title: DELIVERY_SECTION_HEADINGS.talent_map.zh,
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
    opening: by("energy_base"),
    analysis: by("talent_map") || by("energy_base"),
    conclusion: by("spirit_gifts") || by("macro_cycle"),
    whatToDo: by("science_action") || by("metaphysics_action"),
    comingBack: by("thirty_day") || by("risk_guard") || by("signals_close"),
  };
}
