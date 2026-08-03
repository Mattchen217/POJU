/**
 * Delivery PDF HTML builder — page structure smoke test.
 *
 *   pnpm exec tsx scripts/test-delivery-pdf-html.ts
 */
import {
  buildDeliveryPdfHtml,
  buildDeliveryPdfPages,
  countDeliveryPdfPages,
} from "@/lib/poju/delivery-pdf-html";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const md = `# 关于「测试」的能量决策报告

> 副标题

## 目录

1. 序言

## 序言 · 关于这份报告

这份报告帮助你看清结构。

## 第一部分 · 你的能量结构

### 你的能量像藤蔓

正文段落一，说明敏感与协作。

**依据与推理:**
⟦t:stem_yi|柔蔓|gloss⟧与⟦t:weak_self|需养|g⟧说明根基敏感。

### 第二论点

正文段落二。

**依据与推理:**
⟦t:shi_shen|流展|g⟧泄秀承重。
`;

console.log("\n========== Delivery PDF HTML ==========\n");

const pages = buildDeliveryPdfPages(md, "zh");
const kinds = pages.map((p) => p.kind);
assert("has cover", kinds.includes("cover"));
assert("has toc", kinds.includes("toc"));
assert("has argument pages", kinds.filter((k) => k === "argument").length >= 2);
assert("has glossary", kinds.includes("glossary"));
assert(
  "argument page has evidence",
  pages.some((p) => p.kind === "argument" && Boolean(p.evidenceHtml?.includes("pdf-term"))),
);

const html = buildDeliveryPdfHtml(md, "zh", { autoPrint: false });
assert("html has deep bg", html.includes("#0B0815"));
assert("html has evidence box", html.includes("pdf-evidence"));
assert("html has glossary table", html.includes("pdf-gloss-table"));
assert("no auto print in preview", !html.includes("window.print()"));
assert("page count > 4", countDeliveryPdfPages(md, "zh") >= 5);

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED (${failures.length}):`, failures.join(", "));
  process.exit(1);
}
console.log("All delivery PDF HTML checks passed.\n");
