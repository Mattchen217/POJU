import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import {
  formatBreakthroughCoreForFinalize,
  formatSpineSliceForSegment,
} from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { POJU_IDENTITY } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";

export const DELIVERY_FINALIZE_TASK = `# 角色:交付书定稿师(盘面结构为依据·科学背书·一本小书·7内容段)

你拿到:
- 第二阶段【方案骨架】breakthrough_core 的【本段切片】(含 metaphysics_pack 真算料);
- 第三阶段【收集到的现实证据】。

# 任务:定稿产出指定段的双钥匙(不重新算命盘)
每段:
- core_conclusion: 白话结论(直答/论证 80-160字;实操/节奏/红线 100-180字;收尾 60-120字)。
  【铁律·语言】core_conclusion 与 bazi_basis 一律用【中文】写——它们是【内部语言】,多语言统一由下游翻译步处理。【严禁】按 locale 切换成英文/其他语言(即使 locale=en,也写中文)。
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
- science_action:可执行现代行动方向;metaphysics_action:方位/色彩/择时/贵人适配方向(用语见切片合规)。

# 段映射(只输出本次指定的键)
direct_answer ← situation_conclusion + key_crossroads + primary_path + desired_outcome;【结论头·首要】正面回答 original_question(该不该/是否/何时=**阶段趋势+条件成熟**,不报日期)+ 一句点明主路径「我最建议你走这条,因为你…」+ 一句为什么。只给结论,不铺论证(论证归 foundation)。
foundation ← energy_structure + element_scores + 四柱十神 + 神煞(闭集中性)+十二长生 + 当前能量周期;【论证 P1 的结论:你为什么会卡在这】按【论证需要】放底座料(哪几块支撑「为什么卡」就放哪几块,不为凑齐而凑、不放无关的),内部小标题分块(论证支点),收敛到「所以你卡在这」。仪表盘只用真分;禁逐月预测、禁生肖、禁吉凶;「养根」类主隐喻全报告只在此页用一次。
science_action ← primary_path(主路径)+ backup_path(辅路径)+ 收集证据;【主路径展开完整可执行方案(清单式、明天能上手),辅路径给退路+切换条件(较简)】;三层(归因→映射→动作);兜底:无主辅时读 modern_action_frames
metaphysics_action ← energy_retune_frame + metaphysics_pack(方位适配/高效时段/色彩锚定/行业属性方向/贵人方位特质);禁再讲一遍「先照顾好自己」空话
thirty_day ← rhythm_frame + 科学/环境调频动作按【周】排(4周);勿按天;表由 narrative 的 thirty_day_table 写(非代码拼)
risk_guard ← self_check 负向 + 忌神/阻力 → 这30天别做/警惕/身体报警
signals_close ← self_check 正向 + 一次性收尾「你已拿到完整打法」;【禁止回来追踪钩子】

# 跨页去重
「养根/小森林/宜守/向内」主隐喻全报告≤1次(只许落在 foundation);每页必须交付该页映射的新信息维。P1 与 P2 不重复:P1=结论头,P2=论证体。

# 合规
不报日期(时机=阶段+条件成熟);非心理诊断;direct_answer/foundation 禁止场景职业定性;玄学页禁吉凶/风水/属相。

# 输出:严格 JSON —— 必须带段键包裹(不要输出裸 dual-key)
示例(只产出 risk_guard 时):
{"risk_guard":{"core_conclusion":"...","bazi_basis":[...]}}
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
        : formatBreakthroughCoreForFinalize(breakthrough_core);
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
    : `只输出 7 段双钥匙 JSON(direct_answer…signals_close)。`;

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
