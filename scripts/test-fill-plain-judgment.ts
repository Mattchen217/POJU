/**
 * P2/P3 fill plain-judgment: feed strip + soft-frame / agenda / prescription gates.
 * P3 gates aligned with P2 (paste / soft / prescription / parallel-life / empty-shell).
 * Run: pnpm exec tsx scripts/test-fill-plain-judgment.ts
 */
import assert from "node:assert/strict";
import { buildPageSchemaFillPrompt } from "@/lib/llm/pro/delivery/page-schema/fill-prompt";
import { formatDeepEvidencePlanForCompress } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { sanitizePageJson } from "@/lib/llm/pro/delivery/page-schema/sanitize";
import {
  hasFillSoftFrame,
  isFillActionPrescription,
  proseEchoesCollectedAgenda,
  hasFillEmptyShell,
  hasFillWellnessScript,
} from "@/lib/llm/pro/delivery/page-schema/situation-echo";
import { repairCompressPageJargon } from "@/lib/llm/pro/delivery/page-schema/compress-jargon-repair";

const core =
  "只想先兼职试水看看情况，不太敢直接把现在的稳定收入断了，也不知道我能有多大的话语权，股权也没有明确说";
const { user } = buildPageSchemaFillPrompt("foundation", {
  locale: "zh",
  core_conclusion: core,
  fill_mode: "compress",
  plain_judgment: true,
  deep_evidence_lock: "【已锁定命理批断】\n### 单元 1",
  foundation_surface_feed: "处境：兼职试水",
  question_expectation: "如何开口谈兼职",
  reality_constraints: "对方要求全职",
});
assert.doesNotMatch(user, /兼职试水/);
assert.doesNotMatch(user, /core_conclusion/);
assert.match(user, /已锁定命理批断/);

{
  // P3: plain_judgment flag is ignored — always normal compress (menus + 主辅).
  const { user: p3user, system: p3sys } = buildPageSchemaFillPrompt("science_action", {
    locale: "zh",
    core_conclusion: core,
    fill_mode: "compress",
    plain_judgment: true,
    deep_evidence_lock: "【已锁定命理批断】\n### 单元 1 · primary_toolkit.angles[0]",
    science_means_feed: "【P3 科学手段候选菜单】今晚起草阶段性合作提案",
    question_expectation: "如何开口谈兼职与股权",
    reality_constraints: "对方要求全职",
    primary_backup_hint: "主轨试水 / 辅轨守底线",
  });
  assert.match(p3user, /科学手段候选菜单/);
  assert.match(p3user, /主辅对照|主轨试水/);
  assert.match(p3user, /已锁定命理批断/);
  assert.match(p3sys, /科学策略|策略\+行动|可动手/);
  assert.doesNotMatch(p3sys, /只译批断/);
  assert.doesNotMatch(p3sys, /无映射表|第一步正文/);
  assert.doesNotMatch(p3sys, /潜元|显元|锚元/);
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "science_action",
    units: [
      {
        path: "primary_toolkit.angles[0]",
        chart_anchors: [],
        evidence: "日主己土身强。用神水制火。寅午半合火局加重忌神火。",
        unit_claim: "身强须水制火",
        calc_cite: "寅午半合火局",
        means_candidate_ref: "科学维1",
      },
    ],
  });
  assert.match(dump, /strategy/);
  assert.match(dump, /means/);
  assert.match(dump, /生长任务|科学策略/);
  assert.doesNotMatch(dump, /why_cards/);
}

assert.equal(proseEchoesCollectedAgenda("让你有机会争取兼职试水", core), true);
assert.equal(isFillActionPrescription("因此你需要先以兼职方式试水，保住稳定收入。"), true);
assert.equal(hasFillSoftFrame("你在结构上更易感到绑定与投入压力。"), true);
assert.equal(hasFillEmptyShell("需要冷却液来降温"), true);
assert.equal(hasFillWellnessScript("进行静坐、深呼吸"), true);

