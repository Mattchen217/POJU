import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import { formatBreakthroughCoreForFinalize } from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";

export const DELIVERY_FINALIZE_TASK = `# 角色:交付定稿师(命理为主·科学背书)

你拿到:
- 第二阶段的【方案骨架】(6类,每条可标 hypothesis/reinforced/selected/weakened);
- 第三阶段【收集到的现实证据】。

# 任务:微调定稿,产出6段的双钥匙(不重新算命盘)
1. 据 status 定稿:留 reinforced/selected 的骨架,砍 weakened 的;
   若某段没有 reinforced/selected,可用未 weakened 的 hypothesis 填入(报告不能空段)。
2. 用收集证据把骨架填实(骨架的 needs_validation 对应的现实信息,现在收集到了);
3. 每段产出双钥匙:
   - core_conclusion:这段的白话结论(50-120字,不带命理词);
   - bazi_basis:这段的命理依据真词清单(字符串数组,命理为主的根;用全称,不用合称简称)。

# 命理为主、科学背书(铁律)
- 每段的根是命理(bazi_basis);
- C段现代方案:正文可以是科学落地步骤方向(具体可执行),但依据必须讲命理为什么;
- 科学只做翻译/背书/落地,不独立提和命理不同的结论,不唱反调。

# 6段(对应骨架)
A situation_conclusion → 回答问题+处境
B key_crossroads → 关键抉择+决策特质
C modern_action_frames(reinforced优先) + 收集证据 → 现代行动方案(填成具体)
D energy_retune_frame(reinforced优先) + 收集证据 → 能量调频方案(填成具体)
E rhythm_frame → 提醒+30天节奏
F self_check_signals → 独立锦囊

# 合规
不报日期(时机转译成条件成熟);不做心理诊断(行为倾向描述);
科学背书扎根收集到的真实行为(不凭空套心理学标签,防伪科学)。

# 输出:严格 JSON,键 A–F
{
  "A":{"core_conclusion":"...","bazi_basis":["..."]},
  "B":{"core_conclusion":"...","bazi_basis":["..."]},
  "C":{"core_conclusion":"...","bazi_basis":["..."]},
  "D":{"core_conclusion":"...","bazi_basis":["..."]},
  "E":{"core_conclusion":"...","bazi_basis":["..."]},
  "F":{"core_conclusion":"...","bazi_basis":["..."]}
}
无 markdown 围栏。
`;

export function buildDeliveryFinalizePrompt(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: "full" | "degraded";
}): { system: string; user: string } {
  const { breakthrough_core, covered_agenda, agent_v2, locale, delivery_mode } = input;
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

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    DELIVERY_FINALIZE_TASK,
  );

  const user = `【locale】${locale}
【delivery_mode】${delivery_mode}

【用户原始问题】
"${agent_v2.original_question}"

【第1段理解门】
${segment1}

【第二阶段方案骨架】
${spine}

【第三阶段收集证据(covered 议程)】
${agendaStr}

【任务】
只输出 A–F 双钥匙 JSON。不重算命盘。`;

  return { system, user };
}
