/**
 * Step B — POJU prompt modularization verification + sample dump.
 *
 *   pnpm exec tsx scripts/test-poju-prompt-step-b.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import {
  POJU_ACTION_DESIGN_PRINCIPLES,
  POJU_BAZI_DEEP_METHOD,
  POJU_IDENTITY,
  POJU_OUTPUT_BRANDING,
  POJU_SESSION_GUARDRAILS,
  buildPojuChatCoreSections,
  buildPojuDeliveryCoreSections,
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
  const collecting = read("lib/llm/phases/collecting-phase.ts");
  const final = read("lib/llm/pro/final-delivery.ts");
  const oriental = read("lib/llm/prompts/oriental-counselor-base.ts");

  console.log("\n=== Step B: POJU modularization static checks ===\n");

  assert("poju-base.ts exists", existsSync(resolve(ROOT, "lib/llm/prompts/poju-base.ts")));
  assert("delivery core has READING_LAYOUT", buildPojuDeliveryCoreSections().some((s) => s.includes("降维排版（杂志式版面")));
  assert("chat core NO READING_LAYOUT", !buildPojuChatCoreSections().some((s) => s.includes("降维排版（杂志式版面")));

  assert("identity POJU 智者", POJU_IDENTITY.includes("精通东方文化"));
  assert("identity Match 不归我", POJU_IDENTITY.includes("Match"));

  assert("identity 我叫 POJU", POJU_IDENTITY.includes("我叫 POJU"));
  assert("chat core output policy wired", buildPojuChatCoreSections().some((s) => s.includes("POJULIFE OUTPUT POLICY")));
  assert(
    "delivery core BAZI method",
    buildPojuDeliveryCoreSections().some(
      (s) => s.includes("八字深度解读") || s.includes("性格画像深度解读"),
    ),
  );

  assert("passive term marking in BAZI method", POJU_BAZI_DEEP_METHOD.includes("被动包装"));
  assert("no ≥4 term id quota in BAZI method", !POJU_BAZI_DEEP_METHOD.includes("≥4 个不同 term id"));

  assert("action dimension menu", POJU_ACTION_DESIGN_PRINCIPLES.includes("行动维度菜单"));
  assert("action Action 1 prefix", POJU_ACTION_DESIGN_PRINCIPLES.includes("### Action 1:"));
  assert("action 关键对话 dimension", POJU_ACTION_DESIGN_PRINCIPLES.includes("关键对话"));
  assert("action Profile basis line", POJU_ACTION_DESIGN_PRINCIPLES.includes("Profile basis"));

  assert("branding ANALYSIS marker", POJU_OUTPUT_BRANDING.includes("═══ ANALYSIS ═══"));
  assert("branding CONCLUSION marker", POJU_OUTPUT_BRANDING.includes("═══ CONCLUSION ═══"));
  assert("branding WHAT TO DO marker", POJU_OUTPUT_BRANDING.includes("═══ WHAT TO DO ═══"));
  assert("branding 禁 Glyph/Syncro/Match 暴露", POJU_OUTPUT_BRANDING.includes("不得在用户可见"));

  assert("context uses buildPojuChatCoreSections", ctx.includes("buildPojuChatCoreSections"));
  assert("context has buildPojuSystemPrompt", ctx.includes("buildPojuSystemPrompt"));
  assert("context NOT ORIENTAL_COUNSELOR_BASE", !ctx.includes("ORIENTAL_COUNSELOR_BASE"));

  assert("collecting breakthrough_core_updates", collecting.includes("breakthrough_core_updates"));
  assert("collecting no agenda generation block", !collecting.includes("buildAgendaGenerationBlock"));
  assert("collecting spine block", collecting.includes("buildSpineBlock"));
  assert("collecting response-first JSON order", collecting.includes("response 第一个键"));
  assert("collecting topic_drift + new session button", collecting.includes("should_show_new_session_button"));
  assert("collecting no rigid escalation template", !collecting.includes("buildCollectingEscalationBlock"));

  assert("final-delivery uses buildPojuDeliveryCoreSections", final.includes("buildPojuDeliveryCoreSections"));
  assert("final-delivery stitchPromptSections", final.includes("stitchPromptSections"));

  assert("oriental-counselor still has ORIENTAL_COUNSELOR_BASE for Syncro/Match", oriental.includes("ORIENTAL_COUNSELOR_BASE"));

  for (const phase of [
    "opening-phase.ts",
    "collecting-phase.ts",
    "confirmation-phase.ts",
    "delivery-phase.ts",
    "tracking-phase.ts",
    "stall-offer-phase.ts",
  ]) {
    const p = read(`lib/llm/phases/${phase}`);
    const usesOriental =
      p.includes("buildOrientalSystemPrompt") ||
      p.includes("buildPojuSystemPrompt") ||
      p.includes("buildPhaseTransportInput");
    assert(`${phase} uses buildOrientalSystemPrompt / buildPojuSystemPrompt`, usesOriental);
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

  const openingSystem = await buildPojuSystemPrompt(phaseInput);

  const { buildPhaseTurnContext } = await import("@/lib/llm/phases/oriental-prompt-context");
  const openingTurn = buildPhaseTurnContext(
    phaseInput,
    `# 当前任务：主动开场\n\nOutput JSON with response only.`,
  );

  const { system: deliverySystem } = buildFinalDeliveryPrompt({
    base_analysis: phaseInput.base_analysis,
    breakthrough_core: makeTestBreakthroughCore({
      situation_conclusion:
        "Career transition tension maps to weak day master vs aggressive month officer.",
      modern_action_frames: [
        {
          direction: "Test startup fit before quitting",
          why_fits: "Pressure month officer favors small-step validation",
          structural_basis: "pattern + da_yun step 2",
          needs_validation: "offer runway and role scope",
          status: "selected",
        },
        {
          direction: "Stabilize income first",
          why_fits: "Weak day master needs runway first",
          structural_basis: "strength=weak",
          needs_validation: "debt and savings buffer",
          status: "hypothesis",
        },
      ],
    }),
    covered_agenda: [{ label: "Current role dissatisfaction specifics" }],
    agent_v2: mockAgent,
    locale: "en",
    recent_user_messages: ["Should I leave my current job to join a startup?"],
  });

  assert("opening system has POJU identity", openingSystem.includes("POJU") || openingSystem.includes("智者"));
  assert("opening system NO BAZI deep method in chat core", !openingSystem.includes("性格画像深度解读法则"));
  assert("opening task in turnContext not system", openingTurn.includes("任务：") || openingTurn.includes("当前任务"));
  assert("opening system NO task block", !openingSystem.includes("任务：主动开场") && !openingSystem.includes("当前任务：主动开场"));
  assert("opening system NO monolithic ORIENTAL at start", !openingSystem.startsWith("# 你是谁\n\n你是 Pivot，一位精通"));

  assert("final delivery has ANALYSIS marker", deliverySystem.includes("═══ ANALYSIS ═══"));
  assert("final delivery has WHAT TO DO", deliverySystem.includes("═══ WHAT TO DO ═══"));
  assert("final delivery has Action 1 prefix", deliverySystem.includes("### Action 1:"));
  assert("branding no fixed Action 2 name", !POJU_OUTPUT_BRANDING.includes("Modern Decisive Action"));
  assert("final delivery has poju-base 八字", deliverySystem.includes("POJU_BAZI_DEEP_METHOD") || deliverySystem.includes("八字深度解读"));

  const sample = [
    "========== POJU SYSTEM PROMPT (opening) — head ==========",
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
  console.log(`Opening system prompt: ${openingSystem.length} chars`);
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
