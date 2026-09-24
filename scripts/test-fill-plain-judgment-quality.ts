/**
 * Global P3 plain-judgment fill quality (collapse / lever reuse / parallel life).
 * Run: pnpm exec tsx scripts/test-fill-plain-judgment-quality.ts
 */
import assert from "node:assert/strict";
import {
  assessFillPlainJudgmentScienceAngles,
  FILL_ANGLE_COLLAPSE_MAX,
  formatStructureTranslateDutiesLine,
  hasFillCareerShell,
  hasFillParallelLifeStory,
  maxPairwiseFillAngleSimilarity,
  meansMostlyRestatesStrategy,
  structureTranslateDutiesFromEvidence,
} from "@/lib/llm/pro/delivery/page-schema/fill-plain-judgment-quality";
import { formatDeepEvidencePlanForCompress } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { hasFillEmptyShell } from "@/lib/llm/pro/delivery/page-schema/situation-echo";

{
  const duties = structureTranslateDutiesFromEvidence(
    "寅午半合火局。日主己土身强。大运天干壬水为用神。时干辛金食神泄秀。流年丙午。需大运壬水通关调候。",
  );
  assert.ok(duties.some((d) => d.includes("合局")));
  assert.ok(duties.some((d) => d.includes("输出疏导") || d.includes("有益侧")));
  assert.ok(duties.some((d) => d.includes("降温通关") || d.includes("干扰侧")));
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "science_action",
    units: [
      {
        path: "primary_toolkit.angles[0]",
        chart_anchors: [],
        evidence: "日支丑土与月支午火相害。流年丙午引动。需以金泄土、水制火。",
        unit_claim: "丑午相害须泄土制火",
      },
    ],
  });
  assert.match(dump, /本卡策略生长钉|本卡译出义务/);
  assert.match(dump, /互耗或对冲/);
  assert.match(dump, /professional_evidence:\n日支丑土/);
  assert.doesNotMatch(dump, /前同事|稳定收入/);
}

assert.equal(
  hasFillParallelLifeStory("把固定资产换成现金流与灵活合作模式"),
  true,
);
assert.equal(
  hasFillParallelLifeStory("先护住根基位，再用泄压动作打断互耗"),
  false,
);

// Bare「输出」in mechanism vernacular must NOT trip lever reuse.
{
  const bareOk = assessFillPlainJudgmentScienceAngles(
    [
      {
        path: "a0",
        strategy: "合局加压时，疏导通路会被拖紧，须先通关。",
        means: ["减加压入口"],
      },
      {
        path: "a1",
        strategy: "根基互耗时，承重通道会被咬住。",
        means: ["先护根"],
      },
      {
        path: "a2",
        strategy: "食神得力时，疏导位可先稳住再放大。",
        means: ["稳住疏导位"],
      },
      {
        path: "a3",
        strategy: "窗口合局能钉住疏导根。",
        means: ["借合局护疏导"],
      },
    ],
    [
      { path: "a0", evidence: "寅午半合火局。需通关调候。" },
      { path: "a1", evidence: "丑午相害。" },
      { path: "a2", evidence: "时干辛金食神泄秀。" },
      { path: "a3", evidence: "流月酉丑半合。食神得根。" },
    ],
  );
  assert.equal(bareOk.ok, true, bareOk.ok ? "" : bareOk.reason);
}

{
  const collapsed = assessFillPlainJudgmentScienceAngles([
    {
      path: "a0",
      strategy: "用持续的技术输出换取缓冲，让调节能力重新运转。",
      means: ["用输出换取延后压力的空间"],
    },
    {
      path: "a1",
      strategy: "通过技术输出补充调节力，形成缓冲空间。",
      means: ["输出换取自主调节空间"],
    },
    {
      path: "a2",
      strategy: "把输出当作一种主动调节，而不是额外负担。",
      means: ["固定输出时间换缓冲"],
    },
  ]);
  assert.equal(collapsed.ok, false);
  if (collapsed.ok) throw new Error("expected lever reuse");
  assert.ok(
    collapsed.reason.startsWith("fill_lever_reuse:"),
    collapsed.reason,
  );
}

