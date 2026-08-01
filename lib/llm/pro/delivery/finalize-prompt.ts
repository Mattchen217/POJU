import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import { formatBreakthroughCoreForFinalize } from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { formatEnergyBaseForFinalize } from "@/lib/llm/pro/delivery/format-energy-base-for-finalize";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";

export const DELIVERY_FINALIZE_TASK = `# 角色:交付书定稿师(命理为主·科学背书·一本小书)

你拿到:
- 底座真算(day_master/用神/格局/大运等)——只读,禁止改判;
- 第二阶段【方案骨架】breakthrough_core;
- 第三阶段【收集到的现实证据】。

# 任务:定稿产出指定段的双钥匙(不重新算命盘)
每段:
- core_conclusion: 白话结论(序言/结语 40-100字;能量/处境/抉择 80-160字;行动/调频 100-180字;节奏/觉察 60-120字)。
  【铁律】core_conclusion 【零命理词】——禁日主/用神/喜神/忌神/十神/大运/流年/格局专名/神煞名/干支/寅月等支月。
  【铁律】禁软译黑话裸露:锚元/助元/供源/需养/岁环/流展/本元——这些不是白话。
  【铁律】禁止把 bazi_basis 原文粘进 core_conclusion;依据只进 bazi_basis 数组。
- bazi_basis: 命理依据真词清单(字符串数组,用全称)。依据层会拿这些词向用户解释「这段正文的依据是什么」。

# 命理为主、科学背书
- 每段的根是命理(bazi_basis);科学只做翻译/落地,不唱反调。
- action 段:可执行现代行动方向;retune 段:能量调频方向。

# 段映射(只输出本次指定的键)
preface ← original_question + 收集背景;【过渡段】bazi_basis=[]
energy ← 底座真算(能量本质/补给消耗/格局/当前环境) — 底座中立
situation ← situation_conclusion + key_crossroads.structural_basis
crossroads ← key_crossroads(real_fork/path_costs/decision_traits)
action ← modern_action_frames(reinforced优先) + 收集证据
retune ← energy_retune_frame(reinforced优先) + 收集证据
rhythm ← rhythm_frame(三阶段)
awareness ← self_check_signals
epilogue ← 收尾赋能;【过渡段】bazi_basis=[]

# 合规
不报日期(时机=条件成熟);非心理诊断;energy 段禁止场景定性。

# 输出:严格 JSON —— 只含本次指定的段键
每键形如 {"core_conclusion":"...","bazi_basis":[...]}
无 markdown 围栏。
`;

export function buildDeliveryFinalizePrompt(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: "full" | "degraded";
  base_analysis?: unknown | null;
  /** When set, only ask for these segment keys (parallel finalize groups). */
  paths?: readonly import("@/lib/llm/pro/delivery/delivery-schema").DeliverySegmentKey[];
}): { system: string; user: string } {
  const { breakthrough_core, covered_agenda, agent_v2, locale, delivery_mode, base_analysis } =
    input;
  const paths = input.paths;
  const spine =
    breakthrough_core != null
      ? formatBreakthroughCoreForFinalize(breakthrough_core)
      : "(无脊柱 — degraded：仅依据收集语境与问题作薄交付。)";
  const agendaStr =
    covered_agenda.length === 0
      ? "(尚无 covered 议程项 — 结合已有语境,勿编造。)"
      : covered_agenda
          .map((a, i) => `${i + 1}. ${a.label}${a.answer ? `\n   用户确认：${a.answer}` : ""}`)
          .join("\n");
  const segment1 = formatSegment1UnderstandingForPrompt(agent_v2);
  const energyBase = formatEnergyBaseForFinalize(base_analysis ?? null);

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    DELIVERY_FINALIZE_TASK,
  );

  const keysHint = paths?.length
    ? `只输出这 ${paths.length} 个键: ${paths.join(", ")}。不要输出其他段。`
    : `只输出 9 段双钥匙 JSON(preface…epilogue)。`;

  const user = `【locale】${locale}
【delivery_mode】${delivery_mode}

【用户原始问题】
"${agent_v2.original_question}"

【第1段理解门】
${segment1}

【底座真算(energy 段事实源)】
${energyBase}

【第二阶段方案骨架】
${spine}

【第三阶段收集证据(covered 议程)】
${agendaStr}

【任务】
${keysHint}
不重算命盘。`;

  return { system, user };
}
