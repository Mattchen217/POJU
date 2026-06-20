export type ReadingBlock =
  | { type: "p"; content: string }
  | { type: "h3"; content: string }
  | { type: "lead"; label: string; body: string }
  | { type: "subhead"; content: string }
  | { type: "blockquote"; content: string }
  | { type: "ul"; items: string[] };

export const READING_LABEL_PREFIX_RE = /^\*\*([^*]+?):\*\*\s*([\s\S]*)$/;

const BOLD_TITLE_LINE_RE = /^\*\*([^*]+)\*\*:?\s*$/;
const LEAD_LINE_RE = /^\*\*([^*]+):\*\*\s*(.*)$/;

export function parseBoldTitleLine(line: string): string | null {
  const m = line.trim().match(BOLD_TITLE_LINE_RE);
  return m ? m[1]!.trim() : null;
}

export function parseLeadLine(line: string): { label: string; body: string } | null {
  const m = line.trim().match(LEAD_LINE_RE);
  if (!m) return null;
  return { label: `${m[1]}:`, body: m[2]!.trim() };
}

function parseParagraphChunk(trimmed: string): ReadingBlock[] {
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  if (lines.length === 1) {
    const title = parseBoldTitleLine(lines[0]!);
    if (title) return [{ type: "subhead", content: title }];
    const lead = parseLeadLine(lines[0]!);
    if (lead?.body) return [{ type: "lead", label: lead.label, body: lead.body }];
    if (lead) return [{ type: "subhead", content: lead.label.replace(/:$/, "") }];
    return [{ type: "p", content: lines[0]! }];
  }

  const lead = parseLeadLine(lines[0]!);
  if (lead) {
    const body = [lead.body, ...lines.slice(1)].filter(Boolean).join(" ");
    if (body) return [{ type: "lead", label: lead.label, body }];
    return [{ type: "subhead", content: lead.label.replace(/:$/, "") }];
  }

  const title = parseBoldTitleLine(lines[0]!);
  if (title) {
    const rest = lines.slice(1).join(" ");
    return rest
      ? [{ type: "subhead", content: title }, { type: "p", content: rest }]
      : [{ type: "subhead", content: title }];
  }

  return [{ type: "p", content: lines.join(" ") }];
}

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

    blocks.push(...parseParagraphChunk(trimmed));
  }

  return blocks;
}

export function parseReadingLabel(content: string): { label: string; body: string } | null {
  const m = content.match(READING_LABEL_PREFIX_RE);
  if (!m) return null;
  return { label: `${m[1]}:`, body: m[2]!.trim() };
}

/** Split blockquote inner text into optional lead line + body. */
export function parseBlockquoteParts(content: string): { label?: string; body: string } {
  const trimmed = content.trim();
  const labeled = parseReadingLabel(trimmed);
  if (labeled) {
    return labeled.body
      ? { label: labeled.label, body: labeled.body }
      : { body: trimmed };
  }
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const lead = parseLeadLine(lines[0]!);
    if (lead?.body) {
      return {
        label: lead.label,
        body: [lead.body, ...lines.slice(1)].join(" "),
      };
    }
    const title = parseBoldTitleLine(lines[0]!);
    if (title) {
      return { label: `${title}:`, body: lines.slice(1).join(" ") };
    }
  }
  return { body: trimmed.replace(/\n/g, " ") };
}
