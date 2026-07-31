import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Mark-step mode:
 * - combined (default): one call = 意译+打标+情景白话 (foreign) or 打标+情景白话 (zh)
 * - split: foreign runs translate then mark as two calls (degradation when combined quality is poor)
 */
export type DeliveryMarkMode = "combined" | "split";

export type MarkEvidenceContext = {
  /** User's original question / dilemma — drives contextual gloss (3rd slot). */
  original_question?: string | null;
};

export type MarkEvidenceArgInput = {
  /** Narrative argument body (for situational gloss). */
  body: string;
  /** Raw 命理 evidence to mark. */
  evidence: string;
};

export function resolveDeliveryMarkMode(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkMode {
  return env.DELIVERY_MARK_MODE?.trim() === "split" ? "split" : "combined";
}

function questionBlock(ctx: MarkEvidenceContext | undefined, zh: boolean): string {
  const q = ctx?.original_question?.trim();
  if (!q) {
    return zh
      ? "（用户问题未注入 — 仍须按本条论点正文写贴题白话，勿抄词典定义。）"
      : "(No user question injected — still write situational plain from the argument body; do not copy dictionary gloss.)";
  }
  return zh ? `「${q}」` : `"${q}"`;
}

/**
 * Dedicated mark (+ foreign 意译) + **情景白话** step.
 * Markers must be three-slot: `⟦t:<slug>||<贴题白话>⟧` (soft left empty; system fills SSOT soft).
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  // Delivery path — NOT neutralBase. Model must write contextual 3rd slot.
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale);

  const localeRules = zh
    ? `# 中文站任务（打标 + 情景白话）
- 输入每条含 \`body\`(论点正文) + \`evidence\`(命理真词依据)。
- 你做两件事:
  ① **打标** — 把承重命理词换成标记(替换该词,不是叠在词后);
  ② **情景白话** — 每个标记写第三段贴题解释。
- 标记格式(硬): \`⟦t:<slug>||<贴题白话>⟧\`
  - 中间软译槽**留空**(系统填官方软译);
  - 第三段 = 结合【用户问题】+【本条 body】+【本句依据】的 1–2 句人话(这件事上意味着什么);
  - **禁止**抄词典通用定义(如「才华表达」「框架秩序」这类脱离处境的模板)。
- slug **必须**取自上表;表里没有的概念用白话留下,不猜 slug。
- 类称对照: 官星→\`zheng_guan\`(规范框架)或 \`qi_sha\`(偏官/杀星,高压淬炼); 财星→\`zheng_cai\`/\`pian_cai\`; 印星→\`zheng_yin\`/\`pian_yin\`; 伤官→\`shang_guan\`; 食神→\`shi_shen\`。
- 不要删句子、不要改推理结构;只替换该打标的词并写满第三段。`
    : `# Foreign locale task (意译 + mark + situational plain · one call)
- Each item has \`body\` (argument) + \`evidence\` (Chinese 命理 prose).
- You must: **understand → natural ${locale} paraphrase → mark load-bearing concepts → write situational 3rd slot**.
- Marker format (hard): \`⟦t:<slug>||<situational plain>⟧\`
  - Leave the soft (middle) slot empty; system fills official soft.
  - 3rd slot = 1–2 sentences tying this term to the **user question** + **this body** + this evidence sentence.
  - Do **not** paste dictionary glosses.
- Do **not** calque jargon (Officer Star / Day Master dumps). Write natural ${locale}.
- slug must come from the table; unknown concepts → plain language, no invented slug.
- Preserve causal completeness.`;

  const system = `# 你是谁
你是术语打标与情景解释专员。上游已写好依据;你**不重新推理**,只做转换 + 贴题白话。

# 用户问题(贴题白话必须扣住)
${questionBlock(ctx, zh)}

${localeRules}

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "转换后的依据(含三段位标记)" }, ... ] }\`
arguments 长度与输入一致。只输出 evidence 字段(body 不回写)。

${markingBlock}
`;

  const payload = JSON.stringify(segments, null, 2);
  const user = zh
    ? `为下列依据打标并写情景白话。用户问题见 system。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``
    : `Paraphrase into ${locale}, mark terms, and write situational 3rd-slot plain. User question is in system. Output JSON with all keys.\n\`\`\`json\n${payload}\n\`\`\``;
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

/** Mark-only + situational plain (after split translate, or zh fallback). */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale);
  const system = `# 你是谁
你是术语打标与情景解释专员。上游依据已是目标语言通顺句;你**打标 + 写贴题白话**,不另起意译、不改推理。

# 用户问题(贴题白话必须扣住)
${questionBlock(ctx, zh)}

# 铁律
- 格式: \`⟦t:<slug>||<贴题白话>⟧\`(中间软译留空)。
- 第三段结合用户问题 + 本条 body + 本句;禁止词典模板。
- slug **必须**取自上表;表外概念留白话,不猜 slug。
- 不要删句、不要缩短因果。

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "打标后的依据" }, ... ] }\`
arguments 长度与输入一致。

${markingBlock}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `为下列依据打标并写情景白话。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Pack argument tree for the mark step (body + evidence). */
export function pickMarkEvidenceInput(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: MarkEvidenceArgInput[] }> {
  const out: Record<string, { arguments: MarkEvidenceArgInput[] }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    if (args.length === 0) continue;
    out[k] = {
      arguments: args.map((a) => ({
        body: (a.body ?? "").trim(),
        evidence: (a.evidence ?? a.body ?? "").trim(),
      })),
    };
  }
  return out;
}

/** Evidence-only payload for translate-before-mark (split mode). */
export function pickMarkEvidenceOnly(
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
