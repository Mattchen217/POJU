/**
 * Block 63 — render-layer paragraph reflow (zero character loss).
 * Splits long paragraphs at sentence boundaries for readable short blocks.
 */

export type ReflowOptions = {
  /** Target max chars per chunk (CJK ~60–90). */
  maxChars?: number;
  /** Max sentences per chunk before breaking. */
  maxSentences?: number;
};

function splitSentencesPreserving(text: string): string[] {
  if (!text) return [];
  const hasCjk = /[\u4e00-\u9fff]/.test(text);
  const out: string[] = [];

  if (hasCjk) {
    let buf = "";
    for (const ch of text) {
      buf += ch;
      if (/[。！？!?…]/.test(ch)) {
        out.push(buf);
        buf = "";
      }
    }
    if (buf) out.push(buf);
    return out.length ? out : [text];
  }

  const re = /[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0]) out.push(m[0]);
  }
  return out.length ? out : [text];
}

/** Split one long paragraph into 2–4 short paragraphs; preserves every character. */
export function reflowLongParagraph(paragraph: string, opts: ReflowOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 84;
  const maxSentences = opts.maxSentences ?? 2;
  if (!paragraph.trim()) return [];

  const leading = paragraph.match(/^\s*/)?.[0] ?? "";
  const trailing = paragraph.match(/\s*$/)?.[0] ?? "";
  const trimmed = paragraph.trim();
  if (trimmed.startsWith(">")) return [paragraph];

  if (trimmed.length <= maxChars) return [paragraph];

  const sentences = splitSentencesPreserving(trimmed);
  if (sentences.length <= 1) return [paragraph];

  const chunks: string[] = [];
  let current = "";
  let sentenceCount = 0;

  for (const sent of sentences) {
    const candidate = current + sent;
    if (current && (candidate.length > maxChars || sentenceCount >= maxSentences)) {
      chunks.push(current);
      current = sent;
      sentenceCount = 1;
    } else {
      current = candidate;
      sentenceCount += 1;
    }
  }
  if (current) chunks.push(current);

  const joined = chunks.join("");
  if (joined !== trimmed) return [paragraph];

  if (leading && chunks[0]) chunks[0] = leading + chunks[0];
  if (trailing && chunks[chunks.length - 1]) {
    chunks[chunks.length - 1] = chunks[chunks.length - 1]! + trailing;
  }
  return chunks.length ? chunks : [paragraph];
}

/** Reflow an ### Action N block — keep header with first body chunk. */
export function reflowActionBlock(block: string, opts?: ReflowOptions): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  const match = trimmed.match(/^(###\s*Action\s*\d+\s*:[^\n]*)\n?([\s\S]*)$/i);
  if (!match) return reflowLongParagraph(trimmed, opts);
  const header = match[1]!.trim();
  const body = match[2]?.trim() ?? "";
  if (!body) return [header];
  const parts = reflowLongParagraph(body, opts);
  if (!parts.length) return [header];
  return [parts[0] ? `${header}\n\n${parts[0]}` : header, ...parts.slice(1)];
}

/** Expand a list of body paragraphs with reflow (character-preserving). */
export function reflowParagraphList(
  paragraphs: string[],
  type: "actions" | "body" = "body",
  opts?: ReflowOptions,
): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    if (type === "actions" && /^###\s*Action\s*\d+\s*:/i.test(p)) {
      out.push(...reflowActionBlock(p, opts));
    } else {
      out.push(...reflowLongParagraph(p, opts));
    }
  }
  return out;
}
