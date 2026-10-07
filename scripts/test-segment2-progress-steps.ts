/**
 * Segment-2 Call A progress step derivation + copy wiring.
 * Run: pnpm exec tsx scripts/test-segment2-progress-steps.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveSegment2CallAProgressStep,
  isSegment2CallAProgressStep,
} from "../lib/poju/segment2-progress-steps";
import { pivotChatCopy, pivotChatSegment2StepLabel } from "../lib/poju/pivot-chat-copy";

assert.equal(isSegment2CallAProgressStep("voice"), true);
assert.equal(isSegment2CallAProgressStep("nope"), false);

assert.equal(deriveSegment2CallAProgressStep("", null), "starting");
assert.equal(deriveSegment2CallAProgressStep("", "a0_plan"), "a0_plan");
assert.equal(
  deriveSegment2CallAProgressStep("===dims===\n{...}\n===spine===\n{}", null),
  "dims_spine",
);
assert.equal(
  deriveSegment2CallAProgressStep(
    "===dims===\nx\n===spine===\ny\n===voice===\n### 你卡在哪里",
    null,
  ),
  "voice",
);
assert.equal(
  deriveSegment2CallAProgressStep("===dims===\nx", "finalize"),
  "finalize",
);

const zh = pivotChatCopy("zh");
assert.ok(zh.parallel_analysis_in_progress.includes("不是最终交付"));
assert.ok(pivotChatSegment2StepLabel("zh", "dims_spine").includes("并行"));
assert.ok(pivotChatSegment2StepLabel("zh", "voice").includes("初步假设"));

const en = pivotChatCopy("en");
assert.ok(en.parallel_analysis_in_progress.toLowerCase().includes("preliminary"));
assert.ok(pivotChatSegment2StepLabel("en", "a0_plan").toLowerCase().includes("calc"));
assert.ok(pivotChatCopy("de").parallel_analysis_in_progress.includes("Vorläufige"));
assert.ok(pivotChatCopy("fr").segment2_step_voice.includes("hypothèse"));
assert.ok(pivotChatCopy("es").segment2_step_finalize.includes("análisis"));

const runner = readFileSync(resolve(__dirname, "../lib/poju/xhigh-job-runner.ts"), "utf8");
assert.ok(runner.includes('current_stage: "a0_plan"'));
assert.ok(runner.includes('current_stage: "dims_spine"'));
assert.ok(runner.includes('current_stage: "voice"'));
assert.ok(runner.includes('current_stage: "finalize"'));

const status = readFileSync(
  resolve(__dirname, "../app/api/poju/breakthrough-core/status/route.ts"),
  "utf8",
);
assert.ok(status.includes("current_stage: job.current_stage"));

const prep = readFileSync(
  resolve(__dirname, "../components/poju/Segment2AnalysisPreparing.tsx"),
  "utf8",
);
assert.ok(prep.includes("segment2ReportPreparingStep"));

console.log("ok: segment2 progress steps");
