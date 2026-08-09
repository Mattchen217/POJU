/**
 * Block 77 — fuzzy JSON patch keys + opening ceiling force advance
 *
 *   pnpm exec tsx scripts/test-poju-block77-fuzzy-json-keys.ts
 */
import {
  createInitialAgentState,
  hasSubstantiveDilemmaAndDirection,
  isUnderstandingComplete,
  mergeCoreDilemma,
  mergeDesiredDirection,
  parseDesiredDirectionPatch,
  resolveDesiredDirectionRaw,
  withCompleteUnderstanding,
} from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  extractModelTurnSignals,
  OPENING_HARD_CEILING,
  OPENING_MAX_SUBSTANTIVE_TURNS,
} from "@/lib/poju/state-machine";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 77 · Fuzzy keys + ceiling ==========\n");

  const agentState = read("lib/poju/agent-state.ts");
  const sm = read("lib/poju/state-machine.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");

  assert("pickUnderstandingPatchField exported", agentState.includes("pickUnderstandingPatchField"));
  assert("resolveDesiredDirectionRaw exported", agentState.includes("resolveDesiredDirectionRaw"));
  assert("hasSubstantiveDilemmaAndDirection exported", agentState.includes("hasSubstantiveDilemmaAndDirection"));
  assert("opening strict JSON template", opening.includes("键名不可翻译"));
  assert("opening uses resolveDesiredDirectionRaw", opening.includes("resolveDesiredDirectionRaw(parsed)"));
  assert("state-machine force advance", sm.includes("force advance"));
  assert("state-machine overHardCeiling", sm.includes("overHardCeiling"));
  assert("state-machine OPENING_HARD_CEILING", sm.includes("OPENING_HARD_CEILING"));

  const variantRoot = {
    understanding_sufficient: false,
    行动: { w蚂蚁: "希望师傅能主动请教我", 优先: "保住经验价值" },
    core_dilemma: {
      具体事件: "徒弟坐了我的位置",
      stakes: "怕经验烂掉",
      sticking_point: "不知道怎么开口",
    },
  };
  const dirPatch = parseDesiredDirectionPatch(resolveDesiredDirectionRaw(variantRoot));
  assert("variant wants from w蚂蚁", dirPatch?.wants?.includes("请教") === true);
  assert("variant priority from 优先", dirPatch?.priority?.includes("经验") === true);

  let agent = withCompleteUnderstanding(createInitialAgentState({ original_question: "q" }));
  agent = {
    ...agent,
    desired_direction: { wants: null, priority: null },
    core_dilemma: {
      concrete_event: "徒弟坐了位置",
      stakes: "怕经验烂掉",
      sticking_point: "不知道怎么开口",
    },
  };
  agent = {
    ...agent,
    desired_direction: mergeDesiredDirection(agent.desired_direction, dirPatch),
  };
  assert("accumulated complete after variant patch", isUnderstandingComplete(agent));

  const partial = {
    ...createInitialAgentState({ original_question: "q" }),
    has_base_analysis: true,
    core_dilemma: {
      concrete_event: "徒弟坐了位置",
      stakes: "怕经验烂掉",
      sticking_point: "不知道怎么开口",
    },
    desired_direction: { wants: "想被请教", priority: null },
  };
  assert("substantive softer gate", hasSubstantiveDilemmaAndDirection(partial));
  assert("not complete without priority", !isUnderstandingComplete(partial));

  const softCeiling = advanceStateMachine(
    { ...partial, opening_substantive_turns: OPENING_MAX_SUBSTANTIVE_TURNS },
    extractModelTurnSignals({
      base_analysis_ready: true,
      substantive_opening_turns: OPENING_MAX_SUBSTANTIVE_TURNS,
      understanding_sufficient: false,
    }),
    "用户补充",
  );
  assert(
    "soft max turns does not force advance (model owns closure)",
    softCeiling.next_state === "opening",
  );

  const force = advanceStateMachine(
    { ...partial, opening_substantive_turns: OPENING_HARD_CEILING },
    extractModelTurnSignals({
      base_analysis_ready: true,
      substantive_opening_turns: OPENING_HARD_CEILING,
      understanding_sufficient: false,
    }),
    "用户补充",
  );
  assert("hard ceiling force advance", force.next_state === "awaiting_understanding_confirm");
  assert("ceiling does not trigger core until confirm", force.trigger_breakthrough_core === false);

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 77 checks passed.\n");
}

main();
