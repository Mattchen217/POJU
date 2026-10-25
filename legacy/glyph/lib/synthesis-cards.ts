import { parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";

export type SynthesisCard = { title?: string; body: string };

function mergeOrphanTitles(cards: SynthesisCard[]): SynthesisCard[] {
  const out: SynthesisCard[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const body = card.body.trim();
    const title = card.title?.trim();

    if (title && !body && i + 1 < cards.length) {
      const next = cards[i + 1]!;
      const nextBody = next.body.trim();
      if (nextBody) {
        out.push({
          title,
          body: next.title && !nextBody ? next.title : nextBody,
        });
        i += 1;
        continue;
      }
    }

    if (!body && title) {
      out.push({ body: title });
      continue;
    }

    if (body) out.push({ title, body });
  }
  return out;
}

/** Split synthesis text into 2×2 grid cards when structured with **Label:** blocks. */
export function synthesisCardsFromText(text: string): SynthesisCard[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks = parseReadingBlocks(trimmed);
  const cards: SynthesisCard[] = [];

  for (const block of blocks) {
    if (block.type === "lead") {
      const label = block.label.replace(/:$/, "").trim();
      const body = block.body.trim();
      if (body) cards.push({ title: label, body });
      else if (label) cards.push({ title: label, body: "" });
    } else if (block.type === "subhead") {
      cards.push({ title: block.content.trim(), body: "" });
    } else if (block.type === "p") {
      cards.push({ body: block.content.trim() });
    } else if (block.type === "blockquote") {
      cards.push({ body: block.content.trim() });
    } else if (block.type === "ul") {
      cards.push({ body: block.items.join("\n") });
    }
  }

  const merged = mergeOrphanTitles(cards.length ? cards : []);
  if (merged.length) return merged.filter((c) => c.body.trim());

  const chunks = trimmed.split(/\n\n+/).filter(Boolean);
  return chunks.map((chunk) => ({ body: chunk }));
}

/** Split hidden-tension copy into two columns when double-paragraph. */
export function hiddenTensionColumns(text: string): [string, string] | null {
  const parts = text.trim().split(/\n\n+/).filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0]!, parts.slice(1).join("\n\n")];
}
