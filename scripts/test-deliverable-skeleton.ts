/** Focused regression for generated page HTML inside nested deliverable slots. */
import assert from "node:assert/strict";
import {
  assertSkeletonUnchanged,
  listTemplateSlots,
  fillDeliverableHtml,
} from "../lib/deliverables/fill-html";
import { decisionReportSlotIds } from "../lib/deliverables/fill-delivery";
import { renderDecisionReportTemplate } from "../lib/deliverables/templates/decision-report";

const topic = "relationship";
const template = renderDecisionReportTemplate(topic);
const pageIds = decisionReportSlotIds(topic);
const expectedPageIds = ["cover", "01", "02", "04", "05", "06", "07", "08", "03"];
assert.deepEqual(pageIds, expectedPageIds, "eight report faces plus cover must be present in reading order");

const nestedBody = '<div class="delivery-book-stage__section-card"><div class="delivery-book-stage__section-inner"><p>report body</p></div></div>';
const slots = Object.fromEntries(listTemplateSlots(template).map((key) => [
  key,
  key.startsWith("SLOT_BODY_") ? nestedBody : `value:${key}`,
]));
const filled = fillDeliverableHtml(template, slots);
const legacyNormalize = (html: string) => html
  .replace(/<div class="deliverable-slot"[^>]*>[\s\S]*?<\/div>/gi, '<div class="deliverable-slot"></div>')
  .replace(/\{\{[A-Z][A-Z0-9_]*\}\}/g, "")
  .replace(/<p class="slot-empty">—<\/p>/g, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
  .replace(/(\s[\w-:]+=")[^"]*(")/g, "$1$2")
  .replace(/>[^<]*</g, "><")
  .replace(/\s+/g, "");
const legacyExpected = legacyNormalize(template);
const legacyActual = legacyNormalize(filled);
assert.notEqual(legacyActual, legacyExpected,
  "nested slot content must reproduce the old non-greedy matcher’s false drift so this test guards the regression");
let diffAt = 0;
while (diffAt < legacyExpected.length && legacyExpected[diffAt] === legacyActual[diffAt]) diffAt++;
console.log(`[legacy matcher diff] offset=${diffAt}; expected=${legacyExpected.slice(diffAt, diffAt + 32)}; actual=${legacyActual.slice(diffAt, diffAt + 32)}`);
assert.doesNotThrow(() => assertSkeletonUnchanged(template, filled));

const paneIds = Array.from(filled.matchAll(/<section\b[^>]*data-slot-pane="([^"]+)"/g), (match) => match[1]);
const tocIds = Array.from(filled.matchAll(/<button\b[^>]*data-slot="([^"]+)"/g), (match) => match[1]);
assert.deepEqual(paneIds, expectedPageIds, "filled panes must retain all eight faces and canonical order");
assert.deepEqual(tocIds, expectedPageIds, "contents links must map one-to-one to all panes");
assert.equal((filled.match(/delivery-book-stage__section-inner/g) ?? []).length, expectedPageIds.length,
  "nested report body markup must remain in every report slot, including the cover slot");

console.log("Deliverable structure result: 4 passed, 0 failed");
console.log(`Pages: ${paneIds.join(",")}; TOC: ${tocIds.join(",")}; nested bodies: ${expectedPageIds.length}`);
