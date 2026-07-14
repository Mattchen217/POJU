/**
 * Block 96 — segment2 agenda serves landing breakthrough directions (not understanding)
 *
 *   pnpm exec tsx scripts/test-poju-block96-segment2-agenda-landing.ts
 */
import fs from "node:fs";
import path from "node:path";
import { DEEP_RECKONING_TASK } from "@/lib/llm/deepseek/breakthrough-core";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 96 · Segment2 agenda landing ==========\n");

  const prompt = DEEP_RECKONING_TASK;
  const file = fs.readFileSync(path.join(ROOT, "lib/llm/deepseek/breakthrough-core.ts"), "utf8");
  const seg2Prompt = fs.readFileSync(
    path.join(ROOT, "lib/poju/phases/segment2/prompt.ts"),
    "utf8",
  );

  assert("agenda purpose is landing info", prompt.includes("为了达成这些破局方向，第3阶段需要向他收集的关键信息"));
  assert("explicit not reopen phase1 understanding", prompt.includes("不要再去泛泛了解"));
  assert("not execution plan for phase4", prompt.includes("敲定怎么执行方案"));
  assert("forbids verify/falsify framing", !prompt.includes("要验证 / 证伪这几条破局方向"));
  assert("forbids 搞清楚哪几件事 framing", !prompt.includes("搞清楚哪几件事"));
  assert("has phase1-style anti-examples", prompt.includes("妻子烦躁的具体触发点") && prompt.includes("外部支撑"));
  assert("has landing-style positive examples", prompt.includes("能说上话的话题") && prompt.includes("客户关系深到什么程度"));
  assert("self-check asks which direction", prompt.includes("是为了达成【哪一条破局方向】"));
  assert("supports field is landing not verify", prompt.includes("落地方向：") && !prompt.includes('"supports":"验证 direction'));
  assert("segment2 prompt re-exports task", seg2Prompt.includes("DEEP_RECKONING_TASK"));
  assert("source file updated", file.includes("倒推所需收集的信息"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
