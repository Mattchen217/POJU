/**
 * Block 96 — segment2 agenda serves landing breakthrough directions (not understanding)
 *
 *   pnpm exec tsx scripts/test-poju-block96-segment2-agenda-landing.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  AGENDA_BRIDGE_TASK,
  DEEP_RECKONING_REPORT_TASK,
} from "@/lib/llm/deepseek/breakthrough-core";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 96 · Segment2 agenda landing ==========\n");

  const file = fs.readFileSync(path.join(ROOT, "lib/llm/deepseek/breakthrough-core.ts"), "utf8");
  const seg2Prompt = fs.readFileSync(
    path.join(ROOT, "lib/poju/phases/segment2/prompt.ts"),
    "utf8",
  );

  // Call A = report; Call B = agenda landing (A/B split).
  assert("A is report-only", DEEP_RECKONING_REPORT_TASK.includes("只产出报告"));
  assert(
    "B agenda purpose is landing info",
    AGENDA_BRIDGE_TASK.includes("落地某条方向前必须先知道") ||
      AGENDA_BRIDGE_TASK.includes("倒推"),
  );
  assert(
    "B does not reopen phase1 understanding",
    AGENDA_BRIDGE_TASK.includes("严禁通用问卷") || AGENDA_BRIDGE_TASK.includes("第1段的事"),
  );
  assert("B anchors via direction_index", AGENDA_BRIDGE_TASK.includes("direction_index"));
  assert(
    "B supports is natural language not exact copy",
    AGENDA_BRIDGE_TASK.includes("不必照抄") || AGENDA_BRIDGE_TASK.includes("自然语言"),
  );
  assert("supports field is landing not verify", AGENDA_BRIDGE_TASK.includes("落地方向："));
  assert("forbids verify/falsify framing", !AGENDA_BRIDGE_TASK.includes("要验证 / 证伪这几条破局方向"));
  assert("segment2 prompt re-exports task", seg2Prompt.includes("DEEP_RECKONING_TASK"));
  assert("source has index validator", file.includes("direction_index") && file.includes("fuzzyMatchDirectionIndex"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
