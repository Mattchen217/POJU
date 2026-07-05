/**
 * Block 54 — split prediction boundary + time anxiety translation + point prediction audit
 *
 *   pnpm exec tsx scripts/test-poju-block54-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { detectOutputPolicyViolations } from "@/lib/llm/compliance/audit-output";
import {
  buildPojuOutputRedLinesBlock,
  buildPojuPredictionBoundaryBlock,
} from "@/lib/llm/compliance/output-policy";
import { buildOutputRedLinesBlock } from "@/lib/llm/phases/oriental-prompt-context";

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
  console.log("\n=== Block 54 acceptance ===\n");

  const policy = read("lib/llm/compliance/output-policy.ts");
  assert("single source has 禁点位预测", policy.includes("【禁】具体事件/日期/点位预测"));
  assert("single source has 可条件性时机引导", policy.includes("【可】锚定命盘结构的条件性时机引导"));
  assert("single source has time anxiety translation", policy.includes("不生硬拒绝"));

  const v6Redlines = buildPojuOutputRedLinesBlock();
  assert("v6 redlines from single source", v6Redlines.includes("禁】具体事件/日期/点位预测"));
  assert("v6 has translation principle", v6Redlines.includes("不生硬拒绝"));
  assert("v5 chat redlines aligned", buildOutputRedLinesBlock().includes("禁】具体事件/日期/点位预测"));

  assert(
    "poju-base guardrails use translation",
    read("lib/llm/prompts/poju-base.ts").includes("${POJU_TIME_ANXIETY_TRANSLATION}"),
  );
  assert(
    "final-delivery uses POJU_DELIVERY_COMPLIANCE_LINE",
    read("lib/llm/pro/final-delivery.ts").includes("POJU_DELIVERY_COMPLIANCE_LINE"),
  );
  assert(
    "v6 buildOutputRedLinesBlockV6 delegates",
    read("lib/llm/prompts/poju-base-v6.ts").includes("buildPojuOutputRedLinesBlock"),
  );

  assert(
    "no old rejection-only phrasing in v6 redlines",
    !v6Redlines.includes("重构为\"当前阶段是否就绪"),
  );

  const saasHit = detectOutputPolicyViolations("明年下半年将迎来效能拐点，事业会明显好转。", "zh");
  assert(
    "audit blocks SaaS-wrapped point prediction",
    saasHit.some((v) => v.category === "compliance_redline" && v.label.includes("point_prediction")),
  );

  const enHit = detectOutputPolicyViolations(
    "Next year you will break through and land a major deal.",
    "en",
  );
  assert(
    "audit blocks EN point prediction pattern",
    enHit.some((v) => v.category === "compliance_redline" && v.label.includes("point_prediction")),
  );

  const okConditional = detectOutputPolicyViolations(
    "机会接得住的前提，是你的结构先进入就绪状态——用神得力、节奏稳住，这比追一个日期更重要。",
    "zh",
  );
  assert(
    "conditional readiness guidance passes audit",
    !okConditional.some((v) => v.label.includes("point_prediction")),
  );

  assert(
    "buildPojuPredictionBoundaryBlock has both halves",
    buildPojuPredictionBoundaryBlock().includes("【禁】") &&
      buildPojuPredictionBoundaryBlock().includes("【可】"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 54 checks passed.\n");
}

main();
