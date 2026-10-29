/**
 * Body gun must project ZFP/patternHits into page slice (same as judgment face_slice).
 * Run: pnpm exec tsx scripts/test-body-slice-zfp.ts
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { formatPageSliceFeed } from "../lib/llm/pro/delivery/page-slice-feed";
import { pageFeedFlags } from "../lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";

const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};

const ziwei = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2026-10-27" });
assert.ok(ziwei.patternHits.length > 0, "golden has patternHits");

const chartText = [
  "日主：庚金",
  "用神：木",
  "喜神：水",
  "忌神：金土",
  "当前大运：甲申",
].join("\n");

const feed = pageFeedFlags("02", "body");
assert.equal(feed.thesis_factpack, true, "02 body keeps thesis_factpack");

/** Mirrors content-body.ts: ziwei gated on thesis_factpack like chart. */
const pageSlice = formatPageSliceFeed({
  key: "02",
  chartText: feed.thesis_factpack ? chartText : null,
  ziwei: feed.thesis_factpack ? ziwei : null,
  question: "要不要换工作",
  withAllowlistHeader: true,
});
assert.ok(pageSlice, "02 body slice exists");
assert.match(pageSlice!, /"zfp"/, "02 body JSON includes zfp group");
assert.match(pageSlice!, /patternHits/, "02 body slice includes patternHits key");
assert.match(pageSlice!, /紫微/, "02 body slice cites 紫微");
assert.ok(
  /府相朝垣|紫微入命|日月同宫|火贪格|铃贪格/.test(pageSlice!),
  "02 body slice cites a closed-set pattern name",
);

/** Regression: omitting ziwei (old Lab body bug) → only cfp. */
const bare = formatPageSliceFeed({
  key: "02",
  chartText,
  ziwei: null,
  question: "要不要换工作",
});
assert.ok(bare && !/"zfp"/.test(bare), "without ziwei pack, zfp group omitted");
assert.match(bare!, /dayMaster|用神/, "cfp still present");

console.log("body-slice-zfp ok", {
  hits: ziwei.patternHits.slice(0, 3).map((h) => h.name),
});
