import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Expand core_conclusion → thick plain body. No term markers / no 命理 words.
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  _locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是破局交付书写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成「专业咨询报告一章」厚度的正文——展示推导,非只给结论。

# 铁律
- 正文【零命理术语】【零 ⟦t: 标记】【零干支】——纯白话。
  禁:日主/用神/喜神/忌神/十神/大运/流年/格局专名/神煞名/八字/算命。
- 命理为主、科学背书:你写落地表达,不另起炉灶唱反调。
- 每段用 ### 子标题拆开;短段(中文≤120字/段);可用 > 金句框 与 - 列表。
- action:具体步骤/第一步/可能的坑;retune:方向/条件成熟时机/日常习惯(不报日期)。
- energy:只写中立能量结构(本质/补给消耗/格局感/当前环境),不投射职业婚恋事件。
- 不做心理诊断标签。
- 输出严格 JSON:键与输入相同,值=该段正文字符串(可含 ### / > / -)。
`;
  const payload = JSON.stringify(conclusions, null, 2);
  const user = `把下列各段 core_conclusion 扩写成厚正文。输出 JSON 必须含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

export function pickDeliveryConclusions(
  dc: DeliveryComputed,
  paths: readonly DeliverySegmentKey[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of paths) {
    out[k] = dc[k]?.core_conclusion ?? "";
  }
  return out;
}

export function describeDeliveryPaths(paths: readonly DeliverySegmentKey[]): string {
  return paths.map((k) => DELIVERY_SECTION_HEADINGS[k].zh).join("、");
}
