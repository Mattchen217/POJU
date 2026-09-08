/**
 * Reading block parser smoke test.
 * Run: pnpm tsx scripts/test-rich-reading-text.ts
 */
import {
  parseBoldTitleLine,
  parseReadingBlocks,
  parseReadingLabel,
} from "@/lib/reading/parse-reading-blocks";

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
  assert(blocks[0]?.type === "lead", "first is lead block");
  assert(blocks[0]?.type === "lead" && blocks[0].label === "Your Natural Advantage:", "lead label");
  assert(blocks.some((b) => b.type === "blockquote"), "has blockquote");
  assert(blocks.some((b) => b.type === "ul" && b.items.length === 2), "has list");

  const mirage = parseReadingBlocks("**The Mirage of Promises**\nSome imagery follows.");
  assert(mirage[0]?.type === "subhead", "standalone bold → subhead");
  assert(mirage[0]?.type === "subhead" && mirage[0].content === "The Mirage of Promises", "subhead text");
  assert(mirage[1]?.type === "p", "body paragraph after subhead");

  const title = parseBoldTitleLine("**Where They Align**");
  assert(title === "Where They Align", "parse bold title line");

  const labeled = parseReadingLabel("**The Move:** Step back.");
  assert(labeled?.label === "The Move:", "blockquote label parse");

  // Segment-2 voice often omits blank line after ### — body must not become one fat h3
  // (gold ::before bar would float mid-paragraph via flex align-items:center).
  const noBlank = parseReadingBlocks(
    "### 你卡在哪里\n你现在的处境，不是简单的要不要跳槽。\n这种拉扯不是性格软弱。\n\n### 几个关键侧面\n最致命的一点是。",
  );
  assert(noBlank.filter((b) => b.type === "h3").length === 2, "two h3 without blank lines");
  assert(
    noBlank[0]?.type === "h3" && noBlank[0].content === "你卡在哪里",
    "h3 title only — not swallowed body",
  );
  assert(noBlank.some((b) => b.type === "p"), "body paragraphs after tight ###");
  assert(
    !noBlank.some((b) => b.type === "h3" && b.content.includes("处境")),
    "body text not inside h3",
  );

  if (process.exitCode) process.exit(1);
  console.log("\nAll reading-block checks passed.");
}

main();
