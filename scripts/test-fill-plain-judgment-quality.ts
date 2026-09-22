/**
 * Global P3 plain-judgment fill quality (collapse / lever reuse / parallel life).
 * Run: pnpm exec tsx scripts/test-fill-plain-judgment-quality.ts
 */
import assert from "node:assert/strict";
import {
  assessFillPlainJudgmentScienceAngles,
  FILL_ANGLE_COLLAPSE_MAX,
  formatStructureTranslateDutiesLine,
  hasFillParallelLifeStory,
  maxPairwiseFillAngleSimilarity,
  structureTranslateDutiesFromEvidence,
} from "@/lib/llm/pro/delivery/page-schema/fill-plain-judgment-quality";
import { formatDeepEvidencePlanForCompress } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

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
  assert.match(dump, /本卡译出义务/);
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

{
  const collapsed = assessFillPlainJudgmentScienceAngles([
    {
      path: "a0",
      strategy: "用持续的技术输出换取缓冲，让调节能力重新运转，降低外部消耗。",
      means: ["定期做技术复盘输出", "用输出换取延后压力的空间"],
    },
    {
      path: "a1",
      strategy: "通过有节奏的技术输出补充调节力，降低外部消耗，形成缓冲空间。",
      means: ["每周技术分享输出", "用输出换取自主调节空间"],
    },
    {
      path: "a2",
      strategy: "把专长输出安排在冷静时段，用输出保护调节空间。",
      means: ["不受打扰时做技术输出"],
    },
  ]);
  assert.equal(collapsed.ok, false);
  if (collapsed.ok) throw new Error("expected lever reuse / collapse");
  assert.ok(
    collapsed.reason.startsWith("fill_lever_reuse:") ||
      collapsed.reason.startsWith("fill_angle_collapse:"),
    collapsed.reason,
  );
}

{
  // Same lever on cards whose evidence never asked for 输出疏导 → orphan reuse.
  const orphan = assessFillPlainJudgmentScienceAngles(
    [
      {
        path: "primary_toolkit.angles[0]",
        strategy: "互耗时先护根。",
        means: ["护根"],
      },
      {
        path: "primary_toolkit.angles[1]",
        strategy: "靠技术输出换缓冲。",
        means: ["每周输出分享"],
      },
      {
        path: "backup_toolkit.angles[0]",
        strategy: "助燃改润化。",
        means: ["用输出换空间"],
      },
      {
        path: "backup_toolkit.angles[1]",
        strategy: "阶段窗降温。",
        means: ["输出换取延后压力"],
      },
    ],
    [
      {
        path: "primary_toolkit.angles[0]",
        evidence: "日支丑与月支午相害。",
      },
      {
        path: "primary_toolkit.angles[1]",
        evidence: "月柱丙午正印。火为忌神。",
      },
      {
        path: "backup_toolkit.angles[0]",
        evidence: "年支卯与日支未半合木局。木生火。",
      },
      {
        path: "backup_toolkit.angles[1]",
        evidence: "大运壬寅。天干壬水为用神。",
      },
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
        strategy: "外境与阶段合力加重燥热，须先走降温通关，而不是硬顶。",
        means: ["先减同时加压的入口", "通关排在加码之前"],
      },
      {
        path: "a1",
        strategy: "根基位与加压位互耗时，输出根会被咬住，须先护根再泄压。",
        means: ["护住根基不被连耗", "用泄压打断互耗"],
      },
      {
        path: "a2",
        strategy: "近阶月窗出现合局，能钉住输出根，缓解忌压对疏导的挤压。",
        means: ["借合局钉住输出根", "窗口内优先护疏导"],
      },
    ],
    [
      {
        path: "a0",
        evidence: "寅午半合火局。流年丙午。需通关调候。",
      },
      {
        path: "a1",
        evidence: "日支丑与月支午相害。需金泄土水制火。",
      },
      {
        path: "a2",
        evidence: "流月丁酉。酉丑半合金局。食神得根。",
      },
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

assert.match(
  formatStructureTranslateDutiesLine("流月丁酉。酉丑半合金局。"),
  /近阶月窗|合局/,
);

{
  const { max } = maxPairwiseFillAngleSimilarity([
    { path: "x", strategy: "甲乙丙丁戊己庚辛", means: ["壬癸"] },
    { path: "y", strategy: "甲乙丙丁戊己庚辛", means: ["壬癸子"] },
  ]);
  assert.ok(max > FILL_ANGLE_COLLAPSE_MAX);
}

console.log("ok fill-plain-judgment-quality");