{
  const orphan = assessFillPlainJudgmentScienceAngles(
    [
      {
        path: "primary_toolkit.angles[0]",
        strategy: "柱位互耗时，先稳住承重再谈别的。",
        means: ["先护承重位"],
      },
      {
        path: "primary_toolkit.angles[1]",
        strategy: "靠技术输出换缓冲。",
        means: ["用输出换空间"],
      },
      {
        path: "backup_toolkit.angles[0]",
        strategy: "侧面合局助燃时，改走润化而不是加码。",
        means: ["打断助燃链", "技术输出换取延后"],
      },
      {
        path: "backup_toolkit.angles[1]",
        strategy: "阶段窗里把持续输出换缓冲排在前面。",
        means: ["窗口内优先做技术输出"],
      },
    ],
    [
      { path: "primary_toolkit.angles[0]", evidence: "日支丑与月支午相害。" },
      { path: "primary_toolkit.angles[1]", evidence: "月柱丙午正印。火为忌神。" },
      { path: "backup_toolkit.angles[0]", evidence: "卯未半合木局。木生火。" },
      { path: "backup_toolkit.angles[1]", evidence: "大运壬寅。天干壬水为用神。" },
    ],
  );
  assert.equal(orphan.ok, false);
  if (orphan.ok) throw new Error("expected orphan lever reuse");
  assert.ok(orphan.reason.startsWith("fill_lever_reuse:"), orphan.reason);
}

{
  const distinct = assessFillPlainJudgmentScienceAngles(
    [
      {
        path: "a0",
        strategy: "外境与阶段合力加重燥热，须先走通关，而不是硬顶。",
        means: ["先减同时加压的入口", "通关排在加码之前"],
      },
      {
        path: "a1",
        strategy: "根基位与加压位互耗时，承重通道会被咬住，须先护根再泄压。",
        means: ["护住根基不被连耗", "用泄压打断互耗"],
      },
      {
        path: "a2",
        strategy: "近阶月窗出现合局，能钉住疏导根，缓解忌压对疏导的挤压。",
        means: ["借合局钉住疏导根", "窗口内优先护疏导"],
      },
    ],
    [
      { path: "a0", evidence: "寅午半合火局。流年丙午。需通关调候。" },
      { path: "a1", evidence: "日支丑与月支午相害。需金泄土水制火。" },
      { path: "a2", evidence: "流月丁酉。酉丑半合金局。食神得根。" },
    ],
  );
  assert.equal(distinct.ok, true, distinct.ok ? "" : distinct.reason);
}

{
  const life = assessFillPlainJudgmentScienceAngles([
    {
      path: "b0",
      strategy: "根基受冲击时，把固定资产转为现金流更灵活。",
      means: ["资产配置调整"],
    },
    {
      path: "b1",
      strategy: "侧面合局若在助燃，改用润化打断。",
      means: ["打断助燃链"],
    },
  ]);
  assert.equal(life.ok, false);
  if (life.ok) throw new Error("expected parallel life");
  assert.ok(life.reason.startsWith("fill_parallel_life_story:"), life.reason);
}

assert.equal(hasFillEmptyShell("被这股热力消耗，难以直接发挥作用"), false);
assert.equal(hasFillEmptyShell("需要冷却液来降温，让冷却机制运转"), true);

assert.equal(hasFillCareerShell("华盖主技艺专精，宜走技术路线"), true);
assert.equal(hasFillCareerShell("内守聚焦，独处时成局更稳"), false);

assert.equal(
  meansMostlyRestatesStrategy(
    "外境与阶段合力加重燥热，须先走通关，而不是硬顶加压。",
    ["外境与阶段合力加重燥热须先走通关而不是硬顶"],
  ),
  true,
);
assert.equal(
  meansMostlyRestatesStrategy(
    "外境与阶段合力加重燥热，须先走通关，而不是硬顶加压。",
    ["先减同时加压的入口"],
  ),
  false,
);

{
  const career = assessFillPlainJudgmentScienceAngles([
    {
      path: "c0",
      strategy: "华盖得力时，专精技艺更易成局。",
      means: ["稳住内守位"],
    },
  ]);
  assert.equal(career.ok, false);
  if (career.ok) throw new Error("expected career shell");
  assert.ok(career.reason.startsWith("fill_career_shell:"), career.reason);
}

{
  const echo = assessFillPlainJudgmentScienceAngles([
    {
      path: "e0",
      strategy: "外境与阶段合力加重燥热，须先走通关，而不是硬顶加压。",
      means: ["外境与阶段合力加重燥热须先走通关而不是硬顶"],
    },
  ]);
  assert.equal(echo.ok, false);
  if (echo.ok) throw new Error("expected means echo");
  assert.ok(echo.reason.startsWith("fill_means_strategy_echo:"), echo.reason);
}

assert.match(
  formatStructureTranslateDutiesLine("流月丁酉。酉丑半合金局。"),
  /近阶月窗|合局/,
);

assert.match(
  formatStructureTranslateDutiesLine("华盖在时支，主内守。"),
  /内守聚焦/,
);

{
  const { max } = maxPairwiseFillAngleSimilarity([
    { path: "x", strategy: "甲乙丙丁戊己庚辛", means: ["壬癸"] },
    { path: "y", strategy: "甲乙丙丁戊己庚辛", means: ["壬癸子"] },
  ]);
  assert.ok(max > FILL_ANGLE_COLLAPSE_MAX);
}

console.log("ok fill-plain-judgment-quality");
