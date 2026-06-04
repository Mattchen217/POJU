/**
 * Glyph audit-only + I Ching prompt verification (English).
 * Run: pnpm tsx scripts/test-glyph-iching-audit-en.ts
 * Live: pnpm tsx scripts/test-glyph-iching-audit-en.ts --live
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateProfile } from "@/lib/calculations";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import { signDataToPromptGlyph } from "@/lib/glyph/sign-to-prompt";
import {
  auditGlyphReadingContent,
  sanitizeGlyphOutput,
  sanitizeGlyphReadingContent,
} from "@/lib/glyph/sanitize-output";
import { generateGlyphReading } from "@/lib/llm/services/glyph-reading-service";
import {
  buildBaseAnalysisPrompt,
  parseBaseAnalysisResponseText,
} from "@/lib/llm/deepseek/base-analysis";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { SignData } from "@/types/oracle";

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

function hasIChingFramework(text: string): boolean {
  return /I Ching|Book of Changes|《易经》|变化之道|时位|cyclical transformation/i.test(text);
}

function mainStatic(): void {
  console.log("=== prompt contains I Ching framework ===");
  const guanyin = readFileSync(resolve(ROOT, "lib/llm/prompts/glyph-guanyin-base.ts"), "utf8");
  const deepseek = readFileSync(resolve(ROOT, "lib/llm/prompts/glyph-deepseek-prompt.ts"), "utf8");
  assert(guanyin.includes("GLYPH_OUTPUT_ICHING_FRAMEWORK"), "guanyin-base exports I Ching block");
  assert(guanyin.includes("Book of Changes"), "I Ching EN name in block");
  assert(deepseek.includes("GLYPH_OUTPUT_ICHING_FRAMEWORK"), "deepseek prompt stitches I Ching block");

  console.log("\n=== audit-only — text unchanged ===");
  const leaky = "Your Day Master is Yi Wood. You will meet someone next month.";
  const out = sanitizeGlyphOutput(leaky, "en");
  assert(out === leaky, "sanitizeGlyphOutput returns text unchanged");

  console.log("\n=== audit detects violations ===");
  const violations = auditGlyphReadingContent(
    {
      wind_category_blurb: "Fair Sky energy.",
      classical_voice: leaky,
      命理双视角: {
        命理看此事: "Core nature shows resilience.",
        签文看此事: "Archetypal pattern of renewal.",
        两者印证或冲突: "Both align on present readiness.",
      },
      meaning_for_question: leaky,
      hidden_tension: "Waiting may feel passive.",
      your_moment: "Connection is forming through small choices.",
      exploration: {
        text: "Write three qualities tonight.",
        timeframe: "tonight",
        duration_estimate: "10 minutes",
        is_solo: true,
      },
      reflection_question: "What becomes clearer when you stop asking when?",
    },
    "en",
  );
  assert(violations.length > 0, "audit flags black words + prediction");
}

async function mainLive(): Promise<void> {
  loadEnvLocal();
  if (!isOpenRouterConfigured()) {
    console.log("\n[SKIP] --live requires OPENROUTER_API_KEY");
    return;
  }

  console.log("\n=== live English Glyph generation ===");
  const profile = await calculateProfile({
    year: 1977,
    month: 2,
    day: 17,
    hour_period: "yin",
    gender: "M",
    timezone: "Asia/Shanghai",
  });
  profile.id = "glyph-iching-audit-test";

  const signs = JSON.parse(
    readFileSync(resolve(ROOT, "lib/glyph/data/signs.json"), "utf8"),
  ) as SignData[];
  const sign = signs.find((s) => s.sign_number === 42) ?? signs[0]!;
  const question =
    "I'm considering remarriage after a long pause — what does my present readiness look like?";

  const { system, user } = buildBaseAnalysisPrompt(profile);
  const baseResult = await callLLM({
    call_type: "deep_analysis",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 15000,
    response_format: "json",
    thinking_effort: "high",
  });
  const base_analysis = parseBaseAnalysisResponseText(baseResult.content);

  const built = buildGlyphReadingPrompt({
    profile,
    base_analysis,
    question,
    glyph: signDataToPromptGlyph(sign),
    locale: "en",
  });
  assert(built.system.includes("《易经》"), "built prompt includes 易经 framework");

  const result = await generateGlyphReading({
    sign,
    question,
    locale: "en",
    profile_id: profile.id,
    user_profile: profile,
    base_analysis,
  });

  const reading = sanitizeGlyphReadingContent(result.reading, "en");
  const merged = [
    reading.classical_voice,
    reading.命理双视角.签文看此事,
    reading.命理双视角.两者印证或冲突,
    reading.meaning_for_question,
    reading.your_moment,
  ].join("\n\n");

  console.log("\n--- English output (unchanged by audit) ---\n");
  console.log(merged);

  const violations = auditGlyphReadingContent(reading, "en");
  console.log(`\n--- audit violations: ${violations.length} ---`);
  if (violations.length > 0) {
    console.error(violations);
  }

  assert(hasIChingFramework(merged), "output naturally includes I Ching framework");
  assert(violations.length === 0, "0 black-word violations (prompt compliance)");
}

async function main(): Promise<void> {
  mainStatic();
  if (process.argv.includes("--live")) {
    await mainLive();
  } else {
    console.log("\n(Tip: pnpm tsx scripts/test-glyph-iching-audit-en.ts --live for live EN Glyph)\n");
  }
  if (process.exitCode) process.exit(1);
  console.log("\nAll I Ching + audit-only checks passed.");
}

void main();
