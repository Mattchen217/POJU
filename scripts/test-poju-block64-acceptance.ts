/**
 * Block 64 — delivery must answer original_question (especially "什么时候"), no question substitution
 *
 *   pnpm exec tsx scripts/test-poju-block64-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  POJU_CONCLUSION_ORIGINAL_QUESTION_MANDATE,
  POJU_TIME_ANXIETY_TRANSLATION,
  buildPojuConclusionOriginalQuestionBlock,
} from "@/lib/llm/compliance/output-policy";
import { buildFinalDeliveryPrompt } from "@/lib/llm/pro/final-delivery";
import { createInitialAgentState } from "@/lib/poju/agent-state";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function main(): void {
  console.log("\n=== Block 64 acceptance ===\n");

  const policy = read("lib/llm/compliance/output-policy.ts");
  const delivery = read("lib/llm/pro/final-delivery.ts");
  const base = read("lib/llm/prompts/poju-base.ts");

  console.log("=== Shared fragment (Block 54 + 64 同源) ===\n");
  assert("policy has CONCLUSION mandate", policy.includes("POJU_CONCLUSION_ORIGINAL_QUESTION_MANDATE"));
  assert("policy has buildPojuConclusionOriginalQuestionBlock", policy.includes("buildPojuConclusionOriginalQuestionBlock"));
  assert("mandate forbids redefinition", POJU_CONCLUSION_ORIGINAL_QUESTION_MANDATE.includes("不许重定义"));
  assert("mandate catches time anxiety", POJU_CONCLUSION_ORIGINAL_QUESTION_MANDATE.includes("什么时候"));
  assert("block includes time translation", buildPojuConclusionOriginalQuestionBlock().includes(POJU_TIME_ANXIETY_TRANSLATION.slice(0, 20)));

  console.log("\n=== Delivery side wired ===\n");
  assert("final-delivery imports shared block", delivery.includes("buildPojuConclusionOriginalQuestionBlock"));
  assert("full task CONCLUSION uses block", delivery.includes("${buildPojuConclusionOriginalQuestionBlock()}"));
  assert("degraded CONCLUSION uses block", (delivery.match(/buildPojuConclusionOriginalQuestionBlock/g) ?? []).length >= 3);
  assert("expert materials forbid question swap", delivery.includes("禁止偷换"));

  const { user } = buildFinalDeliveryPrompt({
    base_analysis: null,
    breakthrough_core: {
      relationship_conclusion: "RC-test",
      breakthrough_directions: [
        { direction: "D1", structural_basis: "s", what_would_confirm: "c", status: "selected" },
      ],
      generated_at: new Date().toISOString(),
    },
    covered_agenda: [{ label: "事业卡点" }],
    agent_v2: createInitialAgentState({ original_question: "我的事业什么时候能好起来" }),
    locale: "zh-CN",
  });
  assert("delivery user prompt has time translation", user.includes("不生硬拒绝"));
  assert("delivery user prompt forbids redefinition", user.includes("不许重定义"));
  assert("delivery user prompt has original_question", user.includes("我的事业什么时候能好起来"));

  console.log("\n=== Chat side aligned ===\n");
  assert("poju-base uses shared mandate", base.includes("POJU_CONCLUSION_ORIGINAL_QUESTION_MANDATE"));
  assert("poju-base still has time translation", base.includes("POJU_TIME_ANXIETY_TRANSLATION"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 64 checks passed.\n");
}

main();
