/**
 * Syncro Step 6 — local matrix + merge (no LLM).
 * Run: pnpm test:syncro-step6
 */

import { buildSyncroPrompt } from "../lib/llm/prompts/syncro-deepseek-prompt";
import { calculateSyncroMatrix } from "../lib/syncro/calculate-matrix";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const mockProfile = {
  base_analysis: {
    content: {
      bazi: { day_master: "乙" },
      yong_shen: { primary_element: "水" },
    },
  },
};

const { matrix: localMatrix, metadata: trueSolarMeta } = calculateSyncroMatrix({
  profile: mockProfile,
  taskDescription: "job interview tomorrow",
  startTime: new Date("2024-05-10T10:00:00Z"),
  userTimezone: "UTC",
  userLongitude: 0,
  userLatitude: 40.71,
});

const { system, user } = buildSyncroPrompt({
  profile: null,
  base_analysis: mockProfile.base_analysis.content,
  task_description: "job interview tomorrow",
  user_location: { latitude: 40.71, longitude: 0, timezone: "UTC" },
  locale: "en",
  matrix: localMatrix,
  true_solar: trueSolarMeta,
});

assert(system.includes("矩阵已经计算好了"), "prompt: precomputed matrix");
assert(system.includes("绝不能"), "prompt: forbid changing level");
assert(!system.includes("必须输出全部 96 个 key，缺一不可") || system.includes("仅含 3 个字段"), "prompt: copy-only output");
assert(system.includes("zi__"), "prompt embeds matrix keys");
assert(system.includes("真太阳时"), "prompt includes true solar section");
assert(user.includes("不要修改 current_level"), "user: lock levels");

// Simulate LLM returning partial advice
const fakeLlm: Record<string, { short_advice: string; detailed_advice: string; rationale: string }> = {};
const keys = Object.keys(localMatrix);
fakeLlm[keys[0]] = {
  short_advice: "Move east with focus.",
  detailed_advice: "Detailed east advice for the interview window.",
  rationale: "Water element aligns with this direction at this hour.",
};

const merged: Record<string, unknown> = {};
for (const key of keys) {
  const local = localMatrix[key];
  const advice = fakeLlm[key];
  merged[key] = {
    hour_period: local.hour_period,
    direction_id: local.direction_id,
    hour_start_iso: local.hour_start_iso,
    hour_end_iso: local.hour_end_iso,
    current_level: local.current_level,
    short_advice: advice?.short_advice ?? "fallback short",
    detailed_advice: advice?.detailed_advice ?? "fallback detailed",
    rationale: advice?.rationale ?? "fallback rationale",
    _internal: undefined,
  };
}

const first = merged[keys[0]] as { current_level: string; _internal?: unknown };
const second = merged[keys[1]] as { current_level: string };
assert(
  first.current_level === localMatrix[keys[0]].current_level,
  "merge keeps local level"
);
assert(
  second.current_level === localMatrix[keys[1]].current_level,
  "merge keeps local level (no LLM)"
);
assert(!first._internal, "strip _internal");

console.log("Prompt length (system chars):", system.length);
console.log("Sample merged key:", keys[0], merged[keys[0]]);
console.log("\nSyncro Step 6 (prompt + merge smoke): passed.");
