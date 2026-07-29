import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Expand core_conclusion → plain body. No term markers.
 */
export function buildDeliveryNarrativePrompt(
  conclusions: Record<string, string>,
  _locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是破局交付写作者。有人已定稿每段的白话结论(core_conclusion)。
你的工作:把结论扩写成通顺、可执行、温暖但不鸡汤的正文。

# 铁律
- 正文【零命理术语】【零 ⟦t: 标记】——纯白话。
- 命理为主、科学背书:你写的是落地表达,不另起炉灶唱反调。
- C段可写具体步骤;D段可写具体调频习惯;都不报具体日期。
- 不做心理诊断标签。
- 输出严格 JSON:键与输入相同(A/B/C…),值=该段正文字符串。
`;
  const payload = JSON.stringify(conclusions, null, 2);
  const user = `把下列各段 core_conclusion 扩写成正文。输出 JSON 必须含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
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
