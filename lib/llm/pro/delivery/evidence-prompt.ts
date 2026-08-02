import type {
  DeliveryArgument,
  DeliveryArgumentTree,
  DeliveryComputed,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Generate raw 命理 evidence per argument — NO ⟦t:⟧ marking, NO soft译.
 * True words must be wrapped in word slots `⟦w:真词⟧` for the code encoder (P1).
 */
export function buildDeliveryEvidencePrompt(
  segments: Record<
    string,
    { bazi_basis: readonly string[]; arguments: Array<{ body: string }> }
  >,
  _locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是命理依据写作者。正文论点已写好;你只为**每一个独立论点**写一条针对性依据。

# 本步唯一目标
- 看真算 bazi_basis + 该论点 body → 写**完整最短承重证据链**(推理求全、输出求精)。
- 【全用完整复合命理真词】:正印/偏印/七杀/正官/六合/三合/天乙贵人…——**禁止单字命理词**(禁:印/杀/合/官/财/冲/害/破 等单字)。
- 【类称禁令】禁止官星/财星/杀星/印星/比劫/食伤 等无唯一锚点的泛称;必须写成具体十神名(正官/七杀、正财/偏财…)。
- 【定界符】每个承重真词用 \`⟦w:真词⟧\` 包住(例:\`⟦w:天乙贵人⟧\`)。**禁止**写 \`⟦t:\` 标记。
- 【禁止】软译/合规改写/删词/「读懂」式串联白话。
- 【禁止】分号骨架("真词；真词；")——必须是完整推理句。
- 【禁止】复述行动建议/鸡汤;只解释「为什么这个论点在命理上成立」。
- 每个论点一条依据,一一对应 arguments 下标。

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "该论点的命理依据全文" }, ... ] }\`
arguments 长度必须与输入该段 arguments 相同;只填 evidence,可省略 body.
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `为每个论点写一条命理依据(裸真词用 ⟦w:…⟧ 包住、不打 ⟦t:⟧)。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Build evidence-task input: narrative argument bodies + segment bazi_basis. */
export function pickDeliveryEvidenceInput(
  dc: DeliveryComputed,
  narrative: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { bazi_basis: readonly string[]; arguments: Array<{ body: string }> }> {
  const out: Record<
    string,
    { bazi_basis: readonly string[]; arguments: Array<{ body: string }> }
  > = {};
  for (const k of paths) {
    const args = narrative[k] ?? [];
    const bodies =
      args.length > 0
        ? args.map((a) => ({ body: a.body }))
        : [{ body: dc[k]?.core_conclusion ?? "" }];
    out[k] = {
      bazi_basis: dc[k]?.bazi_basis ?? [],
      arguments: bodies,
    };
  }
  return out;
}

/** @deprecated Use pickDeliveryEvidenceInput — kept for scripts. */
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

export type { DeliveryArgument };
