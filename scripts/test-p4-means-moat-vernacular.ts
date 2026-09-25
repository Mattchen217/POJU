/**
 * P4 means / moat — self-retune domain + vernacular timing + scrub.
 *   pnpm exec tsx scripts/test-p4-means-moat-vernacular.ts
 */
import assert from "node:assert/strict";
import {
  blobMentionsMoatMechanism,
  gateP4StrategyMoat,
  isP4CoachPmMean,
  isP4ScienceExecMean,
  scrubP4MeansInstructionNoise,
  softStripP4CoachPmMeans,
  softStripP4ScienceExecMeans,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";

const timingStrategy =
  "服务守成窗口：当前这段较长阶段和这一年的能量交织，外部压力较大，内在恢复力受制，不是全力投入的最佳窗口。守成不是退缩，而是先收缩自身投入带宽，条件成熟再加码。";
assert.equal(
  blobMentionsMoatMechanism(timingStrategy, "timing"),
  true,
  "vernacular era + 窗口/守成/加码 must count as timing moat",
);

assert.equal(
  isP4CoachPmMean(
    "未熟窗口只维持最低接触；在起草验证期合作提案时，把试水期设定为3-6个月。",
  ),
  true,
  "试水期/验证期 are hard PM stems even with 未熟窗口",
);

assert.equal(
  isP4ScienceExecMean(
    "按技术输出者借势——用系统架构文档与可见交付积累话语权。",
  ),
  true,
  "docs/delivery shell is science-exec, not self-retune",
);

assert.equal(
  isP4ScienceExecMean(
    "未熟窗口先收缩自身投入带宽——心力只维持最低必要激活；冷静后再切换加码。",
  ),
  false,
  "pure self-bandwidth timing must pass science-exec",
);

{
  const scrubbed = scrubP4MeansInstructionNoise(
    "催促面前先稳住自己的节律；禁写成股权/验证期/文档清单。",
  );
  assert.equal(scrubbed.includes("验证期"), false);
  assert.ok(scrubbed.includes("节律"));
  assert.equal(isP4CoachPmMean(scrubbed), false);

  const strip = softStripP4CoachPmMeans([
    {
      strategy: "服务主路径推进。内在泄秀表达者借势。",
      means: [
        "催促面前先稳住自己的表达节律，以借势姿态处压力。",
        "感到被逼到墙角时回到可进可退站位；禁写成股权/验证期/文档清单。",
      ],
    },
    {
      strategy: "服务守成窗口。未熟窗口守成。",
      means: [
        "运岁过冲时先守自身结构节奏——守成窗口内不扩心力；窗口到了再加码。",
        "守成期只做调频准备；禁财务安全垫、禁验证期/试水期条款清单。",
      ],
    },
  ]);
  assert.equal(strip.dimensions.length, 2);
  assert.equal((strip.dimensions[0]!.means as unknown[]).length, 2);
  assert.equal((strip.dimensions[1]!.means as unknown[]).length, 2);
}

{
  const sci = softStripP4ScienceExecMeans([
    {
      strategy: "服务主路径。",
      means: [
        "催促面前先稳住自己的表达节律，以借势姿态处压力。",
        "用系统架构文档与可见交付积累话语权。",
      ],
    },
  ]);
  assert.equal((sci.dimensions[0]!.means as unknown[]).length, 1);
  assert.ok(sci.notes.some((n) => n.startsWith("p4_science_exec_mean_stripped")));
}

const page = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: timingStrategy,
      means: [
        "未熟窗口先收缩自身投入带宽——心力与注意力只维持最低必要激活；内在冷静且条件成熟时再切换加码。",
        "未熟期每天固定一段独处降噪作补给窗，只调自己的节奏与恢复。",
      ],
      chart_anchors: ["壬寅", "丙午"],
    },
    {
      strategy:
        "服务主路径推进：按泄秀表达者落成内在站位，催促面前先稳住自己的节律，借势不硬刚。",
      means: [
        "内在按食神落成泄秀表达者——催促面前先稳住自己的表达节律，不把身心绷成硬争主导。",
        "感到被逼到墙角时，先回到可进可退站位，用自己的节律回应压力。",
      ],
      chart_anchors: ["食神", "辛未"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: 未熟\n【十神语义 SSOT】食神、偏印\npack_polarity: yong:水",
});
assert.equal(
  page.structural,
  false,
  `clean self-retune page must pass, got ${page.structural_reason}`,
);
assert.ok(page.covered.includes("timing"));
assert.ok(page.covered.includes("archetype"));

const dirty = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: timingStrategy,
      means: [
        "把试水期设定为3-6个月，并找律师写书面文档。",
        "用每周五里程碑监控。",
      ],
    },
    {
      strategy: "再开一维职场课：写个人博客积累话语权，谈股权设计。",
      means: ["发布技术社区笔记", "明确股权设计与缓冲期"],
    },
  ],
  eastern_calc_slice: "timing_ripeness: 未熟\n【十神语义】食神",
});
assert.equal(dirty.structural, true);
assert.equal(dirty.structural_reason, "p4_coach_pm_means");

console.log("test-p4-means-moat-vernacular: ok");
