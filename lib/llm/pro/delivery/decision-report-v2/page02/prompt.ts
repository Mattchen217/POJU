/**
 * Face 02 dedicated prompt — why this judgment fits you.
 */

import { DECISION_REPORT_V2_SYSTEM_PROMPT } from "../system-prompt";
import { formatTermAllowlistForPrompt } from "../term-allowlist";
import type { TermAllowlistEntry } from "../types";
import type { Page02FeedSlice } from "./slice";

export const FACE02_TASK_PROMPT = `任务：生成个人决策报告第 02 页「为什么这个判断适合你」。

本页只解释：Page01 的判断为何与「此人 + 当前处境」相关。
不是再次发布结论，不是路径比较，不是卡点诊断，不是行动方案。

你将收到：
- decision：本题问题与目标；
- reality_context：DC 现实事实（selection_kind=linked|candidate；status/verification 不得升级）；
- personal_analysis：本题相关的已认证个人批断与锚点（含 domain_versions）；无可用域时可能为空；
- page01_judgment_context：仅供对齐的 Page01 判断摘要（不是个人分析来源，不得整段复读为正文）；
- evidence_registry：本页 slice 内可引用的 evidence_id / claim_id（不得引用之外的 id）；
- page_requirements：本页字段规则。

请完成：

1. 识别真正需要解释的、与本题相关的个人因素（无则留空，禁止伪造）。
2. 只从本页 evidence_registry 选择依据；term_ids 已由程序认证，不得自造。
3. 建立个人结构与现实处境之间的解释关系（条件、边界、代价）。
4. 说明这些关联如何支撑 Page01 判断，而不重述完整结论/首选路径。
5. 明确区分：个人分析依据 / 用户确认事实 / 解释性假设 / 外部机制证据。
6. 不得把传统分析写成已被现代科学验证的事实。
7. 不得展开 Page04 核心卡点诊断、Page05 路径排序、Page06 行动安排。
8. 不得复制 Page01 结论段落作为本页主要正文。
9. 正文零命理专名、零软译术语、零 term_id；不得用 Markdown。
10. 只输出符合 Face02V2 JSON schema 的 JSON。

写作要求：
- 直接、具体、自然；
- 解释条件与适用边界；
- 不恐吓、不定命、不预测确定未来；
- 不为凑结构制造无依据内容。`;

export function buildFace02PromptPair(input: {
  slice: Page02FeedSlice;
  termAllowlist: readonly TermAllowlistEntry[];
  jsonSchemaHint: string;
}): { system: string; user: string } {
  const system = [
    DECISION_REPORT_V2_SYSTEM_PROMPT,
    "",
    FACE02_TASK_PROMPT,
    "",
    "输出必须符合 Face02 JSON schema（schema_version=face02-v2）。",
  ].join("\n");

  const user = [
    `locale: ${input.slice.locale}`,
    `report_id: ${input.slice.report_id}`,
    "",
    "## decision",
    JSON.stringify(input.slice.decision, null, 2),
    "",
    "## reality_context",
    JSON.stringify(input.slice.reality_context, null, 2),
    "",
    "## personal_analysis (topic-filtered; do not invent)",
    JSON.stringify(input.slice.personal_analysis, null, 2),
    "",
    "## page01_judgment_context (alignment only — do not copy as body)",
    JSON.stringify(input.slice.page01_judgment_context, null, 2),
    "",
    "## report_analysis",
    JSON.stringify(input.slice.report_analysis, null, 2),
    "",
    "## evidence_registry (ids you may cite — Page02 slice only)",
    JSON.stringify(input.slice.evidence_registry, null, 2),
    "",
    formatTermAllowlistForPrompt(input.termAllowlist),
    "",
    "## page_requirements",
    [
      "- page_summary: short overview of why the judgment fits",
      "- Whenever a content block makes a concrete claim about user reality, cite structured DC fact ids (canonical raw fact_id, not ev_fact_ aliases)",
      "- page_summary_reality_fact_ids: optional; required when page_summary asserts a concrete DC fact",
      "- relevant_personal_factors: 0–4; claim_ids + evidence_ids + source_domain; optional reality_fact_ids when asserting DC facts",
      "- personal_reality_interplay: 0–4; personal_evidence_ids + reality_fact_ids + conditionality; every evidence/fact must belong to listed claim_ids",
      "- why_judgment_fits: explain fit; optional reality_fact_ids; optional short page01_judgment_ref; no full restatement",
      "- explanation_boundary: personal_analysis_basis/confirmed_fact_basis may be EMPTY when no matching evidence",
      "- explanation_boundary must include structured refs: personal_analysis_evidence_ids, confirmed_fact_ids, hypothesis_fact_ids",
      "- confirmed_fact_ids: only DC facts with original status=confirmed; never promote by verification level",
      "- hypothesis_fact_ids: never include original status=confirmed",
      "- hypothesis_notes: explanatory assumptions only — never confirmed facts",
      "- reading_order: content block order",
      "- Body: vernacular only; no traditional jargon; no soft labels; no term_id",
      "- Do not invent probability scores, destiny forecasts, or fake KPIs",
      "- Do not upgrade unverified/unknown/hypothesis/candidate facts to confirmed in ANY visible field",
      "- Do not diagnose Page04 bottlenecks or prescribe Page06 actions",
      "- evidence_registry.source_domain/source_version are program-certified — both must exist and match profile versions for personal_reading",
    ].join("\n"),
    "",
    "## JSON shape",
    input.jsonSchemaHint,
  ].join("\n");

  return { system, user };
}
