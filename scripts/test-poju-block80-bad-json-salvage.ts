/**
 * Block 80 — bad JSON salvage must keep core_dilemma / desired_direction
 *
 *   pnpm exec tsx scripts/test-poju-block80-bad-json-salvage.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  isUnderstandingComplete,
  mergeCoreDilemma,
  mergeDesiredDirection,
  parseCoreDilemmaPatch,
  parseDesiredDirectionPatch,
  resolveCoreDilemmaRaw,
  resolveDesiredDirectionRaw,
  createInitialAgentState,
} from "@/lib/poju/agent-state";
import {
  guardParseFailedFields,
  parsePhaseJson,
  tolerantJsonRepair,
} from "@/lib/llm/phases/phase-transport";

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
  console.log("\n========== POJU Block 80 · Bad JSON salvage ==========\n");

  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("tolerantJsonRepair exported", transport.includes("export function tolerantJsonRepair"));
  assert("salvageUnderstandingPatches", transport.includes("salvageUnderstandingPatches"));
  assert("salvaged core_dilemma", transport.includes("salvaged.core_dilemma"));
  assert("salvaged desired_direction", transport.includes("salvaged.desired_direction"));
  assert("guard keeps core_dilemma", transport.includes("core_dilemma: parsed.core_dilemma"));

  const spacedKey = `{
    "understanding_sufficient": false,
    "core_dilemma": {
      "concrete_event": "徒弟坐了位置",
      "stakes": "怕经验烂掉",
      "sticking_po int": "不知道怎么开口"
    },
    "desired_direction": {
      "w蚂蚁": "希望师傅能主动请教我",
      "priority": "保住经验价值"
    },
    "response": "我听到了"
  }`;
  const repaired = tolerantJsonRepair(spacedKey);
  const repairedParsed = parsePhaseJson(spacedKey);
  assert("tolerant repair parses spaced key", !repairedParsed._parse_failed);
  assert(
    "repaired sticking_point",
    parseCoreDilemmaPatch(resolveCoreDilemmaRaw(repairedParsed))?.sticking_point?.includes("开口") === true,
  );
  assert(
    "repaired wants from w蚂蚁",
    parseDesiredDirectionPatch(resolveDesiredDirectionRaw(repairedParsed))?.wants?.includes("请教") === true,
  );

  const truncated =
    '{"response":"继续聊","understanding_sufficient":true,"core_dilemma":{"concrete_event":"徒弟坐了位置","stakes":"怕经验烂掉","sticking_point":"不知道怎么开口"},"desired_direction":{"w蚂蚁":"希望师傅请教","priority":"保住经验"';
  const salvaged = guardParseFailedFields(parsePhaseJson(truncated));
  assert("truncated marks parse_failed", salvaged._parse_failed === true);
  assert("truncated salvages sufficient", salvaged.understanding_sufficient === true);
  const dilemmaPatch = parseCoreDilemmaPatch(resolveCoreDilemmaRaw(salvaged));
  const directionPatch = parseDesiredDirectionPatch(resolveDesiredDirectionRaw(salvaged));
  assert("truncated salvages concrete_event", dilemmaPatch?.concrete_event?.includes("徒弟") === true);
  assert("truncated salvages stakes", dilemmaPatch?.stakes?.includes("经验") === true);
  assert("truncated salvages sticking_point", dilemmaPatch?.sticking_point?.includes("开口") === true);
  assert("truncated salvages wants", directionPatch?.wants?.includes("请教") === true);
  assert("truncated salvages priority", directionPatch?.priority?.includes("经验") === true);

  let agent = createInitialAgentState({ original_question: "q" });
  agent = {
    ...agent,
    core_dilemma: mergeCoreDilemma(agent.core_dilemma, dilemmaPatch),
    desired_direction: mergeDesiredDirection(agent.desired_direction, directionPatch),
  };
  assert("salvaged merge completes understanding", isUnderstandingComplete(agent));

  const chineseQuotes =
    "{" +
    "“understanding_sufficient”：false，" +
    "“core_dilemma”：{" +
    "“concrete_event”：“离婚8年”，" +
    "“stakes”：“怕错过窗口”，" +
    "“sticking_point”：“不知道怎么开口”" +
    "}，" +
    "“desired_direction”：{" +
    "“wants”：“想认识合适的人”，" +
    "“priority”：“真诚不将就”" +
    "}，" +
    "“response”：“嗯”" +
    "}";
  const cnParsed = parsePhaseJson(chineseQuotes);
  const cnDilemma = parseCoreDilemmaPatch(resolveCoreDilemmaRaw(cnParsed));
  const cnDirection = parseDesiredDirectionPatch(resolveDesiredDirectionRaw(cnParsed));
  assert("chinese quotes salvage dilemma", cnDilemma?.concrete_event?.includes("离婚") === true);
  assert("chinese quotes salvage direction", cnDirection?.wants?.includes("认识") === true);

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 80 checks passed.\n");
}

main();
