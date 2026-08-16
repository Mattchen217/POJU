/**
 * Split long delivery prose into readable paragraphs (P1 core_logic etc.).
 * Prefers author newlines; otherwise packs sentences into short blocks.
 */

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if ("。！？；.!?;".includes(ch)) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export function splitReadableParagraphs(
  text: string,
  opts?: { targetChars?: number; hardMaxChars?: number },
): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const target = opts?.targetChars ?? 88;
  const hardMax = opts?.hardMaxChars ?? 160;

  let blocks = raw
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Single blob with only spaces — treat double-space / ideographic space runs as breaks.
  if (blocks.length === 1 && /[\u3000]{2,}|\s{3,}/.test(blocks[0]!)) {
    blocks = blocks[0]!
      .split(/[\u3000]{2,}|\s{3,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= hardMax) {
      out.push(block);
      continue;
    }
    const sentences = splitSentences(block);
    if (sentences.length <= 1) {
      out.push(block);
      continue;
    }
    let buf = "";
    for (const sentence of sentences) {
      if (!buf) {
        buf = sentence;
        continue;
      }
      if (buf.length + sentence.length <= target) {
        buf += sentence;
      } else {
        out.push(buf);
        buf = sentence;
      }
    }
    if (buf) out.push(buf);
  }

  return out.length > 0 ? out : [raw];
}

/** Persist-friendly: ensure long core_logic has paragraph breaks. */
export function ensureProseParagraphBreaks(text: string): string {
  const parts = splitReadableParagraphs(text);
  return parts.join("\n\n");
}