const agenda = `${core}\n如何开口谈兼职`;
const badSoft = {
  page: "foundation",
  page_title: "合伙纠结的底层结构卡点",
  page_subtitle: "从机制看卡点",
  why_cards: [
    {
      title: "规范压力",
      surface: "外部环境对你有更高的要求",
      essence:
        "你在结构上更易感到绑定与投入压力。这种约束会让你感到压力。你需要在这种约束与自由之间找到平衡，而不是一味逃避。",
    },
    { title: "b", surface: "x", essence: "y".repeat(70) },
    { title: "c", surface: "x", essence: "y".repeat(70) },
    { title: "d", surface: "x", essence: "y".repeat(70) },
    { title: "e", surface: "x", essence: "y".repeat(70) },
  ],
};
const failSoft = sanitizePageJson("foundation", badSoft, {
  plainJudgmentFill: true,
  situationMaterial: agenda,
});
assert.equal(failSoft.ok, false);
if (failSoft.ok) throw new Error("expected soft-frame fail");

{
  const notes: string[] = [];
  const page = {
    page: "science_action",
    page_title: "加压通关",
    page_subtitle: "从批断来",
    primary_toolkit: {
      role: "primary",
      title: "主",
      angles: [
        {
          name: "a",
          strategy: "外部加压加重燥热，须先降温通关。",
          means: ['通过学习来增强「生水」的能力'],
        },
      ],
    },
    backup_toolkit: { role: "backup", title: "辅", angles: [] },
  };
  const jargon = repairCompressPageJargon("science_action", page, notes);
  assert.equal(jargon.ok, true, jargon.ok ? "" : jargon.reason);
  assert.doesNotMatch((page.primary_toolkit.angles[0].means as string[])[0], /生水/);
}

{
  // Soft-gloss must never be the plain target (地支→深层根基, not 【潜元】).
  const notes: string[] = [];
  const page = {
    page: "science_action",
    page_title: "加压通关",
    page_subtitle: "从批断来",
    primary_toolkit: {
      role: "primary",
      title: "主",
      angles: [
        {
          name: "a",
          strategy: "地支互耗时，【潜元】一层会被咬住，须先护根。",
          means: ["先护住年柱承重"],
        },
      ],
    },
    backup_toolkit: { role: "backup", title: "辅", angles: [] },
  };
  const jargon = repairCompressPageJargon("science_action", page, notes);
  assert.equal(jargon.ok, true, jargon.ok ? "" : jargon.reason);
  const strategy = page.primary_toolkit.angles[0].strategy as string;
  const means0 = (page.primary_toolkit.angles[0].means as string[])[0]!;
  assert.doesNotMatch(strategy, /潜元|地支|【/);
  assert.match(strategy, /深层根基/);
  assert.doesNotMatch(means0, /年柱/);
  assert.match(means0, /年这一层/);
}

