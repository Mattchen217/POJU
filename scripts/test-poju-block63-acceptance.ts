/**
 * Block 63 — delivery report: compliance auto-mark + scenario plain + reflow
 *
 *   pnpm exec tsx scripts/test-poju-block63-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { reflowLongParagraph, reflowParagraphList } from "@/lib/reading/reflow-paragraphs";
import { parseDeliveryContent } from "@/lib/poju/parse-delivery";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import { prepareTextForGlossaryRender } from "@/lib/llm/sanitize/term-marking";

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
  console.log("\n=== Block 63 acceptance ===\n");

  const glossary = read("components/cross-product/GlossaryText.tsx");
  const rich = read("components/cross-product/RichReadingText.tsx");
  const delivery = read("lib/llm/pro/final-delivery.ts");
  const parseDel = read("lib/poju/parse-delivery.ts");

  console.log("=== Fix 1 · UI auto-mark on delivery chain ===\n");
  assert("GlossaryText prepareTextForGlossaryRender", glossary.includes("prepareTextForGlossaryRender"));
  assert("GlossaryText autoMark comment", glossary.includes("autoMarkBareTerms"));
  assert("RichReadingText uses MarkedInline", rich.includes("MarkedInline"));
  assert("MainDeliveryView uses RichReadingText", read("components/poju/MainDeliveryView.tsx").includes("RichReadingText"));
  assert("AssistantMessageActions compliant export", read("components/poju/AssistantMessageActions.tsx").includes("toCompliantPlainText"));

  const leak = "今年流年丙午，走大运。";
  const prepared = prepareTextForGlossaryRender(leak, "zh");
  assert("prepare marks bare terms", prepared.includes("⟦t:"));
  const exportText = toCompliantPlainText(leak, "zh");
  assert("export no 流年", !exportText.includes("流年"), exportText);
  assert("export no 丙午", !exportText.includes("丙午"), exportText);
  assert("export no 大运", !exportText.includes("大运"), exportText);

  console.log("\n=== Fix 2 · delivery 3-part marking prompt ===\n");
  assert("final-delivery 3-part hard rule", delivery.includes("三段位硬要求"));
  assert("final-delivery scenario plain", delivery.includes("对他这件事的白话"));
  assert("final-delivery not generic glossary", delivery.includes("不是术语的通用定义") || delivery.includes("不是术语通用定义"));

  console.log("\n=== Fix 3 · reflow long paragraphs (zero char loss) ===\n");
  assert("parse-delivery imports reflow", parseDel.includes("reflowParagraphList"));
  assert("RichReadingText imports reflow", rich.includes("reflowLongParagraph"));

  const wall =
    "第一句很长，讲的是你在项目里一直扛着的那个压力点，它并不是突然出现的。第二句继续展开，说明这种节奏已经持续了好几个季度。第三句落到具体，你其实早就在找出口，只是还没敢动。第四句收束，这次交付就是要帮你把出口看清楚。";
  const chunks = reflowLongParagraph(wall);
  assert("reflow splits long wall", chunks.length >= 2, `chunks=${chunks.length}`);
  assert("reflow preserves chars", chunks.join("") === wall);
  assert("reflow chunks shorter", chunks.every((c) => c.length <= 90));

  const deliverySample = `═══ ANALYSIS ═══
### 结构张力
${wall}

═══ CONCLUSION ═══
短结论。

═══ WHAT TO DO ═══
### Action 1: 试探
行动内容。

═══ COMING BACK ═══
回访。`;
  const bodyBlock = `### 结构张力\n${wall}`;
  const reflowedBody = reflowParagraphList([bodyBlock], "body");
  assert("reflowParagraphList splits delivery body", reflowedBody.length >= 2);
  assert("reflowParagraphList preserves body chars", reflowedBody.join("") === bodyBlock);

  const sections = parseDeliveryContent(deliverySample);
  const analysisParas = sections.find((s) => s.type === "analysis")?.paragraphs ?? [];
  assert("parse-delivery reflows analysis", analysisParas.length >= 2, `paras=${analysisParas.length}`);
  assert("parse-delivery keeps wall text", analysisParas.join("").includes(wall));

  console.log("\n=== Fix 2 · render prefers dynamic plain ===\n");
  const scenarioPlain = "⟦t:year|岁环|对你而言，这是项目进入兑现窗口、不宜再拖的那一年。⟧";
  const preparedScenario = prepareTextForGlossaryRender(scenarioPlain, "zh");
  assert("marked scenario preserved", preparedScenario.includes("项目进入兑现窗口"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 63 checks passed.\n");
}

main();
