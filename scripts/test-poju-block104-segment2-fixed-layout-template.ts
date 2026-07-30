/**
 * Block 104 — Segment 2 dialogue body (Call A response), not direction report cards
 *
 *   pnpm exec tsx scripts/test-poju-block104-segment2-fixed-layout-template.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import {
  buildSegment2AnalysisReply,
  formatSegment2ReplyForUser,
} from "@/lib/poju/phases/segment2/display";

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
  console.log("\n========== POJU Block 104 · segment2 dialogue ==========\n");

  const display = read("lib/poju/phases/segment2/display.ts");
  const prompt = read("lib/llm/deepseek/breakthrough-core.ts");

  assert("prompt asks for response dialogue", prompt.includes('"response"') && prompt.includes("对话式"));
  assert("prompt forbids 破局方向 cards in response", prompt.includes("破局方向一/二/三") || prompt.includes("破局方向"));
  assert("display uses formatSegment2ReplyForUser", display.includes("formatSegment2ReplyForUser"));
  assert("display no longer templates 破局方向 h3", !display.includes("### 破局方向"));
  assert("prompt short paragraphs", prompt.includes("2–4 短段") || prompt.includes("2-4 短段"));
  assert("timing is 进/守/转 only", prompt.includes("只写【进 / 守 / 转") || prompt.includes("进 / 守 / 转"));

  const agent = createInitialAgentState({ original_question: "q" });
  agent.breakthrough_core = makeTestBreakthroughCore({
    situation_conclusion: "你在关系里容易先退后守。",
    response:
      "我看了你的情况：你在关系里容易先退后守。关键不在再找一套说辞，而在你怎么站位。我心里有几条路，但得先了解你几件事。",
    modern_action_frames: [
      {
        direction: "先稳住边界",
        why_fits: "先守节奏再谈合作",
        structural_basis: "正官与执行锋芒并立",
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

  const replyA = buildSegment2AnalysisReply(agent, "zh", { includeFirstQuestion: false });
  assert("Call A body is dialogue", replyA.includes("我看了你的情况"), replyA);
  assert("no direction report h3", !replyA.includes("### 破局方向"), replyA);
  assert("no action frame dump", !replyA.includes("先稳住边界"), replyA);
  assert("no needs_validation leak", !replyA.includes("对方愿意按你的节奏来"), replyA);

  const replyFull = buildSegment2AnalysisReply(agent, "zh");
  assert("combined path keeps dialogue", replyFull.includes("我心里有几条路"), replyFull);
  assert("first_question can append", replyFull.includes("当场说清楚"), replyFull);

  const body = formatSegment2ReplyForUser(agent.breakthrough_core, "zh");
  assert("formatSegment2ReplyForUser returns response", body.includes("复盘") || body.includes("几条路"), body);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 104 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
