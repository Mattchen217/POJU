import { parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";

export type SynthesisCard = { title?: string; body: string };

/** Split synthesis text into 2×2 grid cards when structured with **Label:** blocks. */
export function synthesisCardsFromText(text: string): SynthesisCard[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks = parseReadingBlocks(trimmed);
  const cards: SynthesisCard[] = [];

  for (const block of blocks) {
    if (block.type === "lead") {
      cards.push({ title: block.label.replace(/:$/, ""), body: block.body });
    } else if (block.type === "subhead") {
      cards.push({ title: block.content, body: "" });
    } else if (block.type === "p") {
      cards.push({ body: block.content });
    } else if (block.type === "blockquote") {
      cards.push({ body: block.content });
    }
  }

  if (cards.length) return cards;

  const chunks = trimmed.split(/\n\n+/).filter(Boolean);
  return chunks.map((chunk) => ({ body: chunk }));
}

/** Split hidden-tension copy into two columns when double-paragraph. */
export function hiddenTensionColumns(text: string): [string, string] | null {
  const parts = text.trim().split(/\n\n+/).filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0]!, parts.slice(1).join("\n\n")];
}
