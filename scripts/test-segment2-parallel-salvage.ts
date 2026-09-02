/**
 * Segment 2 parallel accumulated salvage smoke test.
 * Run: pnpm test:segment2-parallel-salvage
 */

import assert from "node:assert/strict";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { salvageSegment2ParallelAccumulated } from "@/lib/poju/segment2-parallel-salvage";
import { finalizeMergedCallA, parseVoiceResponse } from "@/lib/llm/deepseek/segment2-a-parallel";

const goodVoice = [
  "### 你卡在哪里",
  "你想挣脱，但恐惧不是空穴来风。继续熬着会消耗健康，完全裸辞又可能让你陷入另一种恐慌。",
  "",
  "### 几个关键侧面",
  "职场与关系两股力在拉扯。",
  "",
  "### 此刻真正要看清的",
  "结构已看清，走法还缺现实对齐。",
].join("\n");

{
  assert.equal(parseVoiceResponse(goodVoice), goodVoice);
  console.log("ok parseVoiceResponse accepts plain markdown");
}

const core = makeTestBreakthroughCore({ response: goodVoice });

const blobJsonVoice = [
  "===dims===\n",
  JSON.stringify({ multi_dimension_reckoning: core.multi_dimension_reckoning }),
  "\n===spine===\n",
  JSON.stringify({
    energy_structure: core.energy_structure,
    situation_conclusion: core.situation_conclusion,
    key_crossroads: core.key_crossroads,
    modern_action_frames: core.modern_action_frames,
    energy_retune_frame: core.energy_retune_frame,
    rhythm_frame: core.rhythm_frame,
    self_check_signals: core.self_check_signals,
  }),
  "\n===voice===\n",
  JSON.stringify({ response: core.response }),
].join("");

{
  const salvaged = salvageSegment2ParallelAccumulated(blobJsonVoice, "zh", {});
  assert.equal(salvaged.ok, true);
  if (salvaged.ok) {
    assert.ok(salvaged.breakthrough_core.response?.includes("完全裸辞"));
    assert.ok(!/身弱见官杀|bare_ganzhi/.test(salvaged.breakthrough_core.response ?? ""));
  }
  console.log("ok salvage from JSON-wrapped voice blob");
}

const blobPlainVoice = blobJsonVoice.replace(
  `\n===voice===\n${JSON.stringify({ response: core.response })}`,
  `\n===voice===\n${core.response}`,
);

{
  const salvaged = salvageSegment2ParallelAccumulated(blobPlainVoice, "zh", {});
  assert.equal(salvaged.ok, true);
  if (salvaged.ok) {
    assert.equal(salvaged.breakthrough_core.response, goodVoice);
  }
  console.log("ok salvage from plain-markdown voice blob (runner format)");
}

{
  const { breakthrough_core } = finalizeMergedCallA(
    { ...core, response: goodVoice },
    "zh",
  );
  assert.ok(breakthrough_core.response?.includes("完全裸辞"));
  assert.ok(!breakthrough_core.response?.includes("困境根于"));
  console.log("ok finalizeMergedCallA keeps model voice (no dims fallback)");
}

console.log("\nAll segment2 parallel salvage tests passed.");
