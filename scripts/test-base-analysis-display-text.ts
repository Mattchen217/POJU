/**
 * Verify base_analysis v5: term markers + closed-set audit + section structure.
 * Run: pnpm tsx scripts/test-base-analysis-display-text.ts
 * Requires OPENROUTER_API_KEY in .env.local for live display_text generation.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { getBaziChart } from "shunshi-bazi-core";

import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { auditOutOfSetTerms, parseTermMarkers } from "@/lib/llm/sanitize/term-marking";
import {
  isOpenRouterConfigured,
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1]!.trim();
    const val = m[2]!.trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const REQUIRED_SECTIONS_ZH = [
  "核心底色",
  "系统脆弱点",
  "能量平衡锚",
  "高杠杆发力区",
  "四柱命盘数据",
  "大运能量气候概览",
];

function buildTestProfile(): { profile: UserProfile; chart: ReturnType<typeof getBaziChart> } {
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

  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id: "test_1990_gz",
    birth,
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "?",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "土")],
      challengingElements: ["金"],
      patternSummary: `日主 ${chart.八字?.日主}，四柱 ${chart.八字?.四柱}。`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
    used_true_solar_time: true,
  };

  return { profile, chart };
}

async function main() {
  loadEnvLocal();

  const { profile, chart } = buildTestProfile();
  const localData = buildStreamLocalDataFromProfile(profile, { output_language: "zh" });
  const structured = buildProfileStructured({ profile, chart });

  console.log("=== structured (code) ===");
  console.log("data_availability:", structured.data_availability);
  console.log("da_yun[0..2]:", structured.da_yun.slice(0, 3));

  const { system } = buildBaseAnalysisStreamPrompt({ local_data: localData });
  console.log("\n=== prompt checks ===");
  console.log("has term marking block:", system.includes("⟦t:") ? "PASS" : "FAIL");
  console.log("has closed-set rule:", system.includes("国印贵人") ? "PASS" : "FAIL");
  console.log("has data_availability:", system.includes("data_availability") ? "PASS" : "FAIL");
  console.log("has four-dimension framework:", system.includes("核心底色") && system.includes("系统脆弱点") ? "PASS" : "FAIL");
  console.log("has neutrality ban:", system.includes("开咖啡馆") || system.includes("café") ? "PASS" : "FAIL");

  if (!isOpenRouterConfigured()) {
    console.log("\n⚠ OPENROUTER_API_KEY not set — skipping live display_text generation.");
    console.log("System excerpt:", system.slice(0, 500), "...");
    return;
  }

  const { user } = buildBaseAnalysisStreamPrompt({ local_data: localData });
  console.log("\n=== Generating display_text (zh) via OpenRouter ===");

  const result = await openRouterChatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.65,
    max_tokens: 6000,
    reasoning_effort: "off",
  });

  const displayText = result.text.trim();
  console.log("\n=== display_text (first 1200 chars) ===");
  console.log(displayText.slice(0, 1200));

  const markers = parseTermMarkers(displayText);
  const outOfSet = auditOutOfSetTerms(displayText);
  const sections = parseBaseAnalysisSections(displayText);
  const sectionTitles = sections.map((s) => s.title);

  console.log("\n=== validation ===");
  console.log("length:", displayText.length);
  console.log("term markers:", markers.length, markers.length >= 5 ? "PASS" : "WARN");
  console.log("raw marker leak:", /⟦t:/.test(displayText) ? "expected (parsed by UI)" : "none");
  console.log("out-of-set audit hits:", outOfSet.length, outOfSet.length === 0 ? "PASS" : "FAIL");
  if (outOfSet.length) console.log("  hits:", outOfSet);

  const missingSections = REQUIRED_SECTIONS_ZH.filter(
    (title) => !sectionTitles.some((t) => t.includes(title)),
  );
  console.log("sections found:", sectionTitles.length);
  console.log("missing sections:", missingSections.length ? missingSections.join(", ") : "PASS (0)");
  console.log("tokens:", result.tokens_used);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
