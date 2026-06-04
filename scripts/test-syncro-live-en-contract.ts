/**
 * Live EN Syncro hour via batch-core (production path) — salary increase task.
 * Run: pnpm tsx scripts/test-syncro-live-en-contract.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const BLACK_TERMS =
  /午火|忌神|坤宫|印旺|水元素|奇门|八字|用神|qimen|auspicious|unlucky|good luck/i;

async function main(): Promise<void> {
  loadEnvLocal();
  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY required");
    process.exit(1);
  }

  const { generateSyncroHoursAdvice } = await import("@/lib/syncro/syncro-llm-batch-core");
  const { detectSyncroOutputViolations } = await import("@/lib/syncro/sanitize-output");

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const levels = [
    "open_current",
    "following_current",
    "stillwater",
    "crosscurrent",
    "undertow",
    "following_current",
    "open_current",
    "stillwater",
  ];

  const cells = directions.map((direction, i) => ({
    key: `wu__${direction}`,
    direction,
    current_level: levels[i]!,
    key_hints: ["resonance alignment", "task fit"],
  }));

  const profileSummary = JSON.stringify({
    day_master: "Geng",
    yong_shen: "Water",
    life_phase: "visibility cycle",
    core_traits: ["structured", "decisive"],
  });

  const result = await generateSyncroHoursAdvice({
    session_id: `syncro-live-${Date.now()}`,
    hours: [
      {
        hour_id: "wu",
        hour_label: "Wu",
        hour_range: "11:00–13:00",
        cells,
      },
    ],
    task_description: "negotiate a salary increase with my manager tomorrow afternoon",
    profile_summary: profileSummary,
    locale: "en",
  });

  console.log("\n--- EN Syncro batch output (Wu hour, 8 directions) ---\n");

  let sampleRationale = "";
  let sampleDetailed = "";

  for (const cell of cells) {
    const a = result.advice[cell.key];
    if (!a) continue;
    console.log(`\n### ${cell.direction} (${cell.current_level})\n`);
    console.log("**short:**", a.short_advice);
    console.log("\n**rationale (WHY THIS CURRENT):**", a.rationale);
    console.log("\n**detailed:**", a.detailed_advice);
    if (!sampleRationale) {
      sampleRationale = a.rationale;
      sampleDetailed = a.detailed_advice;
    }
  }

  const merged = Object.values(result.advice)
    .flatMap((c) => [c.short_advice, c.detailed_advice, c.rationale])
    .join("\n");

  console.log("\n--- WHY THIS CURRENT modal sample ---");
  console.log("rationale:", sampleRationale);
  console.log("detailed:", sampleDetailed);

  console.log("\n--- quick checks ---");
  console.log("has Syncro:", /\bSyncro\b/i.test(merged));
  console.log("has I Ching:", /I Ching|Book of Changes|timing and position|时位/i.test(merged));
  console.log("has Qimen:", /\bqimen\b/i.test(merged));
  console.log("has will succeed:", /\bwill\s+succeed\b/i.test(merged));
  console.log("has luck:", /\b(?:good\s+)?luck\b/i.test(merged));
  console.log("has black terms:", BLACK_TERMS.test(merged));
  console.log("mostly English (no CJK run):", !/[\u4e00-\u9fff]{4,}/.test(merged));

  const violations = detectSyncroOutputViolations(merged, "en");
  console.log("audit violations:", violations.length);
  if (violations.length > 0) {
    console.log(violations.slice(0, 8));
  }

  if (BLACK_TERMS.test(merged) || /[\u4e00-\u9fff]{4,}/.test(merged)) {
    process.exit(1);
  }
}

void main();
