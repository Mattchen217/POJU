/**
 * Analyze deep-evidence plan quality metrics (depth / reuse / coverage).
 * Run: pnpm exec tsx scripts/analyze-deep-evidence-quality.ts
 *
 * Pass a JSON file path of DeepEvidencePlan, or runs built-in baseline fixtures.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assessDeepEvidenceQuality,
  summarizeDeepEvidenceQuality,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";

function loadPlan(path: string): DeepEvidencePlan {
  const raw = JSON.parse(readFileSync(path, "utf8")) as DeepEvidencePlan;
  assert.ok(raw?.page && Array.isArray(raw.units), "invalid plan json");
  return raw;
}

const shallowFixture: DeepEvidencePlan = {
  page: "foundation",
  units: Array.from({ length: 4 }, (_, i) => ({
    path: `why_cards[${i}]`,
    chart_anchors: ["食神"],
    evidence: `⟦w:食神⟧ 短。`,
  })),
};

const solidFixture: DeepEvidencePlan = {
  page: "foundation",
  units: [
    {
      path: "why_cards[0]",
      chart_anchors: ["食神", "身弱"],
      evidence:
        "⟦w:食神⟧ 泄秀通道被堵时输出成本抬升，本案推进门槛升高。⟦w:身弱⟧ 叠加后更难连续承压，需先稳住补给再谈扩张。",
    },
    {
      path: "why_cards[1]",
      chart_anchors: ["正官"],
      evidence:
        "⟦w:正官⟧ 约束力偏重时，外部评价会压过自主节奏。对当前议题，这会把决策拖成讨好式延迟。",
    },
    {
      path: "why_cards[2]",
      chart_anchors: ["正印"],
      evidence:
        "⟦w:正印⟧ 滋养不足时恢复窗一被占用就回不到基线。第二天只能硬扛补缺口，形成循环透支。",
    },
    {
      path: "why_cards[3]",
      chart_anchors: ["七杀"],
      evidence:
        "⟦w:七杀⟧ 压迫型节奏一上来就容易用冲刺换安全感。窗口一过成本更高，需要把可验证小步前置。",
    },
  ],
};

function report(label: string, plan: DeepEvidencePlan, slice?: string) {
  const summary = summarizeDeepEvidenceQuality(plan);
  const quality = assessDeepEvidenceQuality(plan.page, plan, {
    eastern_calc_slice: slice,
    core_conclusion: "稳住输出并降低空转",
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify({ summary, quality }, null, 2));
  return { summary, quality };
}

{
  const shallow = report("baseline_shallow", shallowFixture);
  assert.equal(shallow.quality.ok, false);
  assert.ok(
    String((shallow.quality as { reason?: string }).reason ?? "").includes(
      "deep_evidence_",
    ),
  );

  const solid = report("baseline_solid", solidFixture);
  assert.equal(solid.quality.ok, true);
  assert.ok(solid.summary.avg_clauses >= 2);
  assert.ok(solid.summary.max_anchor_jaccard < 0.85);
  console.log("\nok analyze-deep-evidence-quality baselines");
}

const argPath = process.argv[2];
if (argPath) {
  const abs = resolve(argPath);
  assert.ok(existsSync(abs), `file not found: ${abs}`);
  report(`file:${abs}`, loadPlan(abs));
}
