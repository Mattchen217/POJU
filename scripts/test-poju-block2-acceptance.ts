/**
 * Block 2 总验收清单 — 静态 + 熔断单元测试（无 LLM live）。
 *
 *   pnpm exec tsx scripts/test-poju-block2-acceptance.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPojuChatCoreSections,
  POJU_IDENTITY,
  POJU_KNOWLEDGE_ROOTS,
} from "@/lib/llm/prompts/poju-base";
import { DEEP_RECKONING_TASK, buildBreakthroughCorePrompt } from "@/lib/llm/deepseek/breakthrough-core";
import {
  createInitialAgentState,
  decidePhaseTransition,
  mergeBreakthroughCoreUpdates,
  MIN_COLLECTING_USER_TURNS,
  PUSH_MIN_TURNS,
  type BreakthroughCore,
} from "@/lib/poju/agent-state";
import { parseInvestigationAgenda } from "@/lib/poju/investigation-agenda";
import {
  detectShenShaPollution,
  generateWithClosedSetGuard,
} from "@/lib/llm/sanitize/closed-set-circuit-breaker";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import { getThinkingConfig } from "@/lib/llm/router";

const ROOT = resolve(__dirname, "..");
const failures: string[] = [];

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function fileExists(rel: string): void {
  assert(`file: ${rel}`, existsSync(resolve(ROOT, rel)));
}

async function circuitBreakerTests(): Promise<void> {
  console.log("\n=== 1. 熔断（空亡/元辰 注脏） ===\n");

  const dirty = detectShenShaPollution("此人命带空亡与元辰，大运逢冲。", null, "zh");
  assert("detectShenShaPollution flags 空亡/元辰", dirty.polluted, dirty.hits.join(","));

  const clean = detectShenShaPollution("月柱七杀透，用神为水，当前大运第三步。", null, "zh");
  assert("clean text passes pollution check", !clean.polluted);

  let attempts = 0;
  let sawStripLog = false;
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    if (msg.includes("[circuit-breaker:test-label]") && msg.includes("直接剥离")) sawStripLog = true;
    origWarn(...args);
  };

  try {
    const stripped = await generateWithClosedSetGuard({
      label: "test-label",
      locale: "zh",
      structured: null,
      generate: async () => {
        attempts++;
        return "命带空亡元辰，大凶。";
      },
    });
    assert("guard strips on first dirty hit (single generate)", attempts === 1);
    assert("guard logs direct strip (no retry)", sawStripLog);
    assert("stripped output removes forbidden terms", !stripped.includes("空亡") && !stripped.includes("元辰"));
  } catch {
    assert("guard strips on first dirty hit (single generate)", false, `attempts=${attempts}`);
  }

  let failAttempts = 0;
  let degraded = "";
  degraded = await generateWithClosedSetGuard({
    label: "test-fail",
    locale: "zh",
    structured: null,
    generate: async () => {
      failAttempts++;
      return "空亡元辰六秀日将星国印";
    },
  });
  assert("guard single attempt then strip (no throw)", failAttempts === 1);
  assert("degraded text strips forbidden terms", !degraded.includes("空亡") && !degraded.includes("元辰"));
  console.warn = origWarn;

  const finalRoute = read("app/api/poju/final-delivery/route.ts");
  assert(
    "final-delivery route does NOT use closed-set guard (Block 62)",
    !finalRoute.includes("generateWithClosedSetGuard") && !finalRoute.includes("[circuit-breaker:final-delivery]"),
  );
  const btRoute = read("app/api/poju/breakthrough-core/route.ts");
  assert(
    "breakthrough-core route does NOT use generateWithClosedSetGuard (Block 62)",
    !btRoute.includes("generateWithClosedSetGuard"),
  );
}

function agendaGateTests(): void {
  console.log("\n=== 2. 议程解析门禁（3–6 项） ===\n");

  const ok3 = parseInvestigationAgenda([
    { id: "a1", label: "L1", critical: true, status: "unexplored", supports: "dir A" },
    { id: "a2", label: "L2", critical: true, status: "unexplored", supports: "dir B" },
    { id: "a3", label: "L3", critical: false, status: "unexplored", supports: "dir A" },
  ]);
  assert("parse accepts 3 items", ok3 !== null && ok3.length === 3);

  const bad2 = parseInvestigationAgenda([
    { id: "a1", label: "L1", critical: true, status: "unexplored", supports: "x" },
    { id: "a2", label: "L2", critical: false, status: "unexplored", supports: "y" },
  ]);
  assert("parse rejects 2 items", bad2 === null);

  const bad7 = parseInvestigationAgenda(
    Array.from({ length: 7 }, (_, i) => ({
      id: `a${i}`,
      label: `L${i}`,
      critical: i === 0,
      status: "unexplored",
      supports: "dir",
    })),
  );
  assert("parse rejects 7 items", bad7 === null);

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("collecting removed buildAgendaGenerationBlock", !collecting.includes("buildAgendaGenerationBlock"));
  assert("collecting prompt mentions supports/direction linkage", collecting.includes("breakthrough_core_updates"));
}

function spineLoopTests(): void {
  console.log("\n=== 3. 脊柱闭环（结构层） ===\n");

  const base: BreakthroughCore = {
    relationship_conclusion: "七杀透而身弱，卡在不敢行动。",
    breakthrough_directions: [
      {
        direction: "顺势试探",
        structural_basis: "month.ten_god=七杀",
        what_would_confirm: "是否已有 offer",
        status: "hypothesis",
      },
      {
        direction: "守势观察",
        structural_basis: "strength=weak",
        what_would_confirm: "现金流 runway",
        status: "hypothesis",
      },
    ],
    generated_at: "2026-01-01T00:00:00.000Z",
  };

  const merged = mergeBreakthroughCoreUpdates(base, {
    breakthrough_directions: [
      { direction: "顺势试探", structural_basis: "month.ten_god=七杀", what_would_confirm: "offer", status: "reinforced" },
    ],
  });
  assert("merge sets evolved_at", Boolean(merged.evolved_at));
  assert(
    "merge updates direction status",
    merged.breakthrough_directions[0]?.status === "reinforced",
  );

  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("orchestrator triggers breakthrough-core on collecting", orch.includes("requestBreakthroughCore"));
  assert("orchestrator removed requestSituationAnalysis in confirm", !orch.includes("requestSituationAnalysis("));

  const agent = read("lib/poju/agent.ts");
  assert("finalizeAgentV2 merges breakthrough_core_updates", agent.includes("mergeBreakthroughCoreUpdates"));

  const delivery = read("lib/llm/pro/final-delivery.ts");
  assert("delivery requires breakthrough_core for full", delivery.includes("No breakthrough_core persisted"));
  assert("delivery expert block uses relationship_conclusion", delivery.includes("relationship_conclusion"));
}

function understandingGateTests(): void {
  console.log("\n=== 4. 理解门 ===\n");

  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening uses model understanding_sufficient", opening.includes("parsed.understanding_sufficient"));
  assert("opening parses understanding", opening.includes("understanding_sufficient"));
  assert("opening gates suggested_phase on sufficient", opening.includes("understanding.sufficient"));

  const agent = createInitialAgentState({ original_question: "test" });
  agent.current_phase = "opening";

  const blocked = decidePhaseTransition({
    current_state: agent,
    llm_suggested_phase: "collecting_context",
    user_message: "我最近不太顺",
    understanding_sufficient: false,
  });
  assert("vague message blocked when insufficient", !blocked.should_transition);

  const allowed = decidePhaseTransition({
    current_state: agent,
    llm_suggested_phase: "collecting_context",
    user_message: "卡了三年想转行但不敢",
    understanding_sufficient: true,
  });
  assert("clear message allowed when sufficient", allowed.should_transition && allowed.new_phase === "collecting_context");

  const orch = read("lib/poju/agent-orchestrator.ts");
  const agentTs = read("lib/poju/agent.ts");
  assert(
    "breakthrough only after collecting phase",
    orch.includes('current_phase !== "collecting_context"') &&
      agentTs.includes('current_phase: "collecting_context"'),
  );
}

function soulAndCacheTests(): void {
  console.log("\n=== 5. 灵魂 + 前缀缓存 ===\n");

  assert("POJU_IDENTITY warm + tracking", POJU_IDENTITY.includes("欢迎回来"));
  assert("POJU_IDENTITY no spine mechanism leak", !POJU_IDENTITY.includes("独立深推理脊柱"));

  const chatCore = buildPojuChatCoreSections("en").join("\n");
  assert("chat core has KNOWLEDGE_ROOTS", chatCore.includes("知识根基"));
  assert("chat core has warm identity", chatCore.includes("我是 POJU"));

  const { system } = buildBreakthroughCorePrompt({
    base_analysis: {
      structured: {
        day_master: "庚",
        pattern: "七杀",
        yong_shen: "水",
        xi_shen: [],
        ji_shen: [],
        strength: "weak",
        four_pillars: { year: "甲子", month: "丙午", day: "庚辰", hour: "甲寅" },
        pillars_detail: {
          year: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "偏财", shen_sha: [], hidden_stems: [], life_stage_han: "沐浴" },
          month: { ganzhi: "丙午", stem: "丙", branch: "午", ten_god: "正官", shen_sha: [], hidden_stems: [], life_stage_han: "临官" },
          day: { ganzhi: "庚辰", stem: "庚", branch: "辰", ten_god: "日主", shen_sha: [], hidden_stems: [], life_stage_han: "帝旺" },
          hour: { ganzhi: "甲寅", stem: "甲", branch: "寅", ten_god: "偏财", shen_sha: [], hidden_stems: [], life_stage_han: "衰" },
        },
        da_yun: [],
        data_availability: { pillars_detail: true, da_yun: false, bazi_enrichment: false },
      },
    },
    agent_v2: null,
    original_question: "career",
    locale: "en",
  });
  assert("deep pass system has POJU_IDENTITY", system.includes("我是 POJU"));
  assert("deep pass system has KNOWLEDGE_ROOTS", system.includes(POJU_KNOWLEDGE_ROOTS.slice(0, 20)));
  assert("deep pass has DEEP_RECKONING_TASK", system.includes("破局总设计师"));

  const chatCoreMaster = buildPojuChatCoreSections("en").join("\n");
  assert("master core has tracking mindset", chatCoreMaster.includes("欢迎回来") || chatCoreMaster.includes("随时回来"));

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("spine in collecting task block not static import", collecting.includes("buildSpineBlock"));
  assert("chat static core excludes spine block fn", !chatCore.includes("buildSpineBlock"));

  const { system: deliverySystem, user: deliveryUser } = buildFinalDeliveryPrompt({
    base_analysis: {
      structured: {
        day_master: "庚",
        pattern: "七杀",
        yong_shen: "水",
        xi_shen: [],
        ji_shen: [],
        strength: "weak",
        four_pillars: { year: "甲子", month: "丙午", day: "庚辰", hour: "甲寅" },
        pillars_detail: {
          year: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "偏财", shen_sha: [], hidden_stems: [], life_stage_han: "沐浴" },
          month: { ganzhi: "丙午", stem: "丙", branch: "午", ten_god: "正官", shen_sha: [], hidden_stems: [], life_stage_han: "临官" },
          day: { ganzhi: "庚辰", stem: "庚", branch: "辰", ten_god: "日主", shen_sha: [], hidden_stems: [], life_stage_han: "帝旺" },
          hour: { ganzhi: "甲寅", stem: "甲", branch: "寅", ten_god: "偏财", shen_sha: [], hidden_stems: [], life_stage_han: "衰" },
        },
        da_yun: [],
        data_availability: { pillars_detail: true, da_yun: false, bazi_enrichment: false },
      },
    },
    breakthrough_core: {
      relationship_conclusion: "RC-TEST",
      breakthrough_directions: [
        { direction: "D1", structural_basis: "s", what_would_confirm: "c", status: "selected" },
        { direction: "D2", structural_basis: "s2", what_would_confirm: "c2", status: "hypothesis" },
      ],
      generated_at: new Date().toISOString(),
    },
    covered_agenda: [{ label: "agenda evidence" }],
    agent_v2: createInitialAgentState({ original_question: "q" }),
    locale: "en",
  });
  assert("delivery system uses v6 core + fact guard", deliverySystem.includes(POJU_V6_STATIC_SYSTEM.slice(0, 20)));
  assert("delivery system has chat fact guard", deliverySystem.includes("硬约束") || deliverySystem.includes("闭集"));
  assert("delivery user embeds RC-TEST spine", deliveryUser.includes("RC-TEST"));
  assert("delivery user no situation_analysis field", !deliveryUser.includes("Situation Analysis"));
}

function fileChecklist(): void {
  console.log("\n=== 6. 改动文件总览自检 ===\n");

  const files = [
    "lib/llm/prompts/poju-base.ts",
    "lib/poju/agent-state.ts",
    "lib/poju/investigation-agenda.ts",
    "lib/llm/phases/types.ts",
    "lib/llm/phases/opening-phase.ts",
    "lib/llm/deepseek/breakthrough-core.ts",
    "app/api/poju/breakthrough-core/route.ts",
    "lib/poju/agent-orchestrator.ts",
    "lib/llm/phases/collecting-phase.ts",
    "lib/poju/agent.ts",
    "lib/llm/pro/final-delivery.ts",
    "lib/llm/sanitize/closed-set-circuit-breaker.ts",
  ];
  for (const f of files) fileExists(f);

  assert("MIN_COLLECTING_USER_TURNS=3", MIN_COLLECTING_USER_TURNS === 3);
  assert("PUSH_MIN_TURNS=2", PUSH_MIN_TURNS === 2);

  const deep = getThinkingConfig("deep_analysis");
  assert("deep_analysis thinking enabled", deep.enabled === true);
  const btRouteSrc = read("app/api/poju/breakthrough-core/route.ts");
  assert("breakthrough-core route xhigh + 16000", btRouteSrc.includes('thinking_effort: "xhigh"') && btRouteSrc.includes("16_000"));
}

async function main(): Promise<void> {
  console.log("Block 2 acceptance (static + unit)\n");
  await circuitBreakerTests();
  agendaGateTests();
  spineLoopTests();
  understandingGateTests();
  soulAndCacheTests();
  fileChecklist();

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 2 automated acceptance checks passed.");
  console.log("\nManual / live still required:");
  console.log("  - 议程多元：同一职业问题 live 深测算 → 3–5 项 + supports 指向 direction + 命盘特异");
  console.log("  - 理解门：真实 opening LLM 对「我最近不太顺」追问 1 句且不触发 breakthrough-core");
  console.log("  - provider 恒定：OPENROUTER 环境下日志 actual_model 含 deepseek-v4-pro");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
