/**
 * Block 51 — thinking_effort high + envelope salvage + compliance redlines
 *
 *   pnpm exec tsx scripts/test-poju-block51-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { auditDeliveredText } from "@/lib/llm/sanitize/compliance-terms";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import {
  coerceOpeningConversionRecord,
  parseOpeningConversionPayload,
} from "@/lib/poju/opening-conversion-payload";

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
  console.log("\n=== Block 51 acceptance ===\n");

  // Fix 1 — no xhigh in v6 hot path
  assert("opening-phase-v6 uses high", read("lib/llm/phases/opening-phase-v6.ts").includes('thinking_effort: "high"'));
  assert(
    "opening-phase-v6 no xhigh",
    !read("lib/llm/phases/opening-phase-v6.ts").includes('thinking_effort: "xhigh"'),
  );
  assert("breakthrough-core route high", read("app/api/poju/breakthrough-core/route.ts").includes('thinking_effort: "high"'));
  assert(
    "breakthrough-core timeout 180s",
    read("app/api/poju/breakthrough-core/route.ts").includes("timeout_ms: 180_000"),
  );
  assert(
    "core retry max_tokens 16000",
    read("app/api/poju/breakthrough-core/route.ts").includes("CORE_MAX_TOKENS_RETRY = 16_000"),
  );
  assert(
    "phase-transport default high",
    read("lib/llm/phases/phase-transport.ts").includes('thinking_effort ?? "high"'),
  );

  // Fix 2 — envelope salvage
  const salvage = parseOpeningConversionPayload(
    {
      understanding_sufficient: true,
      question_category: "career",
      relationship_conclusion: "上线前节奏被自我要求压紧",
      investigation_agenda: [
        { id: "a1", label: "最大卡点", status: "unexplored" },
        { id: "a2", label: "已试过什么", status: "unexplored" },
      ],
    },
    "上线前节奏被自我要求压紧——我们先从最大卡点说起？",
  );
  assert("agenda-only salvage succeeds", salvage != null && salvage.salvaged === true);
  assert("salvaged core has 2 directions", (salvage?.breakthrough_core.breakthrough_directions.length ?? 0) >= 2);

  const mixed = coerceOpeningConversionRecord(
    '先说明一下：{"relationship_conclusion":"x","investigation_agenda":[{"label":"A","status":"unexplored"},{"label":"B","status":"unexplored"}]}',
  );
  assert("coerce extracts JSON from prose", typeof mixed.investigation_agenda === "object");

  // Fix 4 — compliance redlines in identity + audit
  assert("identity avoids 命盘", !POJU_V6_STATIC_SYSTEM.includes("命盘"));
  assert("identity avoids 占卜", !POJU_V6_STATIC_SYSTEM.includes("占卜"));
  assert("redlines reference compliance_redline audit", POJU_V6_STATIC_SYSTEM.includes("compliance_redline"));
  const negationHit = auditDeliveredText("我不替你占卜，也不下命运定论。", "zh");
  assert(
    "audit blocks 占卜/命运 even in negation",
    negationHit.some((v) => v.label.includes("compliance_redline") || v.label.includes("divination") || v.label.includes("bazi_term")),
  );

  // Fix 5 — opening convergence rules
  assert(
    "opening synthesizes prior answers",
    read("lib/llm/phases/opening-phase-v6.ts").includes("综合用户已经说过的"),
  );

  // Fix 3 — guard uses closed-set principle (no enumerated forbidden shen_sha list)
  assert(
    "fact guard uses instance inventory principle",
    read("lib/llm/prompts/shen-sha-guard.ts").includes("本盘实例清单里实际算出"),
  );
  assert(
    "fact guard no enumerated 金舆",
    !read("lib/llm/prompts/shen-sha-guard.ts").includes("金舆"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 51 checks passed.\n");
}

main();
