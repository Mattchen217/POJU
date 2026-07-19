/**
 * Matrix fact panel · local cards
 *   pnpm exec tsx scripts/test-matrix-fact-panel.ts
 */
import { buildMatrixFactPanel } from "@/lib/poju/build-matrix-fact-panel";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

const structured = {
  day_master: "甲",
  pattern: "",
  yong_shen: "水",
  xi_shen: ["水", "木"],
  ji_shen: ["土"],
  strength: "weak",
  four_pillars: { year: "甲子", month: "丙寅", day: "甲子", hour: "戊辰" },
  pillars_detail: {
    year: {
      ganzhi: "甲子",
      stem: "甲",
      branch: "子",
      ten_god: "比肩",
      hidden_stems: [],
      shen_sha: [],
      life_stage: "",
    },
    month: {
      ganzhi: "丙寅",
      stem: "丙",
      branch: "寅",
      ten_god: "食神",
      hidden_stems: [],
      shen_sha: [],
      life_stage: "",
    },
    day: {
      ganzhi: "甲子",
      stem: "甲",
      branch: "子",
      ten_god: "日主",
      hidden_stems: [],
      shen_sha: [],
      life_stage: "",
    },
    hour: {
      ganzhi: "戊辰",
      stem: "戊",
      branch: "辰",
      ten_god: "偏财",
      hidden_stems: [],
      shen_sha: [],
      life_stage: "",
    },
  },
  da_yun: [
    { start_age: 8, start_year: 2000, ganzhi: "丁卯" },
    { start_age: 18, start_year: 2010, ganzhi: "戊辰" },
  ],
  data_availability: {
    pillars_detail: true,
    da_yun: true,
    bazi_enrichment: false,
  },
} as ProfileStructured;

function main(): void {
  console.log("\n===== Matrix fact panel =====\n");
  const fp = buildMatrixFactPanel({
    structured,
    dayunIndex: 1,
    dayunTheme: "Expansion",
    dayunAgeRange: "18–27",
    dayunStartYear: 2010,
    currentAge: 28,
    transitYear: 2026,
    transitProgressPct: 40,
    transitStemElement: "Fire",
    luckOnsetRaw: "4岁",
    luckOnsetDate: "1994-03-01",
    locale: "zh",
  });

  assert("era age range", Boolean(fp.era.age_range));
  assert("era has stem soft", Boolean(fp.era.stem_element_soft));
  assert("era progress", typeof fp.era.progress_pct === "number");
  assert("year pulse soft", Boolean(fp.year_pulse.stem_element_soft));
  assert("year pulse links array", Array.isArray(fp.year_pulse.links));
  assert("balance strength soft", Boolean(fp.balance.strength_soft));
  assert("yong soft present", Boolean(fp.balance.yong_soft));
  assert("no bare 水 in yong", fp.balance.yong_soft !== "水");
  assert("structure arrays exist", Array.isArray(fp.structure.bonds));
  assert("structure bonds cap", fp.structure.bonds.length <= 5);
  assert("balance xi chips", Array.isArray(fp.balance.xi));
  assert("strength slug", fp.balance.strength_slug === "weak_self");
  assert("year_sign zodiac", Boolean(fp.year_sign.zodiac_soft));
  assert("shensha highlights array", Array.isArray(fp.shensha_highlights));
  assert("luck onset age", fp.luck_onset.start_age === 4);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
