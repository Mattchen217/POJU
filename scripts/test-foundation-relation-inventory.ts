/**
 * Foundation relation inventory — a 甲木 chart, not the lab partnership case.
 *   pnpm exec tsx scripts/test-foundation-relation-inventory.ts
 */
import assert from "node:assert/strict";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import {
  bindFoundationRelationPicks,
  buildFoundationRelationInventory,
} from "../lib/llm/pro/delivery/page-schema/foundation-relation-inventory";

const structured: ProfileStructured = {
  day_master: "甲木",
  pattern: "食伤",
  yong_shen: "金",
  xi_shen: ["水"],
  ji_shen: ["火", "土"],
  strength: "strong",
  four_pillars: { year: "丙寅", month: "庚午", day: "甲子", hour: "乙亥" },
  pillars_detail: {
    year: { ganzhi: "丙寅", stem: "丙", branch: "寅", ten_god: "食神", hidden_stems: ["甲", "丙", "戊"], shen_sha: [] },
    month: { ganzhi: "庚午", stem: "庚", branch: "午", ten_god: "七杀", hidden_stems: ["丁", "己"], shen_sha: [] },
    day: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "日主自身", hidden_stems: ["癸"], shen_sha: [] },
    hour: { ganzhi: "乙亥", stem: "乙", branch: "亥", ten_god: "劫财", hidden_stems: ["壬", "甲"], shen_sha: [] },
  },
  da_yun: [{ start_age: 8, start_year: 1994, ganzhi: "戊辰" }],
  data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
};

const rows = buildFoundationRelationInventory(structured, {
  as_of: new Date("2026-06-15T12:00:00Z"),
  timezone: "UTC",
});
const claims = rows.map((row) => row.claim);

assert.ok(rows.length >= 5, "inventory covers the card count");
assert.ok(claims.some((claim) => claim.includes("午子相冲")), "natal clash is listed");
assert.ok(
  claims.includes("日支本气癸正印克制年干丙食神"),
  "印克食 is generated in the table direction",
);
assert.equal(
  claims.includes("年干丙食神克制日支本气癸正印"),
  false,
  "reversed ten-god direction is absent",
);
assert.equal(
  claims.some((claim) => claim.includes("午午半合")),
  false,
);
assert.equal(
  claims.some((claim) => /配偶宫|夫妻宫|父母宫|子女宫|官禄宫|命宫|身宫/.test(claim)),
  false,
);
assert.equal(
  claims.some((claim) =>
    /(?:大运|流年|流月)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀)/.test(
      claim,
    ),
  ),
  false,
);
assert.ok(claims.some((claim) => claim.startsWith("大运天干戊")));

const picked = rows[0];
assert.ok(picked);
const bound = bindFoundationRelationPicks([picked], [picked.id], ["why_cards[0]"]);
assert.equal(bound.ok, true);
if (bound.ok) {
  assert.equal(bound.picks[0]?.claim, picked.claim);
  assert.equal(bound.picks[0]?.cite, picked.cite);
}
const unknown = bindFoundationRelationPicks(rows, ["nope"], ["why_cards[0]"]);
assert.equal(unknown.ok, false);
if (!unknown.ok) assert.equal(unknown.reason, "assign:pick_unknown:nope");
const duplicate = bindFoundationRelationPicks(
  rows,
  [picked.id, picked.id],
  ["why_cards[0]", "why_cards[1]"],
);
assert.equal(duplicate.ok, false);
if (!duplicate.ok) assert.match(duplicate.reason, /^assign:pick_duplicate:/);

console.log("test-foundation-relation-inventory: ok");
