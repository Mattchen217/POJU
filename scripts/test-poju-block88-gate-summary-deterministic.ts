/**
 * Block 88 — understanding gate deterministic summary + no literal markdown stars
 *
 *   pnpm exec tsx scripts/test-poju-block88-gate-summary-deterministic.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildUnderstandingGateSummaryFromFields } from "@/lib/poju/understanding-gate-reply";
import type { POJUAgentState } from "@/lib/poju/agent-state";

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
  console.log("\n========== POJU Block 88 · Gate summary deterministic ==========\n");

  const agent = read("lib/poju/agent.ts");
  const gate = read("lib/poju/understanding-gate-reply.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");

  assert("agent uses buildUnderstandingGateSummaryFromFields", agent.includes("buildUnderstandingGateSummaryFromFields(agent_v2"));
  assert("agent gate on awaiting_understanding_confirm phase", agent.includes('phaseAfter === "awaiting_understanding_confirm"'));
  assert("resolve always uses fields", gate.includes("return buildUnderstandingGateSummaryFromFields(agent, locale)"));
  assert("no model length threshold 120", !gate.includes("trimmed.length >= 120"));
  assert("summary has no markdown field labels", !gate.includes("`**${copy.fieldEvent}:**"));
  assert("sanitize fallback exported", gate.includes("sanitizeUnderstandingGateModelResponse"));
  assert("opening prompt summary hard rule", opening.includes("总结轮硬规则"));
  assert("opening response not visible to user", opening.includes("对用户不可见"));

  const sample = buildUnderstandingGateSummaryFromFields(
    {
      core_dilemma: {
        concrete_event: "新领导推数字化考核",
        stakes: "怕丢饭碗",
        sticking_point: "不认同标准又不敢硬顶",
      },
      desired_direction: {
        wants: "保住位置并争取话语权",
        priority: "先摸清对方真实底线",
      },
    } as unknown as POJUAgentState,
    "zh",
  );

  assert("summary includes event", sample.includes("新领导推数字化考核"));
  assert("summary includes stakes", sample.includes("怕丢饭碗"));
  assert("summary no question mark at end", !/[？?]\s*$/.test(sample.trim()));
  assert("summary no literal **", !sample.includes("**"));
  assert("summary has footer preview", sample.includes("深度分析"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
