/**
 * Block 94 — segment2 phase isolation + async preparing mount
 *
 *   pnpm exec tsx scripts/test-poju-block94-segment2-isolation.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildSegment2AnalysisReply } from "@/lib/poju/phases/segment2/display";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { SEGMENT2_XHIGH_MAX_TOKENS } from "@/lib/poju/xhigh-job-runner";

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
  console.log("\n========== POJU Block 94 · Segment2 isolation ==========\n");

  assert("segment2 control exists", fs.existsSync(path.join(ROOT, "lib/poju/phases/segment2/control.ts")));
  assert("segment2 display exists", fs.existsSync(path.join(ROOT, "lib/poju/phases/segment2/display.ts")));
  assert("segment2 prompt exists", fs.existsSync(path.join(ROOT, "lib/poju/phases/segment2/prompt.ts")));

  const control = read("lib/poju/phases/segment2/control.ts");
  const opening = read("lib/poju/phases/opening/control.ts");
  assert("segment2 does not import opening/", !control.includes("phases/opening"));
  assert("opening does not import segment2/", !opening.includes('from "@/lib/poju/phases/segment2'));
  assert("segment2 imports shared xhigh-job", control.includes("@/lib/poju/shared/xhigh-job"));

  assert("max tokens 26000", SEGMENT2_XHIGH_MAX_TOKENS === 26_000);

  const ui = read("components/poju/POJUChatUI.tsx");
  assert("UI mounts Segment2AnalysisPreparing", ui.includes("<Segment2AnalysisPreparing"));
  assert("UI sets segment2JobId", ui.includes("setSegment2JobId"));
  assert("UI applySegment2PollSuccess on complete", ui.includes("applySegment2PollSuccess"));
  assert("UI finalizeSegment2JobFailure on error", ui.includes("finalizeSegment2JobFailure"));

  const agent = createInitialAgentState({ original_question: "q" });
  agent.breakthrough_core = makeTestBreakthroughCore({
    situation_conclusion: "结构卡在月柱官杀过旺。",
    modern_action_frames: [
      {
        direction: "先稳住边界",
        why_fits: "先守后动",
        structural_basis: "月柱七杀 + 当前大运",
        needs_validation: "对方最近一次越界",
      },
      {
        direction: "备用方向",
        why_fits: "备用",
        structural_basis: "备用依据",
        needs_validation: "备用验证",
      },
    ],
  });
  agent.investigation_agenda = [
    { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
  ];
  const reply = buildSegment2AnalysisReply(agent, "zh");
  assert("display includes conclusion", reply.includes("结构卡在"));
  assert("display includes directions", reply.includes("破局方向"));
  assert("display includes agenda focus", reply.includes("越界"));

  const router = read("lib/poju/phase-router.ts");
  assert("router exports segment2 starters", router.includes("startSegment2AfterGateConfirm"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
