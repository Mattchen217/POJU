export type ReadingBlock =
  | { type: "p"; content: string }
  | { type: "h3"; content: string }
  | { type: "blockquote"; content: string }
  | { type: "ul"; items: string[] };

export const READING_LABEL_PREFIX_RE = /^\*\*([^*]+?):\*\*\s*([\s\S]*)$/;

export function parseReadingBlocks(raw: string): ReadingBlock[] {
  const text = raw.trim();
  if (!text) return [];

  const blocks: ReadingBlock[] = [];
  for (const chunk of text.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);

    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*>/.test(l))) {
      blocks.push({
        type: "blockquote",
        content: nonEmpty.map((l) => l.replace(/^\s*>\s?/, "")).join("\n").trim(),
      });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", content: trimmed.slice(4).trim() });
      continue;
    }

    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*[-*]\s+/.test(l))) {
      blocks.push({
        type: "ul",
        items: nonEmpty.map((l) => l.replace(/^\s*[-*]\s+/, "").trim()),
      });
      continue;
    }

    blocks.push({ type: "p", content: trimmed.replace(/\n/g, " ") });
  }

  return blocks;
}

export function parseReadingLabel(content: string): { label: string; body: string } | null {
  const m = content.match(READING_LABEL_PREFIX_RE);
  if (!m) return null;
  return { label: `${m[1]}:`, body: m[2]!.trim() };
}
