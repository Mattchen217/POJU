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
  assert("A report task is report-only", DEEP_RECKONING_REPORT_TASK.includes("只产出报告"));
  assert("A has 方案骨架", DEEP_RECKONING_REPORT_TASK.includes("方案骨架"));
  assert("A has situation_conclusion", DEEP_RECKONING_REPORT_TASK.includes("situation_conclusion"));
  assert("A has needs_validation", DEEP_RECKONING_REPORT_TASK.includes("needs_validation"));
  assert("A forbids agenda output", DEEP_RECKONING_REPORT_TASK.includes("investigation_agenda"));
  assert("A has no Agenda Engine section", !DEEP_RECKONING_REPORT_TASK.includes("Agenda Engine"));
  assert("B has 承上启下", AGENDA_BRIDGE_TASK.includes("承上"));
  assert("B bans yes/no", AGENDA_BRIDGE_TASK.includes("yes/no"));
  assert("B has frame_kind", AGENDA_BRIDGE_TASK.includes("frame_kind"));
  assert("B has frame_index", AGENDA_BRIDGE_TASK.includes("frame_index"));
  assert("B has needs_validation", AGENDA_BRIDGE_TASK.includes("needs_validation"));
  assert("B has no full chart dump instruction", !AGENDA_BRIDGE_TASK.includes("pillars_detail"));
  assert("A runner xhigh", runner.includes('reasoning_effort: "xhigh"'));
  assert("B runner high", runner.includes('reasoning_effort: "high"'));
  assert("B timeout 90s", runner.includes("SEGMENT2_AGENDA_TIMEOUT_MS = 90_000"));
  assert("agenda route maxDuration 120", agendaRoute.includes("maxDuration = 120"));
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
  assert("anchor rejects out-of-range index without fuzzy hit", badIdx.ok === false);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 109 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
