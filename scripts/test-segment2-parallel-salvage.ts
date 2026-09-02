/**
 * Segment 2 parallel accumulated salvage smoke test.
 * Run: pnpm test:segment2-parallel-salvage
 */

import assert from "node:assert/strict";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { salvageSegment2ParallelAccumulated } from "@/lib/poju/segment2-parallel-salvage";

const core = makeTestBreakthroughCore({
  response: "### 你卡在哪里\n中间路线是最聪明的做法。\n\n### 几个关键侧面\nx\n\n### 此刻真正要看清的\ny",
});

const blob = [
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
  const salvaged = salvageSegment2ParallelAccumulated(blob, "zh", {});
  assert.equal(salvaged.ok, true);
  if (salvaged.ok) {
    assert.ok(salvaged.breakthrough_core.situation_conclusion.trim().length > 0);
    assert.ok(!/中间路线|最聪明的做法/.test(salvaged.breakthrough_core.response ?? ""));
  }
  console.log("ok salvage from parallel accumulated blob");
}

console.log("\nAll segment2 parallel salvage tests passed.");
