/**
 * Match v5.1 Step 6 â€?end-to-end (local matrix + optional --live LLM).
 *
 *   pnpm test:match-step6
 *   pnpm test:match-step6:live
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateMatchAnalysis } from "@/lib/llm/services/match-analysis-service";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { calculateCompatibilityMatrix } from "@/lib/compatibility/calculate-compatibility";
import { calculateDayMasterInteraction } from "@/lib/match/calculations/day-master-interaction";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { BRANCHES, STEMS, type WuXing } from "@/lib/calendar/data/stems-branches";
import { splitPillar } from "@/lib/poju/chart-loader-display";
import type { UserProfile } from "@/lib/profile/types";
import type { SynergyType } from "@/lib/match/types";

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
  console.log(`  [${mark}] ${name}${detail ? ` â€?${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function wuxingDistributionFromProfile(profile: UserProfile): Record<WuXing, number> {
  const dist: Record<WuXing, number> = { æœ? 0, ç? 0, åœ? 0, é‡? 0, æ°? 0 };
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
  å‘½ä¸»åŸºç¡€?: { æ—¥ä¸»åˆ†æ: string };
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
    å‘½ä¸»åŸºç¡€: { æ—¥ä¸»åˆ†æ: `${d.stem}æ—¥ä¸»ç®€è¦` },
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
      year_stem: "ä¸?, year_branch: "å·?,
      month_stem: "ç™?, month_branch: "ä¸?,
      day_stem: "ä¹?, day_branch: "å­?,
      hour_stem: "æˆ?, hour_branch: "å¯?,
    },
    gender: "M",
    yong_shen: { primary_element: "æ°? },
    wuxing_distribution: { 'æœ?: 2, 'ç?: 1, 'åœ?: 2, 'é‡?: 0, 'æ°?: 2 },
    da_yun: { current: { stem: "è¾?, branch: "äº?, is_favorable: true } },
};
const classicalA = wrapProfile(
  testProfile({
    id: "m6-a1",
    birth: { year: 1985, month: 12, day: 15, hour_period: "yin", gender: "M", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "ä¸å·³", monthPillar: "ç™¸ä¸‘", dayPillar: "ä¹™å­", hourPillar: "æˆŠå¯…" },
    diagnosis: { dayMaster: "ä¹™æœ¨", favorableElements: ["æ°?], challengingElements: [], patternSummary: "test" },
  }),
  classicalAContent,
);

const classicalBContent: BaseAnalysisContent = {
    bazi: {
      year_stem: "æˆ?, year_branch: "å?,
      month_stem: "ç”?, month_branch: "å¯?,
      day_stem: "åº?, day_branch: "ä¸?,
      hour_stem: "ä¸?, hour_branch: "äº?,
    },
    gender: "F",
    yong_shen: { primary_element: "æœ? },
    wuxing_distribution: { 'æœ?: 2, 'ç?: 2, 'åœ?: 2, 'é‡?: 1, 'æ°?: 1 },
    da_yun: { current: { stem: "ä¸?, branch: "å·?, is_favorable: true } },
};
const classicalB = wrapProfile(
  testProfile({
    id: "m6-b1",
    birth: { year: 1988, month: 2, day: 22, hour_period: "wei", gender: "F", timezone: "Asia/Shanghai" },
    bazi: { yearPillar: "æˆŠåˆ", monthPillar: "ç”²å¯…", dayPillar: "åºšä¸‘", hourPillar: "ä¸äº¥" },
    diagnosis: { dayMaster: "åºšé‡‘", favorableElements: ["æœ?], challengingElements: [], patternSummary: "test" },
  }),
  classicalBContent,
);

const clashA = wrapProfile(testProfile({
  id: "m6-a2",
  birth: { year: 1984, month: 8, day: 10, hour_period: "si", gender: "M", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "ç™¸äº¥", monthPillar: "ä¸™è¾°", dayPillar: "ç”²å­", hourPillar: "ä¸™å¯…" },
  diagnosis: { dayMaster: "ç”²æœ¨", favorableElements: ["æ°?], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "ç™?, year_branch: "äº?,
    month_stem: "ä¸?, month_branch: "è¾?,
    day_stem: "ç”?, day_branch: "å­?,
    hour_stem: "ä¸?, hour_branch: "å¯?,
  },
  gender: "M",
  yong_shen: { primary_element: "æ°? },
  wuxing_distribution: { 'æœ?: 2, 'ç?: 2, 'åœ?: 1, 'é‡?: 0, 'æ°?: 3 },
});

const clashB = wrapProfile(testProfile({
  id: "m6-b2",
  birth: { year: 1990, month: 6, day: 15, hour_period: "wu", gender: "F", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "ç”²æˆŒ", monthPillar: "ä¸™å¯…", dayPillar: "åºšåˆ", hourPillar: "è¾›å·³" },
  diagnosis: { dayMaster: "åºšé‡‘", favorableElements: ["åœ?], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "ç”?, year_branch: "æˆ?,
    month_stem: "ä¸?, month_branch: "å¯?,
    day_stem: "åº?, day_branch: "å?,
    hour_stem: "è¾?, hour_branch: "å·?,
  },
  gender: "F",
  yong_shen: { primary_element: "åœ? },
  wuxing_distribution: { 'æœ?: 2, 'ç?: 3, 'åœ?: 1, 'é‡?: 2, 'æ°?: 0 },
});

const neutralA = wrapProfile(testProfile({
  id: "m6-a3",
  birth: { year: 1987, month: 4, day: 8, hour_period: "si", gender: "M", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "ä¸å¯", monthPillar: "ç”²è¾°", dayPillar: "ä¸é…‰", hourPillar: "ä¹™å·³" },
  diagnosis: { dayMaster: "ä¸ç«", favorableElements: ["æœ?], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "ä¸?, year_branch: "å?,
    month_stem: "ç”?, month_branch: "è¾?,
    day_stem: "ä¸?, day_branch: "é…?,
    hour_stem: "ä¹?, hour_branch: "å·?,
  },
  gender: "M",
  yong_shen: { primary_element: "æœ? },
  wuxing_distribution: { 'æœ?: 2, 'ç?: 2, 'åœ?: 1, 'é‡?: 1, 'æ°?: 0 },
});

const neutralB = wrapProfile(testProfile({
  id: "m6-b3",
  birth: { year: 1989, month: 11, day: 22, hour_period: "shen", gender: "F", timezone: "Asia/Shanghai" },
  bazi: { yearPillar: "å·±å·³", monthPillar: "ä¹™äº¥", dayPillar: "å£¬å¯…", hourPillar: "åºšç”³" },
  diagnosis: { dayMaster: "å£¬æ°´", favorableElements: ["ç?], challengingElements: [], patternSummary: "test" },
}), {
  bazi: {
    year_stem: "å·?, year_branch: "å·?,
    month_stem: "ä¹?, month_branch: "äº?,
    day_stem: "å£?, day_branch: "å¯?,
    hour_stem: "åº?, hour_branch: "ç”?,
  },
  gender: "F",
  yong_shen: { primary_element: "ç? },
  wuxing_distribution: { 'æœ?: 1, 'ç?: 1, 'åœ?: 1, 'é‡?: 2, 'æ°?: 2 },
});

type Report = {
  ran_at: string;
  openrouter_configured: boolean;
  local: Record<string, unknown>;
  live?: Record<string, unknown>;
};

async function runLocal(report: Report): Promise<void> {
  console.log("\n=== Match v5.1 Step 6: local validations ===\n");

  // Scenario 1 â€?classical harmony
  const c1 = calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  assert("S1 tianhe", c1.day_master_interaction.type === "tianhe", c1.day_master_interaction.type);
  assert("S1 day_branch_he", c1.branch_interactions.day_branch_he);
  assert(
    "S1 level high",
    ["full_resonance", "complementary_flow"].includes(c1.synergy_type),
    c1.synergy_type,
  );
  assert("S1 marriage_palace_bond", c1.key_insights.strengths.includes("marriage_palace_bond"));

  // Scenario 2 â€?clash
  const c2 = calculateCompatibilityMatrix({ profileA: clashA, profileB: clashB });
  assert("S2 tianchong", c2.day_master_interaction.type === "tianchong");
  assert("S2 day_branch_chong", c2.branch_interactions.day_branch_chong);
  assert(
    "S2 level low",
    ["dynamic_tension", "structural_undertow"].includes(c2.synergy_type),
    c2.synergy_type,
  );
  assert("S2 marriage_palace_clash", c2.key_insights.challenges.includes("marriage_palace_clash"));

  // Scenario 3 â€?ä¸å£¬å? neutral / effort
  assert("S3 ä¸å£¬å?, calculateDayMasterInteraction("ä¸?, "å£?).type === "tianhe");
  const c3 = calculateCompatibilityMatrix({ profileA: neutralA, profileB: neutralB });
  assert(
    "S3 level mid",
    ["complementary_flow", "adaptive_balance", "full_resonance"].includes(c3.synergy_type),
    `${c3.synergy_type} score=${c3.resonance_index}`,
  );

  // Scenario 6 â€?determinism (3 runs)
  const scores = [0, 1, 2].map(() =>
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB }).resonance_index,
  );
  assert("S6 deterministic score", scores.every((s) => s === scores[0]), scores.join(", "));
  const levels = [0, 1, 2].map(() =>
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB }).synergy_type,
  );
  assert("S6 deterministic level", levels.every((l) => l === levels[0]));

  // Scenario 7 â€?local compute speed
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) {
    calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  }
  const avgMs = (performance.now() - t0) / 100;
  assert("S7 local avg <50ms", avgMs < 50, `${avgMs.toFixed(2)}ms`);

  // Scenario 5 â€?language detection (no LLM)
  const m = calculateCompatibilityMatrix({ profileA: classicalA, profileB: classicalB });
  const zhP = buildMatchPrompt({
    a_profile: classicalA.user_profile,
    a_base_analysis: classicalA.base_analysis.content,
    b_profile: classicalB.user_profile,
    b_base_analysis: classicalB.base_analysis.content,
    relationship_description: "æˆ‘å’Œæœªå©šå¦»äº¤å¾€ä¸‰å¹´äº†ï¼Œå‡†å¤‡ç»“å©š",
    locale: "en",
    compatibilityMatrix: m,
  });
  const enP = buildMatchPrompt({
    a_profile: classicalA.user_profile,
    a_base_analysis: classicalA.base_analysis.content,
    b_profile: classicalB.user_profile,
    b_base_analysis: classicalB.base_analysis.content,
    relationship_description: "My business partner of 3 years â€?considering expansion",
    locale: "zh",
    compatibilityMatrix: m,
  });
  assert("S5 Chinese detect", zhP.detected_language.includes("Chinese"), zhP.detected_language);
  assert("S5 English detect", enP.detected_language === "English");

  // Distribution sample (20 random-ish pairs)
  const dist: Record<SynergyType, number> = {
    full_resonance: 0,
    complementary_flow: 0,
    adaptive_balance: 0,
    dynamic_tension: 0,
    structural_undertow: 0,
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
    dist[r.synergy_type]++;
  }

  report.local = {
    scenario1: { level: c1.synergy_type, score: c1.resonance_index },
    scenario2: { level: c2.synergy_type, score: c2.resonance_index },
    scenario3: { level: c3.synergy_type, score: c3.resonance_index },
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
    expectedSynergyType?: SynergyType[],
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
      !expectedSynergyType || expectedSynergyType.includes(rpt.conclusion.synergy_type);
    assert(
      `${name} level locked`,
      rpt.conclusion.synergy_type === matrix.synergy_type &&
        rpt._meta.computation_meta?.synergy_type === matrix.synergy_type,
      `report=${rpt.conclusion.synergy_type} matrix=${matrix.synergy_type}`,
    );
    assert(`${name} expected band`, levelOk, rpt.conclusion.synergy_type);

    const sections = ["analysis_a", "analysis_b", "combined", "conclusion", "recommendations"] as const;
    for (const s of sections) {
      assert(`${name} has ${s}`, Boolean(rpt[s]));
    }
    assert(`${name} strengths>=3`, rpt.conclusion.strengths.length >= 3);
    assert(`${name} actions 4-6`, rpt.recommendations.actions.length >= 4);

    const combinedText = `${rpt.combined.detail} ${rpt.combined.five_elements_interaction}`;
    const mentionsChart =
      /ä¹™|åºš|åˆ|å†²|tianhe|harmon|clash|day master|æ—¥ä¸»|å­ä¸‘|å­åˆ/i.test(combinedText);
    assert(`${name} cites chart`, mentionsChart);

    liveResults[name] = {
      matrix_level: matrix.synergy_type,
      matrix_score: matrix.resonance_index,
      report_level: rpt.conclusion.synergy_type,
      latency_ms: elapsed,
      tokens: meta.tokens_used,
      cost_usd: meta.cost_usd,
      detected_language: meta.detected_language,
      local_computation: meta.local_computation,
      resonance_index: meta.resonance_index,
    };
    console.log(
      `  Done ${(elapsed / 1000).toFixed(1)}s | level=${rpt.conclusion.synergy_type} | tokens=${meta.tokens_used}`,
    );
  }

  await runCase(
    "S1_classical",
    classicalA,
    classicalB,
    "We're getting engaged next month and want to know if our charts support a lasting marriage.",
    "en",
    ["full_resonance", "complementary_flow"],
  );

  await runCase(
    "S2_clash",
    clashA,
    clashB,
    "We've been arguing more lately about money and where to live â€?is this a bad match?",
    "en",
    ["dynamic_tension", "structural_undertow"],
  );

  await runCase(
    "S5_zh",
    classicalA,
    classicalB,
    "æˆ‘å’Œæœªå©šå¦»äº¤å¾€ä¸‰å¹´äº†ï¼Œå®¶é‡Œå‚¬å©šï¼Œæƒ³çŸ¥é“å…«å­—ä¸Šæ˜¯å¦é€‚åˆé•¿æœŸåœ¨ä¸€èµ·ã€?,
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
    console.log("\n  (Skip live â€?run: pnpm test:match-step6:live)");
  }

  mkdirSync(resolve(ROOT, ".data"), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n  Report: ${REPORT_PATH}`);

  if (failures.length) {
    console.error("\n  FAILED:", failures.join(", "));
    process.exit(1);
  }
  console.log("\n  Match Step 6 â€?all checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
