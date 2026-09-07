/**
 * Analyze deep-evidence plan quality metrics (depth / reuse / unit_echo / coverage).
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
  evidenceTextSimilarity,
  unitMentionsMoatClass,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import {
  blobMentionsMoatMechanism,
  gateP4StrategyMoat,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
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

/** Negative: sample-report P4 dim2/dim3 identical paste (developer eye QA). */
const IDENTICAL_WHY =
  "当前你正处于纪元岁环的阶段，结构上⟦w:用神⟧需养优先；等待环境对你更有利的时机再图进取。同时⟦w:忌神⟧耗元过旺时更要侧向流动，不孤注一掷。";

const p4IdenticalEchoFixture: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: [
    {
      path: "dimensions[0]",
      chart_anchors: ["用神", "忌神"],
      evidence:
        "⟦w:用神⟧补给通道要先稳住，再谈对外进取。⟦w:忌神⟧过旺时硬冲只会抬高空转成本，宜换侧向出口。",
    },
    {
      path: "dimensions[1]",
      chart_anchors: ["纪元", "用神"],
      evidence: IDENTICAL_WHY,
    },
    {
      path: "dimensions[2]",
      chart_anchors: ["岁环", "忌神"],
      evidence: IDENTICAL_WHY,
    },
  ],
};

function report(
  label: string,
  plan: DeepEvidencePlan,
  opts?: {
    slice?: string;
    prior?: readonly string[];
  },
) {
  const summary = summarizeDeepEvidenceQuality(plan);
  const quality = assessDeepEvidenceQuality(plan.page, plan, {
    eastern_calc_slice: opts?.slice,
    core_conclusion: "稳住输出并降低空转",
    prior_chart_anchors: opts?.prior,
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
  assert.ok(solid.summary.max_evidence_similarity < 0.92);

  const echo = report("p4_dim2_dim3_identical", p4IdenticalEchoFixture);
  assert.equal(echo.quality.ok, false);
  assert.match(
    String((echo.quality as { reason?: string }).reason ?? ""),
    /deep_evidence_unit_echo/,
  );
  assert.equal(evidenceTextSimilarity(IDENTICAL_WHY, IDENTICAL_WHY), 1);

  const cross = report("cross_page_primary_reuse", solidFixture, {
    prior: ["食神", "身弱", "正官", "正印", "七杀"],
  });
  assert.equal(cross.quality.ok, false);
  assert.match(
    String((cross.quality as { reason?: string }).reason ?? ""),
    /deep_evidence_cross_page_anchor_reuse/,
  );

  // Timing: 纪元 alone must NOT count as moat timing mechanism.
  const timingOnlyEra = {
    path: "dimensions[0]",
    chart_anchors: ["纪元"],
    evidence:
      "当前你正处于⟦w:纪元⟧岁环的阶段，结构与节奏都偏稳。先把补给做实，再谈对外进取。",
  };
  assert.equal(unitMentionsMoatClass(timingOnlyEra, "timing"), false);
  const timingWithMech = {
    ...timingOnlyEra,
    evidence:
      "当前⟦w:纪元⟧岁环尚未到转折窗口，宜等待环境更有利再图进取；切换阶段前先稳住补给。",
  };
  assert.equal(unitMentionsMoatClass(timingWithMech, "timing"), true);

  // Batch3: strategy moat — era atmosphere alone fails; science-dominated fails.
  {
    assert.equal(
      blobMentionsMoatMechanism("正处于纪元岁环的阶段，先稳住。", "timing"),
      false,
    );
    assert.equal(
      blobMentionsMoatMechanism(
        "纪元岁环尚未到转折窗口，宜等待再图进取。",
        "timing",
      ),
      true,
    );
    const thin = gateP4StrategyMoat({
      eastern_calc_slice:
        "yong: 水\npack_polarity: yong=水 ji=火\ncurrent_da_yun_cycle: 甲子\ntiming_ripeness: 中\n【十神语义】正印",
      dimensions: [
        {
          strategy: "用邮件话术推进授权，再更新日历。",
          means: [{ text: "发 Slack 周报", type: "mindset" }],
          chart_anchors: ["用神"],
        },
        {
          strategy: "用战绩夹谈谈判条件。",
          means: [{ text: "准备 STAR 案例", type: "mindset" }],
          chart_anchors: ["忌神"],
        },
        {
          strategy: "正处于纪元岁环的阶段。",
          means: [{ text: "保持节奏", type: "timing" }],
          chart_anchors: ["纪元"],
        },
      ],
    });
    assert.equal(thin.structural, true);
    assert.ok(
      thin.structural_reason === "p4_body_echo_p3" ||
        thin.structural_reason === "p4_strategy_moat_thin",
    );
  }

  console.log("\nok analyze-deep-evidence-quality baselines");
}

const argPath = process.argv[2];
if (argPath) {
  const abs = resolve(argPath);
  assert.ok(existsSync(abs), `file not found: ${abs}`);
  report(`file:${abs}`, loadPlan(abs));
}
