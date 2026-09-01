/**
 * P3 smoke: yongshen/pattern upgrade + career de-slogan + partner archetypes.
 * pnpm exec tsx scripts/test-p3-yongshen-career-archetype.ts
 */
import assert from "node:assert/strict";
import { getBaziChart } from "shunshi-bazi-core";
import { buildProfileStructured } from "../lib/calculations/build-profile-structured";
import { buildPartnerArchetypeHints } from "../lib/calculations/partner-archetype-hints";
import { inferPatternHeuristic } from "../lib/calculations/pattern-heuristic";
import { careerDirectionForElement } from "../lib/calculations/metaphysics-pack/element-adaptations";
import { computeYongshenAnalysis } from "../lib/calculations/yongshen-heuristic";
import { buildStructuredInstanceInventory } from "../lib/base-analysis/build-structured-instance-inventory";
import { shunshiParamsFromBirthInfo } from "../lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "../lib/profile/types";

{
  const p = inferPatternHeuristic({
    tenGods: ["食神", "正财", "比肩"],
    strength: "weak",
  });
  assert.equal(p.id, "shishang_shengcai");
  assert.ok(p.han.includes("食伤生财"));
  console.log("ok pattern heuristic", p.han);
}

{
  const career = careerDirectionForElement("wood");
  assert.equal(career.framing, "energy_domain_hint_not_job_title");
  assert.ok(career.mechanism_zh.length >= 1);
  assert.ok(!/教育辅导|生命相关产品/.test(career.themes_zh.join("")));
  console.log("ok career de-slogan", career.themes_zh.join("/"), career.mechanism_zh.join("/"));
}

{
  const birth: BirthInfo = {
    year: 1990,
    month: 5,
    day: 12,
    hour: 14,
    minute: 0,
    gender: "female",
    timezone: "Asia/Shanghai",
    longitude: 121.47,
    latitude: 31.23,
  };
  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    longitude: params.longitude,
    latitude: params.latitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });
  const ya = computeYongshenAnalysis(chart);
  assert.ok(ya.elements_han.length >= 1);
  assert.ok(Array.isArray(ya.ji_elements_han));
  assert.ok(ya.ji_elements_han.every((j) => !ya.elements_han.includes(j)));
  console.log("ok yongshen upgrade", {
    strength: ya.status_strength,
    yong: ya.elements_han,
    ji: ya.ji_elements_han,
    season: ya.season_element,
    tiaohou: ya.tiaohou_adjusted,
  });

  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id: "p3_smoke",
    birth: { ...birth },
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "甲子",
      monthPillar: pillars?.月柱?.干支 ?? "乙丑",
      dayPillar: pillars?.日柱?.干支 ?? "丙寅",
      hourPillar: pillars?.时柱?.干支 ?? "丁卯",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "甲",
      favorableElements: ["water"],
      challengingElements: ["fire"],
      patternSummary: `日主 ${chart.八字?.日主}，四柱 ${chart.八字?.四柱}。`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
    used_true_solar_time: true,
  };
  const structured = buildProfileStructured({ profile, chart });
  assert.ok(structured.pattern);
  assert.ok(!/^日主/.test(structured.pattern), structured.pattern);
  const hints = buildPartnerArchetypeHints(structured);
  assert.ok(hints.length >= 1, "expected archetype hints");
  const inv = buildStructuredInstanceInventory(structured, {
    questionCategory: "relationship",
  });
  assert.ok(inv.includes("对方型人提示") || inv.includes("型人"));
  assert.ok(inv.includes("格局粗标签"));
  console.log("ok structured pattern + archetypes", structured.pattern, hints.map((h) => h.chart_token).join("；"));
}

console.log("\nAll P3 yongshen/career/archetype checks passed.");
