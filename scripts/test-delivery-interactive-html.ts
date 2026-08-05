/**
 * Interactive delivery HTML + main-text extractor smoke tests.
 * Export must be the fixed delivery card (shell), not a long redesign page.
 *
 *   pnpm exec tsx scripts/test-delivery-interactive-html.ts
 */
import { deliveryEvidenceLabelPlain } from "@/lib/llm/pro/delivery/delivery-locale";
import { buildDeliveryInteractiveHtml } from "@/lib/poju/delivery-interactive-html";
import {
  deliveryMainTextContainsEvidenceLead,
  extractDeliveryMainText,
} from "@/lib/poju/delivery-main-text";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const md = `# 关于「测试议题」的能量决策报告

> 副标题

## 目录

1. 序言
2. 能量结构

## 序言 · 关于这份报告

这份报告帮助你看清结构与下一步。

## 第一部分 · 你的能量结构

### 你的能量像藤蔓

正文段落一，说明敏感与协作。今天先写下一件可做的事。

**依据与推理:**
⟦t:stem_yi|柔蔓|gloss⟧与⟦t:weak_self|需养|g⟧说明根基敏感。

### 第二论点

正文段落二，落到动作。

**依据与推理:**
⟦t:shi_shen|流展|g⟧泄秀承重。
`;

console.log("\n========== Delivery interactive HTML (card) ==========\n");

const html = buildDeliveryInteractiveHtml(md, "zh", {
  originalQuestion: "测试议题",
  profileLine: "1990-01-01",
  reportId: "PIVOT-TEST01",
  reportDate: "2026-08-05",
  title: "关于「测试议题」的能量决策报告",
});

assert("uses delivery-book-stage shell", html.includes('class="delivery-book-stage"'));
assert("has shell + card", html.includes("delivery-book-stage__shell") && html.includes("delivery-book-stage__card"));
assert("has dual panes", html.includes("delivery-book-stage__panes") && html.includes("delivery-book-stage__left"));
assert("has Pivot brand", html.includes("Pivot") && html.includes("Breakthrough"));
assert("has TOC data-slot", html.includes("data-slot="));
assert("has right panes data-slot-pane", html.includes("data-slot-pane="));
assert("has evidence-block fold", html.includes("evidence-block") && html.includes("evidence-block__toggle"));
assert("has evidence summary label zh", html.includes(deliveryEvidenceLabelPlain("zh")));
assert("evidence keeps gold term-mark", html.includes("term-mark") && html.includes("term-mark__word"));
assert("evidence has polarity class", /term-mark--(neutral|favorable|caution)/.test(html));
assert("has footer pager inside shell", html.includes("delivery-book-stage__chrome--footer") && html.includes("delivery-book-stage__pager"));
assert("fixed card viewport (no page scroll)", html.includes("overflow: hidden") && html.includes("height: 100%"));
assert("inline script present", html.includes("<script>") && html.includes("show(start)"));
assert("no script CDN", !/src=["']https?:\/\//i.test(html));
assert("no external stylesheet link", !/<link[^>]+stylesheet/i.test(html));
assert("audio mount reserved", html.includes("dib-audio-mount"));
assert("meta question", html.includes("测试议题"));
assert("meta report id", html.includes("PIVOT-TEST01"));
assert("prefers-reduced-motion", html.includes("prefers-reduced-motion"));
assert("delivery inset card", html.includes("--delivery-inset"));

const htmlEn = buildDeliveryInteractiveHtml(md, "en");
assert("evidence label en", htmlEn.includes("Evidence") && htmlEn.includes("reasoning"));
const htmlEs = buildDeliveryInteractiveHtml(md, "es");
assert("evidence label es", htmlEs.includes(deliveryEvidenceLabelPlain("es")));
const htmlDe = buildDeliveryInteractiveHtml(md, "de");
assert("evidence label de", htmlDe.includes("Beweis"));
const htmlFr = buildDeliveryInteractiveHtml(md, "fr");
assert("evidence label fr", htmlFr.includes("Preuves"));

console.log("\n========== Delivery main text ==========\n");

const main = extractDeliveryMainText(md, "zh");
assert("main text has body", main.includes("正文段落一") && main.includes("正文段落二"));
assert("main text omits evidence lead", !deliveryMainTextContainsEvidenceLead(main));
assert("no 依据与推理 in main", !main.includes("依据与推理"));

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED (${failures.length}):`, failures.join(", "));
  process.exit(1);
}
console.log("All delivery interactive HTML checks passed.\n");
