/**
 * Foundation surface → primary rematch + rejection weld (partnership case).
 *   pnpm exec tsx scripts/test-foundation-surface-primary.ts
 */
import assert from "node:assert/strict";
import { suggestFoundationPrimaryForSurface } from "@/lib/llm/pro/delivery/page-schema/foundation-surface-primary";
import { planDeepEvidenceSlots } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  buildFoundationSurfaceFeedBlock,
  buildFoundationAssignPathHints,
  collectFoundationSurfaceCandidates,
} from "@/lib/llm/pro/delivery/foundation-surface-feed";
import type { ThesisAssignMenuItem } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import {
  isPartnershipRejectionSurface,
  isTechOutputSurface,
  isLegalAdvisorSurface,
  isThirdPartyInTopicFrameOnly,
  partnershipRejectionInferenceTemplate,
  softRepairThirdPartyAgencyProse,
  detectKnownThirdPartyAgency,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";

const menu: ThesisAssignMenuItem[] = [
  { slug: "卯未半合", dimension_id: "day_master_strength", fact_hint: "x" },
  { slug: "比肩", dimension_id: "interpersonal_pattern", fact_hint: "x" },
  { slug: "偏财", dimension_id: "resource_pattern", fact_hint: "x" },
  { slug: "正财", dimension_id: "favor_avoid_tuning", fact_hint: "x" },
  { slug: "食神", dimension_id: "expression_creativity", fact_hint: "x" },
  { slug: "伤官", dimension_id: "expression_creativity", fact_hint: "x" },
  { slug: "正印", dimension_id: "favor_avoid_tuning", fact_hint: "x" },
  { slug: "偏印", dimension_id: "favor_avoid_tuning", fact_hint: "x" },
  { slug: "午丑相害", dimension_id: "cycle_rhythm", fact_hint: "x" },
  { slug: "丑未相冲", dimension_id: "cycle_rhythm", fact_hint: "x" },
];

{
  assert.equal(
    suggestFoundationPrimaryForSurface(
      "项目对技术的依赖程度: 技术重要但不是唯一，他可以找别人或自己慢慢搞",
      menu,
    ),
    "食神",
  );
  assert.equal(
    suggestFoundationPrimaryForSurface(
      "法律或顾问资源: 有信得过的律师或前辈，能帮我看合同、出主意",
      menu,
    ),
    "正印",
  );
  assert.equal(
    suggestFoundationPrimaryForSurface(
      "对方对兼职的反应: 我提过，他直接拒绝了，说必须全职才能给核心位置。",
      menu,
    ),
    "午丑相害",
  );
  assert.equal(
    suggestFoundationPrimaryForSurface(
      "男友反对的核心原因: 我的专业积累很具体",
      menu,
    ),
    undefined,
  );
}

{
  assert.ok(
    isPartnershipRejectionSurface(
      "对方对兼职的反应: 我提过，他直接拒绝了，说必须全职才能给核心位置。",
    ),
  );
  assert.ok(
    !isPartnershipRejectionSurface(
      "创业伙伴对兼职试水的接受度: 他明确说过希望我全职加入",
    ),
  );
  assert.ok(isTechOutputSurface("技术不是壁垒，他主要缺一个信得过的执行者"));
  assert.ok(isLegalAdvisorSurface("有信得过的律师或前辈，能帮我看合同"));
}

{
  assert.ok(isThirdPartyInTopicFrameOnly("对方对兼职的反应已对齐", "对方"));
  assert.ok(isThirdPartyInTopicFrameOnly("他可以找别人慢慢搞", "别人"));
  assert.ok(
    isThirdPartyInTopicFrameOnly("资源主要在对方侧，你守交付筹码", "对方"),
  );
  assert.ok(
    isThirdPartyInTopicFrameOnly("对方是发起人；若对方拒绝兼职则切辅轨", "对方"),
  );
  assert.ok(
    isThirdPartyInTopicFrameOnly(
      "在对方再次施压全职时，主动将对话切换到冷静的节奏",
      "对方",
    ),
    "partner pressure as scene frame",
  );
  assert.ok(
    isThirdPartyInTopicFrameOnly("不因对方画饼而动摇根基", "对方"),
    "querent refuses counterpart bait",
  );
  assert.equal(
    detectKnownThirdPartyAgency(
      "本卡须证明：对方对兼职的反应在本盘能量结构上成立",
      ["对方"],
    ),
    null,
  );
  assert.equal(
    detectKnownThirdPartyAgency(
      "先以兼职试水。资源主要在对方侧。若对方拒绝兼职，切到全职硬网辅轨。",
      ["对方"],
    ),
    null,
  );
}

{
  const rejected =
    "他直接拒绝了，说必须全职才能给核心位置，对方设门槛逼你就范";
  const fixed = softRepairThirdPartyAgencyProse(rejected, ["对方"]);
  assert.ok(!/更难把兼职试水说出口/.test(fixed), fixed);
  assert.ok(/全职门槛|配合与让步/.test(fixed), fixed);

  const expectAgency = "伙伴期望盘主以全职身份承担正式责任";
  const expectFixed = softRepairThirdPartyAgencyProse(expectAgency, ["伙伴"]);
  assert.ok(
    /更难把兼职试水说出口|配合而非主导|绑定与投入/.test(expectFixed),
    expectFixed,
  );

  const tmpl = partnershipRejectionInferenceTemplate("午丑相害");
  assert.ok(/全职门槛|让步/.test(tmpl));
  assert.equal(detectKnownThirdPartyAgency(tmpl, ["对方", "伙伴"]), null);
}

{
  // reserved on other pages must NOT block foundation rematch
  const thesis = {
    version: 1,
    structured_fingerprint: "rematch-reserved",
    generated_at: new Date().toISOString(),
    judgment_core_frozen: true,
    as_of_day: "2026-09-20",
    question_category: "career",
    dimensions: [
      {
        dimension_id: "expression_creativity",
        dimension_name_zh: "表达",
        classical_basis: [
          {
            key: "output_gods",
            present: true,
            summary_zh: "食神/伤官：时柱食神",
          },
        ],
        conclusion_zh: "食神",
        usable_claims_hint: ["ten_god:食神"],
        wuxing_relations: [],
        depth: "brief",
      },
      {
        dimension_id: "favor_avoid_tuning",
        dimension_name_zh: "用神",
        classical_basis: [
          { key: "yong_shen", present: true, summary_zh: "用神：水" },
          {
            key: "pillar",
            present: true,
            summary_zh: "月柱正印、年柱偏印",
          },
        ],
        conclusion_zh: "水",
        usable_claims_hint: ["ten_god:正印"],
        wuxing_relations: [],
        depth: "brief",
      },
      {
        dimension_id: "cycle_rhythm",
        dimension_name_zh: "岁运",
        classical_basis: [
          {
            key: "cycle_tension_signals",
            present: true,
            summary_zh: "午丑相害；寅午半合；午午相刑",
          },
        ],
        conclusion_zh: "午丑相害",
        usable_claims_hint: [],
        wuxing_relations: [],
        depth: "full",
      },
      {
        dimension_id: "resource_pattern",
        dimension_name_zh: "财",
        classical_basis: [
          {
            key: "wealth_gods",
            present: true,
            summary_zh: "偏财藏干；大运正财",
          },
        ],
        conclusion_zh: "正财",
        usable_claims_hint: ["ten_god:正财"],
        wuxing_relations: [],
        depth: "brief",
      },
      {
        dimension_id: "day_master_strength",
        dimension_name_zh: "日主",
        classical_basis: [
          {
            key: "branch_he_ju",
            present: true,
            summary_zh: "卯未半合；午未六合",
          },
        ],
        conclusion_zh: "卯未半合",
        usable_claims_hint: [],
        wuxing_relations: [],
        depth: "brief",
      },
      {
        dimension_id: "interpersonal_pattern",
        dimension_name_zh: "人际",
        classical_basis: [
          {
            key: "peer_gods",
            present: true,
            summary_zh: "比肩藏干",
          },
        ],
        conclusion_zh: "比肩",
        usable_claims_hint: ["ten_god:比肩"],
        wuxing_relations: [],
        depth: "full",
      },
    ],
  } as ChartThesis;

  const feed = buildFoundationSurfaceFeedBlock(
    [
      {
        label: "项目对技术的依赖程度",
        answer: "技术不是壁垒，他主要缺一个信得过的执行者",
      },
      {
        label: "法律或顾问资源",
        answer: "有信得过的律师或前辈，能帮我看合同",
      },
      {
        label: "对方对兼职的反应",
        answer: "他直接拒绝了，说必须全职才能给核心位置。",
      },
      {
        label: "你的收入安全底线",
        answer: "我能撑半年左右，但再长就会焦虑",
      },
    ],
    { desired_outcome: "先以兼职方式试水合作，保住现有稳定收入" },
  );
  const planned = planDeepEvidenceSlots("foundation", {
    key: "foundation",
    chart_thesis: thesis,
    foundation_surface_feed: feed,
    assign_path_hints: buildFoundationAssignPathHints(
      collectFoundationSurfaceCandidates(
        [
          {
            label: "项目对技术的依赖程度",
            answer: "技术不是壁垒，他主要缺一个信得过的执行者",
          },
          {
            label: "法律或顾问资源",
            answer: "有信得过的律师或前辈，能帮我看合同",
          },
          {
            label: "对方对兼职的反应",
            answer: "他直接拒绝了，说必须全职才能给核心位置。",
          },
          {
            label: "你的收入安全底线",
            answer: "我能撑半年左右，但再长就会焦虑",
          },
        ],
        { desired_outcome: "先以兼职方式试水合作，保住现有稳定收入" },
      ),
      5,
    ),
    prealloc_prefer_by_path: {
      "why_cards[0]": "卯未半合",
      "why_cards[1]": "比肩",
      "why_cards[2]": "偏财",
      "why_cards[3]": "正财",
      "why_cards[4]": "寅午半合",
    },
    reserved_chart_primaries: ["食神", "正印", "午丑相害"],
  });
  const slug = (i: number) =>
    planned[i]?.locked_signals?.[0]?.slug ?? planned[i]?.prefer_primary;
  assert.equal(slug(0), "食神", `got ${slug(0)}`);
  assert.equal(slug(1), "正印", `got ${slug(1)}`);
  assert.equal(slug(2), "午丑相害", `got ${slug(2)}`);
}

console.log("test-foundation-surface-primary: ok");
