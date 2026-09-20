/**
 * Foundation surface → primary rematch + rejection weld (partnership case).
 *   pnpm exec tsx scripts/test-foundation-surface-primary.ts
 */
import assert from "node:assert/strict";
import { suggestFoundationPrimaryForSurface } from "@/lib/llm/pro/delivery/page-schema/foundation-surface-primary";
import type { ThesisAssignMenuItem } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
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
  // Boyfriend intimacy cite must NOT rematch to 食神
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
  // Topic frames: 对方对X的反应 / 找别人 must not trip agency
  assert.ok(
    isThirdPartyInTopicFrameOnly("对方对兼职的反应已对齐", "对方"),
  );
  assert.ok(isThirdPartyInTopicFrameOnly("他可以找别人慢慢搞", "别人"));
  assert.equal(
    detectKnownThirdPartyAgency(
      "本卡须证明：对方对兼职的反应在本盘能量结构上成立",
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

  // Expectation (no rejection verb) still uses 难开口 shell when agency fires
  const expectAgency =
    "伙伴期望盘主以全职身份承担正式责任";
  const expectFixed = softRepairThirdPartyAgencyProse(expectAgency, ["伙伴"]);
  assert.ok(/更难把兼职试水说出口|配合而非主导|绑定与投入/.test(expectFixed), expectFixed);

  const tmpl = partnershipRejectionInferenceTemplate("午丑相害");
  assert.ok(!/还没开口|更难把兼职试水说出口/.test(tmpl) || /而非「还没开口」/.test(tmpl));
  assert.ok(/全职门槛|让步/.test(tmpl));
  assert.equal(detectKnownThirdPartyAgency(tmpl, ["对方", "伙伴"]), null);
}

console.log("test-foundation-surface-primary: ok");
