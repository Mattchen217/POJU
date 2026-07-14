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
  validateAgendaAnchorsToDirections,
} from "@/lib/llm/deepseek/breakthrough-core";

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
  assert("A forbids agenda output", DEEP_RECKONING_REPORT_TASK.includes("investigation_agenda"));
  assert("A has no Agenda Engine section", !DEEP_RECKONING_REPORT_TASK.includes("Agenda Engine"));
  assert("B has 承上启下", AGENDA_BRIDGE_TASK.includes("承上"));
  assert("B bans yes/no", AGENDA_BRIDGE_TASK.includes("yes/no"));
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
  assert("validateAgendaAnchors exported", core.includes("validateAgendaAnchorsToDirections"));

  const ok = validateAgendaAnchorsToDirections(
    [
      {
        id: "a1",
        label: "冷却时间",
        critical: true,
        status: "unexplored",
        supports: "落地方向：先降火，再应对",
      },
    ],
    [{ direction: "先降火，再应对", structural_basis: "x", what_would_confirm: "y" }],
  );
  assert("anchor validates matching supports", ok.ok === true);

  const bad = validateAgendaAnchorsToDirections(
    [
      {
        id: "a1",
        label: " demography",
        critical: true,
        status: "unexplored",
        supports: "落地方向：无关话题",
      },
    ],
    [{ direction: "先降火，再应对", structural_basis: "x", what_would_confirm: "y" }],
  );
  assert("anchor rejects unmapped supports", bad.ok === false);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 109 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
