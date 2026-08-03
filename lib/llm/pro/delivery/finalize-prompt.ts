import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import {
  formatBreakthroughCoreForFinalize,
  formatSpineSliceForSegment,
} from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";

export const DELIVERY_FINALIZE_TASK = `# 角色:交付书定稿师(盘面结构为依据·科学背书·一本小书)

你拿到:
- 第二阶段【方案骨架】breakthrough_core 的【本段切片】;
- 第三阶段【收集到的现实证据】。

# 任务:定稿产出指定段的双钥匙(不重新算命盘)
每段:
- core_conclusion: 白话结论(序言/结语 40-100字;能量/处境/抉择 80-160字;行动/调频 100-180字;节奏/觉察 60-120字)。
  【铁律】core_conclusion 【纯大白话】【零命理词】——禁日主/用神/喜神/忌神/十神/大运/流年/格局专名/神煞名/干支/寅月等支月。
  【铁律】表外命理黑话也不许写进 core_conclusion,一律改感受/行为/处境白话。
  【铁律】禁软译黑话裸露:锚元/助元/供源/需养/岁环/流展/本元——这些不是白话。
  【铁律】【命运红线】core_conclusion 禁止字面出现:命运 / 命定 / 宿命 / 天注定
    （含否定式「这不是命运」「并非命定」。改用人生轨迹/配置读数/外部定论,或直接讲机制。）
    「判决」可作普通白话;禁止「命运判决书」类套话。
  【铁律】禁止 \`⟦t:…⟧\` 与自造 slug 出现在 core_conclusion。
  【铁律】禁止把 bazi_basis 原文粘进 core_conclusion;依据只进 bazi_basis 数组。
- bazi_basis: 结构依据真词清单(字符串数组,用全称)。依据层会拿这些词向用户解释「这段正文的依据是什么」。

# 以盘面结构为依据、科学背书
- 每段的根在 bazi_basis;科学只做翻译/落地,不唱反调。
- action 段:可执行现代行动方向;retune 段:能量调频方向。

# 段映射(只输出本次指定的键)
preface ← original_question + 收集背景;【过渡段】bazi_basis=[]
energy ← energy_structure(第2段脊柱·能量本质/补给消耗/格局/当前环境)
situation ← situation_conclusion + key_crossroads.structural_basis
crossroads ← key_crossroads(real_fork/path_costs/decision_traits)
action ← modern_action_frames(reinforced优先) + 收集证据
retune ← energy_retune_frame(reinforced优先) + 收集证据
rhythm ← rhythm_frame(三阶段)
awareness ← self_check_signals
epilogue ← 收尾赋能;【过渡段】bazi_basis=[]

# 合规
不报日期(时机=条件成熟);非心理诊断;energy 段禁止场景定性。

# 输出:严格 JSON —— 必须带段键包裹(不要输出裸 dual-key)
示例(只产出 awareness 时):
{"awareness":{"core_conclusion":"...","bazi_basis":[...]}}
错误示例(禁止): {"core_conclusion":"...","bazi_basis":[...]}  ← 缺少段键
无 markdown 围栏。
`;

export function buildDeliveryFinalizePrompt(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: "full" | "degraded";
  /** When set, only ask for these segment keys (parallel finalize groups). */
  paths?: readonly import("@/lib/llm/pro/delivery/delivery-schema").DeliverySegmentKey[];
}): { system: string; user: string } {
  const { breakthrough_core, covered_agenda, agent_v2, locale, delivery_mode } = input;
  const paths = input.paths;
  const sliceKey = paths?.length === 1 ? paths[0] : undefined;
  const spine =
    breakthrough_core == null
      ? "(无脊柱 — degraded：仅依据收集语境与问题作薄交付。)"
      : sliceKey
        ? formatSpineSliceForSegment(breakthrough_core, sliceKey)
        : formatBreakthroughCoreForFinalize(breakthrough_core); // 多键/无 path 兜底：全量
  const agendaStr =
    covered_agenda.length === 0
      ? "(尚无 covered 议程项 — 结合已有语境,勿编造。)"
      : covered_agenda
          .map((a, i) => `${i + 1}. ${a.label}${a.answer ? `\n   用户确认：${a.answer}` : ""}`)
          .join("\n");
  const segment1 = formatSegment1UnderstandingForPrompt(agent_v2);

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    DELIVERY_FINALIZE_TASK,
  );

  const keysHint = paths?.length
    ? paths.length === 1
      ? `只输出 1 个顶层键 "${paths[0]}"，值为 {"core_conclusion":"...","bazi_basis":[...]}。禁止省略段键、禁止输出其他段。`
      : `只输出这 ${paths.length} 个顶层键: ${paths.join(", ")}。每键值为 {"core_conclusion":"...","bazi_basis":[...]}。不要输出其他段。`
    : `只输出 9 段双钥匙 JSON(preface…epilogue)。`;

  const user = `【locale】${locale}
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
