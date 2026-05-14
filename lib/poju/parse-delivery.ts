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
    lower.includes("do") ||
    lower.includes("action") ||
    lower.includes("做") ||
    lower.includes("puede") ||
    lower.includes("faire") ||
    lower.includes("tun")
  )
    return "actions";
  if (lower.includes("coming back") || lower.includes("回来") || lower.includes("volver")) return "invitation";
  return "analysis";
}

/**
 * Split LLM delivery text on markers like "═══ ANALYSIS ═══".
 */
export function parseDeliveryContent(content: string): DeliverySection[] {
  const sections: DeliverySection[] = [];
  const parts = content.split(/═══\s*(.+?)\s*═══/);

  if (parts[0]?.trim()) {
    sections.push({
      type: "opening",
      title: "",
      paragraphs: parts[0]
        .trim()
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i]?.trim() || "";
    const body = parts[i + 1]?.trim() || "";
    const type = guessSectionType(title);
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    sections.push({ type, title, paragraphs });
  }

  return sections;
}
