/**
 * Block 65 — POJU delivery typography (Glyph/Match-style layout, zero char loss)
 *
 *   pnpm exec tsx scripts/test-poju-block65-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";
import {
  normalizeLayoutWhitespace,
  prepareReadingLayoutText,
} from "@/lib/reading/prepare-reading-layout";
import { reflowLongParagraph } from "@/lib/reading/reflow-paragraphs";
import { parseDeliveryContent } from "@/lib/poju/parse-delivery";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function main(): void {
  console.log("\n=== Block 65 acceptance ===\n");

  const mainView = read("components/poju/MainDeliveryView.tsx");
  const rich = read("components/cross-product/RichReadingText.tsx");
  const parseDel = read("lib/poju/parse-delivery.ts");
  const typography = read("styles/reading-typography.css");

  console.log("=== Layout prep + reflow (char-preserving) ===\n");
  assert("prepare-reading-layout module", fs.existsSync(path.join(ROOT, "lib/reading/prepare-reading-layout.ts")));
  assert("parse-delivery uses prepareReadingLayoutText", parseDel.includes("prepareReadingLayoutText"));
  assert("RichReadingText density=delivery", rich.includes('density?: "default" | "delivery"'));
  assert("RichReadingText divider render", rich.includes('case "divider"'));

  const inlineWall =
    "第一段分析很长，讲的是你在项目里一直扛着的那个压力点。第二段继续展开，说明这种节奏已经持续了好几个季度。> 要旨: 先把出口看清楚。*** ### 结构张力 第三段落到具体，你其实早就在找出口。";
  const laidOut = prepareReadingLayoutText(inlineWall);
  assert(
    "layout prep preserves chars",
    normalizeLayoutWhitespace(laidOut) === normalizeLayoutWhitespace(inlineWall),
  );
  assert("layout prep breaks blockquote", laidOut.includes("\n\n>"));
  assert("layout prep breaks divider", laidOut.includes("\n\n***\n\n"));
  assert("layout prep breaks ###", /\n\n\s*###/.test(laidOut));

  const markedWall =
    "第一句⟦t:foo|bar|对你而言这是项目兑现窗口。⟧很长，讲的是你在项目里一直扛着的那个压力点。第二句继续展开，说明这种节奏已经持续了好几个季度。第三句落到具体，你其实早就在找出口，只是还没敢动。第四句收束，这次交付就是要帮你把出口看清楚。";
  const markedChunks = reflowLongParagraph(markedWall, { maxChars: 72, maxSentences: 2 });
  assert("reflow splits marked text", markedChunks.length >= 2, `chunks=${markedChunks.length}`);
  assert("reflow preserves marked chars", markedChunks.join("") === markedWall);

  const blocks = parseReadingBlocks(laidOut);
  assert("parse blocks finds blockquote", blocks.some((b) => b.type === "blockquote"));
  assert("parse blocks finds divider", blocks.some((b) => b.type === "divider"));
  assert("parse blocks finds h3", blocks.some((b) => b.type === "h3"));

  const deliverySample = `═══ ANALYSIS ═══
${inlineWall}

═══ CONCLUSION ═══
短结论第一句。第二句补充说明。

═══ WHAT TO DO ═══
### Action 1: 试探
行动内容第一句。行动内容第二句继续展开。

═══ COMING BACK ═══
回访第一句。回访第二句。`;
  const sections = parseDeliveryContent(deliverySample);
  const analysisParas = sections.find((s) => s.type === "analysis")?.paragraphs ?? [];
  assert("parse-delivery splits analysis", analysisParas.length >= 2, `paras=${analysisParas.length}`);
  assert(
    "parse-delivery preserves analysis chars",
    normalizeLayoutWhitespace(analysisParas.join("")) === normalizeLayoutWhitespace(inlineWall),
  );

  console.log("\n=== Glyph-style delivery UI ===\n");
  assert("MainDeliveryView imports glyph-delivery.css", mainView.includes('glyph-delivery.css'));
  assert("MainDeliveryView glyph section heading", mainView.includes("glyph-delivery-section-heading"));
  assert("MainDeliveryView conclusion highlight", mainView.includes("poju-delivery-highlight"));
  assert("MainDeliveryView density delivery", mainView.includes('density="delivery"'));
  assert("typography poju-delivery-inner", typography.includes(".poju-delivery-inner"));
  assert("typography reading-divider", typography.includes(".reading-divider"));
  assert("typography action cards", typography.includes(".poju-delivery-action"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 65 checks passed.\n");
}

main();
