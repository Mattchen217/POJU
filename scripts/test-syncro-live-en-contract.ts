/**
 * Live EN Syncro hour — sign a business contract (minimal imports).
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

async function main(): Promise<void> {
  loadEnvLocal();
  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY required");
    process.exit(1);
  }

  const { generateSyncroHourAdvice } = await import("@/lib/syncro/syncro-llm-core");

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

  const result = await generateSyncroHourAdvice({
    session_id: `syncro-live-${Date.now()}`,
    hour_id: "wu",
    hour_label: "Wu",
    hour_range: "11:00–13:00",
    cells,
    task_description: "sign a business contract",
    profile_summary:
      "Core nature: expressive, structured decision-making. Current 10-year life cycle emphasizes visibility and negotiation skill. Key supporting energy favors clarity and steady pacing in formal agreements.",
    locale: "en",
  });

  console.log("\n--- EN Syncro output (Wu hour, 8 directions) ---\n");

  for (const cell of cells) {
    const a = result.advice[cell.key];
    if (!a) continue;
    console.log(`\n### ${cell.direction} (${cell.current_level})\n`);
    console.log("**short:**", a.short_advice);
    console.log("\n**rationale:**", a.rationale);
  }

  const merged = Object.values(result.advice)
    .flatMap((c) => [c.short_advice, c.detailed_advice, c.rationale])
    .join("\n");

  console.log("\n--- quick checks ---");
  console.log("has Syncro:", /\bSyncro\b/i.test(merged));
  console.log("has I Ching:", /I Ching|Book of Changes|timing and position/i.test(merged));
  console.log("has Qimen:", /\bqimen\b/i.test(merged));
  console.log("has will succeed:", /\bwill\s+succeed\b/i.test(merged));
  console.log("has luck:", /\b(?:good\s+)?luck\b/i.test(merged));
}

void main();
