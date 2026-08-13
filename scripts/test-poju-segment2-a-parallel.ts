/**
 * Segment-2 Call A parallel merge/parse smoke.
 *   pnpm exec tsx scripts/test-poju-segment2-a-parallel.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEEP_RECKONING_DIMS_TASK,
  DEEP_RECKONING_SPINE_TASK,
  DEEP_RECKONING_VOICE_TASK,
  fallbackVoiceFromDims,
  mergeSegment2APartials,
  parseDimsPartial,
  parseSpinePartial,
  parseVoiceResponse,
} from "@/lib/llm/deepseek/segment2-a-parallel";

const ROOT = process.cwd();
const runner = fs.readFileSync(path.join(ROOT, "lib/poju/xhigh-job-runner.ts"), "utf8");

assert.ok(DEEP_RECKONING_DIMS_TASK.includes("multi_dimension_reckoning"));
assert.ok(DEEP_RECKONING_SPINE_TASK.includes("situation_conclusion"));
assert.ok(DEEP_RECKONING_SPINE_TASK.includes("禁止】multi_dimension_reckoning") || DEEP_RECKONING_SPINE_TASK.includes("不含 multi_dimension"));
assert.ok(DEEP_RECKONING_VOICE_TASK.includes('"response"'));
assert.ok(DEEP_RECKONING_VOICE_TASK.includes("###"));
assert.ok(DEEP_RECKONING_VOICE_TASK.includes("反流水账") || DEEP_RECKONING_VOICE_TASK.includes("一维一段"));
assert.ok(DEEP_RECKONING_VOICE_TASK.includes("长等待") || DEEP_RECKONING_VOICE_TASK.includes("熔"));
assert.ok(DEEP_RECKONING_VOICE_TASK.includes("360"));
assert.ok(DEEP_RECKONING_SPINE_TASK.includes("不定主辅") || DEEP_RECKONING_SPINE_TASK.includes("不定】主辅"));
assert.ok(runner.includes("SEGMENT2_A_PARALLEL_LEG_TIMEOUT_MS"));
assert.ok(runner.includes("segment2 parallel A start"));
assert.ok(runner.includes('reasoning_effort: "xhigh"'));
assert.ok(runner.includes("buildBreakthroughCoreDimsPrompt"));
assert.ok(runner.includes("buildBreakthroughCoreSpinePrompt"));
assert.ok(runner.includes("buildBreakthroughCoreVoicePrompt"));

const dims = parseDimsPartial(
  JSON.stringify({
    multi_dimension_reckoning: [
      { dimension: "大运", chart_basis: "壬水日主", judgment: "宜先稳住现金流再扩张" },
      { dimension: "十神", chart_basis: "食伤透干", judgment: "适合靠产出换资源,不宜空转社交" },
    ],
  }),
);
assert.equal(dims.length, 2);

const spine = parseSpinePartial(
  JSON.stringify({
    energy_structure: "身弱喜印",
    situation_conclusion: "卡在身份切换与消耗之间",
    key_crossroads: {
      real_fork: "尖刀还是舵手",
      path_costs: "降薪换掌控",
      decision_traits: "习惯做执行尖刀",
      structural_basis: "食伤旺",
      needs_validation: "家庭对降薪的底线",
    },
    energy_retune_frame: {
      direction_fit: "宜守中求进",
      timing_ripeness: "今明两年可试",
      daily_retune: "早起独思",
      complementary: "找托底伙伴",
      structural_basis: "印星",
      needs_validation: "是否已有托底人选",
      status: "hypothesis",
    },
    rhythm_frame: {
      phase1_observe: "先观察两周消耗源",
      phase2_adjust: "再谈条件",
      phase3_consolidate: "落地节奏",
    },
    self_check_signals: ["睡得好吗", "还想回大厂吗", "家庭是否支持"],
  }),
);
assert.ok(spine.situation_conclusion.includes("身份"));

const merged = mergeSegment2APartials({
  dims,
  spine,
  response: parseVoiceResponse(JSON.stringify({ response: "从你的能量结构看，这是身份切换局。" })),
});
assert.equal(merged.multi_dimension_reckoning?.length, 2);
assert.ok(merged.response?.includes("身份"));

const fb = fallbackVoiceFromDims(dims, spine.situation_conclusion, "zh");
assert.ok(fb.includes("能量结构"));

console.log("test-poju-segment2-a-parallel: ok");
