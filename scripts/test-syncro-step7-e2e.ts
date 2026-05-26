/**
 * Syncro v5.1 Step 7 — end-to-end verification (local + optional --live LLM).
 *
 *   pnpm test:syncro-step7
 *   pnpm test:syncro-step7:live
 *   pnpm test:syncro-step7:live -- --server http://localhost:3000
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import { generateSyncroMatrix } from "@/lib/llm/services/syncro-reading-service";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  calculateSyncroMatrix as calculateLocalMatrix,
  generateNext12HourPeriods,
} from "@/lib/syncro/calculate-matrix";
import { calculateCombinationScore } from "@/lib/syncro/calculate-score";
import { extractTaskKeywords } from "@/lib/syncro/task-keyword-extractor";
import type { CurrentLevel } from "@/lib/syncro/current-system";
import type { BirthInfo } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, ".data", "syncro-step7-report.json");
const failures: string[] = [];
const LIVE = process.argv.includes("--live");
const SERVER = (() => {
  const i = process.argv.indexOf("--server");
  return i >= 0 ? process.argv[i + 1] : "http://localhost:3000";
})();

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function distribution(matrix: Record<string, { current_level: CurrentLevel }>) {
  const dist: Record<CurrentLevel, number> = {
    open_current: 0,
    following_current: 0,
    stillwater: 0,
    crosscurrent: 0,
    undertow: 0,
  };
  for (const key of Object.keys(matrix)) {
    dist[matrix[key].current_level]++;
  }
  return dist;
}

const TASK =
  "Tomorrow morning I have a job interview at 10 AM";
const TIMEZONE = "America/New_York";
const START = new Date("2024-05-10T14:00:00Z");

const profileWater = {
  base_analysis: {
    content: {
      bazi: { day_master: "乙" },
      yong_shen: { primary_element: "水" },
    },
  },
};

const profileFire = {
  base_analysis: {
    content: {
      bazi: { day_master: "乙" },
      yong_shen: { primary_element: "火" },
    },
  },
};

const baseInput = {
  profile: profileWater,
  taskDescription: TASK,
  startTime: START,
  userTimezone: TIMEZONE,
  userLongitude: -74.0,
  userLatitude: 40.71,
};

type Report = {
  ran_at: string;
  validations: Record<string, unknown>;
  sample_cells?: Record<string, unknown>;
  live?: Record<string, unknown>;
};

async function runLocalValidations(report: Report): Promise<void> {
  console.log("\n=== Syncro v5.1 Step 7: local validations ===\n");

  // V1 — determinism (5 runs)
  const v1Levels: string[] = [];
  const v1Scores: number[] = [];
  let refKey = "mao__E";
  for (let i = 0; i < 5; i++) {
    const { matrix: m } = calculateLocalMatrix(baseInput);
    if (!m[refKey]) {
      refKey = Object.keys(m).find((k) => k.endsWith("__E")) ?? Object.keys(m)[0];
    }
    v1Levels.push(m[refKey].current_level);
    v1Scores.push(m[refKey]._internal.total_score);
    console.log(`  Run ${i}: ${refKey} → ${m[refKey].current_level} (score ${m[refKey]._internal.total_score})`);
  }
  const v1LevelOk = v1Levels.every((l) => l === v1Levels[0]);
  const v1ScoreOk = v1Scores.every((s) => s === v1Scores[0]);
  assert("V1 determinism — same level ×5", v1LevelOk, v1Levels.join(", "));
  assert("V1 determinism — same score ×5", v1ScoreOk, v1Scores.join(", "));
  report.validations.v1 = { refKey, levels: v1Levels, scores: v1Scores };

  // V2 — distribution
  const { matrix: mMain } = calculateLocalMatrix(baseInput);
  const dist = distribution(mMain);
  console.log("\n  V2 distribution:", dist);
  const favorable = dist.open_current + dist.following_current;
  const harsh = dist.crosscurrent + dist.undertow;
  assert("V2 favorable cells ≥ 5", favorable >= 5, String(favorable));
  assert("V2 harsh cells ≥ 5", harsh >= 5, String(harsh));
  assert("V2 stillwater ≤ 50", dist.stillwater <= 50, String(dist.stillwater));
  report.validations.v2 = { distribution: dist };

  // V3 — personalization water vs fire
  const { matrix: mA } = calculateLocalMatrix({ ...baseInput, profile: profileWater });
  const { matrix: mB } = calculateLocalMatrix({ ...baseInput, profile: profileFire });
  let diffCount = 0;
  for (const key of Object.keys(mA)) {
    if (mA[key].current_level !== mB[key].current_level) diffCount++;
  }
  console.log(`\n  V3 different levels (水 vs 火): ${diffCount}/96`);
  assert("V3 personalization diff > 20", diffCount > 20, String(diffCount));
  report.validations.v3 = { diffCount };

  // V4 — N vs S avg scores (用神水)
  const taskKw = extractTaskKeywords(TASK);
  const periods = generateNext12HourPeriods(START, TIMEZONE);
  const northScores: number[] = [];
  const southScores: number[] = [];
  for (const p of periods) {
    northScores.push(
      calculateCombinationScore({
        yongShenWuXing: "水",
        dayMasterWuXing: "木",
        hourPeriod: p.id,
        direction: "N",
        combinationTime: p.start,
        taskKeywords: taskKw,
      }).total_score,
    );
    southScores.push(
      calculateCombinationScore({
        yongShenWuXing: "水",
        dayMasterWuXing: "木",
        hourPeriod: p.id,
        direction: "S",
        combinationTime: p.start,
        taskKeywords: taskKw,
      }).total_score,
    );
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgN = avg(northScores);
  const avgS = avg(southScores);
  console.log(`\n  V4 avg score N=${avgN.toFixed(2)} S=${avgS.toFixed(2)}`);
  assert("V4 north avg > south avg (水用神)", avgN > avgS, `${avgN} vs ${avgS}`);
  report.validations.v4 = { avgNorth: avgN, avgSouth: avgS, northScores, southScores };

  // V6 — time consistency (+2 min)
  const t1 = new Date("2024-05-10T14:05:00Z");
  const t2 = new Date("2024-05-10T14:07:00Z");
  const { matrix: mT1 } = calculateLocalMatrix({ ...baseInput, startTime: t1 });
  const { matrix: mT2 } = calculateLocalMatrix({ ...baseInput, startTime: t2 });
  let v6diff = 0;
  for (const key of Object.keys(mT1)) {
    if (mT1[key].current_level !== mT2[key].current_level) v6diff++;
  }
  console.log(`\n  V6 level changes within 2 min: ${v6diff}/96`);
  assert("V6 stable within same 时辰 (+2 min)", v6diff === 0, String(v6diff));
  report.validations.v6 = { levelChangesIn2Min: v6diff };

  // V7 — no cache (documented)
  console.log("\n  V7 cache: none — each generateSyncroMatrix call recomputes locally");
  report.validations.v7 = {
    cached: false,
    note: "P1: optional Redis cache (profile + task + 30min)",
  };

  // Sample cells for report (5 levels)
  const byLevel: Partial<Record<CurrentLevel, string>> = {};
  for (const key of Object.keys(mMain)) {
    const lv = mMain[key].current_level;
    if (!byLevel[lv]) byLevel[lv] = key;
  }
  const samples: Record<string, unknown> = {};
  const levelOrder: CurrentLevel[] = [
    "open_current",
    "following_current",
    "stillwater",
    "crosscurrent",
    "undertow",
  ];
  for (const lv of levelOrder) {
    const key = byLevel[lv];
    if (!key) continue;
    const c = mMain[key];
    samples[lv] = {
      key,
      current_level: c.current_level,
      total_score: c._internal.total_score,
      qimen: c._internal.qimen_data,
      key_factors: c._internal.key_factors,
    };
  }
  report.sample_cells = samples;
}

async function runLiveValidation(report: Report): Promise<void> {
  console.log("\n=== Syncro v5.1 Step 7: live LLM validation ===\n");
  loadEnvLocal();

  if (!isOpenRouterConfigured()) {
    console.log("  SKIP live: OPENROUTER_API_KEY not set");
    report.live = { skipped: true, reason: "no_openrouter_key" };
    return;
  }

  const birth: BirthInfo = {
    year: 1977,
    month: 2,
    day: 17,
    hour_period: "yin",
    gender: "M",
    timezone: TIMEZONE,
  };
  const profile = await calculateProfile(birth);
  profile.id = "syncro-step7-live";

  const base_analysis = {
    bazi: { day_master: "乙" },
    yong_shen: { primary_element: "水" },
    day_master: { stem: "乙", element: "木" },
    current_major_luck: { period: "2024-2034", theme: "Career consolidation" },
  };

  const { matrix: localOnly } = calculateLocalMatrix({
    profile: { base_analysis: { content: base_analysis }, user_profile: profile },
    taskDescription: TASK,
    startTime: START,
    userTimezone: TIMEZONE,
    userLongitude: -74.0,
    userLatitude: 40.71,
  });

  console.log("  Calling generateSyncroMatrix (local + LLM)...");
  const result = await generateSyncroMatrix({
    profile_id: profile.id,
    task_description: TASK,
    user_location: { latitude: 40.71, longitude: -74.0, timezone: TIMEZONE },
    locale: "en",
    user_profile: profile,
    base_analysis,
  });

  const matrix = result.matrix;
  const keys = Object.keys(matrix);
  assert("V5 live — 96 keys", keys.length === 96, String(keys.length));

  let adviceOk = true;
  let levelDrift = 0;
  const forbidden = /奇门遁甲|三奇六仪|八门|九星|值符星|天盘|地盘/g;

  for (const key of keys) {
    const cell = matrix[key];
    if (!cell.short_advice || !cell.detailed_advice || !cell.rationale) {
      adviceOk = false;
    }
    if (localOnly[key] && cell.current_level !== localOnly[key].current_level) {
      levelDrift++;
    }
    const visible = `${cell.short_advice} ${cell.detailed_advice} ${cell.rationale}`;
    if (forbidden.test(visible)) {
      assert(`V5 no exposed qimen terms (${key})`, false, visible.slice(0, 80));
    }
  }

  assert("V5 live — all advice fields", adviceOk);
  assert("V5 live — levels match local", levelDrift === 0, `${levelDrift} drifted`);

  const hasChartRef = keys.some((k) => {
    const t = `${matrix[k].rationale} ${matrix[k].detailed_advice}`.toLowerCase();
    return (
      t.includes("day master") ||
      t.includes("日主") ||
      t.includes("用神") ||
      t.includes("favorable") ||
      t.includes("乙")
    );
  });
  assert("V5 live — rationale references chart", hasChartRef);

  const liveSamples = ["open_current", "following_current", "stillwater", "crosscurrent", "undertow"]
    .map((lv) => {
      const key = keys.find((k) => matrix[k].current_level === lv);
      return key
        ? {
            key,
            level: lv,
            short_advice: matrix[key].short_advice.slice(0, 120),
            rationale: matrix[key].rationale.slice(0, 200),
          }
        : null;
    })
    .filter(Boolean);

  report.live = {
    meta: result.meta,
    distribution: result.meta.distribution,
    levelDrift,
    samples: liveSamples,
  };

  console.log("\n  Live meta:", result.meta);
  console.log("  Live samples:", JSON.stringify(liveSamples, null, 2));
}

async function runApiProbe(report: Report): Promise<void> {
  if (!process.argv.includes("--api")) return;
  console.log("\n=== API probe POST /api/syncro/compute ===\n");
  try {
    const res = await fetch(`${SERVER}/api/syncro/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    assert("API reachable", res.status === 400 || res.status === 200, `status ${res.status}`);
    report.validations.api_probe = { status: res.status };
  } catch (e) {
    console.log("  API probe skipped (server not running):", e);
    report.validations.api_probe = { skipped: true };
  }
}

async function main(): Promise<void> {
  const report: Report = { ran_at: new Date().toISOString(), validations: {} };

  await runLocalValidations(report);
  await runApiProbe(report);

  if (LIVE) {
    await runLiveValidation(report);
  } else {
    console.log("\n  (Skip live LLM — run pnpm test:syncro-step7:live with OPENROUTER_API_KEY)");
  }

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReport written: ${REPORT_PATH}`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed:`, failures);
    process.exit(1);
  }
  console.log("\nSyncro Step 7: all requested checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
