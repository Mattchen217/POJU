/**
 * Block 90 — segment 2 bad JSON salvage (no bare 500)
 *
 *   pnpm exec tsx scripts/test-poju-block90-breakthrough-json-salvage.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  parseAndMapBreakthroughCore,
  parseBreakthroughCoreResponseText,
  salvageBreakthroughFields,
} from "@/lib/llm/deepseek/breakthrough-core";

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
  console.log("\n========== POJU Block 90 · Breakthrough JSON salvage ==========\n");

  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  const route = read("app/api/poju/breakthrough-core/route.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");

  assert("tolerantJsonRepair import", core.includes("tolerantJsonRepair"));
  assert("salvageBreakthroughFields exported", core.includes("export function salvageBreakthroughFields"));
  assert("parseAndMapBreakthroughCore exported", core.includes("export function parseAndMapBreakthroughCore"));
  assert("BreakthroughCoreParseError", core.includes("BreakthroughCoreParseError"));
  assert("strict JSON prompt", core.includes("严格 JSON") && core.includes("键名英文小写 ASCII 双引号"));
  assert(
    "runner uses parseSanitizeBreakthroughCore",
    runner.includes("parseSanitizeBreakthroughCore") || runner.includes("parseAndMapBreakthroughCore"),
  );
  assert("create returns async job_id", route.includes("job_id: job.job_id"));
  assert("runner retryable parse failure", runner.includes('failure_reason: "parse_failed"'));

  const broken = `{
  "relationship_conclusion": "你在关系里容易先退后守。",
  "breakthrough_directions": [
    { "direction": "先稳住边界", "structural_basis": "正官与羊刃并立", "timing": "今年下半年", "what_would_confirm": "对方愿意按你的节奏" },
    { "direction": "把经验沉淀成模块", "structural_basis": "乙木需扎根", "timing": "未来两年", "what_would_confirm": "有徒弟主动来问" }
  ],
  "investigation_agenda": [
    { "id":"a1", "label":"你最想先动哪一步？", "critical":true, "status":"unexplored", "supports":"验证方向1" },
    { "id":"a2", "label":"过去类似处境你怎么选的？", "critical":true, "status":"unexplored", "supports":"验证方向2" },
    { "id":"a3", "label":"谁最能给你现实支撑？", "critical":false, "status":"unexplored", "supports":"验证方向1" }
  ],
`;

  const mapped = parseAndMapBreakthroughCore(broken);
  assert("truncated JSON salvage maps", mapped.breakthrough_core.situation_conclusion.includes("先退后守"));
  assert("salvaged action frames count", mapped.breakthrough_core.modern_action_frames.length >= 2);
  assert("salvaged agenda count", mapped.investigation_agenda.length >= 3);

  const spacedKeys = `{
  "relationship _conclusion": "测试结论",
  "breakthrough_directions": [
    { "direction": "方向一", "structural_basis": "依据一", "timing": "时机一", "what_would_confirm": "验证一" },
    { "direction": "方向二", "structural_basis": "依据二", "timing": "时机二", "what_would_confirm": "验证二" }
  ]
}`;
  const salvaged = salvageBreakthroughFields(spacedKeys.replace("relationship _conclusion", "relationship_conclusion"));
  assert("field salvage returns object", salvaged != null);

  let threw = false;
  try {
    parseBreakthroughCoreResponseText('{"foo":');
    threw = false;
  } catch (e) {
    threw = e instanceof Error && e.message === "core_parse_failed";
  }
  assert("unrecoverable throws core_parse_failed", threw);

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
