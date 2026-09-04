/**
 * Layer A · anchor category tally + prompt inject + soft sanitize wiring.
 * Usage: pnpm exec tsx scripts/test-anchor-category-tally.ts
 */
import assert from "node:assert/strict";
import {
  classifyAnchorToken,
  formatAnchorCategoryUsageForPrompt,
  tallyAnchorCategoryUsage,
  buildCategoryTokenSetsFromStructured,
} from "../lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildPageSchemaFillPrompt } from "../lib/llm/pro/delivery/page-schema/fill-prompt";
import { assessUnitAnchorQuality } from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import { formatEvidenceTermLabel } from "../lib/poju/collect-delivery-evidence-terms";

const sets = buildCategoryTokenSetsFromStructured(null);

assert.equal(classifyAnchorToken("正官", sets), "ten_god");
assert.equal(classifyAnchorToken("七杀", sets), "ten_god");
assert.equal(classifyAnchorToken("寡宿", sets), "shen_sha");
assert.equal(classifyAnchorToken("午未六合", sets), "relation");
assert.equal(classifyAnchorToken("大运甲子", sets), "dayun");
assert.equal(classifyAnchorToken("用神水", sets), "core_structure");

const used = [
  "正官",
  "正官",
  "正官",
  "七杀",
  "七杀",
  "七杀",
  "用神",
  "用神",
  "忌神",
];
const tally = tallyAnchorCategoryUsage(used, sets);
assert.equal(tally.byCategory.ten_god.count, 6);
assert.ok(tally.byCategory.relation.count === 0);
assert.ok(tally.byCategory.shen_sha.count === 0);

const block = formatAnchorCategoryUsageForPrompt(tally);
assert.match(block, /十神类：已用 6 次/);
assert.match(block, /关系类：已用 0 次/);
assert.match(block, /不凑数/);

const { system, user } = buildPageSchemaFillPrompt("science_action", {
  locale: "zh",
  core_conclusion: "test",
  prior_chart_anchors: used,
  category_token_sets: sets,
});
assert.ok(!system.includes("已用锚点类目分布"), "tally must not enter static system");
assert.match(user, /已用锚点类目分布/);

const aq = assessUnitAnchorQuality({
  pageKey: "science_action",
  units: [{ path: "angles[0]", anchors: ["正官", "七杀"] }],
  priorAnchors: ["正官", "七杀"],
  inventoryTokens: tally.inventoryTokens,
});
assert.ok(aq.notes.some((n) => n.includes("cross_page_echo")));
assert.equal(aq.structuralFail, false, "Layer C must stay soft (no structural fail on echo)");

assert.equal(
  formatEvidenceTermLabel({ soft: "统御", traditional: "正官" }),
  "统御",
);
assert.equal(
  formatEvidenceTermLabel({ soft: "正官", traditional: "正官" }),
  "正官",
);
assert.ok(
  !formatEvidenceTermLabel({ soft: "流展", traditional: "食神" }).includes("食神"),
  "appendix label must not leak traditional 真词",
);

console.log("ok · test-anchor-category-tally");
