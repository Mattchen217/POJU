import { prepareReadingLayoutText } from "@/lib/reading/prepare-reading-layout";

export type ReadingBlock =
  | { type: "p"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "lead"; label: string; body: string }
  | { type: "subhead"; content: string }
  | { type: "blockquote"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "divider" };

export const READING_LABEL_PREFIX_RE = /^\*\*([^*]+?)[:：]\*\*\s*([\s\S]*)$/;

const BOLD_TITLE_LINE_RE = /^\*\*([^*]+)\*\*[:：]?\s*$/;
const LEAD_LINE_RE = /^\*\*([^*]+)[:：]\*\*\s*(.*)$/;

/** Lead labels that fold as evidence (shared by parser + EvidenceBlock UI). */
export function isEvidenceLeadLabel(label: string): boolean {
  const t = label.replace(/[:：]\s*$/, "").trim();
  return /依据|推理|结构依据|时机判断|Profile\s*basis|Structural\s*basis|Timing\s*verdict|Evidence|Rationale|Evidencia|razonamiento|Beweis|Schlussfolgerung|Preuves|raisonnement|为什么这条|Why this/i.test(
    t,
  );
}

/**
 * Absorb following paragraphs into「依据与推理」so multi-para evidence stays in the fold.
 *
 * Boundary is structural — never "has ⟦t: marker?":
 * - Absorb consecutive `p` blocks after an evidence lead.
 * - Stop before a `p` that starts the next dual-layer pair (that `p` is followed by
 *   another evidence lead). This keeps 1:1 body↔evidence without requiring gold marks
 *   on every evidence paragraph (models often leave the 2nd sentence unmarked).
 */
function mergeEvidenceTrailingParagraphs(blocks: ReadingBlock[]): ReadingBlock[] {
  const out: ReadingBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type === "lead" && isEvidenceLeadLabel(b.label)) {
      const parts = [b.body].filter(Boolean);
      while (i + 1 < blocks.length && blocks[i + 1]!.type === "p") {
        // Next body of a dual-layer pair: bare vernacular `p` + following evidence lead.
        const followedByEvidenceLead =
          i + 2 < blocks.length &&
          blocks[i + 2]!.type === "lead" &&
          isEvidenceLeadLabel((blocks[i + 2] as { type: "lead"; label: string }).label);
        if (followedByEvidenceLead) break;
        i += 1;
        parts.push((blocks[i] as { type: "p"; content: string }).content);
      }
      out.push({ type: "lead", label: b.label, body: parts.join("").trim() });
      continue;
    }
    if (b.type === "subhead" && isEvidenceLeadLabel(b.content)) {
      const parts: string[] = [];
      while (i + 1 < blocks.length && blocks[i + 1]!.type === "p") {
        const followedByEvidenceLead =
          i + 2 < blocks.length &&
          blocks[i + 2]!.type === "lead" &&
          isEvidenceLeadLabel((blocks[i + 2] as { type: "lead"; label: string }).label);
        if (followedByEvidenceLead) break;
        i += 1;
        parts.push((blocks[i] as { type: "p"; content: string }).content);
      }
      const label = /[:：]\s*$/.test(b.content) ? b.content : `${b.content}:`;
      out.push({ type: "lead", label, body: parts.join("").trim() });
      continue;
    }
    out.push(b);
  }
  return out;
}

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

export function parseReadingBlocks(raw: string, opts?: { layout?: boolean }): ReadingBlock[] {
  const prepared = opts?.layout === false ? raw : prepareReadingLayoutText(raw);
  const text = prepared.trim();
  if (!text) return [];

  const blocks: ReadingBlock[] = [];
  for (const chunk of text.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed === "***") {
      blocks.push({ type: "divider" });
      continue;
    }

    const lines = trimmed.split("\n");
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);

    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*>/.test(l))) {
      blocks.push({
        type: "blockquote",
        content: nonEmpty.map((l) => l.replace(/^\s*>\s?/, "")).join("\n").trim(),
      });
      continue;
    }

    // Prefer ### before ## (### starts with ## too).
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", content: trimmed.slice(4).trim() });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", content: trimmed.slice(3).trim() });
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

  return mergeEvidenceTrailingParagraphs(blocks);
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
