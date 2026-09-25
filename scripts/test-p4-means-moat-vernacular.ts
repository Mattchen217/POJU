/**
 * P4 means / moat mechanism — vernacular timing + coach hard stems.
 *   pnpm exec tsx scripts/test-p4-means-moat-vernacular.ts
 */
import assert from "node:assert/strict";
import {
  blobMentionsMoatMechanism,
  gateP4StrategyMoat,
  isP4CoachPmMean,
  scrubP4MeansInstructionNoise,
  softStripP4CoachPmMeans,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";

const timingStrategy =
  "服务守成窗口：当前这段较长阶段和这一年的能量交织，外部压力较大，内在恢复力受制，不是全力投入的最佳窗口。守成不是退缩，而是等待客观依赖你产出时再加码。";
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

{
  const scrubbed = scrubP4MeansInstructionNoise(
    "站位边界：对方催促加码时不正面硬刚，保持借势输出节律；禁写成股权/验证期/文档清单。",
  );
  assert.equal(scrubbed.includes("验证期"), false);
  assert.ok(scrubbed.includes("借势"));
  assert.equal(isP4CoachPmMean(scrubbed), false);

  const strip = softStripP4CoachPmMeans([
    {
      strategy: "服务主路径推进。技术输出者借势。",
      means: [
        "按技术输出者借势定位——用可见产出借势推进，不硬争主导席位。",
        "站位边界：对方催促加码时不正面硬刚，保持借势输出节律；禁写成股权/验证期/文档清单。",
      ],
    },
    {
      strategy: "服务守成窗口。未熟窗口守成。",
      means: [
        "运岁过冲或未熟时先守结构节奏——守成窗口内不扩投入；窗口到了再加码。",
        "守成期第二手段只做调频准备、不做破局跳步；禁财务安全垫、禁验证期/试水期条款清单。",
      ],
    },
  ]);
  assert.equal(strip.dimensions.length, 2);
  assert.equal(
    (strip.dimensions[0]!.means as unknown[]).length,
    2,
    "ban-tail scrub must keep both archetype means",
  );
  assert.equal(
    (strip.dimensions[1]!.means as unknown[]).length,
    2,
    "ban-tail scrub must keep both timing means",
  );
}

assert.equal(
  isP4CoachPmMean(
    "未熟窗口只维持最低接触与最低交付节律，不因催促破窗加码；状态冷静且客观依赖产出时才加码。",
  ),
  false,
  "pure timing retune without trial-period PM must pass",
);

const page = gateP4StrategyMoat({
  dimensions: [
    {
      strategy: timingStrategy,
      means: [
        "未熟窗口只维持最低接触与最低交付节律，不因催促破窗加码；状态冷静且客观依赖产出时才加码。",
        "未熟期内只做调频准备——固定独处降噪作补给窗；不做破局跳步。",
      ],
      chart_anchors: ["壬寅", "丙午"],
    },
    {
      strategy:
        "服务主路径推进：先天配置里技术表达是显性力量，适合以技术输出者借势，不硬争主导。",
      means: [
        "按技术输出者借势定位——用可见产出借势推进，不硬争主导席位。",
        "站位边界：催促加码时不正面硬刚，保持借势输出节律与可进可退站位。",
      ],
      chart_anchors: ["食神", "辛未"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: 未熟\n【十神语义 SSOT】食神、偏印\npack_polarity: yong:水",
});
assert.equal(page.structural, false, `clean moat page must pass, got ${page.structural_reason}`);
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
