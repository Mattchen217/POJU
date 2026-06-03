/**
 * Verify downstream context + Match matrix read structured.
 * Run: pnpm tsx scripts/test-base-analysis-downstream.ts
 */
import { getBaziChart } from "shunshi-bazi-core";

import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { formatBaseAnalysisForPrompt } from "@/lib/llm/prompts/base-analysis-context";
import { buildProfileContextSection } from "@/lib/llm/prompts/oriental-counselor-base";
import { parseProfileForMatrix, wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import { calculateSyncroMatrix } from "@/lib/syncro/calculate-matrix";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

function buildFixture() {
  const birth: BirthInfo = {
    year: 1990,
    month: 3,
    day: 24,
    hour_period: "si",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Guangzhou",
      longitude: 113.2644,
      latitude: 23.1291,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  };

  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({
    ...params,
    useTrueSolarTime: true,
    sect: 1,
  });
  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id: "test",
    birth,
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "戊",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "土")],
      challengingElements: ["金"],
      patternSummary: `日主 ${chart.八字?.日主}，四柱 ${chart.八字?.四柱}。`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
  };

  const structured = buildProfileStructured({ profile, chart });
  const display_text = "## 性格核心\n\n（白榜示例）核心特质属于沉稳承载型。";

  const v4Bundle = { structured, display_text, content: display_text };
  const legacyBundle = {
    content: {
      命主基础: { 用神忌神: { 用神: "水" } },
      当前大运详解: { 干支: "辛亥" },
    },
  };

  return { profile, v4Bundle, legacyBundle, structured };
}

function main() {
  const { profile, v4Bundle, legacyBundle, structured } = buildFixture();

  console.log("=== buildProfileContextSection (v4) ===");
  const ctxV4 = buildProfileContextSection(profile, v4Bundle);
  console.log(ctxV4.includes("## 性格结构数据（内部精确") ? "✓ has structured block" : "✗ missing structured");
  console.log(ctxV4.includes("## 性格画像分析（用户向白榜") ? "✓ has display_text block" : "✗ missing display_text");
  console.log(ctxV4.includes('"da_yun"') ? "✓ structured JSON includes da_yun" : "✗ da_yun missing");

  console.log("\n=== formatBaseAnalysisForPrompt excerpt ===");
  console.log(formatBaseAnalysisForPrompt(v4Bundle).slice(0, 600), "\n…");

  console.log("\n=== legacy fallback (v3 content only) ===");
  const ctxLegacy = buildProfileContextSection(profile, legacyBundle);
  console.log(ctxLegacy.includes("legacy JSON") || ctxLegacy.includes("命主基础") ? "✓ legacy renders" : "✗ legacy broken");

  console.log("\n=== Match parseProfileForMatrix ===");
  const parsedV4 = parseProfileForMatrix(wrapProfileForMatrix(profile, v4Bundle));
  console.log("yongShen:", parsedV4.yongShen, "(expected 土 from structured)");
  console.log(
    "current dayun:",
    `${parsedV4.currentDayunStem}${parsedV4.currentDayunBranch}`,
    `(from structured.da_yun, first cycle ${structured.da_yun[0]?.ganzhi})`,
  );

  const parsedLegacy = parseProfileForMatrix(wrapProfileForMatrix(profile, legacyBundle));
  console.log("legacy yongShen:", parsedLegacy.yongShen, "(expected 水 from content JSON)");

  console.log("\n=== Syncro calculateSyncroMatrix yong shen ===");
  const { matrix } = calculateSyncroMatrix({
    profile: {
      user_profile: profile,
      base_analysis: { structured, content: {} },
    },
    taskDescription: "明天开会",
    startTime: new Date("2024-06-15T12:00:00+08:00"),
    userTimezone: "Asia/Shanghai",
    userLongitude: 113.2644,
    userLatitude: 23.1291,
  });
  console.log("matrix cells:", Object.keys(matrix).length, "(expected 96)");
  console.log("\nAll downstream checks printed.");
}

main();
