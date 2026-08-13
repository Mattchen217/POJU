/**
 * Opening dataplane: identity only (age/gender), no chart pillars.
 *   pnpm exec tsx scripts/test-opening-identity-only-dataplane.ts
 */
import assert from "node:assert/strict";
import { buildProfileContextSection } from "@/lib/llm/prompts/oriental-counselor-base";
import type { UserProfile } from "@/lib/profile/types";

const profile = {
  bazi: {
    yearPillar: "丁巳",
    monthPillar: "壬寅",
    dayPillar: "乙亥",
    hourPillar: "庚辰",
  },
  birth: {
    year: 1976,
    month: 3,
    day: 15,
    gender: "M",
    timezone: "Asia/Shanghai",
  },
  diagnosis: {
    dayMaster: "乙木",
    favorableElements: ["水", "木"],
  },
} as unknown as UserProfile;

const identity = buildProfileContextSection(profile, null, "zh", {
  identityOnly: true,
});
assert.ok(identity.includes("年龄") || identity.includes("岁"));
assert.ok(identity.includes("男"));
assert.ok(!identity.includes("八字四柱"));
assert.ok(!identity.includes("## 日主与五行线索"));
assert.ok(!identity.includes("有利元素方向"));
assert.ok(!identity.includes("丁巳"));
assert.ok(!identity.includes("乙木"));
assert.ok(identity.includes("身份 only") || identity.includes("非命盘"));

const full = buildProfileContextSection(profile, null, "zh");
assert.ok(full.includes("八字四柱"));
assert.ok(full.includes("## 日主与五行线索"));

const slimOld = buildProfileContextSection(profile, null, "zh", {
  includeBaseAnalysis: false,
});
assert.ok(slimOld.includes("八字四柱"));

console.log("test-opening-identity-only-dataplane: ok");
