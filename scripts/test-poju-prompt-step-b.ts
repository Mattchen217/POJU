/**
 * Step B — POJU prompt modularization verification + sample dump.
 *
 *   pnpm exec tsx scripts/test-poju-prompt-step-b.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import {
  POJU_ACTION_DESIGN_PRINCIPLES,
  POJU_BAZI_DEEP_METHOD,
  POJU_BREAKTHROUGH_COUNSELOR_IDENTITY,
  POJU_OUTPUT_BRANDING,
  POJU_SESSION_GUARDRAILS,
  buildPojuCorePromptSections,
} from "@/lib/llm/prompts/poju-base";
import { buildPojuSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import type { BirthInfo } from "@/lib/profile/types";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, ".data", "poju-step-b-prompt-sample.txt");
const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  const ctx = read("lib/llm/phases/oriental-prompt-context.ts");
  const final = read("lib/llm/pro/final-delivery.ts");
  const oriental = read("lib/llm/prompts/oriental-counselor-base.ts");

  console.log("\n=== Step B: POJU modularization static checks ===\n");

  assert("poju-base.ts exists", existsSync(resolve(ROOT, "lib/llm/prompts/poju-base.ts")));
  assert("6 core exports (incl output policy)", buildPojuCorePromptSections().length === 6);

  assert("identity 破局顾问", POJU_BREAKTHROUGH_COUNSELOR_IDENTITY.includes("破局顾问"));
  assert("identity 不是签文(Glyph)", POJU_BREAKTHROUGH_COUNSELOR_IDENTITY.includes("Glyph"));
  assert("identity 不是方位(Syncro)", POJU_BREAKTHROUGH_COUNSELOR_IDENTITY.includes("Syncro"));
  assert("identity 不是合盘(Match)", POJU_BREAKTHROUGH_COUNSELOR_IDENTITY.includes("Match"));

  assert("identity 我是 POJU / I am POJU", POJU_BREAKTHROUGH_COUNSELOR_IDENTITY.includes("我是 POJU"));
  assert("identity output policy wired", buildPojuCorePromptSections().some((s) => s.includes("POJULIFE OUTPUT POLICY")));

  assert("action 3类", POJU_ACTION_DESIGN_PRINCIPLES.includes("Action 1"));
  assert("action 风水调候", POJU_ACTION_DESIGN_PRINCIPLES.includes("传统调候"));
  assert("action 决策", POJU_ACTION_DESIGN_PRINCIPLES.includes("决策行动"));
  assert("action 反思", POJU_ACTION_DESIGN_PRINCIPLES.includes("反思练习"));

  assert("branding ANALYSIS marker", POJU_OUTPUT_BRANDING.includes("═══ ANALYSIS ═══"));
  assert("branding CONCLUSION marker", POJU_OUTPUT_BRANDING.includes("═══ CONCLUSION ═══"));
  assert("branding WHAT TO DO marker", POJU_OUTPUT_BRANDING.includes("═══ WHAT TO DO ═══"));
  assert("branding 禁 Glyph/Syncro/Match 暴露", POJU_OUTPUT_BRANDING.includes("不得在用户可见"));

  assert("context uses poju-base", ctx.includes("buildPojuCorePromptSections"));
  assert("context NOT ORIENTAL_COUNSELOR_BASE", !ctx.includes("ORIENTAL_COUNSELOR_BASE"));

  assert("final-delivery uses poju-base", final.includes("buildPojuCorePromptSections"));
  assert("final-delivery stitchPromptSections", final.includes("stitchPromptSections"));

  assert("oriental-counselor still has ORIENTAL_COUNSELOR_BASE for Syncro/Match", oriental.includes("ORIENTAL_COUNSELOR_BASE"));

  for (const phase of [
    "opening-phase.ts",
    "collecting-phase.ts",
    "confirmation-phase.ts",
    "delivery-phase.ts",
    "tracking-phase.ts",
  ]) {
    const p = read(`lib/llm/phases/${phase}`);
    assert(`${phase} uses buildOrientalSystemPrompt`, p.includes("buildOrientalSystemPrompt"));
  }

  const birth: BirthInfo = {
    year: 1985,
    month: 8,
    day: 20,
    hour_period: "wu",
    gender: "F",
    timezone: "America/New_York",
  };
  const profile = await calculateProfile(birth);
  profile.id = "poju-step-b-test";

  const mockAgent = createInitialAgentState({
    original_question: "Should I leave my current job to join a startup?",
    selected_profile_id: "poju-step-b-test",
  });
  mockAgent.question_category = "career";
  mockAgent.collection_completeness = 0.85;
  mockAgent.current_phase = "collecting_context";

  const phaseInput = {
    session: {
      session_id: "test",
      original_question: mockAgent.original_question,
      messages: [],
      selected_stored_profile_id: profile.id,
      profile_skipped: false,
      main_delivery_done: false,
      agent_v2: {
        current_phase: "collecting_context",
        original_question: mockAgent.original_question,
        question_category: "career",
        collection_completeness: 0.85,
        context_collected: mockAgent.context_collected,
        current_summary: null,
        actions: [],
      },
    },
    profile,
    base_analysis: {
      day_master: { stem: "庚", element: "金" },
      current_major_luck: { period: "2020-2030", theme: "官杀混杂，压力与突破并存" },
      useful_god: { primary: "水", note: "用神取水泄金生木" },
    },
    user_message: "I've been hesitating for months.",
    locale: "en",
    agent_state: mockAgent,
  } as unknown as PhaseLLMInput;

  phaseInput.session.agent_v2 = mockAgent;

  const openingSystem = await buildPojuSystemPrompt(
    phaseInput,
    `# 当前任务：主动开场\n\nOutput JSON with response only.`,
  );

  const { system: deliverySystem } = buildFinalDeliveryPrompt({
    base_analysis: phaseInput.base_analysis,
    situation_analysis: { theme: "career transition", tension: "risk vs growth" },
    agent_v2: mockAgent,
    locale: "en",
    recent_user_messages: ["Should I leave my current job to join a startup?"],
  });

  assert("opening prompt has POJU identity", openingSystem.includes("破局顾问") || openingSystem.includes("POJU"));
  assert("opening prompt has BAZI method", openingSystem.includes("大运") || openingSystem.includes("Major"));
  assert("opening prompt NO monolithic ORIENTAL at start", !openingSystem.startsWith("# 你是谁\n\n你是 POJU，一位精通"));

  assert("final delivery has ANALYSIS marker", deliverySystem.includes("═══ ANALYSIS ═══"));
  assert("final delivery has WHAT TO DO", deliverySystem.includes("═══ WHAT TO DO ═══"));
  assert("final delivery has Action 1/2/3", deliverySystem.includes("Action 1") && deliverySystem.includes("Action 3"));
  assert("final delivery has poju-base 八字", deliverySystem.includes("POJU_BAZI_DEEP_METHOD") || deliverySystem.includes("八字深度解读"));

  const sample = [
    "========== POJU OPENING PHASE (collecting) — head ==========",
    openingSystem.slice(0, 2400),
    "\n...[middle omitted]...\n",
    openingSystem.slice(-1200),
    "\n========== POJU FINAL DELIVERY — head ==========",
    deliverySystem.slice(0, 2400),
    "\n...[middle omitted]...\n",
    deliverySystem.slice(-2000),
  ].join("\n");

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(OUT, sample, "utf8");

  console.log(`\nPrompt sample: ${OUT}`);
  console.log(`Opening system: ${openingSystem.length} chars`);
  console.log(`Final delivery system: ${deliverySystem.length} chars`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Step B static checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
