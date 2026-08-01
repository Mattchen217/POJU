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
  console.log("\n========== POJU Block 95 · Segment2 presentation ==========\n");

  const prompt = read("lib/llm/deepseek/breakthrough-core.ts");
  const glossary = read("components/cross-product/GlossaryText.tsx");
  const css = read("styles/glossary.css");
  const display = read("lib/poju/phases/segment2/display.ts");
  const marking = read("lib/llm/sanitize/term-marking.ts");

  assert("prompt fluency rewrite rule", prompt.includes("白话重组") && prompt.includes("禁抠词替换"));
  assert("prompt compliance on bare structure", prompt.includes("正文【严禁】裸写") || prompt.includes("合规（用户可见字段"));
  assert(
    "GlossaryText golden soft + underline",
    glossary.includes("term-mark__word--interactive") && !glossary.includes('>[···]<'),
  );
  assert(
    "GlossaryText soft word has no bracket wrapper",
    !glossary.includes("[{softLabel}]") && glossary.includes("{softLabel}"),
  );
  assert("interactive soft word (no info dots opener)", glossary.includes("term-mark__word--interactive") && !glossary.includes("term-mark__info"));
  assert("css golden word style", css.includes(".term-mark__word") && css.includes("term-mark__word--interactive"));
  assert("display clear question helper", display.includes("formatFocusQuestionAsClearQuestion"));
  assert("display model first_question path", display.includes("appendModelFirstQuestion"));
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
  agent.breakthrough_core = makeTestBreakthroughCore({
    situation_conclusion: "你在关系里容易先退后守。",
    modern_action_frames: [
      {
        direction: "先稳住边界",
        why_fits: "先守节奏再谈合作",
        structural_basis: "正官与执行锋芒并立",
        needs_validation: "对方愿意按你的节奏来",
      },
      {
        direction: "备用方向",
        why_fits: "备用",
        structural_basis: "备用依据",
        needs_validation: "备用验证",
      },
    ],
    first_question:
      "要把边界稳住，我想先知道最近一次对方越过你底线时，你有没有当场表达清楚——那次具体是怎么发生的？",
  });
  agent.investigation_agenda = [
    { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
  ];
  const reply = buildSegment2AnalysisReply(agent, "zh");
  assert("reply uses model first_question", reply.includes("当场表达清楚"));
  assert("reply ends with question mark", /[？?]\s*$/.test(reply.trim()));
  assert("reply does not dump raw agenda label", !reply.includes("最近一次越界是什么？"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
