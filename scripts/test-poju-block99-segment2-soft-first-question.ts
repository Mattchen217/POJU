/**
 * Block 99 — segment2 light soft render + model first_question
 *
 *   pnpm exec tsx scripts/test-poju-block99-segment2-soft-first-question.ts
 */
import fs from "node:fs";
import path from "node:path";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import { mapBreakthroughCorePayload } from "@/lib/llm/deepseek/breakthrough-core";
import {
  appendModelFirstQuestion,
  buildSegment2AnalysisReply,
} from "@/lib/poju/phases/segment2/display";
import { createInitialAgentState } from "@/lib/poju/agent-state";

const ROOT = process.cwd();
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 99 · Soft light + first_question ==========\n");

  const glossary = read("components/cross-product/GlossaryText.tsx");
  const prompt = read("lib/llm/deepseek/breakthrough-core.ts");
  const display = read("lib/poju/phases/segment2/display.ts");

  assert("golden soft + dots UI", glossary.includes("term-mark__word") && glossary.includes("[···]"));
  assert("no soft · plain join in UI", !glossary.includes("${visible.trim()} · ${plain.trim()}"));
  assert("paragraph density cap", glossary.includes("MAX_PAREN_MARKS_PER_PARAGRAPH = 2"));
  assert("prompt fluency + first_question", prompt.includes("白话重组") && prompt.includes("first_question"));
  assert("prompt first_question task", prompt.includes("首问（first_question"));
  assert("display uses appendModelFirstQuestion", display.includes("appendModelFirstQuestion"));
  assert("display prefers model first_question", display.includes("core?.first_question"));

  const mapped = mapBreakthroughCorePayload({
    relationship_conclusion: "你卡住的地方在于降温能力跟不上外部压力。",
    breakthrough_directions: [
      {
        direction: "建立冷却机制",
        structural_basis: "食神受制 · 需要先释放",
        timing: "先守后进",
        what_would_confirm: "是否能稳定独处降温",
      },
      {
        direction: "修复沟通温度",
        structural_basis: "正印被冲",
        timing: "并行推进",
        what_would_confirm: "是否还有可说话窗口",
      },
    ],
    investigation_agenda: [
      {
        id: "a1",
        label: "现有冷却方式与独处时间",
        critical: true,
        status: "unexplored",
        supports: "落地方向：建立冷却机制",
      },
      {
        id: "a2",
        label: "可对话时间窗口",
        critical: true,
        status: "unexplored",
        supports: "落地方向：修复沟通温度",
      },
      {
        id: "a3",
        label: "过渡期接受度",
        critical: false,
        status: "unexplored",
        supports: "落地方向：建立冷却机制",
      },
    ],
    first_question:
      "要帮你把『先降火再回家』这个方向落地，我得先了解你现在有没有属于自己的冷却时间——比如下班到进家门之间，有没有一段哪怕十分钟、完全不被打扰的空档？你现在是怎么给自己降温的？",
  });
  assert("maps first_question onto core", mapped.breakthrough_core.first_question?.includes("冷却时间") === true);

  const agent = createInitialAgentState({ original_question: "q" });
  agent.breakthrough_core = mapped.breakthrough_core;
  agent.investigation_agenda = mapped.investigation_agenda;
  const reply = buildSegment2AnalysisReply(agent, "zh");
  assert("reply uses model first_question", reply.includes("先降火再回家"));
  assert("reply does not dump agenda label as ask", !reply.includes("现有冷却方式与独处时间？"));
  assert(
    "appendModelFirstQuestion keeps model text",
    appendModelFirstQuestion("分析正文。", mapped.breakthrough_core.first_question, "zh").includes(
      "冷却时间",
    ),
  );

  const dense =
    "见食神与正印并立。再见食神发动。又见正官制约。\n\n另段见羊刃与七杀。";
  const marked = autoMarkBareTerms(dense, "zh");
  const markCount = (marked.match(/⟦t:/g) || []).length;
  assert("autoMark density capped (~≤4 across 2 paras)", markCount <= 4);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
