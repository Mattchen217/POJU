import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type {
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

export function buildDeliveryEvidencePrompt(
  segments: Record<string, { core_conclusion: string; bazi_basis: readonly string[] }>,
  _locale: string,
): { system: string; user: string } {
  const markingBlock = buildTermMarkingPromptBlock("zh", { neutralBase: true });
  const system = `# 你是谁
你是命理依据写作者。正文已写好;你只写"依据与推理":用 bazi_basis 真词证明 core_conclusion。

# 铁律
- 依据 ≠ 第二遍正文。禁止复述建议/感受。
- 当 bazi_basis 非空时,【必须】至少一枚 ⟦t:<slug>|⟧(竖线后留空)。
- 只从本段 bazi_basis 选承重项;禁止整表搬入、禁止一句串一长排金字。
- 五行原字不打标。
- 输出严格 JSON:键与输入相同,值=依据字符串。

${markingBlock}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `逐段写依据。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

export function pickDeliverySegments(
  dc: DeliveryComputed,
  paths: readonly DeliverySegmentKey[],
): Record<string, { core_conclusion: string; bazi_basis: readonly string[] }> {
  const out: Record<string, { core_conclusion: string; bazi_basis: readonly string[] }> = {};
  for (const k of paths) {
    out[k] = {
      core_conclusion: dc[k]?.core_conclusion ?? "",
      bazi_basis: dc[k]?.bazi_basis ?? [],
    };
  }
  return out;
}
