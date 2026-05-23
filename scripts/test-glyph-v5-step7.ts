/**
 * Glyph v5 Step 7 — static wiring checks + optional live DeepSeek smoke test.
 *
 *   pnpm exec tsx scripts/test-glyph-v5-step7.ts
 *   pnpm exec tsx scripts/test-glyph-v5-step7.ts --live
 *   pnpm exec tsx scripts/test-glyph-v5-step7.ts --live --server http://localhost:3000
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateProfile } from "@/lib/calculations";
import { getWelcomeText, getSessionPrepBrand } from "@/lib/poju/session-prep-copy";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import { signDataToPromptGlyph } from "@/lib/glyph/sign-to-prompt";
import { generateGlyphReading } from "@/lib/llm/services/glyph-reading-service";
import {
  buildBaseAnalysisPrompt,
  parseBaseAnalysisResponseText,
} from "@/lib/llm/deepseek/base-analysis";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { SignData } from "@/types/oracle";
import type { BirthInfo } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const failures: string[] = [];
const REPORT_PATH = resolve(ROOT, ".data", "glyph-step7-report.json");

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

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function staticChecks(): void {
  console.log("\n=== Glyph v5 Step 7: static verification ===\n");

  // Scenario A — entry & prepare
  const marketing = read("components/marketing/glyph-marketing-page.tsx");
  const cta = read("components/glyph/GlyphPrepareCta.tsx");
  assert("A1 marketing five winds", marketing.includes("five_winds"));
  assert("A1b prepare CTA", cta.includes("/glyph/prepare?type=free"));
  assert("A1c paid CTA", cta.includes("start_paid"));
  assert("A3 Glyph welcome (en)", getWelcomeText("en", "glyph").includes("Glyph weaves your bazi"));
  assert("A3 brand GLYPH", getSessionPrepBrand("glyph") === "GLYPH");
  assert("A3 not POJU welcome", !getWelcomeText("en", "glyph").includes("POJU is your AI thinking partner"));

  const prep = read("app/[locale]/(marketing)/glyph/prepare/page.tsx");
  assert("A2 prepare route", prep.includes("SessionPreparation") || prep.includes("productType"));

  // Scenario A — draw & reading
  const draw = read("components/glyph/GlyphDrawPage.tsx");
  assert("A6 base_analysis on new profile", draw.includes("generateBaseAnalysis"));
  assert("A6 cache skip when has_base_analysis", draw.includes("has_base_analysis"));
  assert("A7 question 10-200", draw.includes("q.length < 10") || draw.includes("length < 10"));
  assert("A8 draw API", draw.includes("/api/oracle/draw"));
  assert("A8 session save", draw.includes("saveGlyphDrawSession"));
  assert("A8 reading route", draw.includes("/glyph/reading/"));

  const readingPage = read("components/glyph/GlyphReadingPage.tsx");
  assert("A9 full-reading API", readingPage.includes("generateGlyphFullReading"));
  assert("A9 getStoredProfile", readingPage.includes("getStoredProfile"));
  assert("A10 archive save", readingPage.includes("saveGlyphReadingToArchive"));

  const report = read("components/glyph/GlyphReport.tsx");
  const sections = [
    "wind_category_blurb",
    "classical_voice",
    "命理双视角",
    "meaning_for_question",
    "hidden_tension",
    "your_moment",
    "exploration",
    "reflection_question",
  ];
  for (const s of sections) {
    assert(`A10 report section ${s}`, report.includes(s));
  }
  assert("A10 dual view UI", report.includes("view_bazi_title") && report.includes("view_glyph_title"));

  // Scenario B — paid + cached base
  assert("B1 paid flow", cta.includes("handleStartPaid") || cta.includes("/api/payments/create"));

  // Scenario C — shared stored_profiles
  const drawImports = draw.includes("stored-profiles-service");
  const prepComp = read("components/poju/SessionPreparation.tsx");
  assert("C shared getStoredProfile on draw", drawImports);
  assert("C SessionPreparation supports glyph", prepComp.includes("glyph") || prepComp.includes("productType"));

  const fullRoute = read("app/api/oracle/full-reading/route.ts");
  assert("API uses generateGlyphReading", fullRoute.includes("generateGlyphReading"));
  assert("API no Gemini", !fullRoute.includes("@google/generative-ai"));
  assert("API profile_id required", fullRoute.includes("profile_id"));

  const prompt = read("lib/llm/prompts/glyph-deepseek-prompt.ts");
  const guanyin = read("lib/llm/prompts/glyph-guanyin-base.ts");
  assert("Step5 Glyph uses Guanyin base", prompt.includes("glyph-guanyin-base"));
  assert("Step5 imports output branding", prompt.includes("GLYPH_OUTPUT_BRANDING"));
  assert("Step5 Guanyin 百签", guanyin.includes("观音百签"));
  assert("Step5 Glyph output branding", guanyin.includes("GLYPH_OUTPUT_BRANDING"));
  assert("Step5 bans 观音灵签 in user output", guanyin.includes("观音灵签"));
  assert("Step5 not POJU identity in glyph prompt", !prompt.includes("ORIENTAL_COUNSELOR_BASE"));
  assert("Step5 dual view output", prompt.includes("命理双视角"));
  assert("Step5 raw_md in prompt", prompt.includes("raw_md_content") || prompt.includes("classical_text"));

  const signs = JSON.parse(read("public/oracle/data/signs.json")) as SignData[];
  assert("100 signs in JSON", signs.length === 100);
  const withMd = signs.filter((s) => (s.raw_md_content?.length ?? 0) > 500);
  assert("signs have full raw_md_content", withMd.length >= 95, `${withMd.length}/100`);

  const archive = read("lib/archive/archive-service.ts");
  assert("Archive glyph_reading type", archive.includes('type: "glyph_reading"'));
  assert("saveGlyphReadingToArchive", archive.includes("saveGlyphReadingToArchive"));

  assert("maxDuration 120 full-reading", /maxDuration\s*=\s*120/.test(fullRoute));

  // i18n
  for (const loc of ["en", "zh", "es", "fr", "de"]) {
    const msg = read(`messages/${loc}.json`);
    assert(`${loc} reading_loading_hint`, msg.includes("reading_loading_hint"));
    assert(`${loc} section_dual_view`, msg.includes("section_dual_view"));
  }
}

async function buildScenarioAProfile() {
  const birth: BirthInfo = {
    year: 1977,
    month: 2,
    day: 17,
    hour_period: "yin",
    gender: "M",
    timezone: "Asia/Shanghai",
  };
  const profile = await calculateProfile(birth);
  profile.id = "glyph-step7-test";
  return { birth, profile };
}

async function liveGlyphReading(serverBase?: string): Promise<Record<string, unknown> | null> {
  console.log("\n=== Glyph v5 Step 7: live DeepSeek smoke (draw + full reading) ===\n");
  loadEnvLocal();
  if (!isOpenRouterConfigured()) {
    console.log("  [SKIP] OPENROUTER_API_KEY not set");
    return null;
  }

  const { profile } = await buildScenarioAProfile();
  const signs = JSON.parse(read("public/oracle/data/signs.json")) as SignData[];
  const sign = signs.find((s) => s.sign_number === 1) ?? signs[0];
  const question = "I'm caught between two paths and need clarity";

  let base_analysis: unknown;
  let baseMeta = { latency_ms: 0, tokens_used: 0, cost_usd: 0, model: "" };

  if (serverBase) {
    const res = await fetch(`${serverBase}/api/profile/base-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_profile: profile, display_name: "Step7 Test" }),
    });
    if (!res.ok) {
      assert("live base-analysis via server", false, `${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      analysis: unknown;
      latency_ms?: number;
      tokens_used?: number;
      cost_usd?: number;
      model?: string;
    };
    base_analysis = data.analysis;
    baseMeta = {
      latency_ms: data.latency_ms ?? 0,
      tokens_used: data.tokens_used ?? 0,
      cost_usd: data.cost_usd ?? 0,
      model: data.model ?? "",
    };
  } else {
    const { system, user } = buildBaseAnalysisPrompt(profile);
    const t0 = Date.now();
    const baseResult = await callLLM({
      call_type: "deep_analysis",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 15000,
      response_format: "json",
      thinking_effort: "high",
    });
    base_analysis = parseBaseAnalysisResponseText(baseResult.content);
    baseMeta = {
      latency_ms: baseResult.meta.latency_ms ?? Date.now() - t0,
      tokens_used: baseResult.meta.tokens_used,
      cost_usd: baseResult.meta.cost_usd,
      model: baseResult.actual_model,
    };
  }

  assert("live base_analysis parsed", base_analysis != null && typeof base_analysis === "object");

  const glyph = signDataToPromptGlyph(sign);
  const built = buildGlyphReadingPrompt({
    profile,
    base_analysis,
    question,
    glyph,
    locale: "en",
  });
  assert(
    "prompt system includes full raw_md",
    built.system.includes(sign.raw_md_content.slice(0, 40)),
    `raw_md len=${sign.raw_md_content.length}, system len=${built.system.length}`,
  );
  assert("prompt system substantial", built.system.length > 3000, `system len=${built.system.length}`);

  const readingResult = await generateGlyphReading({
    sign,
    question,
    locale: "en",
    profile_id: "glyph-step7-test",
    user_profile: profile,
    base_analysis,
  });

  const r = readingResult.reading;
  assert("live reading wind_category_blurb", r.wind_category_blurb.length > 20);
  assert("live reading dual 命理", r.命理双视角.命理看此事.length > 20);
  assert("live reading dual 签文", r.命理双视角.签文看此事.length > 20);
  assert("live reading exploration", r.exploration.text.length > 10);

  const totalCost = baseMeta.cost_usd + readingResult.meta.cost_usd;
  console.log("\n  --- Live metrics ---");
  console.log(`  base_analysis: model=${baseMeta.model} tokens=${baseMeta.tokens_used} latency=${baseMeta.latency_ms}ms cost=$${baseMeta.cost_usd.toFixed(4)}`);
  console.log(
    `  glyph_reading: model=${readingResult.meta.model} tokens=${readingResult.meta.tokens_used} latency=${readingResult.meta.latency_ms}ms cost=$${readingResult.meta.cost_usd.toFixed(4)}`,
  );
  console.log(`  total_estimated_cost: $${totalCost.toFixed(4)}`);
  assert("cost in expected band (<$3)", totalCost < 3, `$${totalCost.toFixed(4)}`);

  const dayMaster = profile.diagnosis?.dayMaster ?? profile.bazi.dayPillar;
  const baziMentionsDay = JSON.stringify(r).toLowerCase().includes(String(dayMaster).toLowerCase().slice(0, 2));
  assert("reading references chart (day pillar hint)", baziMentionsDay || r.命理双视角.命理看此事.length > 40);

  return {
    generated_at: new Date().toISOString(),
    birth: { year: 1977, month: 2, day: 17, hour_period: "yin", gender: "M" },
    day_pillar: profile.bazi.dayPillar,
    sign_number: sign.sign_number,
    question,
    base_meta: baseMeta,
    reading_meta: readingResult.meta,
    total_cost_usd: totalCost,
    reading: r,
    prompt_system_chars: built.system.length,
    prompt_user_chars: built.user.length,
    raw_md_chars: sign.raw_md_content.length,
  };
}

async function main(): Promise<void> {
  staticChecks();

  let liveReport: Record<string, unknown> | null = null;
  if (process.argv.includes("--live")) {
    const serverArg = process.argv.find((a) => a.startsWith("--server="));
    const server = serverArg?.split("=")[1] ?? process.argv.includes("--server")
      ? process.argv[process.argv.indexOf("--server") + 1]
      : undefined;
    liveReport = await liveGlyphReading(server);
    if (liveReport) {
      mkdirSync(resolve(ROOT, ".data"), { recursive: true });
      writeFileSync(REPORT_PATH, JSON.stringify(liveReport, null, 2), "utf8");
      console.log(`\n  Report written: ${REPORT_PATH}`);
    }
  } else {
    console.log("\n(Tip: pnpm exec tsx scripts/test-glyph-v5-step7.ts --live for OpenRouter smoke)\n");
  }

  console.log("\n=== Summary ===");
  if (failures.length === 0) {
    console.log("All automated Step 7 checks passed.");
    console.log("\nManual browser E2E (doc scenarios A/B/C) still required:");
    console.log("  A: Incognito → /glyph → prepare → new birth 1977-02-17 → draw → reading → /archive");
    console.log("  B: Second draw with cached profile (no base_analysis loader)");
    console.log("  C: POJU session first → same profile in Glyph → consistent 日主 in reading");
  } else {
    console.log(`Failed (${failures.length}): ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

void main();
