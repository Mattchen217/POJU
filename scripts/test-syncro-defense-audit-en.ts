/**
 * Syncro four defenses + audit-only + live EN hour copy.
 * Run: pnpm tsx scripts/test-syncro-defense-audit-en.ts
 * Live: pnpm tsx scripts/test-syncro-defense-audit-en.ts --live
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  detectSyncroOutputViolations,
  sanitizeSyncroText,
} from "@/lib/syncro/sanitize-output";

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

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function hasBlackTerms(text: string): boolean {
  return (
    /\b(?:qimen|dunjia|feng\s*shui|auspicious|ominous|shichen)\b/i.test(text) ||
    /\b(?:day\s+master|yong\s*shen|four\s+pillars)\b/i.test(text) ||
    /奇门|风水|吉时|凶时/.test(text)
  );
}

function hasPrediction(text: string): boolean {
  return (
    /\bwill\s+succeed\b/i.test(text) ||
    /\bbrings?\s+(?:you\s+)?luck\b/i.test(text) ||
    /\bwill\s+bring\s+(?:you\s+)?success\b/i.test(text) ||
    /会成功|带来好运/.test(text)
  );
}

function hasIChing(text: string): boolean {
  return /I Ching|Book of Changes|时位|timing and position/i.test(text);
}

function usesSyncro(text: string): boolean {
  return /\bSyncro\b/i.test(text);
}

function mainStatic(): void {
  const base = readFileSync(resolve(ROOT, "lib/llm/prompts/syncro-base.ts"), "utf8");
  assert(base.includes("SYNCRO_OUTPUT_FRAMING"), "syncro-base has framing");
  assert(base.includes("SYNCRO_OUTPUT_DEFENSE_PREDICTION"), "syncro-base has prediction defense");
  assert(base.includes("《易经》"), "framing mentions I Ching");
  assert(base.includes("buildSyncroFullPromptSections"), "full prompt builder");

}

function mainStaticAudit(): void {
  const leaky = "Qimen shows auspicious southeast; you will succeed at 3pm.";
  const out = sanitizeSyncroText(leaky, "en");
  assert(out === leaky, "sanitize returns text unchanged");
  assert(detectSyncroOutputViolations(leaky, "en").length > 0, "detects leaky EN");
}

async function mainLive(): Promise<void> {
  loadEnvLocal();
  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  const { auditSyncroHourAdvice } = await import("@/lib/syncro/sanitize-output");
  if (!isOpenRouterConfigured()) {
    console.log("\n[SKIP] --live requires OPENROUTER_API_KEY");
    return;
  }

  const { generateSyncroHourAdvice } = await import("@/lib/syncro/syncro-llm-core");

  const task = "sign a business contract";
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

  const profile_summary = `Core nature: expressive, structured decision-making. Current 10-year life cycle emphasizes visibility and negotiation skill. Key supporting energy favors clarity and steady pacing in formal agreements.`;

  console.log("\n=== live EN Syncro hour (sign a business contract) ===\n");

  const result = await generateSyncroHourAdvice({
    session_id: `syncro-defense-test-${Date.now()}`,
    hour_id: "wu",
    hour_label: "Wu",
    hour_range: "11:00–13:00",
    cells,
    task_description: task,
    profile_summary,
    locale: "en",
  });

  const sampleDir = result.advice[cells[0]!.key];
  const sample = sampleDir
    ? [sampleDir.short_advice, sampleDir.detailed_advice, sampleDir.rationale].join("\n\n")
    : "";

  for (const cell of cells) {
    const a = result.advice[cell.key];
    if (!a) continue;
    console.log(`\n--- ${cell.direction} (${cell.current_level}) ---`);
    console.log("short:", a.short_advice);
    console.log("rationale:", a.rationale);
  }

  const merged = Object.values(result.advice)
    .flatMap((c) => [c.short_advice, c.detailed_advice, c.rationale])
    .join("\n");

  const violations = auditSyncroHourAdvice(result.advice, "en");
  console.log(`\n--- audit violations: ${violations.length} ---`);
  if (violations.length > 0) console.error(violations.slice(0, 12));

  assert(!hasBlackTerms(merged), "no Qimen/Feng Shui/auspicious/Day Master");
  assert(!hasPrediction(merged), "no will succeed / brings luck");
  assert(hasIChing(merged), "I Ching framework present");
  assert(usesSyncro(merged), "uses Syncro naming");
  assert(sample.length > 40, "sample output non-empty");
}

async function main(): Promise<void> {
  mainStatic();
  mainStaticAudit();
  if (process.argv.includes("--live")) {
    await mainLive();
  } else {
    console.log("\n(Tip: pnpm tsx scripts/test-syncro-defense-audit-en.ts --live)\n");
  }
  if (process.exitCode) process.exit(1);
  console.log("\nAll Syncro defense checks passed.");
}

void main();
