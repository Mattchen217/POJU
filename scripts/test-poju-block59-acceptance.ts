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

  console.log("\n=== Fix 2 · layout mandate + parse A–F ===\n");
  assert(
    "route uses final-delivery job runner",
    read("app/api/poju/final-delivery/route.ts").includes("runFinalDeliveryJob"),
  );
  assert("parse has fallback export", parseTs.includes("parseDeliveryContentFallback"));

  const sixSample = `## A · 回答问题与处境洞察

第一段处境。

**依据与推理:**
依据甲。

## C · 现代行动方案

行动正文。

**依据与推理:**
依据乙。
`;
  const fallbackSections = parseDeliveryContentFallback(sixSample);
  assert("fallback parses foundation section", fallbackSections[0]?.type === "foundation");
  assert("fallback has body", (fallbackSections[0]?.body.length ?? 0) >= 4);

  const noMarker = parseDeliveryContent(sixSample);
  assert("parseDeliveryContent returns book sections", noMarker.length >= 2);
  assert(
    "legacy A→foundation and C→science_action",
    noMarker.some((s) => s.type === "foundation") &&
      noMarker.some((s) => s.type === "science_action"),
  );

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
