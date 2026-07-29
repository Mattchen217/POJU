/**
 * Live EN verification — POJU + Match (feng shui whitewash + marriage term translation).
 * Run: pnpm tsx scripts/test-output-policy-poju-match-en.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { detectOutputPolicyViolations } from "@/lib/llm/compliance/audit-output";

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

const SUPERNATURAL_RAW =
  /\b(?:attract wealth|wealth activation|lucky direction|amulet|ward off evil|boost luck|boost fortune)\b/i;
const ENV_PSYCH_SIGNAL =
  /\b(?:environmental psychology|spatial harmony|space alignment|spatial resonance|biophilic|stress|cortisol|grounding|calm(?:ing)?)\b/i;
const SPATIAL_METHOD =
  /\b(?:plant|water feature|fish tank|desk|workspace|corner|north|east|south|west|green|bowl of water)\b/i;

function verify(label: string, text: string): boolean {
  const lower = text.toLowerCase();
  const violations = detectOutputPolicyViolations(text, "en");
  const marriage = violations.filter((v) => v.category === "marriage_chart_term");
  const supernatural = violations.filter((v) => v.category === "supernatural_promise");
  const hasWuxing =
    /\b(wood|fire|earth|metal|water)\b/i.test(lower) || /金|木|水|火|土/.test(text);
  const hasIChing = /\bi ching\b/i.test(lower) || /易经/.test(text);
  const hasProduct = /\b(?:poju|match)\b/i.test(lower);
  const hasEnvPsych = ENV_PSYCH_SIGNAL.test(lower);
  const hasSpatialMethod = SPATIAL_METHOD.test(lower);
  const rawSupernatural = SUPERNATURAL_RAW.test(text);

  console.log(`\n${"=".repeat(72)}`);
  console.log(`=== ${label} — FULL OUTPUT ===`);
  console.log("=".repeat(72));
  console.log(text);
  console.log(`\n--- Audit (${label}) ---`);
  console.log(`  marriage_chart_term: ${marriage.length}`);
  console.log(`  supernatural_promise: ${supernatural.length}`);
  if (marriage.length || supernatural.length) {
    for (const v of [...marriage, ...supernatural]) {
      console.log(`    [${v.category}] ${v.label}: …${v.snippet}…`);
    }
  }
  console.log(`  spatial method retained: ${hasSpatialMethod ? "ok" : "weak"}`);
  console.log(`  env-psych explanation: ${hasEnvPsych ? "ok" : "MISSING"}`);
  console.log(`  raw supernatural regex: ${rawSupernatural ? "FAIL" : "ok"}`);
  console.log(`  wuxing energy model: ${hasWuxing ? "ok" : "MISSING"}`);
  console.log(`  I Ching framework: ${hasIChing ? "ok" : "weak"}`);
  console.log(`  product naming: ${hasProduct ? "ok" : "weak"}`);

  const ok =
    marriage.length === 0 &&
    supernatural.length === 0 &&
    !rawSupernatural &&
    hasWuxing &&
    hasEnvPsych &&
    hasSpatialMethod;
  console.log(`  RESULT: ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

function saveOutput(name: string, text: string): void {
  const dir = resolve(ROOT, ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${name}.txt`), text, "utf8");
}

async function runPoju(): Promise<string> {
  const { buildFinalDeliveryPrompt } = await import("@/lib/llm/pro/final-delivery");
  const { callLLM } = await import("@/lib/llm/router");
  const { createInitialAgentState } = await import("@/lib/poju/agent-state");
  const { makeTestBreakthroughCore } = await import("@/lib/poju/test-breakthrough-core-fixture");
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
    breakthrough_core: makeTestBreakthroughCore({
      situation_conclusion:
        "Metal core resists pay cut while learning hunger pulls toward lateral move.",
      modern_action_frames: [
        {
          direction: "Negotiate learning + partial pay protection",
          why_fits: "Metal core needs runway while learning expands",
          structural_basis: "core_nature Metal + balancing Water",
          needs_validation: "rent runway in Toronto",
          status: "selected",
        },
        {
          direction: "Stay and upskill in place",
          why_fits: "Skill expansion theme supports in-place growth",
          structural_basis: "life_cycle skill expansion",
          needs_validation: "internal growth path",
          status: "hypothesis",
        },
      ],
    }),
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
  return result.content;
}

async function runMatch(): Promise<string> {
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
  return result.content;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { isOpenRouterConfigured } = await import("@/lib/llm/openrouter-shared");
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY required");
    process.exit(1);
  }
  console.log("Running POJU + Match EN live verification…");
  const pojuText = await runPoju();
  saveOutput("policy-poju-en", pojuText);
  const matchText = await runMatch();
  saveOutput("policy-match-en", matchText);
  const pojuOk = verify("POJU (main_delivery EN)", pojuText);
  const matchOk = verify("Match (match_report EN)", matchText);
  if (!pojuOk || !matchOk) process.exit(1);
  console.log("\nBoth POJU and Match passed whitewash + marriage-term policy checks.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

