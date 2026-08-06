/**
 * Collect evidence gold terms → appendix glossary.
 *
 *   pnpm exec tsx scripts/test-delivery-evidence-glossary.ts
 */
import { deliveryAppendixCopy } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  collectDeliveryEvidenceTerms,
  isDeliveryAppendixEmptyPlaceholder,
} from "@/lib/poju/collect-delivery-evidence-terms";
import { buildDeliveryInteractiveHtml } from "@/lib/poju/delivery-interactive-html";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const md = `# Report

## Contents

1. Structure

## Part I · Structure

### First move

Body without gold.

**Evidence & reasoning:**
⟦t:stem_yi|柔蔓|g⟧ and ⟦t:weak_self|需养|g⟧ explain the root. Also ⟦t:shi_shen|流展|g⟧.

## Appendix · Structural Data & Terms

(No structured chart attached. Evidence layers include key term glosses.)
`;

console.log("\n========== Evidence glossary ==========\n");

const termsZh = collectDeliveryEvidenceTerms(md, "zh");
assert("collects terms", termsZh.length >= 2);
assert("has soft labels", termsZh.every((t) => Boolean(t.soft)));
assert("unique ids", new Set(termsZh.map((t) => t.id)).size === termsZh.length);
assert(
  "empty placeholder detected",
  isDeliveryAppendixEmptyPlaceholder(
    "(No structured chart attached. Evidence layers include key term glosses.)",
  ),
);

const termsEn = collectDeliveryEvidenceTerms(md, "en");
assert("en soft differs or present", termsEn.length === termsZh.length);
assert("en has gloss field", termsEn.every((t) => typeof t.gloss === "string"));

const leadEn = deliveryAppendixCopy("en").evidenceGlossaryLead;
const leadZh = deliveryAppendixCopy("zh").evidenceGlossaryLead;
assert("lead zh", leadZh.includes("依据"));
assert("lead en", /evidence|Gold/i.test(leadEn));

const html = buildDeliveryInteractiveHtml(md, "en");
assert("html has term table", html.includes("delivery-book-stage__term-table"));
assert("html has glossary lead", html.includes(leadEn));
assert("html omits empty placeholder when terms exist", !html.includes("No structured chart attached"));
assert("html has plain term cells", html.includes("delivery-book-stage__term-table-term"));
{
  const i = html.indexOf("delivery-book-stage__term-table");
  const slice = i >= 0 ? html.slice(i, i + 8000) : "";
  assert(
    "appendix table has no SoftTerm hover",
    Boolean(slice) && !slice.includes("term-mark__word--interactive"),
  );
}

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED (${failures.length}):`, failures.join(", "));
  process.exit(1);
}
console.log("All evidence glossary checks passed.\n");
