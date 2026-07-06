export type DeliverySectionType = "analysis" | "conclusion" | "actions" | "invitation" | "opening";

export interface DeliverySection {
  type: DeliverySectionType;
  title: string;
  paragraphs: string[];
}

export function guessSectionType(title: string): DeliverySectionType {
  const lower = title.toLowerCase();
  if (lower.includes("analysis") || lower.includes("分析") || lower.includes("análisis") || lower.includes("analyse"))
    return "analysis";
  if (lower.includes("conclusion") || lower.includes("结论") || lower.includes("conclusión")) return "conclusion";
  if (
    lower.includes("what you can do") ||
    lower.includes("what to do") ||
    lower.includes("do") ||
    lower.includes("action") ||
    lower.includes("做") ||
    lower.includes("行动") ||
    lower.includes("puede") ||
    lower.includes("faire") ||
    lower.includes("tun")
  )
    return "actions";
  if (lower.includes("coming back") || lower.includes("回来") || lower.includes("volver")) return "invitation";
  return "analysis";
}

function splitBodyParagraphs(body: string, type: DeliverySectionType): string[] {
  if (type === "actions") {
    return splitActionParagraphs(body);
  }
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Split WHAT TO DO body into one paragraph per ### Action N block. */
function splitActionParagraphs(body: string): string[] {
  const chunks = body
    .split(/(?=###\s*Action\s*\d+\s*:)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks;
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseFromMarkerParts(parts: string[]): DeliverySection[] {
  const sections: DeliverySection[] = [];

  if (parts[0]?.trim()) {
    sections.push({
      type: "opening",
      title: "",
      paragraphs: splitBodyParagraphs(parts[0].trim(), "opening"),
    });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i]?.trim() || "";
    const body = parts[i + 1]?.trim() || "";
    const type = guessSectionType(title);
    sections.push({ type, title, paragraphs: splitBodyParagraphs(body, type) });
  }

  return sections;
}

const MAJOR_SECTION_LINE_RE =
  /^(?:#{1,3}\s*)?(?:\*\*)?(ANALYSIS|CONCLUSION|WHAT TO DO|WHAT YOU CAN DO|COMING BACK|分析|结论|你可以做的事|你可以做什么|行动|回来)(?:\*\*)?\s*[:：]?\s*$/gim;

/** Fallback when model omits ═══ markers — split by major headings or ### blocks. */
export function parseDeliveryContentFallback(content: string): DeliverySection[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const majorMatches: Array<{ index: number; title: string; length: number }> = [];
  MAJOR_SECTION_LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAJOR_SECTION_LINE_RE.exec(trimmed)) !== null) {
    majorMatches.push({ index: m.index, title: m[1]!.trim(), length: m[0].length });
  }

  if (majorMatches.length >= 2) {
    const sections: DeliverySection[] = [];
    for (let i = 0; i < majorMatches.length; i++) {
      const start = majorMatches[i]!.index + majorMatches[i]!.length;
      const end = i + 1 < majorMatches.length ? majorMatches[i + 1]!.index : trimmed.length;
      const body = trimmed.slice(start, end).trim();
      const title = majorMatches[i]!.title;
      const type = guessSectionType(title);
      if (body) {
        sections.push({ type, title, paragraphs: splitBodyParagraphs(body, type) });
      }
    }
    if (sections.length) return sections;
  }

  const h3Blocks = trimmed.split(/(?=^###\s+)/m).map((s) => s.trim()).filter(Boolean);
  if (h3Blocks.length >= 2) {
    return [
      {
        type: "analysis",
        title: "ANALYSIS",
        paragraphs: h3Blocks,
      },
    ];
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length >= 2) {
    return [{ type: "analysis", title: "ANALYSIS", paragraphs }];
  }

  return [{ type: "analysis", title: "ANALYSIS", paragraphs: [trimmed] }];
}

/**
 * Split LLM delivery text on markers like "═══ ANALYSIS ═══".
 * Falls back to ### / keyword section split when markers are missing.
 */
export function parseDeliveryContent(content: string): DeliverySection[] {
  const parts = content.split(/═══\s*(.+?)\s*═══/);
  if (parts.length > 1) {
    return parseFromMarkerParts(parts);
  }
  return parseDeliveryContentFallback(content);
}
