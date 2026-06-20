/**
 * Reading block parser smoke test.
 * Run: pnpm tsx scripts/test-rich-reading-text.ts
 */
import { parseReadingBlocks, parseReadingLabel } from "@/lib/reading/parse-reading-blocks";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function main() {
  const sample = `**Your Natural Advantage:** You thrive by bending.

**The Current Storm:** Pressure cooker.

> **The Move:** Step back.

* Cut one cost
* Call one mentor`;

  const blocks = parseReadingBlocks(sample);
  assert(blocks.length === 4, "four blocks");
  assert(blocks[0]?.type === "p", "first is paragraph");
  assert(parseReadingLabel(blocks[0]!.type === "p" ? blocks[0].content : "")?.label === "Your Natural Advantage:", "parses label");
  assert(blocks.some((b) => b.type === "blockquote"), "has blockquote");
  assert(blocks.some((b) => b.type === "ul" && b.items.length === 2), "has list");

  const labeled = parseReadingLabel("**The Move:** Step back.");
  assert(labeled?.label === "The Move:", "blockquote label parse");

  if (process.exitCode) process.exit(1);
  console.log("\nAll reading-block checks passed.");
}

main();
