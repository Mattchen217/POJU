/**
 * Lab ZFP feed · zfpOmitted=false when birth_info present; 02 anchors include ziwei/pattern.
 * Run: pnpm exec tsx scripts/test-lab-ziwei-feed.ts
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import {
  buildLabFaceSliceFeed,
  buildLabPageFeedPacks,
} from "../lib/llm/pro/delivery/lab/lab-face-qc";
import { pageSliceAnchorLines } from "../lib/llm/pro/delivery/slice-for-page";
import {
  formatZiweiClosedSetForPrompt,
  tryBuildLabZiweiFactPack,
  ziweiCompanionTriggerAnchors,
} from "../lib/ziwei/lab-ziwei";
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

const pack = tryBuildLabZiweiFactPack({
  locale: "zh",
  original_question: "要不要换工作",
  base_analysis: { structured: { day_master: "甲" } },
  birth_info: GOLDEN_BIRTH,
});
assert.ok(pack, "birth_info builds ZFP");
assert.equal(pack!.source.library, "ziwei-doushu");
assert.ok(Array.isArray(pack!.pattern_hits));

const closed = formatZiweiClosedSetForPrompt(pack);
assert.match(closed, /紫微闭集/);
assert.ok(
  /命宫|格局命中|大限/.test(closed),
  "closed-set cites palace or pattern or daxian",
);

const lab = {
  version: 1,
  lab_id: "lab_test_zfp",
  created_at: Date.now(),
  updated_at: Date.now(),
  ops_user: "test",
  source: {
    locale: "zh",
    original_question: "要不要换工作去一线城市",
    base_analysis: { structured: { day_master: "甲木" } },
    birth_info: GOLDEN_BIRTH,
  },
  cursor_index: 0,
  steps: {},
  artifacts: {
    by_page: {},
    ziwei_fact_pack: pack,
    prealloc: {
      chart_fact_pack: "日主：甲木\n用神：木\n喜神：水\n忌神：土\n当前大运：甲辰",
    },
  },
  approved_order: [],
} as unknown as DeliveryLabSession;

const feeds = buildLabPageFeedPacks(lab);
assert.ok(feeds.zfp, "feed packs get ZFP by default");
assert.ok(
  (feeds.zfp as { pattern_hits?: unknown[] }).pattern_hits != null ||
    (feeds.zfp as { topicPalace?: unknown }).topicPalace != null,
  "ZFP has structure",
);

const slice02 = buildLabFaceSliceFeed(lab, "02");
assert.ok(slice02, "02 slice feed");
assert.equal(slice02!.zfpOmitted, false, "02 zfpOmitted=false with stable birth");
assert.ok(slice02!.sliced.slice.zfp?.topicPalace, "02 has topicPalace");

const anchors = pageSliceAnchorLines("02", feeds);
const anchorText = anchors.join("|");
assert.ok(
  /紫微|格局|命宫|大限|四化|午|贪狼/.test(anchorText) ||
    Boolean(slice02!.sliced.slice.zfp?.patternHits?.length),
  "02 anchors include ziwei or pattern",
);

const twin = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2026-10-27" });
const otherBirth: BirthInfo = { ...GOLDEN_BIRTH, year: 1990, hour: 15, hour_period: "shen" };
const other = buildZiweiFactPack(otherBirth, { asOf: "2026-10-27" });
assert.notEqual(
  JSON.stringify(twin.topicPalace),
  JSON.stringify(other.topicPalace),
  "two births → different ZFP topic",
);

const triggers = ziweiCompanionTriggerAnchors(pack);
assert.ok(triggers.some((t) => t.startsWith("大限") || t.startsWith("流年") || t.startsWith("格局")));

console.log("lab-ziwei-feed ok", {
  hits: pack!.pattern_hits.length,
  zfpOmitted: slice02!.zfpOmitted,
  anchors: anchors.slice(0, 6),
  triggers,
});
