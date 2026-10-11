/**
 * Smoke: extract CompanionBrief from mock P1/P3 page_schema fences.
 * Run: pnpm exec tsx scripts/test-companion-brief.ts
 */

import assert from "node:assert/strict";

import { encodePageSchemaFence } from "@/lib/llm/pro/delivery/page-schema/render";
import { DELIVERY_PAGE_SCHEMA_MOCK_ZH } from "@/lib/llm/pro/delivery/page-schema/mock-preview-zh";
import { extractCompanionBrief, meansFocusForDay } from "@/lib/companion/extract-companion-brief";
import { addDaysKey } from "@/lib/companion/date-keys";
import { COMPANION_WINDOW_DAYS } from "@/lib/companion/types";

const p1 = DELIVERY_PAGE_SCHEMA_MOCK_ZH.pages.direct_answer;
const p3 = DELIVERY_PAGE_SCHEMA_MOCK_ZH.pages.science_action;
assert.ok(p1 && p3);

const fullText = [
  "## Direct",
  encodePageSchemaFence(p1),
  "## Science",
  encodePageSchemaFence(p3),
].join("\n\n");

const brief = extractCompanionBrief({
  fullText,
  locale: "zh",
  originalQuestion: "海外一线怎么走",
});

assert.equal(brief.primary.role, "primary");
assert.equal(brief.backup.role, "backup");
assert.ok(brief.primary.means_excerpts.length >= 1);
assert.ok(brief.backup.means_excerpts.length >= 1);
assert.ok(meansFocusForDay(brief.primary, 0));
assert.ok(meansFocusForDay(brief.primary, 7));
assert.equal(addDaysKey("2026-10-10", COMPANION_WINDOW_DAYS - 1).length, 10);

console.log("ok companion-brief", {
  primary: brief.primary.name,
  backup: brief.backup.name,
  means: brief.primary.means_excerpts.length,
});
