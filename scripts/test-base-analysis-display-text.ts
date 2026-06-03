/**
 * Verify base_analysis v4: code structured + LLM display_text.
 * Run: pnpm tsx scripts/test-base-analysis-display-text.ts
 * Requires OPENROUTER_API_KEY in .env.local for live display_text generation.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { getBaziChart } from "shunshi-bazi-core";

import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
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

const ZH_BLACKLIST = /八字|四柱|日主|用神|忌神|大运|格局|算命|命理|命盘|命运|预测命运|[吉凶]/;
const EN_BLACKLIST =
  /\b(Bazi|Four Pillars|Day Master|Yong Shen|Ji Shen|Da Yun|fortune[- ]?telling|fate|destiny|auspicious|inauspicious)\b/i;

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
  console.log(JSON.stringify(structured, null, 2));
  console.log("\nstructured.da_yun[0..2]:", structured.da_yun.slice(0, 3));

  if (!isOpenRouterConfigured()) {
    console.log("\n⚠ OPENROUTER_API_KEY not set — skipping live display_text generation.");
    console.log("Prompt preview (system excerpt):");
    const { system } = buildBaseAnalysisStreamPrompt({ local_data: localData });
    console.log(system.slice(0, 400), "...");
    return;
  }

  const { system, user } = buildBaseAnalysisStreamPrompt({ local_data: localData });
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
  console.log("\n=== display_text ===");
  console.log(displayText);
  console.log("\n=== validation ===");
  console.log("length:", displayText.length);
  console.log("ZH blacklist hits:", ZH_BLACKLIST.test(displayText) ? "FAIL" : "PASS (0)");
  console.log("EN blacklist hits:", EN_BLACKLIST.test(displayText) ? "FAIL" : "PASS (0)");
  console.log("tokens:", result.tokens_used);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
