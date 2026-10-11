/**
 * Smoke: extract CompanionBrief from mock P1/P3 page_schema fences.
 * Run: pnpm exec tsx scripts/test-companion-brief.ts
 */

import assert from "node:assert/strict";

import { encodePageSchemaFence } from "@/lib/llm/pro/delivery/page-schema/render";
import { DELIVERY_PAGE_SCHEMA_MOCK_ZH } from "@/lib/llm/pro/delivery/page-schema/mock-preview-zh";
import { extractCompanionBrief, meansFocusForDay } from "@/lib/companion/extract-companion-brief";
import { addDaysKey } from "@/lib/companion/date-keys";
import {
  COMPANION_WINDOW_DAYS,
  CompanionDayCardsSchema,
} from "@/lib/companion/types";

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
/** means 仅存档；日更不再轮转，但抽取仍可用。 */
assert.ok(meansFocusForDay(brief.primary, 0));
assert.equal(addDaysKey("2026-10-10", COMPANION_WINDOW_DAYS - 1).length, 10);

const cards = CompanionDayCardsSchema.parse({
  today_is: "今日场域偏稳。",
  suitable: "适合守住主线边界。",
  unsuitable: "不宜仓促加码。",
  suggestion: "主线先稳住，备线只作低风险出口。",
  evidence: "今日 ⟦t:食神⟧ 与支持气口相连，宜守不宜冲。",
});
assert.ok(cards.suggestion.length > 0);

console.log("ok companion-brief", {
  primary: brief.primary.name,
  backup: brief.backup.name,
  means: brief.primary.means_excerpts.length,
  cards_keys: Object.keys(cards),
});
