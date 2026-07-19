/**
 * Block 59 — surgical delivery sanitize + parse fallback + soft labels without ganzhi
 *
 *   pnpm exec tsx scripts/test-poju-block59-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { encodeTermMarker } from "@/lib/llm/sanitize/term-marking";
import { sanitizeDeliveryText } from "@/lib/llm/sanitize/compliance-terms";
import { parseDeliveryContent, parseDeliveryContentFallback } from "@/lib/poju/parse-delivery";
import { KEEP_CN_VISIBLE_SOFT } from "@/lib/glossary/term-closed-set";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== Block 59 acceptance ===\n");

  const compliance = read("lib/llm/sanitize/compliance-terms.ts");
  const finalTs = read("lib/llm/pro/final-delivery.ts");
  const parseTs = read("lib/poju/parse-delivery.ts");

  console.log("=== Fix 1 · surgical sanitize ===\n");
  assert("no applySortedTermReplacements in body sanitize", !compliance.includes("applySortedTermReplacements(result, locale)"));
  {
    const start = compliance.indexOf("function sanitizeDeliveryBodyPart");
    const end = compliance.indexOf("export function sanitizePaymentAuditLeaks");
    const bodySlice = start >= 0 && end > start ? compliance.slice(start, end) : "";
    assert("no stripBrokenMarkers in body sanitize", !bodySlice.includes("stripBrokenMarkers"));
  }
  assert("uses transformNonMarkerRegions", compliance.includes("transformNonMarkerRegions"));
  assert("uses replaceStandaloneRedlines", compliance.includes("replaceStandaloneRedlines"));

  const intactMarker = "⟦t:year|岁环|This year pushes pace.⟧";
  const scrubbedMarker = sanitizeDeliveryText(`═══ ANALYSIS ═══\n${intactMarker}`, "zh");
  assert("intact marker preserved", scrubbedMarker.includes("⟦t:year|岁环|"));

  const corrupted = sanitizeDeliveryText("他拒绝会不会被堵住，运转正常。", "zh");
  assert("拒绝 not corrupted", corrupted.includes("拒绝"));
  assert("堵住 not corrupted", corrupted.includes("堵住"));
  assert("运转 not corrupted", corrupted.includes("运转"));

  const redline = sanitizeDeliveryText("涉及占卜。命运安排另说。", "zh");
  assert("standalone 占卜 removed", !redline.includes("占卜"));

  const bareLeak = sanitizeDeliveryText("t:year|岁环（丙午）|plain", "zh");
  assert("bare t: leak stripped", !bareLeak.includes("t:year|"));

  console.log("\n=== Fix 2 · layout mandate + parse fallback ===\n");
  assert("final-delivery imports POJU_DELIVERY_STRUCTURE_MANDATE", finalTs.includes("POJU_DELIVERY_STRUCTURE_MANDATE"));
  assert("mandate requires ### subheads", finalTs.includes("3–4 个 ### 子标题") || finalTs.includes("3-4 个 ### 子标题"));
  assert("parse has fallback export", parseTs.includes("parseDeliveryContentFallback"));

  const fallbackSections = parseDeliveryContentFallback(
    "### 压力从哪来\n\n第一段。\n\n### 卡点在哪\n\n第二段。\n\nCONCLUSION\n\n直答句。",
  );
  assert("fallback splits ### blocks", fallbackSections[0]?.paragraphs.length >= 2);

  const noMarker = parseDeliveryContent("ANALYSIS\n\n### 子标题一\n\n段落一。\n\nCONCLUSION\n\n结论段。");
  assert("parseDeliveryContent uses fallback when no markers", noMarker.length >= 2);

  console.log("\n=== Fix 3 · soft labels without ganzhi ===\n");
  assert("KEEP_CN_VISIBLE_SOFT has day_master", Boolean(KEEP_CN_VISIBLE_SOFT.day_master));
  assert("year soft has no ganzhi paren", !KEEP_CN_VISIBLE_SOFT.year!.zh.includes("（"));
  assert("term-marking forbids ganzhi in visible", read("lib/llm/sanitize/term-marking.ts").includes("禁括号干支"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 59 checks passed.\n");
}

main();
