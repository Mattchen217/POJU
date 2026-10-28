/**
 * Lab decision_shelf stamp — prod-v3 parity, decoupled from DELIVERY_PIPELINE.
 *   pnpm exec tsx scripts/test-lab-decision-shelf.ts
 */
import assert from "node:assert/strict";

import {
  DEFAULT_LAB_PIPELINE_STAMP,
  isDecisionShelfPipeline,
  labPipelineBadge,
  labUsesV3Executor,
} from "../lib/llm/pro/delivery/lab/pipeline-stamp";
import { labPublicView } from "../lib/llm/pro/delivery/lab/public-view";
import {
  initLabStepsV3,
  LAB_STEP_DEFS_V3,
} from "../lib/llm/pro/delivery/lab/types-v3";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import {
  productionDeliveryUsesV3,
  resolveDeliveryPipeline,
} from "../lib/llm/pro/delivery/pipeline-v3/flag";
import { formatPageFeedAllowlistHeader } from "../lib/llm/pro/delivery/page-slice-feed";
import { readingOrderForTopic } from "../lib/llm/pro/delivery/decision-page-bridge";
import { readFileSync } from "node:fs";
import path from "node:path";

const emptyEnv = {} as NodeJS.ProcessEnv;

assert.equal(DEFAULT_LAB_PIPELINE_STAMP, "decision_shelf");
assert.equal(labUsesV3Executor("decision_shelf"), true);
assert.equal(labUsesV3Executor("v3_three_step"), true);
assert.equal(labUsesV3Executor("legacy"), false);
assert.equal(labUsesV3Executor(undefined), false);
assert.equal(isDecisionShelfPipeline("decision_shelf"), true);
assert.equal(labPipelineBadge("decision_shelf"), "decision_shelf · prod-v3");

/** Prod flag unchanged: unset env is still v3. */
assert.equal(productionDeliveryUsesV3(emptyEnv), true);
/** Env resolve still legacy when unset — Lab create must NOT follow it. */
assert.equal(resolveDeliveryPipeline(emptyEnv), "legacy");

/** createDeliveryLab source must stamp decision_shelf (no env gate). */
const storeSrc = readFileSync(
  path.join(process.cwd(), "lib/llm/pro/delivery/lab/store.ts"),
  "utf8",
);
assert.match(storeSrc, /DEFAULT_LAB_PIPELINE_STAMP/);
assert.doesNotMatch(
  storeSrc,
  /isDeliveryPipelineV3\(\)/,
  "Lab create must not use env resolveDeliveryPipeline/isDeliveryPipelineV3",
);

const now = Date.now();
const lab = {
  version: 1 as const,
  lab_id: "lab_test_decision_shelf",
  created_at: now,
  updated_at: now,
  ops_user: "test",
  source: {
    locale: "zh",
    original_question: "要不要换城市工作？",
    session_id: "lab-test",
    base_analysis: {},
  },
  pipeline: DEFAULT_LAB_PIPELINE_STAMP,
  cursor_index: 0,
  steps: initLabStepsV3(),
  artifacts: { by_page: {} },
  approved_order: [],
  mode: "delivery_only" as const,
} satisfies DeliveryLabSession;

assert.equal(lab.pipeline, "decision_shelf");
assert.ok(labUsesV3Executor(lab.pipeline), "decision_shelf uses v3 executor");

const view = labPublicView(lab);
assert.equal(view.pipeline, "decision_shelf");
assert.equal(view.step_defs.length, LAB_STEP_DEFS_V3.length);

const brief = view.step_defs.find(
  (d) => d.step_key === "decision_brief.content.body",
) as { faceId?: string; faceDisposition?: string; label?: string } | undefined;
assert.ok(brief, "decision_brief body step present");
assert.equal(brief!.faceId, "01");
assert.equal(brief!.faceDisposition, "primary");
assert.match(String(brief!.label), /01 断语/);

const patterns = view.step_defs.find(
  (d) => d.step_key === "personal_decision_patterns.content.judgment",
) as { faceId?: string; faceDisposition?: string } | undefined;
assert.ok(patterns);
assert.equal(patterns!.faceId, "02");
assert.equal(patterns!.faceDisposition, "folded");

const bottleneck = view.step_defs.find(
  (d) => d.step_key === "bottleneck_analysis.content.body",
);
assert.ok(bottleneck, "04 face paper present (not old 6-page subset)");

const allow = formatPageFeedAllowlistHeader("situation_analysis");
assert.ok(allow && allow.includes("face 02") && allow.includes("CFP."), allow ?? "missing");

const order = readingOrderForTopic("迁移");
assert.deepEqual(order.slice(0, 6), ["01", "02", "04", "05", "06", "07"]);
assert.equal(order[order.length - 1], "03");
const no07 = readingOrderForTopic(null);
assert.deepEqual(no07, ["01", "02", "04", "05", "06", "08", "03"]);

assert.equal(labUsesV3Executor("legacy"), false);

console.log("ok · lab decision_shelf", {
  pipeline: lab.pipeline,
  steps: view.step_defs.length,
  badge: labPipelineBadge(lab.pipeline),
});
