/**
 * Teaser = same reading pipeline as full report, truncated by block count.
 * Never char-slice raw markdown (that leaks literal `##`).
 */

import {
  parseReadingBlocks,
  type ReadingBlock,
} from "@/lib/reading/parse-reading-blocks";

export function serializeReadingBlocks(blocks: ReadingBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "h2":
          return `## ${block.content}`;
        case "h3":
          return `### ${block.content}`;
        case "subhead":
          return `**${block.content}**`;
        case "lead":
          return `**${block.label.replace(/:$/, "")}:** ${block.body}`.trim();
        case "blockquote":
          return block.content
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "ul":
          return block.items.map((item) => `- ${item}`).join("\n");
        case "divider":
          return "***";
        case "p":
        default:
          return block.content;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** First N reading blocks — shared teaser path for report card / synopsis. */
export function truncateReadingTeaser(text: string, maxBlocks = 5): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  const blocks = parseReadingBlocks(normalized);
  if (!blocks.length) {
    return normalized.length <= 480 ? normalized : `${normalized.slice(0, 480).trim()}…`;
  }
  if (blocks.length <= maxBlocks) return serializeReadingBlocks(blocks);
  return serializeReadingBlocks(blocks.slice(0, maxBlocks));
}
