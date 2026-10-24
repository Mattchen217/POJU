/**
 * Smoke: fill blank baseline template → temp/eastern-os-baseline-profile-*.html
 * Run: pnpm tsx scripts/smoke-baseline-profile-offline-html.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import {
  baselineProfileOfflineFilename,
  buildBaselineProfileOfflineHtml,
  getBaselineProfileBlankTemplate,
} from "@/lib/poju/baseline-profile-offline-html";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";
import { getBaziChart } from "shunshi-bazi-core";

const birth: BirthInfo = {
  year: 1994,
  month: 8,
  day: 12,
  hour_period: "si",
  hour: 10,
  minute: 0,
  gender: "M",
  timezone: "Asia/Shanghai",
  birth_location: {
    name: "Shanghai",
    longitude: 121.47,
    latitude: 31.23,
    timezone: "Asia/Shanghai",
    use_defaults: false,
  },
};

function buildProfile(): UserProfile {
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
  const tst = chart.真太阳时
    ? {
        original_date: "1994-08-12",
        original_time: "10:00",
        true_solar_date: chart.真太阳时.真太阳时.split(" ")[0]!,
        true_solar_time: chart.真太阳时.真太阳时.split(" ")[1]!.slice(0, 5),
        diff_minutes: chart.真太阳时.修正分钟,
        longitude: params.longitude!,
        timezone: birth.timezone,
        computation_version: "smoke",
      }
    : undefined;
  return {
    id: "smoke-baseline-1994",
    birth: { ...birth, tst_meta: tst },
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "?",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "unknown")],
      challengingElements: [],
      patternSummary: `日主 ${chart.八字?.日主}，四柱 ${chart.八字?.四柱}。`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
    used_true_solar_time: params.usedTrueSolarTime,
    tst_meta: tst,
  } as UserProfile;
}

async function main() {
  const blank = getBaselineProfileBlankTemplate();
  if (!blank.includes("{{SLOT_PANES}}") || !blank.includes("delivery-book-stage")) {
    throw new Error("blank template missing chrome/slots");
  }
  const profile = buildProfile();
  const payload = buildMatrixPayloadFromProfile("smoke-baseline-1994", profile, {
    locale: "zh",
    display_name: "smoke",
  });
  const htmlEmbed = buildBaselineProfileOfflineHtml(payload, "zh", {
    subjectLabel: "smoke",
    embed: true,
  });
  const htmlFile = buildBaselineProfileOfflineHtml(payload, "zh", {
    subjectLabel: "smoke",
    embed: false,
  });
  // Architecture lock: popup embed mode hides Close; file mode shows Close.
  // Preview uses file mode (offline open). Popup uses embed.
  if (htmlEmbed.includes("{{SLOT_")) throw new Error("unfilled slots in embed html");
  if (htmlFile.includes("{{SLOT_")) throw new Error("unfilled slots in file html");
  if (!htmlFile.includes("data-slot-pane=\"calibration\"")) throw new Error("missing B1 pane");
  if (!htmlFile.includes("data-slot-pane=\"core\"")) throw new Error("missing B5 pane");
  if (!htmlFile.includes("pcm-zodiac")) throw new Error("missing zodiac chrome");
  if (!htmlFile.includes("Eastern OS")) throw new Error("missing Eastern OS header");

  const dir = join(process.cwd(), "temp");
  mkdirSync(dir, { recursive: true });
  const name = baselineProfileOfflineFilename();
  const outFile = join(dir, name);
  const outEmbed = join(dir, name.replace(".html", "-embed.html"));
  writeFileSync(outFile, htmlFile, "utf8");
  writeFileSync(outEmbed, htmlEmbed, "utf8");
  // Also stable name for Max preview
  const stable = join(dir, "eastern-os-baseline-profile-smoke.html");
  writeFileSync(stable, htmlFile, "utf8");
  console.log("READY baseline offline html");
  console.log("blank_bytes", blank.length);
  console.log("filled_bytes", htmlFile.length);
  console.log("out", outFile);
  console.log("stable", stable);
  console.log("embed", outEmbed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
