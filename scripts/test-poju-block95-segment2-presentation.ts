/**
 * Block 95 — segment 2 presentation: paren terms, full auto-mark, clear agenda ask
 *
 *   pnpm exec tsx scripts/test-poju-block95-segment2-presentation.ts
 */
import fs from "node:fs";
import path from "node:path";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import {
  buildSegment2AnalysisReply,
  formatFocusQuestionAsClearQuestion,
} from "@/lib/poju/phases/segment2/display";
import { createInitialAgentState } from "@/lib/poju/agent-state";

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
  console.log("\n========== POJU Block 95 · Segment2 presentation ==========\n");

  const prompt = read("lib/llm/deepseek/breakthrough-core.ts");
  const glossary = read("components/cross-product/GlossaryText.tsx");
  const css = read("styles/glossary.css");
  const display = read("lib/poju/phases/segment2/display.ts");
  const marking = read("lib/llm/sanitize/term-marking.ts");

  assert("prompt paren layout rule", prompt.includes("排版硬要求") && prompt.includes("括号补充"));
  assert("prompt forbids inline interrupt example", prompt.includes("错误示范（禁止）"));
  assert("GlossaryText paren class", glossary.includes("term-mark__paren") && glossary.includes("（{parenBody}）"));
  assert("uses paren button not info dots", glossary.includes("term-mark__paren") && !glossary.includes("term-mark__info"));
  assert("css paren style", css.includes(".term-mark__paren"));
  assert("display clear question helper", display.includes("formatFocusQuestionAsClearQuestion"));
  assert("display lead asks clearly", display.includes("我们先从最关键的一件开始"));
  assert("marking STEM_ELEMENT_COMPOUNDS", marking.includes("STEM_ELEMENT_COMPOUNDS"));
  assert("marking shensha surfaces", marking.includes("allShenshaHanSurfaces"));

  const renShui = autoMarkBareTerms("日主见壬水偏旺。", "zh");
  assert("壬水 auto-marked", renShui.includes("⟦t:") && !renShui.includes("壬水偏旺"));

  const guLuan = autoMarkBareTerms("盘里有孤鸾煞牵制。", "zh");
  assert("孤鸾煞 auto-marked", guLuan.includes("⟦t:") && !guLuan.includes("有孤鸾煞"));

  const guaSu = autoMarkBareTerms("年支见寡宿。", "zh");
  assert("寡宿 auto-marked", guaSu.includes("⟦t:") && !guaSu.includes("见寡宿"));

  const q = formatFocusQuestionAsClearQuestion("最近一次越界是什么", "zh");
  assert("clear question ends with？", q.endsWith("？"));

  const agent = createInitialAgentState({ original_question: "q" });
  agent.breakthrough_core = {
    relationship_conclusion: "你在关系里容易先退后守。",
    breakthrough_directions: [
      {
        direction: "先稳住边界",
        structural_basis: "正官与执行锋芒并立",
        timing: "守而后进",
        what_would_confirm: "对方愿意按你的节奏来",
      },
    ],
    generated_at: new Date().toISOString(),
  };
  agent.investigation_agenda = [
    { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
  ];
  const reply = buildSegment2AnalysisReply(agent, "zh");
  assert("reply has clear ask lead", reply.includes("我们先从最关键的一件开始"));
  assert("reply ends with question mark", /[？?]\s*$/.test(reply.trim()));
  assert("reply asks first focus", reply.includes("越界"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
