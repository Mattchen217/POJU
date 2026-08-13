/**
 * Leak → ban → mapping promotion loop.
 *   pnpm exec tsx scripts/test-vernacular-leak-feedback.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  clearLeakHitBuffer,
  formatLeakPromotionReport,
  getLeakHitBuffer,
  LEAK_PROMOTE_TO_MAPPING_THRESHOLD,
  recordUserFacingLeakHit,
  suggestLeakPromotions,
} from "@/lib/glossary/vernacular-leak-feedback";
import { STAGED_BAN_ZH } from "@/lib/glossary/vernacular-leak-staging";
import {
  findDeliveryProsePollution,
  warnDeliveryProsePollution,
} from "@/lib/llm/pro/delivery/delivery-body-purity";

clearLeakHitBuffer();

for (let i = 0; i < LEAK_PROMOTE_TO_MAPPING_THRESHOLD; i++) {
  recordUserFacingLeakHit({
    term: "杀印相生",
    label: "fixture",
    source: "fixture",
    quiet: true,
  });
}
recordUserFacingLeakHit({
  term: "湿土",
  label: "fixture",
  source: "fixture",
  quiet: true,
});

const hits = getLeakHitBuffer();
assert.equal(hits.length, LEAK_PROMOTE_TO_MAPPING_THRESHOLD + 1);

const promo = suggestLeakPromotions(hits);
assert.ok(promo.banCandidates.some((x) => x.term === "杀印相生" && x.count === 3));
assert.ok(promo.mappingCandidates.some((x) => x.term === "杀印相生"));
assert.ok(!promo.mappingCandidates.some((x) => x.term === "湿土"));

const report = formatLeakPromotionReport(hits);
assert.ok(report.includes("Ban candidates"));
assert.ok(report.includes("NEVER inject mapping table into POJU_IDENTITY"));

assert.ok(STAGED_BAN_ZH.includes("杀印相生" as (typeof STAGED_BAN_ZH)[number]));
assert.equal(
  findDeliveryProsePollution("你这是杀印相生的格局")?.label,
  "staged_ban",
);

clearLeakHitBuffer();
warnDeliveryProsePollution("test/warn", "用神是水木");
assert.ok(getLeakHitBuffer().some((h) => h.source === "delivery_purity"));

const identity = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/poju-base.ts"),
  "utf8",
);
assert.ok(!identity.includes("vernacular-mapping-ssot"));
assert.ok(!identity.includes("buildUserFacingExpressionContractBlock"));
assert.ok(!identity.includes("引擎概念 → 用户可见语"));

console.log("test-vernacular-leak-feedback: ok");
