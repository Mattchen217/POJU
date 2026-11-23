/**
 * Face 01 dedicated prompt — decision conclusion page.
 */

import { DECISION_REPORT_V2_SYSTEM_PROMPT } from "../system-prompt";
import { formatTermAllowlistForPrompt } from "../term-allowlist";
import type { TermAllowlistEntry } from "../types";
import type { Page01FeedSlice } from "./slice";

export const FACE01_TASK_PROMPT = `任务：生成个人决策报告第 01 页「本题决策结论」。

你不是在总结聊天记录，而是在对一个具体决策给出有依据的建议。

你将收到：
- decision：本题问题、目标和决策边界；
- reality_context：DC 现实事实（每条含 selection_kind=linked|candidate；status/verification 不得升级）、冲突；
- personal_analysis：本题相关的本地个人资料和已审核批断（含 domain_versions）；
- report_analysis：报告级综合分析和候选路径；
- evidence_registry：已经验证的主张与依据单元（term_ids 仅来自真实个人来源）；
- page_requirements：本页字段和规则。

关于 selection_kind：
- linked：有结构化 DIR/role/conflict/constraint 关联；
- candidate：暂无直接关联的有限候选；不得把 candidate 当作已确认相关事实；
- 核心推荐不得仅依赖 candidate 事实。

请完成以下工作：

1. 明确本题真正需要回答的决策问题。
2. 从真实可行的路径中选择当前最优先的方向。
3. 说明推荐成立的必要条件，并标明每项条件的状态。
4. 指出当前不建议的路径及其主要代价。
5. 指出当前判断的适用边界和失效条件。
6. 为所有承重判断关联真实 evidence_id 或 claim_id。
7. 对尚未确认的条件明确保留不确定性。
8. 不得创建输入中不存在的事实、个人批断、资源、预算、时间或成功概率。
9. 不得在正文中出现任何命理专业词汇或自造软译术语。
10. 不得在本页展开完整个人分析；个人化依据指向第 02 页对应依据单元。
11. 不得输出 Markdown，不得输出额外解释，只输出符合 JSON schema 的 JSON。

写作要求：
- 直接、具体、自然、易懂；
- 不夸大确定性；
- 不使用空泛建议；
- 不堆砌专业术语；
- 不为了完整而制造虚假平衡；
- 推荐必须体现当前现实条件；
- 结论必须可被后续事实变化重新评估。

如果现有材料不足以支持唯一主推荐：
- 不要伪装成确定答案；
- 说明当前最合理的暂定方向；
- 明确决定该方向所缺少的关键条件；
- 说明在什么信息得到确认后才能形成更稳定结论。

只输出结构化 JSON。`;

export function buildFace01PromptPair(input: {
  slice: Page01FeedSlice;
  termAllowlist: readonly TermAllowlistEntry[];
  jsonSchemaHint: string;
}): { system: string; user: string } {
  const system = [
    DECISION_REPORT_V2_SYSTEM_PROMPT,
    "",
    FACE01_TASK_PROMPT,
    "",
    "输出必须符合 Face01 JSON schema（schema_version=face01-v2）。",
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
    "## report_analysis",
    JSON.stringify(input.slice.report_analysis, null, 2),
    "",
    "## evidence_registry (ids you may cite)",
    JSON.stringify(input.slice.evidence_registry, null, 2),
    "",
    formatTermAllowlistForPrompt(input.termAllowlist),
    "",
    "## page_requirements",
    [
      "- core_judgment: 1–3 sentences; claim_ids required",
      "- why_this_path: 1–3 reasons; each needs claim_ids + evidence_ids + target_page=02 + target_evidence_ids",
      "- recommendation_conditions: 2–4; status in satisfied|unconfirmed|conflicted|not_applicable; source_ids required",
      "- not_recommended: 1–2; include cost_or_conflict",
      "- applicability_boundary: current_basis + invalidation_conditions + page02_evidence_ids",
      "- Body text: vernacular only; no traditional jargon; no soft labels; no term_id",
      "- Do not invent probability scores or fake KPIs",
    ].join("\n"),
    "",
    "## JSON shape",
    input.jsonSchemaHint,
  ].join("\n");

  return { system, user };
}
