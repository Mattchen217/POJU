/**
 * Face 02 dedicated prompt — structured content units.
 */

import { DECISION_REPORT_V2_SYSTEM_PROMPT } from "../system-prompt";
import { formatTermAllowlistForPrompt } from "../term-allowlist";
import type { TermAllowlistEntry } from "../types";
import type { Page02FeedSlice } from "./slice";

export const FACE02_TASK_PROMPT = `任务：生成个人决策报告第 02 页「为什么这个判断适合你」。

本页只解释：Page01 的判断为何与「此人 + 当前处境」相关。
不是再次发布结论，不是路径比较，不是卡点诊断，不是行动方案。

你必须输出【结构化 content_units】，不要输出无法归属的大段自由事实陈述。

content_units.kind 只能是：
- personal_interpretation：个人结构解释（须引用 personal_reading evidence + source_domain）
- reality_fact：现实事实单元（须含 canonical fact_ids + 对应 ev_fact_* evidence_ids；claim 须与程序可信 DIR 关联一致）
- reality_mechanism：外部机制解释（须引用 reality_mechanism evidence）
- conditional_explanation：条件性说明；若涉及现实事实，必须在 related_reality_fact_unit_ids 指向已声明的 reality_fact unit，禁止在本 unit 内偷偷陈述未引用的 DC 事实

硬约束（每个 unit）：
- claim_ids：至少 1 个，且必须来自 evidence_registry.claims
- evidence_ids：personal / reality_fact / reality_mechanism 至少 1 个；须与 registry 归属一致
- 不得留空 claim_ids / fact_ids（reality_fact）

页面各段只引用 unit_id 装配：
- page_summary_unit_ids
- relevant_personal_factor_unit_ids
- personal_reality_interplay_unit_ids
- why_judgment_fits_unit_ids
- explanation_boundary.personal_unit_ids / confirmed_fact_unit_ids / hypothesis_unit_ids

你将收到：
- decision / reality_context / personal_analysis / page01_judgment_context
- evidence_registry（仅可引用其中的 id）
- credible_fact_claim_pairs（程序认证的 fact↔claim；reality_fact 只能用这些对）
- page_requirements

规则：
1. 无可用个人域时不得伪造 personal_interpretation（bazi/ziwei）。
2. 不得升级 DC 事实状态；confirmed_fact_unit_ids 只能指向 status=confirmed 的 reality_fact units。
3. hypothesis_unit_ids 不得指向 confirmed 事实。
4. 正文零命理专名、零软译、零 term_id；不得用 Markdown。
5. 不得复制 Page01 结论；不得侵入 Page04/05/06。
6. 只输出符合 Face02V2 JSON schema 的 JSON。`;

export function buildFace02PromptPair(input: {
  slice: Page02FeedSlice;
  termAllowlist: readonly TermAllowlistEntry[];
  jsonSchemaHint: string;
  /** Program-certified pairs — feed to model as read-only constraint. */
  credibleFactClaimPairs?: ReadonlyArray<{
    claim_id: string;
    fact_id: string;
    evidence_id: string;
    related_dir_ids: string[];
  }>;
}): { system: string; user: string } {
  const system = [
    DECISION_REPORT_V2_SYSTEM_PROMPT,
    "",
    FACE02_TASK_PROMPT,
    "",
    "输出必须符合 Face02 JSON schema（schema_version=face02-v2 · content_units 权威）。",
  ].join("\n");

  const pairs = (input.credibleFactClaimPairs ?? []).map((p) => ({
    claim_id: p.claim_id,
    fact_id: p.fact_id,
    evidence_id: p.evidence_id,
    related_dir_ids: p.related_dir_ids,
  }));

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
    "## credible_fact_claim_pairs (program-certified; reality_fact must use these)",
    JSON.stringify(pairs, null, 2),
    "",
    formatTermAllowlistForPrompt(input.termAllowlist),
    "",
    "## page_requirements",
    [
      "- content_units: required array of discriminated units (personal_interpretation | reality_fact | reality_mechanism | conditional_explanation)",
      "- EVERY unit.claim_ids: min 1 id from evidence_registry.claims (never empty)",
      "- reality_fact units: fact_ids = canonical raw DC ids; evidence_ids must include matching ev_fact_* records; (claim_id, fact_id) must appear in credible_fact_claim_pairs",
      "- Section assembly uses unit_id lists only — do not rely on free-text page_summary fields",
      "- explanation_boundary.claim_ids must intersect the claim_ids of referenced boundary units",
      "- confirmed_fact_unit_ids: every body-used reality_fact unit whose DC statuses are all confirmed (exclusive with hypothesis)",
      "- hypothesis_unit_ids: every body-used reality_fact unit with any non-confirmed DC status; must not hold confirmed facts",
      "- Do not leave a non-confirmed reality_fact unit in summary/body without listing it in hypothesis_unit_ids",
      "- uncertainty_notes: non-authoritative; never change DC status",
      "- Body vernacular only; no traditional jargon; no soft labels; no term_id",
      "- Do not invent probability scores or destiny forecasts",
      "- Do not diagnose Page04 bottlenecks or prescribe Page06 actions",
    ].join("\n"),
    "",
    "## JSON shape",
    input.jsonSchemaHint,
  ].join("\n");

  return { system, user };
}
