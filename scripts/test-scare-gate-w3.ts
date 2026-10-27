/**
 * W3 · scare redline fails the delivery gate, and page prompts read the slice.
 * Run: pnpm test:scare-gate-w3
 */
import assert from "node:assert/strict";
import {
  CLEAR_RECOMMENDATION_ALLOWED_STEMS,
  detectOutputPolicyViolations,
  scareRedlineSnippet,
  textHitsScareRedline,
} from "@/lib/llm/compliance/audit-output";
import {
  buildAuditRegenHint,
  isCriticalDeliveryAuditFailure,
} from "@/lib/llm/services/delivery-audit-regen";
import { isBaseAnalysisGateFailure } from "@/lib/base-analysis/delivery-gate";
import { gateContentPhaseA } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
import { resolveDeliveryPipeline } from "@/lib/llm/pro/delivery/pipeline-v3/flag";
import { buildPageSchemaFillPrompt } from "@/lib/llm/pro/delivery/page-schema/fill-prompt";
import { buildDeepEvidenceWriteChunkPrompt } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-write";
import { buildDeepEvidencePrompt } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import { fillDutyForKey } from "@/lib/llm/pro/delivery/page-prompts";
import { DECISION_VOICE_DUTY } from "@/lib/llm/pro/delivery/page-prompts/decision-voice";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

const SCARE = "这段关系必散";
const CLEAR = "本题更宜先稳住，条件是对方给出书面范围。";
const MIXED = "更宜降档，否则必死";

assert.equal(textHitsScareRedline(SCARE), true);
assert.equal(scareRedlineSnippet(SCARE), "必散");
assert.equal(textHitsScareRedline(CLEAR), false);
assert.equal(scareRedlineSnippet(CLEAR), null);
assert.equal(textHitsScareRedline(MIXED), true);
for (const stem of CLEAR_RECOMMENDATION_ALLOWED_STEMS) {
  assert.equal(textHitsScareRedline(stem), false, stem);
}

const policy = detectOutputPolicyViolations(SCARE, "zh");
assert.ok(policy.some((v) => v.category === "fear_mongering" && v.label === "scare_redline"));
assert.equal(detectOutputPolicyViolations(CLEAR, "zh").some((v) => v.label === "scare_redline"), false);

const scareViolation = { label: "fear_mongering:scare_redline", snippet: "必散" };
assert.equal(isCriticalDeliveryAuditFailure([scareViolation]), true);
assert.equal(isBaseAnalysisGateFailure([scareViolation]), true);
assert.match(buildAuditRegenHint([scareViolation], "zh"), /带条件的明确主推/);

const gated = gateContentPhaseA({
  key: "decision_brief",
  page_schema: { page_title: SCARE } as DeliveryPageData,
});
assert.equal(gated.passed, false);
assert.equal(gated.failed_rule, "scare_redline");

const clearGate = gateContentPhaseA({
  key: "decision_brief",
  page_schema: { page_title: CLEAR } as DeliveryPageData,
});
assert.notEqual(clearGate.failed_rule, "scare_redline");

assert.match(DECISION_VOICE_DUTY, /切轨或停止/);
assert.match(DECISION_VOICE_DUTY, /近步原则/);
assert.match(DECISION_VOICE_DUTY, /可勾选/);
assert.match(fillDutyForKey("strategic_options", "选项"), /切轨或停止/);
assert.match(fillDutyForKey("execution_guidance", "执行"), /做成什么样/);
assert.match(fillDutyForKey("execution_guidance", "执行"), /可勾选/);
assert.match(fillDutyForKey("self_regulation", "调频"), /06-C/);

const chart = [
  "年柱：FULLCHART_CANARY",
  "日主：甲木",
  "用神：水",
  "当前大运：庚午",
  "【奇门锁盘】",
  "值使门：开门CANARY",
].join("\n");

const fill02 = buildPageSchemaFillPrompt("situation_analysis", {
  locale: "zh",
  core_conclusion: "测",
  chart_fact_pack: chart,
  structured_inventory: "FULL_INVENTORY_CANARY",
  question_expectation: "想看清主路",
});
assert.match(fill02.user, /本页切片/);
assert.match(fill02.user, /用神：水/);
assert.doesNotMatch(fill02.user, /FULLCHART_CANARY/);
assert.doesNotMatch(fill02.user, /FULL_INVENTORY_CANARY/);
assert.doesNotMatch(fill02.user, /开门CANARY/);

const fill06 = buildPageSchemaFillPrompt("execution_guidance", {
  locale: "zh",
  core_conclusion: "测",
  chart_fact_pack: chart,
  structured_inventory: "FULL_INVENTORY_CANARY",
});
assert.match(fill06.user, /page 06/);
assert.match(fill06.user, /庚午/);
assert.doesNotMatch(fill06.user, /甲木/);
assert.doesNotMatch(fill06.user, /FULLCHART_CANARY/);
assert.doesNotMatch(fill06.user, /FULL_INVENTORY_CANARY/);

const inventoryOnly = buildPageSchemaFillPrompt("situation_analysis", {
  locale: "zh",
  core_conclusion: "测",
  structured_inventory: "闭集样本",
});
assert.match(inventoryOnly.user, /完整原始命盘闭集/);
assert.doesNotMatch(inventoryOnly.user, /本页切片/);

const write02 = buildDeepEvidenceWriteChunkPrompt(
  "situation_analysis",
  {
    locale: "zh",
    core_conclusion: "测",
    chart_fact_pack: chart,
  },
  [
    {
      path: "why_cards[0]",
      chart_anchors: [],
      calc_cite: "丑未相冲",
      means_candidate_ref: "归因1",
      unit_claim: "日支与时支，丑未相冲",
    },
  ],
);
assert.match(write02.user, /本页切片/);
assert.match(write02.user, /用神：水/);
assert.match(write02.user, /丑未相冲/);
assert.doesNotMatch(write02.user, /FULLCHART_CANARY/);
assert.doesNotMatch(write02.user, /开门CANARY/);

const ziwei = {
  topicPalace: {
    role: "ming",
    palace: "命宫",
    heavenlyStem: "丙",
    earthlyBranch: "午",
    majorStars: ["紫微"],
    oppositePalace: "迁移",
    oppositeMajorStars: ["贪狼"],
  },
  palaces: [{ name: "命宫", heavenlyStem: "丙", earthlyBranch: "午", majorStars: ["破军"], role: "ming" }],
  source: { note: "LEAK_SOURCE_CANARY" },
  otherChart: null,
} as unknown as ZiweiFactPack;

const withZiwei = buildDeepEvidencePrompt("situation_analysis", {
  locale: "zh",
  core_conclusion: "测",
  ziwei_fact_pack: ziwei,
  structured_inventory: "FULL_INVENTORY_CANARY",
});
assert.match(withZiwei.user, /本页切片/);
assert.match(withZiwei.user, /紫微/);
assert.doesNotMatch(withZiwei.user, /"palaces"/);
assert.doesNotMatch(withZiwei.user, /LEAK_SOURCE_CANARY/);
assert.doesNotMatch(withZiwei.user, /破军/);
assert.doesNotMatch(withZiwei.user, /FULL_INVENTORY_CANARY/);

assert.equal(resolveDeliveryPipeline({} as NodeJS.ProcessEnv), "legacy");

console.log("test-scare-gate-w3: ok");
