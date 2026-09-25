/**
 * Delivery P4 Step1 — qimen lock-pan Fact-pack.
 * Run: pnpm exec tsx scripts/test-delivery-qimen-fact-pack.ts
 */

import assert from "node:assert/strict";
import {
  castDeliveryQimenFactPack,
  DELIVERY_QIMEN_FACT_PACK_HEADER,
  DeliveryQimenCastError,
  isValidDeliveryQimenFactPack,
  mergeQimenIntoChartFactPackText,
  preallocHasQimen,
} from "../lib/llm/pro/delivery/page-schema/qimen-fact-pack";
import {
  attachQimenLockPan,
  preallocateChartPrimaries,
} from "../lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";

const lockAt = new Date("2026-09-25T15:30:00.000Z");

const a = castDeliveryQimenFactPack({ castAt: lockAt });
assert.ok(isValidDeliveryQimenFactPack(a), "first cast valid");
assert.equal(a.qimen_cast_at, lockAt.toISOString());
assert.ok(a.text.includes(DELIVERY_QIMEN_FACT_PACK_HEADER));
assert.ok(a.ju_name.includes("局"));
assert.ok(a.zhi_fu_star.length >= 2);
assert.ok(a.zhi_shi_door.length >= 2);
assert.ok(a.host_guest.includes("主客"));
assert.ok(a.stance_zh.length >= 2);

const b = castDeliveryQimenFactPack({
  castAt: new Date("2026-09-25T18:00:00.000Z"),
  existing: a,
});
assert.equal(b.qimen_cast_at, a.qimen_cast_at, "idempotent: no recast");
assert.equal(b.text, a.text);
assert.equal(b.ju_name, a.ju_name);

const laterHour = castDeliveryQimenFactPack({
  castAt: new Date("2026-09-25T18:00:00.000Z"),
});
assert.notEqual(
  laterHour.qimen_cast_at,
  a.qimen_cast_at,
  "different lock time may differ",
);

const merged = mergeQimenIntoChartFactPackText("日主己土身强\n用神水", a);
assert.ok(merged.includes("日主己土"));
assert.ok(merged.includes(DELIVERY_QIMEN_FACT_PACK_HEADER));
const merged2 = mergeQimenIntoChartFactPackText(merged, laterHour);
assert.equal(
  merged2.split(DELIVERY_QIMEN_FACT_PACK_HEADER).length - 1,
  1,
  "replace old qimen block",
);
assert.ok(merged2.includes(laterHour.ju_name));

assert.equal(preallocHasQimen({ qimen: a, chart_fact_pack: merged }), true);
assert.equal(preallocHasQimen({ chart_fact_pack: "日主己" }), false);

const structured = {
  day_master: "己",
  day_master_element: "earth",
  strength: "strong",
  yong_shen: "water",
  xi_shen: ["metal"],
  ji_shen: ["fire", "earth"],
  four_pillars: {
    year: "丁卯",
    month: "丙午",
    day: "己丑",
    hour: "辛未",
  },
  pillars_detail: {
    year: {
      ganzhi: "丁卯",
      stem: "丁",
      branch: "卯",
      ten_god: "偏印",
      hidden_stems: ["乙"],
      shen_sha: ["将星"],
    },
    month: {
      ganzhi: "丙午",
      stem: "丙",
      branch: "午",
      ten_god: "正印",
      hidden_stems: ["丁", "己"],
      shen_sha: [],
    },
    day: {
      ganzhi: "己丑",
      stem: "己",
      branch: "丑",
      ten_god: "比肩",
      hidden_stems: ["己", "癸", "辛"],
      shen_sha: [],
    },
    hour: {
      ganzhi: "辛未",
      stem: "辛",
      branch: "未",
      ten_god: "食神",
      hidden_stems: ["己", "丁", "乙"],
      shen_sha: [],
    },
  },
} as unknown as ProfileStructured;

const map = preallocateChartPrimaries({
  structured,
  qimen_cast_at: lockAt,
});
assert.equal(map.pool_source, "chart_fact_pack");
assert.ok(map.qimen);
assert.equal(map.qimen_cast_at, lockAt.toISOString());
assert.ok(map.chart_fact_pack?.includes(DELIVERY_QIMEN_FACT_PACK_HEADER));
assert.ok(map.chart_fact_pack?.includes("日主") || map.chart_fact_pack?.includes("己"));

const again = attachQimenLockPan(map, {
  castAt: new Date("2099-01-01T00:00:00.000Z"),
});
assert.equal(again.qimen_cast_at, lockAt.toISOString(), "attach keeps lock");

let failed = false;
try {
  castDeliveryQimenFactPack({
    castAt: new Date("not-a-date"),
    maxAttempts: 2,
  });
} catch (e) {
  failed = e instanceof DeliveryQimenCastError;
}
assert.ok(failed, "invalid castAt must throw DeliveryQimenCastError");

console.log("test-delivery-qimen-fact-pack: ok", {
  ju: a.ju_name,
  door: a.zhi_shi_door,
  stance: a.stance_zh,
  host_guest: a.host_guest,
});
