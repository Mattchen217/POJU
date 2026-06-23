/**
 * Live EN output samples — POJU / Glyph / Syncro / Match production paths.
 * Run: pnpm tsx scripts/test-output-policy-live-en.ts
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

function assertSample(label: string, text: string): void {
  const lower = text.toLowerCase();
  const bad =
    /\b(day master|yong shen|bazi|birth chart|natal chart|in your chart|four pillars|qimen)\b/i.test(
      text,
    ) ||
    /\b(will marry|will succeed|guaranteed success|good luck|auspicious|ominous)\b/i.test(lower) ||
    /大吉|大凶|八字|用神|日主/.test(text);

  const good =
    /\b(wood|fire|earth|metal|water|i ching|book of changes|yin.?yang)\b/i.test(lower) ||
    /金|木|水|火|土|易经|阴阳/.test(text);

  console.log(`\n=== ${label} ===`);
  console.log(text.slice(0, 1200) + (text.length > 1200 ? "\n…[truncated]" : ""));
  console.log(`  bazi/chart/prediction/jixiong: ${bad ? "FAIL" : "ok"}`);
  console.log(`  wuxing/iching signal: ${good ? "ok" : "weak"}`);
  if (bad) process.exitCode = 1;
}

async function runSyncro(): Promise<void> {
  const { generateSyncroHoursAdvice } = await import("@/lib/syncro/syncro-llm-batch-core");
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
    key_hints: ["resonance", "task fit"],
  }));
  const result = await generateSyncroHoursAdvice({
    session_id: `policy-syncro-${Date.now()}`,
    hours: [{ hour_id: "wu", hour_label: "Wu", hour_range: "11:00–13:00", cells }],
    task_description: "prepare a calm pitch for a salary review with my manager tomorrow",
    profile_summary: JSON.stringify({
      core_nature: "Metal-like structure",
      balancing_element: "Water",
      life_cycle: "visibility phase",
    }),
    locale: "en",
  });
  const cell = result.advice[cells[0]!.key];
  const blob = [cell?.short_advice, cell?.detailed_advice, cell?.rationale].filter(Boolean).join("\n");
  assertSample("Syncro (batch-core EN)", blob);
}

async function runGlyph(): Promise<void> {
  const { calculateProfile } = await import("@/lib/calculations");
  const { generateGlyphReading } = await import("@/lib/llm/services/glyph-reading-service");
  const signs = (await import("@/lib/glyph/data/signs.json")).default as import("@/types/oracle").SignData[];
  const sign79 = signs.find((s) => s.sign_number === 79)!;
  const profile = await calculateProfile({
    year: 1990,
    month: 5,
    day: 15,
    hour_period: "wei",
    gender: "M",
    timezone: "America/Toronto",
  });
  profile.id = "policy-glyph-test";
  const result = await generateGlyphReading({
    sign: sign79,
    question: "I made promises I have not kept and feel stuck about honoring them at work.",
    locale: "en",
    profile_id: profile.id,
    user_profile: profile,
    base_analysis: {
      structured: {
        core_nature: { element: "Wood", tone: "growth-oriented" },
        balancing_element: "Earth",
        life_cycle: { theme: "consolidation" },
      },
      display_text:
        "Core nature resonates with Wood — flexibility and growth. Life cycle theme: consolidation.",
    },
  });
  const r = result.reading;
  const blob = [
    r.wind_category_blurb,
    r.classical_voice,
    r.命理双视角?.命理看此事,
    r.meaning_for_question,
  ]
    .filter(Boolean)
    .join("\n");
  assertSample("Glyph (glyph-reading-service EN)", blob);
}

async function runMatch(): Promise<void> {
  const { calculateProfile } = await import("@/lib/calculations");
  const { buildMatchPrompt } = await import("@/lib/llm/prompts/match-deepseek-prompt");
  const { calculateCompatibilityMatrix } = await import("@/lib/match/calculate-compatibility");
  const { wrapProfileForMatrix } = await import("@/lib/match/parse-profile-for-matrix");
  const { callLLM } = await import("@/lib/llm/router");
  const profileA = await calculateProfile({
    year: 1988,
    month: 3,
    day: 12,
    hour_period: "mao",
    gender: "F",
    timezone: "America/New_York",
  });
  const profileB = await calculateProfile({
    year: 1985,
    month: 11,
    day: 8,
    hour_period: "wu",
    gender: "M",
    timezone: "America/New_York",
  });
  const matrix = calculateCompatibilityMatrix({
    profileA: wrapProfileForMatrix(profileA, null),
    profileB: wrapProfileForMatrix(profileB, null),
  });
  const { system, user } = buildMatchPrompt({
    a_profile: profileA,
    b_profile: profileB,
    relationship_description:
      "We are co-founders deciding how to split responsibilities after a tense quarter.",
    locale: "en",
    compatibilityMatrix: matrix,
  });
  const result = await callLLM({
    call_type: "match_report",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 8000,
    thinking_effort: "medium",
    response_format: "json",
  });
  assertSample("Match (match_report EN)", result.content);
}

async function runPoju(): Promise<void> {
  const { buildFinalDeliveryPrompt } = await import("@/lib/llm/pro/final-delivery");
  const { callLLM } = await import("@/lib/llm/router");
  const { createInitialAgentState } = await import("@/lib/poju/agent-state");
  const agent = createInitialAgentState({
    original_question: "Should I accept a lateral move that offers learning but less pay?",
  });
  agent.current_summary = null;
  const { system, user } = buildFinalDeliveryPrompt({
    agent_v2: agent,
    base_analysis: {
      structured: {
        core_nature: { element: "Metal", tone: "decisive" },
        balancing_element: "Water",
        life_cycle: { theme: "skill expansion" },
      },
      display_text: "Metal-like core nature; Water balances intensity.",
    },
    breakthrough_core: {
      relationship_conclusion: "Metal core resists pay cut while learning hunger pulls toward lateral move.",
      breakthrough_directions: [
        {
          direction: "Negotiate learning + partial pay protection",
          structural_basis: "core_nature Metal + balancing Water",
          what_would_confirm: "rent runway in Toronto",
          status: "selected",
        },
        {
          direction: "Stay and upskill in place",
          structural_basis: "life_cycle skill expansion",
          what_would_confirm: "internal growth path",
          status: "hypothesis",
        },
      ],
      generated_at: new Date().toISOString(),
    },
    covered_agenda: [{ label: "rent pressure in Toronto" }],
    locale: "en",
    recent_user_messages: ["I value learning but worry about rent in Toronto."],
  });
  const result = await callLLM({
    call_type: "main_delivery",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 6000,
    thinking_effort: "medium",
  });
  assertSample("POJU (final-delivery EN)", result.content);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY required");
    process.exit(1);
  }
  console.log("Running EN production-path samples (may take several minutes)…");
  await runPoju();
  await runGlyph();
  await runSyncro();
  await runMatch();
  if (process.exitCode) {
    console.error("\nSome samples failed policy checks.");
    process.exit(1);
  }
  console.log("\nAll four modules passed policy spot-checks.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
