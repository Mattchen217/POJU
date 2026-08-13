/**
 * Block 109 — Segment2 Call A/B split (report then agenda bridge)
 *
 *   pnpm exec tsx scripts/test-poju-block109-segment2-ab-split.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  DEEP_RECKONING_REPORT_TASK,
  AGENDA_BRIDGE_TASK,
  validateAgendaAnchorsToFrames,
} from "@/lib/llm/deepseek/breakthrough-core";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";

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
  console.log("\n========== POJU Block 109 · Call A/B split ==========\n");

  const runner = read("lib/poju/xhigh-job-runner.ts");
  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  const types = read("lib/poju/xhigh-job-types.ts");
  const control = read("lib/poju/phases/segment2/control.ts");
  const ui = read("components/poju/POJUChatUI.tsx");
  const agendaRoute = read("app/api/poju/breakthrough-core/agenda/route.ts");

  assert("phase segment2_agenda_bridge", types.includes('"segment2_agenda_bridge"'));
  assert("A report task is report-only", /只产出(报告|骨架)/.test(DEEP_RECKONING_REPORT_TASK));
  assert("A has 方案骨架", DEEP_RECKONING_REPORT_TASK.includes("方案骨架"));
  assert("A has situation_conclusion", DEEP_RECKONING_REPORT_TASK.includes("situation_conclusion"));
  assert("A has needs_validation", DEEP_RECKONING_REPORT_TASK.includes("needs_validation"));
  assert("A forbids agenda output", DEEP_RECKONING_REPORT_TASK.includes("investigation_agenda"));
  assert("A has no Agenda Engine section", !DEEP_RECKONING_REPORT_TASK.includes("Agenda Engine"));
  assert(
    "B has bridge / continuity goal",
    AGENDA_BRIDGE_TASK.includes("连贯") || AGENDA_BRIDGE_TASK.includes("下一条气泡"),
  );
  assert("B bans yes/no", AGENDA_BRIDGE_TASK.includes("yes/no"));
  assert("B has frame_kind", AGENDA_BRIDGE_TASK.includes("frame_kind"));
  assert("B has frame_index", AGENDA_BRIDGE_TASK.includes("frame_index"));
  assert("B has needs_validation", AGENDA_BRIDGE_TASK.includes("needs_validation"));
  assert("B requires multi_dimension_reckoning", AGENDA_BRIDGE_TASK.includes("multi_dimension_reckoning"));
  assert("B multi-dim coverage rule", AGENDA_BRIDGE_TASK.includes("≥2 个不同维度") || AGENDA_BRIDGE_TASK.includes("多个不同维度"));
  assert("B solve-first positioning", AGENDA_BRIDGE_TASK.includes("更好解决") || AGENDA_BRIDGE_TASK.includes("本步总目标"));
  assert("B bans report-as-reason", AGENDA_BRIDGE_TASK.includes("填满某报告页") || AGENDA_BRIDGE_TASK.includes("为写报告"));
  assert("B role coordinates", AGENDA_BRIDGE_TASK.includes("角色坐标") || AGENDA_BRIDGE_TASK.includes("Pivot** = 你自己"));
  assert("B first_question goals", AGENDA_BRIDGE_TASK.includes("连贯") && AGENDA_BRIDGE_TASK.includes("反例"));
  assert("B split-UI bridge", AGENDA_BRIDGE_TASK.includes("分步"));
  assert("B no fill-in template for first_q", !AGENDA_BRIDGE_TASK.includes("三拍结构"));
  assert(
    "B prompt feeds dims into coreJson",
    /multi_dimension_reckoning:\s*breakthrough_core\.multi_dimension_reckoning/.test(core),
  );
  assert("B prompt feeds segment1", core.includes("segment1_understanding"));
  assert("B has no full chart dump instruction", !AGENDA_BRIDGE_TASK.includes("pillars_detail"));
  assert("A runner xhigh", runner.includes('reasoning_effort: "xhigh"'));
  assert("B runner high", runner.includes('reasoning_effort: "high"'));
  assert("B timeout 150s", runner.includes("SEGMENT2_AGENDA_TIMEOUT_MS = 150_000"));
  assert("agenda route maxDuration 180", agendaRoute.includes("maxDuration = 180"));
  assert("agenda salvage after transport", runner.includes("salvaged after transport error"));
  assert("agenda schedules own after()", agendaRoute.includes("runSegment2AgendaBridgeJob"));
  assert("report finalize", control.includes("finalizeSegment2ReportSuccess"));
  assert("bridge finalize", control.includes("finalizeSegment2AgendaBridgeSuccess"));
  assert("bridge fail unlock path", control.includes("finalizeSegment2AgendaBridgeFailure"));
  assert("UI pipeline lock", ui.includes("segment2PipelineLock"));
  assert("UI hard unlock", ui.includes("SEGMENT2_INPUT_LOCK_HARD_MS"));
  assert("UI chains B after A", ui.includes("createSegment2AgendaJob"));
  assert("UI regenerate question", ui.includes("handleRegenerateQuestionClick"));
  assert("validateAgendaAnchorsToFrames exported", core.includes("validateAgendaAnchorsToFrames"));

  const stubCore = makeTestBreakthroughCore({
    modern_action_frames: [
      {
        direction: "先把火浇灭：建立强制冷却的独处时段",
        why_fits: "适合先释放再应对",
        structural_basis: "x",
        needs_validation: "y",
      },
      {
        direction: "把经验沉淀成可复用模块",
        why_fits: "适合系统化输出",
        structural_basis: "x",
        needs_validation: "y",
      },
    ],
  });

  const byIndex = validateAgendaAnchorsToFrames(
    [
      {
        id: "cool",
        label: "你的冷却时段",
        critical: true,
        status: "unexplored",
        frame_kind: "modern_action",
        frame_index: 1,
        supports: "验证行动骨架：先把火浇灭——建立强制冷却的独处时段",
      },
      {
        id: "mod",
        label: "最硬的那块经验",
        critical: true,
        status: "unexplored",
        frame_kind: "modern_action",
        frame_index: 2,
        supports: "随便写",
      },
    ],
    stubCore,
  );
  assert("anchor accepts frame_index (punctuation-diff supports ok)", byIndex.ok === true);

  const punctOnly = validateAgendaAnchorsToFrames(
    [
      {
        id: "cool",
        label: "你的冷却时段",
        critical: true,
        status: "unexplored",
        // no index — fuzzy fallback must survive ： vs ——
        supports: "验证行动骨架：先把火浇灭——建立强制冷却的独处时段",
      },
    ],
    makeTestBreakthroughCore({
      modern_action_frames: [
        {
          direction: "先把火浇灭：建立强制冷却的独处时段",
          why_fits: "适合先释放",
          structural_basis: "x",
          needs_validation: "y",
        },
        {
          direction: "备用方向",
          why_fits: "备用",
          structural_basis: "x2",
          needs_validation: "y2",
        },
      ],
    }),
  );
  assert("fuzzy fallback survives punctuation diff", punctOnly.ok === true);
  if (punctOnly.ok) {
    assert("fuzzy fills frame_index=1", punctOnly.agenda[0]?.frame_index === 1);
    assert("fuzzy fills frame_kind=modern_action", punctOnly.agenda[0]?.frame_kind === "modern_action");
  }

  const bad = validateAgendaAnchorsToFrames(
    [
      {
        id: "a1",
        label: "无关项",
        critical: true,
        status: "unexplored",
        supports: "验证行动骨架：月球殖民计划与外卖配送",
      },
    ],
    makeTestBreakthroughCore({
      modern_action_frames: [
        {
          direction: "先降火，再应对",
          why_fits: "先稳后动",
          structural_basis: "x",
          needs_validation: "y",
        },
        {
          direction: "备用",
          why_fits: "备用",
          structural_basis: "x2",
          needs_validation: "y2",
        },
      ],
    }),
  );
  assert("anchor rejects unmapped supports without index", bad.ok === false);

  const badIdx = validateAgendaAnchorsToFrames(
    [
      {
        id: "a1",
        label: "越界",
        critical: true,
        status: "unexplored",
        frame_kind: "modern_action",
        frame_index: 9,
        supports: "x",
      },
    ],
    makeTestBreakthroughCore({
      modern_action_frames: [
        {
          direction: "先降火，再应对",
          why_fits: "先稳后动",
          structural_basis: "x",
          needs_validation: "y",
        },
        {
          direction: "备用",
          why_fits: "备用",
          structural_basis: "x2",
          needs_validation: "y2",
        },
      ],
    }),
  );
  // Explicit modern_action with an OOB index should soft-assign slot 1, not kill Call B.
  assert("anchor soft-assigns out-of-range modern_action index", badIdx.ok === true);
  if (badIdx.ok) {
    assert("soft-assign uses frame_index=1", badIdx.agenda[0]?.frame_index === 1);
  }

  // Declared modern_action + paraphrase supports (mirrors real Call B from 输出.md)
  // must land even when fuzzy is noisy — never surface "提问还没生成完".
  const paraphrase = validateAgendaAnchorsToFrames(
    [
      {
        id: "unfinished_project",
        label: "想做未做的小事",
        critical: true,
        status: "unexplored",
        frame_kind: "modern_action",
        supports: "验证行动骨架：从小项目恢复节奏",
      },
      {
        id: "work_style",
        label: "独立还是协作",
        critical: false,
        status: "unexplored",
        frame_kind: "modern_action",
        supports: "验证行动骨架：借助合作力量",
      },
    ],
    makeTestBreakthroughCore({
      modern_action_frames: [
        {
          direction: "靠知识或技能输出建立个人品牌",
          why_fits: "z",
          structural_basis: "x",
          needs_validation: "y",
        },
        {
          direction: "借助合作力量推进",
          why_fits: "z2",
          structural_basis: "x2",
          needs_validation: "y2",
        },
        {
          direction: "用小项目把停掉的节奏捡起来",
          why_fits: "z3",
          structural_basis: "x3",
          needs_validation: "y3",
        },
      ],
    }),
  );
  assert("paraphrase modern_action agenda anchors ok", paraphrase.ok === true);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 109 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
