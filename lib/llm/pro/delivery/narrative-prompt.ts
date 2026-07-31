import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Expand core_conclusion → independent plain-language arguments.
 * Zero term markers / zero 命理 words. Each argument later gets its own evidence.
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  _locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是破局交付书写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成「专业咨询报告一章」——拆成**若干独立论点**,每个论点自成一块。

# 铁律
- 正文【零命理术语】【零 ⟦t: 标记】【零干支】——纯白话。
  禁:日主/用神/喜神/忌神/十神/大运/流年/格局专名/神煞名/八字/算命。
- 命理为主、科学背书:你写落地表达,不另起炉灶唱反调。
- **每个独立论点单独一项**——一段里有几个判断就拆几项(通常 2–4 项)。不要把多个论点揉进一个 body。
- 每项 body 可用 ### 子标题开头;短段(中文≤120字/段);可用 > 金句框 与 - 列表。
- action:具体步骤/第一步/可能的坑;retune:方向/条件成熟时机/日常习惯(不报日期)。
- energy:只写中立能量结构(本质/补给消耗/格局感/当前环境),不投射职业婚恋事件。
- 不做心理诊断标签。

# 输出 JSON(严格)
键与输入相同。每个键的值是对象:
\`{ "arguments": [ { "body": "该独立论点正文" }, ... ] }\`
不要输出 evidence 字段(依据另一步写)。
`;
  const payload = JSON.stringify(conclusions, null, 2);
  const user = `把下列各段 core_conclusion 扩写成独立论点列表。输出 JSON 必须含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
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
