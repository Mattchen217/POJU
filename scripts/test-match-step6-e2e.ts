/**
 * Match v5.1 Step 6 — end-to-end (local matrix + optional --live LLM).
 *
 *   pnpm test:match-step6
 *   pnpm test:match-step6:live
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateMatchAnalysis } from "@/lib/llm/services/match-analysis-service";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { calculateDayMasterInteraction } from "@/lib/match/calculations/day-master-interaction";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { BRANCHES, STEMS, type WuXing } from "@/lib/match/data/stems-branches";
import { splitPillar } from "@/lib/poju/chart-loader-display";
import type { UserProfile } from "@/lib/profile/types";
import type { CompatibilityLevel } from "@/lib/match/types";

const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, ".data", "match-step6-report.json");
const LIVE = process.argv.includes("--live");
const failures: string[] = [];

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function wuxingDistributionFromProfile(profile: UserProfile): Record<WuXing, number> {
  const dist: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of [
    profile.bazi.yearPillar,
    profile.bazi.monthPillar,
    profile.bazi.dayPillar,
    profile.bazi.hourPillar,
  ]) {
    const { stem, branch } = splitPillar(p);
    const s = stem as keyof typeof STEMS;
    const b = branch as keyof typeof BRANCHES;
    if (STEMS[s]) dist[STEMS[s].wuxing]++;
    if (BRANCHES[b]) dist[BRANCHES[b].wuxing]++;
  }
  return dist;
}

type BaseAnalysisContent = {
  bazi: Record<string, string>;
  gender: "M" | "F";
  yong_shen: { primary_element: WuXing };
  wuxing_distribution: Record<WuXing, number>;
  da_yun?: { current: { stem: string; branch: string; is_favorable: boolean } };
  命主基础?: { 日主分析: string };
};

function baseContentFromProfile(
  profile: UserProfile,
  yongShen: WuXing,
  daYun?: { stem: string; branch: string; is_favorable: boolean },
): BaseAnalysisContent {
  const y = splitPillar(profile.bazi.yearPillar);
  const m = splitPillar(profile.bazi.monthPillar);
  const d = splitPillar(profile.bazi.dayPillar);
  const h = splitPillar(profile.bazi.hourPillar);
  return {
    bazi: {
      year_stem: y.stem,
      year_branch: y.branch,
      month_stem: m.stem,
      month_branch: m.branch,
      day_stem: d.stem,
      day_branch: d.branch,
      hour_stem: h.stem,
      hour_branch: h.branch,
    },
    gender: profile.birth.gender,
    yong_shen: { primary_element: yongShen },
    wuxing_distribution: wuxingDistributionFromProfile(profile),
    da_yun: daYun ? { current: daYun } : undefined,
    命主基础: { 日主分析: `${d.stem}日主简要` },
  };
}

function wrapProfile(user_profile: UserProfile, content: BaseAnalysisContent) {
  return {
    user_profile,
    base_analysis: { content },
  };
}

function testProfile(partial: Partial<UserProfile> & Pick<UserProfile, "id" | "birth" | "bazi" | "diagnosis">): UserProfile {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "test",
    ...partial,
  } as UserProfile;
}

// --- Fixtures (doc scenarios) ---

const classicalAContent: BaseAnalysisContent = {
    bazi: {
      year_stem: "丁", year_branch: "巳",
      month_stem: "癸", month_branch: "丑",
      day_stem: "乙", day_branch: "子",
      hour_stem: "戊", hour_branch: "寅",
    },
    gender: "M",
    yong_shen: { primary_element: "水" },
    wuxing_distribution: { '木': 2, '火': 1, '土': 2, '金': 0, '水': 2 },
    da_yun: { current: { stem: "辛", branch: "亥", is_favorable: true } },
};
const classicalA = wrapProfile(
  testProfile({
    id: "m6-a1",
    birth: { year: 1985, month: 12, day: 15, hour_period: "yin", gender: "M", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "丁巳", monthPillar: "癸丑", dayPillar: "乙子", hourPillar: "戊寅" },
    diagnosis: { dayMaster: "乙木", favorableElements: ["水"], challengingElements: [], patternSummary: "test" },
  }),
  classicalAContent,
);

const classicalBContent: BaseAnalysisContent = {
    bazi: {
      year_stem: "戊", year_branch: "午",
      month_stem: "甲", month_branch: "寅",
      day_stem: "庚", day_branch: "丑",
      hour_stem: "丁", hour_branch: "亥",
    },
    gender: "F",
    yong_shen: { primary_element: "木" },
    wuxing_distribution: { '木': 2, '火': 2, '土': 2, '金': 1, '水': 1 },
    da_yun: { current: { stem: "丁", branch: "巳", is_favorable: true } },
};
const classicalB = wrapProfile(
  testProfile({
    id: "m6-b1",
    birth: { year: 1988, month: 2, day: 22, hour_period: "wei", gender: "F", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "戊午", monthPillar: "甲寅", dayPillar: "庚丑", hourPillar: "丁亥" },
    diagnosis: { dayMaster: "庚金", favorableElements: ["木"], challengingElements: [], patternSummary: "test" },
  }),
  classicalBContent,
);

const clashA = wrapProfile(testProfile({
  id: "m6-a2",
  birth: { year: 1984, month: 8, day: 10, hour_period: "si", gender: "M", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "癸亥", monthPillar: "丙辰", dayPillar: "甲子", hourPillar: "丙寅" },
  diagnosis: { dayMaster: "甲木", favorableElements: ["水"], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "癸", year_branch: "亥",
    month_stem: "丙", month_branch: "辰",
    day_stem: "甲", day_branch: "子",
    hour_stem: "丙", hour_branch: "寅",
  },
  gender: "M",
  yong_shen: { primary_element: "水" },
  wuxing_distribution: { '木': 2, '火': 2, '土': 1, '金': 0, '水': 3 },
});

const clashB = wrapProfile(testProfile({
  id: "m6-b2",
  birth: { year: 1990, month: 6, day: 15, hour_period: "wu", gender: "F", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "甲戌", monthPillar: "丙寅", dayPillar: "庚午", hourPillar: "辛巳" },
  diagnosis: { dayMaster: "庚金", favorableElements: ["土"], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "甲", year_branch: "戌",
    month_stem: "丙", month_branch: "寅",
    day_stem: "庚", day_branch: "午",
    hour_stem: "辛", hour_branch: "巳",
  },
  gender: "F",
  yong_shen: { primary_element: "土" },
  wuxing_distribution: { '木': 2, '火': 3, '土': 1, '金': 2, '水': 0 },
});

const neutralA = wrapProfile(testProfile({
  id: "m6-a3",
  birth: { year: 1987, month: 4, day: 8, hour_period: "si", gender: "M", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "丁卯", monthPillar: "甲辰", dayPillar: "丁酉", hourPillar: "乙巳" },
  diagnosis: { dayMaster: "丁火", favorableElements: ["木"], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "丁", year_branch: "卯",
    month_stem: "甲", month_branch: "辰",
    day_stem: "丁", day_branch: "酉",
    hour_stem: "乙", hour_branch: "巳",
  },
  gender: "M",
  yong_shen: { primary_element: "木" },
  wuxing_distribution: { '木': 2, '火': 2, '土': 1, '金': 1, '水': 0 },
});

const neutralB = wrapProfile(testProfile({
  id: "m6-b3",
  birth: { year: 1989, month: 11, day: 22, hour_period: "shen", gender: "F", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "己巳", monthPillar: "乙亥", dayPillar: "壬寅", hourPillar: "庚申" },
  diagnosis: { dayMaster: "壬水", favorableElements: ["火"], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "己", year_branch: "巳",
    month_stem: "乙", month_branch: "亥",
    day_stem: "壬", day_branch: "寅",
    hour_stem: "庚", hour_branch: "申",
  },
  gender: "F",
  yong_shen: { primary_element: "火" },
  wuxing_distribution: { '木': 1, '火': 1, '土': 1, '金': 2, '水': 2 },
});

type Report = {
  ran_at: string;
  openrouter_configured: boolean;
  local: Record<string, unknown>;
  live?: Record<string, unknown>;
};

async function runLocal(report: Report): Promise<void> {
  console.log("\n=== Match v5.1 Step 6: local validations ===\n");

  // Scenario 1 — classical harmony
  const c1 = calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  assert("S1 tianhe", c1.day_master_interaction.type === "tianhe", c1.day_master_interaction.type);
  assert("S1 day_branch_he", c1.branch_interactions.day_branch_he);
  assert(
    "S1 level high",
    ["highly_compatible", "compatible_with_effort"].includes(c1.overall_level),
    c1.overall_level,
  );
  assert("S1 marriage_palace_bond", c1.key_insights.strengths.includes("marriage_palace_bond"));

  // Scenario 2 — clash
  const c2 = calculateCompatibilityMatrix({ profileA: clashA, profileB: clashB });
  assert("S2 tianchong", c2.day_master_interaction.type === "tianchong");
  assert("S2 day_branch_chong", c2.branch_interactions.day_branch_chong);
  assert(
    "S2 level low",
    ["challenging", "highly_challenging"].includes(c2.overall_level),
    c2.overall_level,
  );
  assert("S2 marriage_palace_clash", c2.key_insights.challenges.includes("marriage_palace_clash"));

  // Scenario 3 — 丁壬合, neutral / effort
  assert("S3 丁壬合", calculateDayMasterInteraction("丁", "壬").type === "tianhe");
  const c3 = calculateCompatibilityMatrix({ profileA: neutralA, profileB: neutralB });
  assert(
    "S3 level mid",
    ["compatible_with_effort", "neutral", "highly_compatible"].includes(c3.overall_level),
    `${c3.overall_level} score=${c3.weighted_total_score}`,
  );

  // Scenario 6 — determinism (3 runs)
  const scores = [0, 1, 2].map(() =>
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB }).weighted_total_score,
  );
  assert("S6 deterministic score", scores.every((s) => s === scores[0]), scores.join(", "));
  const levels = [0, 1, 2].map(() =>
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB }).overall_level,
  );
  assert("S6 deterministic level", levels.every((l) => l === levels[0]));

  // Scenario 7 — local compute speed
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) {
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  }
  const avgMs = (performance.now() - t0) / 100;
  assert("S7 local avg <50ms", avgMs < 50, `${avgMs.toFixed(2)}ms`);

  // Scenario 5 — language detection (no LLM)
  const m = calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  const zhP = buildMatchPrompt({
    a_profile: classicalA.user_profile,
    a_base_analysis: classicalA.base_analysis.content,
    b_profile: classicalB.user_profile,
    b_base_analysis: classicalB.base_analysis.content,
    relationship_description: "我和未婚妻交往三年了，准备结婚",
    locale: "en",
    compatibilityMatrix: m,
  });
  const enP = buildMatchPrompt({
    a_profile: classicalA.user_profile,
    a_base_analysis: classicalA.base_analysis.content,
    b_profile: classicalB.user_profile,
    b_base_analysis: classicalB.base_analysis.content,
    relationship_description: "My business partner of 3 years — considering expansion",
    locale: "zh",
    compatibilityMatrix: m,
  });
  assert("S5 Chinese detect", zhP.detected_language.includes("Chinese"), zhP.detected_language);
  assert("S5 English detect", enP.detected_language === "English");

  // Distribution sample (20 random-ish pairs)
  const dist: Record<CompatibilityLevel, number> = {
    highly_compatible: 0,
    compatible_with_effort: 0,
    neutral: 0,
    challenging: 0,
    highly_challenging: 0,
  };
  const pairs = [
    [classicalA, classicalB],
    [clashA, clashB],
    [neutralA, neutralB],
    [classicalA, clashB],
    [clashA, classicalB],
  ];
  for (let i = 0; i < 20; i++) {
    const [pa, pb] = pairs[i % pairs.length]!;
    const r = calculateCompatibilityMatrix({ profileA: pa, profileB: pb });
    dist[r.overall_level]++;
  }

  report.local = {
    scenario1: { level: c1.overall_level, score: c1.weighted_total_score },
    scenario2: { level: c2.overall_level, score: c2.weighted_total_score },
    scenario3: { level: c3.overall_level, score: c3.weighted_total_score },
    determinism_score: scores[0],
    avg_compute_ms: Number(avgMs.toFixed(3)),
    level_distribution_20: dist,
  };

  console.log("\n  Local summary:", JSON.stringify(report.local, null, 2));
}

async function runLive(report: Report): Promise<void> {
  console.log("\n=== Match v5.1 Step 6: live LLM validation ===\n");
  loadEnvLocal();

  const configured = isOpenRouterConfigured();
  console.log(`  OPENROUTER_API_KEY: ${configured ? "configured" : "NOT SET"}`);
  report.openrouter_configured = configured;

  if (!configured) {
    report.live = { skipped: true, reason: "no_openrouter_key" };
    console.log("  SKIP live LLM tests");
    return;
  }

  const liveResults: Record<string, unknown> = {};

  async function runCase(
    name: string,
    pa: typeof classicalA,
    pb: typeof classicalB,
    relationship: string,
    locale: string,
    expectedLevel?: CompatibilityLevel[],
  ) {
    console.log(`\n  --- Live: ${name} ---`);
    const matrix = calculateCompatibilityMatrix({ profileA: pa, profileB: pb });
    const t0 = Date.now();
    const result = await generateMatchAnalysis({
      a_profile_id: pa.user_profile.id,
      b_profile_id: pb.user_profile.id,
      relationship_description: relationship,
      locale,
      a_user_profile: pa.user_profile,
      a_base_analysis: pa.base_analysis.content,
      b_user_profile: pb.user_profile,
      b_base_analysis: pb.base_analysis.content,
    });
    const elapsed = Date.now() - t0;
    const { report: rpt, meta } = result;

    const levelOk =
      !expectedLevel || expectedLevel.includes(rpt.conclusion.compatibility_level);
    assert(
      `${name} level locked`,
      rpt.conclusion.compatibility_level === matrix.overall_level &&
        rpt._meta.computation_meta?.overall_level === matrix.overall_level,
      `report=${rpt.conclusion.compatibility_level} matrix=${matrix.overall_level}`,
    );
    assert(`${name} expected band`, levelOk, rpt.conclusion.compatibility_level);

    const sections = ["analysis_a", "analysis_b", "combined", "conclusion", "recommendations"] as const;
    for (const s of sections) {
      assert(`${name} has ${s}`, Boolean(rpt[s]));
    }
    assert(`${name} strengths>=3`, rpt.conclusion.strengths.length >= 3);
    assert(`${name} actions 4-6`, rpt.recommendations.actions.length >= 4);

    const combinedText = `${rpt.combined.detail} ${rpt.combined.five_elements_interaction}`;
    const mentionsChart =
      /乙|庚|合|冲|tianhe|harmon|clash|day master|日主|子丑|子午/i.test(combinedText);
    assert(`${name} cites chart`, mentionsChart);

    liveResults[name] = {
      matrix_level: matrix.overall_level,
      matrix_score: matrix.weighted_total_score,
      report_level: rpt.conclusion.compatibility_level,
      latency_ms: elapsed,
      tokens: meta.tokens_used,
      cost_usd: meta.cost_usd,
      detected_language: meta.detected_language,
      local_computation: meta.local_computation,
      compatibility_score: meta.compatibility_score,
    };
    console.log(
      `  Done ${(elapsed / 1000).toFixed(1)}s | level=${rpt.conclusion.compatibility_level} | tokens=${meta.tokens_used}`,
    );
  }

  await runCase(
    "S1_classical",
    classicalA,
    classicalB,
    "We're getting engaged next month and want to know if our charts support a lasting marriage.",
    "en",
    ["highly_compatible", "compatible_with_effort"],
  );

  await runCase(
    "S2_clash",
    clashA,
    clashB,
    "We've been arguing more lately about money and where to live — is this a bad match?",
    "en",
    ["challenging", "highly_challenging"],
  );

  await runCase(
    "S5_zh",
    classicalA,
    classicalB,
    "我和未婚妻交往三年了，家里催婚，想知道八字上是否适合长期在一起。",
    "en",
    undefined,
  );

  const zhReport = liveResults.S5_zh as { detected_language?: string };
  assert(
    "S5 live Chinese output",
    typeof zhReport?.detected_language === "string" &&
      zhReport.detected_language.includes("Chinese"),
  );

  report.live = liveResults;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const report: Report = {
    ran_at: new Date().toISOString(),
    openrouter_configured: isOpenRouterConfigured(),
    local: {},
  };

  await runLocal(report);

  if (LIVE) {
    await runLive(report);
  } else {
    console.log("\n  (Skip live — run: pnpm test:match-step6:live)");
  }

  mkdirSync(resolve(ROOT, ".data"), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n  Report: ${REPORT_PATH}`);

  if (failures.length) {
    console.error("\n  FAILED:", failures.join(", "));
    process.exit(1);
  }
  console.log("\n  Match Step 6 — all checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
