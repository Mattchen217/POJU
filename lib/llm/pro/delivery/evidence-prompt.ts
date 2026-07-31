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
你是命理依据写作者。正文已写好;你只写「依据与推理」:
用 bazi_basis 真词向用户解释——【这段正文的依据是什么】,并把命理词讲清楚。

# 铁律(对齐底座 v2 · 打标软译 · 不删词)
- 依据 = 完整句子,有主语有结构。【禁止】写成"真词；真词；"清单或分号骨架。
- 依据 ≠ 第二遍正文。禁止复述行动建议/鸡汤感受。
- 当 bazi_basis 非空时,【必须】至少一枚 ⟦t:<slug>|⟧(竖线后留空,软译由系统填)。
- 只从本段 bazi_basis 选承重项;禁止整表搬入、禁止一句串一长排金字。
- 命理词【打标保留】,用金字解释它们如何支撑该段正文结论——不要省略主语(如「日主庚金为…」完整写,再打标)。
- 五行原字不打标。
- 输出严格 JSON:键与输入相同,值=依据字符串(完整句)。

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
