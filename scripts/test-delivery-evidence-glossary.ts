/**
 * Collect evidence gold terms → appendix glossary.
 *
 *   pnpm exec tsx scripts/test-delivery-evidence-glossary.ts
 */
import { deliveryAppendixCopy } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  collectDeliveryEvidenceTerms,
  formatEvidenceTermLabel,
  isDeliveryAppendixEmptyPlaceholder,
} from "@/lib/poju/collect-delivery-evidence-terms";
import { buildDeliveryInteractiveHtml } from "@/lib/poju/delivery-interactive-html";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

/** P2+ have dualLayer; P1 (direct_answer) is transition and skips evidence folds. */
const md = `# Report

## Contents

1. Root Analysis

## 归因剖析

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
assert("has soft labels", termsZh.length === 0 || termsZh.every((t) => Boolean(t.soft)));
assert(
  "has traditional field",
  termsZh.every((t) => typeof t.traditional === "string"),
);
assert(
  "formatEvidenceTermLabel is soft-only",
  termsZh.every((t) => {
    const label = formatEvidenceTermLabel(t);
    return (
      label === t.soft &&
      (!t.traditional || t.traditional === t.soft || !label.includes(t.traditional))
    );
  }),
);
assert(
  "unique ids",
  termsZh.length === 0 || new Set(termsZh.map((t) => t.id)).size === termsZh.length,
);
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
assert("lead zh", /金字|依据/.test(leadZh));
assert("lead en", /gold|evidence|lookup/i.test(leadEn));
assert("goldTerms zh", deliveryAppendixCopy("zh").goldTerms.includes("金字"));
assert("goldTerms en", /gold/i.test(deliveryAppendixCopy("en").goldTerms));

assert("collects terms enough for html", termsZh.length >= 2);
const html = buildDeliveryInteractiveHtml(md, "en");
assert("html has term table", html.includes("delivery-book-stage__term-table"));
assert(
  "html has glossary lead",
  html.includes(leadEn) || html.includes(deliveryAppendixCopy("en").goldTerms),
);
assert(
  "html omits empty placeholder when terms exist",
  !html.includes("No structured chart attached"),
);
assert(
  "html has plain term cells",
  html.includes("delivery-book-stage__term-table-term"),
);
{
  const i = html.indexOf("delivery-book-stage__term-table");
  const slice = i >= 0 ? html.slice(i, i + 8000) : "";
  assert(
    "appendix table has no SoftTerm hover",
    Boolean(slice) && !slice.includes("term-mark__word--interactive"),
  );
  // Soft labels from fixture markers — traditional must not appear in term column cells
  assert(
    "appendix table soft-only (no 食神 paren)",
    Boolean(slice) && !/流展（食神）/.test(slice) && !/>食神</.test(slice),
  );
}

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED (${failures.length}):`, failures.join(", "));
  process.exit(1);
}
console.log("All evidence-glossary checks passed.\n");
