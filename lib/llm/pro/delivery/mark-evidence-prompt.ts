import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Mark-step mode:
 * - combined (default): one call = 意译+打标 (foreign) or 打标-only (zh)
 * - split: foreign runs translate then mark as two calls (degradation when combined quality is poor)
 */
export type DeliveryMarkMode = "combined" | "split";

export function resolveDeliveryMarkMode(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkMode {
  return env.DELIVERY_MARK_MODE?.trim() === "split" ? "split" : "combined";
}

/**
 * Dedicated mark (+ foreign 意译) step — default: one call does both.
 * Set DELIVERY_MARK_MODE=split to degrade foreign into translate → mark.
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale, { neutralBase: true });

  const localeRules = zh
    ? `# 中文站任务
- 输入是通顺的命理真词依据。
- 你只做一件事:**打标** —— 把承重命理词换成 \`⟦t:<slug>|⟧\`(竖线后留空)。
- **保留命理真词语义**,不要翻译成白话软译塞进句子(软译由系统填槽)。
- 不要删句子、不要改推理结构;只替换该打标的词为标记。
- slug **必须**取自上表(全 SSOT);表里没有的概念用白话留下,不猜 slug。
- 常见易漏:官星→\`zheng_guan\` 或 \`pian_guan\`(按上下文)、正印→\`zheng_yin\`、伤官→\`shang_guan\`、天德贵人→\`tian_de\`、天乙贵人等神煞按表。`
    : `# 外文站任务(意译 + 打标 · 一次完成)
- 输入是中文命理真词依据。
- 你要:**先理解命理逻辑 → 用地道目标语言意译整句 → 再打标**。
- 【禁止】直译命理词(如 Officer Star / Day Master 生硬堆砌)。应写成读者能懂的自然外文,承重点用 \`⟦t:<slug>|⟧\` 标记。
- 标记格式 \`⟦t:<slug>|⟧\`(竖线后留空);slug 必须取自上表。
- 保持与原文同等的推理完整度;不要省略因果。
- 目标语言: ${locale}`;

  const system = `# 你是谁
你是术语打标${zh ? "" : "与意译"}专员。上游已写好依据;你**不重新推理**,只做转换。

${localeRules}

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "转换后的依据" }, ... ] }\`
arguments 长度与输入一致。

${markingBlock}
`;

  const payload = JSON.stringify(segments, null, 2);
  const user = zh
    ? `为下列依据打标。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``
    : `将下列中文命理依据意译为 ${locale} 并打标。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Foreign-only: 意译命理依据 → 地道外文，禁止打标。 */
export function buildTranslateEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是命理依据意译专员。上游是中文命理真词依据;你只做**理解后的地道意译**,不打标、不改推理。

# 铁律
- 目标语言: ${locale}
- 【禁止】直译命理词(Officer Star / Day Master 等生硬堆砌)。
- 【禁止】输出 ⟦t: 标记。
- 保留完整因果与主语;句子通顺自然。

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "意译后的依据" }, ... ] }\`
arguments 长度与输入一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `将下列中文命理依据意译为 ${locale}(不打标)。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Mark-only (no 意译) — used after split translate, or for zh. */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const markingBlock = buildTermMarkingPromptBlock(
    locale.startsWith("zh") ? "zh" : locale,
    { neutralBase: true },
  );
  const system = `# 你是谁
你是术语打标专员。上游依据已是目标语言通顺句;你**只打标**,不改写推理、不另起意译。

# 铁律
- 把承重命理概念换成 \`⟦t:<slug>|⟧\`(竖线后留空)。
- slug **必须**取自上表;表外概念留白话,不猜 slug。
- 不要删句、不要缩短因果。

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "打标后的依据" }, ... ] }\`
arguments 长度与输入一致。

${markingBlock}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `为下列依据打标。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Pack raw evidence tree for the mark step (evidence-only payloads). */
export function pickMarkEvidenceInput(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: Array<{ evidence: string }> }> {
  const out: Record<string, { arguments: Array<{ evidence: string }> }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    if (args.length === 0) continue;
    out[k] = {
      arguments: args.map((a) => ({
        evidence: (a.evidence ?? a.body ?? "").trim(),
      })),
    };
  }
  return out;
}
