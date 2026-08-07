/**
 * Delivery chrome i18n — es/de/fr headings, evidence labels, cover, sanitize.
 *
 *   pnpm exec tsx scripts/test-delivery-locale-chrome.ts
 */
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryCoverCopy,
  deliveryEvidenceLabelPlain,
  deliveryEvidenceLeadLabel,
  deliveryLocaleBucket,
  deliverySectionHeading,
  deliveryTranslateTargetName,
  DELIVERY_V2_EVIDENCE_LABEL_RE,
} from "@/lib/llm/pro/delivery/delivery-locale";
import {
  deliveryKeyFromHeading,
  sanitizeDeliveryBookMarkdown,
} from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { buildCoverAndToc } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { splitSectionBlocks } from "@/lib/poju/delivery-report-v2-split";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";

let failed = 0;
function assert(label: string, ok: boolean): void {
  if (!ok) failed += 1;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

console.log("\n=== delivery locale chrome ===\n");

assert("bucket es", deliveryLocaleBucket("es-ES") === "es");
assert("bucket de falls back to en", deliveryLocaleBucket("de") === "en");
assert("bucket fr", deliveryLocaleBucket("fr-FR") === "fr");
assert("translate name es", deliveryTranslateTargetName("es") === "Spanish");
assert("translate name de → English", deliveryTranslateTargetName("de") === "English");
assert("translate name fr", deliveryTranslateTargetName("fr") === "French");

for (const loc of ["es", "fr"] as const) {
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const h = deliverySectionHeading(k, loc);
    assert(`${loc} heading ${k} not EN`, h === DELIVERY_SECTION_HEADINGS[k][loc]);
    assert(`${loc} keyFromHeading ${k}`, deliveryKeyFromHeading(h) === k);
  }
  const plain = deliveryEvidenceLabelPlain(loc);
  const lead = deliveryEvidenceLeadLabel(loc);
  assert(`${loc} lead wraps plain`, lead === `**${plain}:**`);
  assert(`${loc} lead matches RE`, DELIVERY_V2_EVIDENCE_LABEL_RE.test(lead));

  const cover = buildCoverAndToc({
    original_question: "Test Q",
    locale: loc,
  });
  assert(`${loc} cover uses toc title`, cover.includes(`## ${deliveryCoverCopy(loc).tocTitle}`));
  assert(`${loc} cover not English Contents`, !cover.includes("## Contents"));
  assert(
    `${loc} cover has localized talent_map in TOC`,
    cover.includes(DELIVERY_SECTION_HEADINGS.talent_map[loc]),
  );

  const sample = `## ${DELIVERY_SECTION_HEADINGS.talent_map[loc]}

### Argument one
Body one.

${lead}
Gold evidence here.

### Argument two
Body two.

${lead}
More evidence.
`;
  const cleaned = sanitizeDeliveryBookMarkdown(sample, loc);
  assert(`${loc} sanitize keeps evidence label`, cleaned.includes(plain));
  assert(`${loc} sanitize keeps evidence text`, cleaned.includes("Gold evidence"));

  const pages = buildDeliveryBookPages(cleaned);
  const sit = pages.find((p) => p.id === "talent_map");
  assert(`${loc} talent_map dualLayer`, sit?.dualLayer === true);
  const mods = buildDeliveryBookModules({
    pageTitle: sit!.title,
    body: sit!.body,
    dualLayer: true,
    pageIndex: 0,
  });
  assert(`${loc} modules split`, mods.length === 2);
  assert(`${loc} first has evidence`, Boolean(mods[0]?.evidence.trim()));
  assert(`${loc} no raw ###`, mods.every((m) => !m.body.includes("###")));

  const blocks = splitSectionBlocks(sit!.body);
  assert(`${loc} split has evidence blocks`, blocks.some((b) => b.kind === "evidence"));
}

console.log(failed ? `\nFAILED: ${failed}` : "\nAll passed");
process.exit(failed ? 1 : 0);
