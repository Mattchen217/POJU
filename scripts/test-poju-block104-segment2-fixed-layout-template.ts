/**
 * Block 104 — Segment 2 fixed layout template (code fills structure, model fills content)
 *
 *   pnpm exec tsx scripts/test-poju-block104-segment2-fixed-layout-template.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import {
  buildSegment2AnalysisReply,
  formatBreakthroughDirectionsForUser,
} from "@/lib/poju/phases/segment2/display";
import { parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 104 · fixed layout template ==========\n");

  const display = read("lib/poju/phases/segment2/display.ts");
  const prompt = read("lib/llm/deepseek/breakthrough-core.ts");

  assert("no space-indent structural_basis", !display.includes("   结构依据："));
  assert(
    "prompt content-only fields",
    prompt.includes("字段=纯内容") || prompt.includes("字段内标题"),
  );
  assert(
    "prompt short paragraphs",
    prompt.includes("2–4 短段") || prompt.includes("2-4 短段") || prompt.includes("2–4 个短段"),
  );
  assert(
    "prompt forbids field markdown",
    prompt.includes("禁字段内标题") || prompt.includes("禁止】在字段里写标题") || prompt.includes("禁止在字段里写标题"),
  );
  assert("timing is 进/守/转 only", prompt.includes("只写【进 / 守 / 转") || prompt.includes("进 / 守 / 转"));
  assert("timing bans action steps", prompt.includes("严禁】写具体行动步骤") || prompt.includes("严禁写具体行动"));
  assert("agenda label 2nd person", prompt.includes("第二人称") && prompt.includes("短名词短语"));
  assert("plain cites user words", prompt.includes("亲口说过") || prompt.includes("亲口元素"));

  const agent = createInitialAgentState({ original_question: "q" });
  agent.breakthrough_core = makeTestBreakthroughCore({
    situation_conclusion:
      "你在关系里容易先退后守。\n\n外部一加压，你就把自己缩回去，而不是先把边界说清楚。",
    modern_action_frames: [
      {
        direction: "1. 先稳住边界",
        why_fits: "先守节奏再谈合作",
        structural_basis: "结构依据：正官与执行锋芒并立",
        needs_validation: "对方愿意按你的节奏来",
      },
      {
        direction: "换通道发力",
        why_fits: "表达力过旺时改用更克制的方式",
        structural_basis: "表达力过旺时改用更克制的方式",
        needs_validation: "连续两周边界未被封口",
      },
    ],
    first_question: "要把边界稳住，上次对方越线时你有没有当场说清楚？",
  });
  agent.investigation_agenda = [
    { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
  ];

  const reply = buildSegment2AnalysisReply(agent, "zh");
  assert("has conclusion h3", reply.includes("### 你为什么卡在这里"), reply);
  assert("has direction one h3", reply.includes("### 破局方向一 · 先稳住边界"), reply);
  assert("has direction two h3", reply.includes("### 破局方向二 · 换通道发力"), reply);
  assert("strips model direction numbering", !reply.includes("1. 先稳住边界"), reply);
  assert("strips model basis prefix", !reply.includes("结构依据：正官"), reply);
  assert("has basis lead", reply.includes("**依据与推理:**"), reply);
  assert("has why lead", reply.includes("**为什么适合你:**"), reply);
  assert("no old timing lead", !reply.includes("**时机判断:**"), reply);
  assert("no old how lead", !reply.includes("**现在该怎么走:**"), reply);
  assert("no needs_validation in body", !reply.includes("对方愿意按你的节奏来"), reply);
  assert("first_question at end", reply.trim().endsWith("？") || reply.includes("当场说清楚"), reply);
  assert("agenda label not dumped", !reply.includes("最近一次越界是什么？"), reply);

  const blocks = parseReadingBlocks(reply, { layout: false });
  const h3s = blocks.filter((b) => b.type === "h3");
  const leads = blocks.filter((b) => b.type === "lead");
  assert("parse sees ≥3 h3", h3s.length >= 3, JSON.stringify(h3s.map((b) => (b as { content: string }).content)));
  assert("parse sees lead blocks", leads.length >= 2, JSON.stringify(leads));

  const en = formatBreakthroughDirectionsForUser(agent.breakthrough_core, "en");
  assert("en isomorphic Direction h3", en.includes("### Direction 1 ·"), en);
  assert("en isomorphic basis lead", en.includes("**Evidence & reasoning:**"), en);
  assert("en why fits lead", en.includes("**Why it fits:**"), en);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 104 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
