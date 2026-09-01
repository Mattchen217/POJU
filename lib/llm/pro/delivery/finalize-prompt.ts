import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import {
  formatBreakthroughCoreForFinalize,
  formatSpineSliceForSegment,
} from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/types";
import { formatPagePlanSummaryForPrompt } from "@/lib/llm/pro/delivery/page-plan/format-page-plan-for-prompt";
import {
  DELIVERY_FINALIZE_SHARED,
  finalizeDutyForKey,
} from "@/lib/llm/pro/delivery/page-prompts";

export { DELIVERY_FINALIZE_SHARED, finalizeDutyForKey };

/** @deprecated Use DELIVERY_FINALIZE_SHARED + finalizeDutyForKey. Kept for tests that scan shared lexicon. */
export const DELIVERY_FINALIZE_TASK = DELIVERY_FINALIZE_SHARED;

/**
 * Finalize 组装器：共用规则 + 仅本次 paths 的页职责。
 * 逐页人设/任务/目标 → lib/llm/pro/delivery/page-prompts/p1…p6。
 */
export function buildDeliveryFinalizePrompt(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: "full" | "degraded";
  /** When set, only ask for these segment keys (parallel finalize groups). */
  paths?: readonly DeliverySegmentKey[];
  page_plan?: DeliveryPagePlan | null;
  question_expectation?: string;
}): { system: string; user: string } {
  const { breakthrough_core, covered_agenda, agent_v2, locale, delivery_mode } = input;
  const paths = input.paths;
  const sliceKey = paths?.length === 1 ? paths[0] : undefined;
  const questionExpectation =
    input.question_expectation ??
    [
      agent_v2.original_question?.trim(),
      agent_v2.context_collected?.desired_outcome?.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  const spine =
    breakthrough_core == null
      ? "(无脊柱 — degraded：仅依据收集语境与问题作薄交付。)"
      : sliceKey
        ? formatSpineSliceForSegment(breakthrough_core, sliceKey, {
            pagePlan: input.page_plan,
            questionExpectation,
          })
        : formatBreakthroughCoreForFinalize(breakthrough_core);
  const agendaStr =
    covered_agenda.length === 0
      ? "(尚无 covered 议程项 — 结合已有语境,勿编造。)"
      : covered_agenda
          .map((a, i) => `${i + 1}. ${a.label}${a.answer ? `\n   用户确认：${a.answer}` : ""}`)
          .join("\n");
  const segment1 = formatSegment1UnderstandingForPrompt(agent_v2);

  const pathDuties =
    paths?.length
      ? paths.map((k) => finalizeDutyForKey(k)).join("\n\n")
      : [
          "direct_answer",
          "foundation",
          "science_action",
          "metaphysics_action",
          "risk_guard",
          "signals_close",
        ]
          .map((k) => finalizeDutyForKey(k as DeliverySegmentKey))
          .join("\n\n");

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    DELIVERY_FINALIZE_SHARED,
    input.page_plan ? formatPagePlanSummaryForPrompt(input.page_plan) : "",
    pathDuties,
    // Body-only contract; bazi_basis / evidence stay closed-set technical.
    buildUserFacingExpressionContractBlock({ locale, preset: "delivery" }),
  );

  const keysHint = paths?.length
    ? paths.length === 1
      ? `只输出 1 个顶层键 "${paths[0]}"，值为 {"core_conclusion":"...","bazi_basis":[...]}。禁止省略段键、禁止输出其他段、禁止写其他页职责。`
      : `只输出这 ${paths.length} 个顶层键: ${paths.join(", ")}。每键值为 {"core_conclusion":"...","bazi_basis":[...]}。不要输出其他段。`
    : `只输出指定段双钥匙 JSON(活跃6页: direct_answer…signals_close;不含 thirty_day)。`;

  const user = `【locale】${locale}（仅上下文参考;core_conclusion/bazi_basis 一律中文,勿据此切换语言——多语言由下游翻译步统一处理）
【delivery_mode】${delivery_mode}

【用户原始问题】
"${agent_v2.original_question}"

【第1段理解门】
${segment1}

【本段脊柱切片】
${spine}

【第三阶段收集证据(covered 议程)】
${agendaStr}

【任务】
${keysHint}
不重算命盘。`;

  return { system, user };
}