{
  const goodPlan = {
    page: "science_action" as const,
    units: [
      {
        path: "primary_toolkit.angles[0]",
        chart_anchors: [] as string[],
        evidence: "寅午半合火局。流年丙午。日主身强。需通关调候。",
      },
      {
        path: "primary_toolkit.angles[1]",
        chart_anchors: [] as string[],
        evidence: "日支丑与月支午相害。需金泄土水制火。",
      },
      {
        path: "primary_toolkit.angles[2]",
        chart_anchors: [] as string[],
        evidence: "月柱丙午正印。火为忌神。时柱辛未食神泄秀。",
      },
      {
        path: "backup_toolkit.angles[0]",
        chart_anchors: [] as string[],
        evidence: "大运壬寅。天干壬水为用神。寅午半合。需金生水。",
      },
      {
        path: "backup_toolkit.angles[1]",
        chart_anchors: [] as string[],
        evidence: "流月丁酉。酉丑半合金局。食神得根。",
      },
      {
        path: "backup_toolkit.angles[2]",
        chart_anchors: [] as string[],
        evidence: "年支卯与日支未半合木局。木生火。需水润木。",
      },
    ],
  };

  const goodP3 = {
    page: "science_action",
    page_title: "加压通关·疏导加固",
    page_subtitle: "六条结构杠杆从批断译出",
    primary_toolkit: {
      role: "primary",
      title: "主轨",
      angles: [
        {
          name: "忌压加重须通关",
          strategy:
            "你这边承载力本就偏满，外部又叠一层加压，通路会被拖紧。通关要靠能降温的一侧，而不是硬顶。",
          means: ["先减同时加压的入口", "把泄压通路排在加码之前"],
        },
        {
          name: "根基受耗",
          strategy:
            "根基位与加压位互相耗损时，承重通道会被咬住。先护根、再泄压，顺序不能反。",
          means: ["护住根基位不被连耗", "用泄压动作打断互耗"],
        },
        {
          name: "资源位忌压",
          strategy:
            "资源位本身带忌压时，助力也要先降温才能用上；疏导位得力，宜先走疏导再放大。",
          means: ["资源入口先降温再借力", "疏导位先稳住再加负荷"],
        },
      ],
    },
    backup_toolkit: {
      role: "backup",
      title: "辅轨",
      angles: [
        {
          name: "运上用水被泄",
          strategy: "运上能疏导的一侧被深层根基助燃拖走时，要先补上再生调节的通路。",
          means: ["先切断助燃入口", "补源排在空喊疏导之前"],
        },
        {
          name: "合局加固疏导根",
          strategy: "阶段性合局能把疏导根钉稳，缓解忌压对疏导的挤压。",
          means: ["窗口内先借合局护根", "忌压高时优先护疏导"],
        },
        {
          name: "间接助燃",
          strategy: "侧面合局若在助燃忌压，要用润化打断，而不是再加一把火。",
          means: ["打断助燃链", "用润化改方向"],
        },
      ],
    },
  };
  const passP3 = sanitizePageJson("science_action", goodP3, {
    plainJudgmentFill: true,
    situationMaterial: agenda,
    deepEvidencePlan: goodPlan,
    fillMode: "compress",
  });
  assert.equal(passP3.ok, true, passP3.ok ? "" : passP3.reason);

  const badLife = {
    ...goodP3,
    primary_toolkit: {
      ...goodP3.primary_toolkit,
      angles: [
        {
          name: "错",
          strategy: "把固定资产转为现金流更灵活。",
          means: ["资产配置调整"],
        },
        goodP3.primary_toolkit.angles[1],
        goodP3.primary_toolkit.angles[2],
      ],
    },
  };
  const failLife = sanitizePageJson("science_action", badLife, {
    plainJudgmentFill: true,
    situationMaterial: agenda,
    deepEvidencePlan: goodPlan,
    fillMode: "compress",
  });
  assert.equal(failLife.ok, false);
  assert.ok(
    failLife.ok
      ? false
      : failLife.reason.startsWith("fill_parallel_life_story:") ||
          failLife.reason.startsWith("strategy_situation_paste:"),
    failLife.ok ? "ok" : failLife.reason,
  );

  const shellP3 = {
    ...goodP3,
    primary_toolkit: {
      ...goodP3.primary_toolkit,
      angles: [
        {
          name: "过热",
          strategy:
            "这就像一台机器在高温下持续运转，需要冷却液来降温。",
          means: ["增加休息，进行静坐、深呼吸"],
        },
        goodP3.primary_toolkit.angles[1],
        goodP3.primary_toolkit.angles[2],
      ],
    },
  };
  const failShell = sanitizePageJson("science_action", shellP3, {
    plainJudgmentFill: true,
    situationMaterial: agenda,
    deepEvidencePlan: goodPlan,
    fillMode: "compress",
  });
  assert.equal(failShell.ok, false);
  assert.ok(
    failShell.ok
      ? false
      : failShell.reason.startsWith("fill_empty_shell:") ||
          failShell.reason.startsWith("fill_wellness_script:"),
    failShell.ok ? "ok" : failShell.reason,
  );
}

console.log("ok fill-plain-judgment");
