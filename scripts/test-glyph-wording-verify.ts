/**
 * Glyph wording + section labels + live CN/EN verification.
 * Run: pnpm tsx scripts/test-glyph-wording-verify.ts
 * Live: pnpm tsx scripts/test-glyph-wording-verify.ts --live
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateProfile } from "@/lib/calculations";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import { signDataToPromptGlyph } from "@/lib/glyph/sign-to-prompt";
import { glyphReportSectionLabels } from "@/lib/glyph/report-section-labels";
import { auditGlyphReadingContent } from "@/lib/glyph/sanitize-output";
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

function hasForbiddenWording(text: string, lang: string): boolean {
  if (lang.startsWith("zh")) {
    return /签(?:文|诗|意|号|筒)?|抽签|求签|灵签/.test(text);
  }
  return /\b(?:the|this|a|an|oracle|divination|fortune)\s+sign\b|\blot\b/i.test(text);
}

function hasIChing(text: string): boolean {
  return /I Ching|Book of Changes|《易经》|变化之道|时位/i.test(text);
}

function usesGlyph(text: string): boolean {
  return /Glyph|Glyph 文|the Glyph text|this Glyph/i.test(text);
}

function mainStatic(): void {
  const guanyin = readFileSync(resolve(ROOT, "lib/llm/prompts/glyph-guanyin-base.ts"), "utf8");
  const deepseek = readFileSync(resolve(ROOT, "lib/llm/prompts/glyph-deepseek-prompt.ts"), "utf8");
  assert(guanyin.includes("GLYPH_OUTPUT_WORDING"), "prompt has GLYPH_OUTPUT_WORDING");
  assert(deepseek.includes("GLYPH_OUTPUT_WORDING"), "deepseek stitches wording block");

  const zhLabels = glyphReportSectionLabels("zh");
  assert(zhLabels.section_classical === "这个 Glyph 说什么", "zh section title");
  assert(zhLabels.view_glyph_title === "从 Glyph 的角度看", "zh glyph view title");

  const enLabels = glyphReportSectionLabels("en");
  assert(enLabels.section_dual_view === "Dual perspective analysis", "en dual view title");
}

async function runLive(lang: "zh" | "en"): Promise<void> {
  const question =
    lang === "zh"
      ? "经历长期停顿后，我在考虑再婚——我当下的准备度如何？"
      : "After a long pause, I'm considering remarriage — what does my present readiness look like?";

  const profile = await calculateProfile({
    year: 1977,
    month: 2,
    day: 17,
    hour_period: "yin",
    gender: "M",
    timezone: "Asia/Shanghai",
  });
  profile.id = `glyph-wording-${lang}`;

  const signs = JSON.parse(
    readFileSync(resolve(ROOT, "lib/glyph/data/signs.json"), "utf8"),
  ) as SignData[];
  const sign = signs.find((s) => s.sign_number === 42) ?? signs[0]!;

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
    locale: lang,
  });
  assert(built.system.includes("Glyph 措辞统一") || built.system.includes("GLYPH_OUTPUT_WORDING"), `${lang} prompt has wording`);

  const result = await generateGlyphReading({
    sign,
    question,
    locale: lang,
    profile_id: profile.id,
    user_profile: profile,
    base_analysis,
  });

  const reading = result.reading;
  const merged = [
    reading.classical_voice,
    reading.命理双视角.签文看此事,
    reading.meaning_for_question,
    reading.your_moment,
  ].join("\n\n");

  const labels = glyphReportSectionLabels(lang);
  console.log(`\n=== ${lang.toUpperCase()} section labels ===`);
  console.log(labels.section_classical, "|", labels.view_glyph_title);

  console.log(`\n--- ${lang.toUpperCase()} output ---\n`);
  console.log(merged);

  const violations = auditGlyphReadingContent(reading, lang);
  console.log(`\n--- audit violations: ${violations.length} ---`);
  if (violations.length > 0) console.error(violations.slice(0, 8));

  assert(!hasForbiddenWording(merged, lang), `${lang}: no 签/sign/lot`);
  assert(usesGlyph(merged), `${lang}: uses Glyph wording`);
  assert(hasIChing(merged), `${lang}: I Ching framework present`);
}

async function main(): Promise<void> {
  mainStatic();
  if (process.argv.includes("--live")) {
    loadEnvLocal();
    if (!isOpenRouterConfigured()) {
      console.log("\n[SKIP] --live requires OPENROUTER_API_KEY");
      return;
    }
    await runLive("en");
    await runLive("zh");
  } else {
    console.log("\n(Tip: pnpm tsx scripts/test-glyph-wording-verify.ts --live)\n");
  }
  if (process.exitCode) process.exit(1);
  console.log("\nAll wording checks passed.");
}

void main();
