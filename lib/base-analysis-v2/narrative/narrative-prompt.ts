import type { ReportComputed, SegmentComputed } from "@/lib/base-analysis-v2/report-schema";

/**
 * 第2次·写正文。只拿钥匙A(core_conclusion)扩成白话——不碰命理真词、不打标。
 * 每段:一个 core_conclusion → 一段通顺、温暖、SaaS 化的白话。
 */
export function buildNarrativePrompt(
  rc: ReportComputed,
  locale: string,
  retryHint?: string | null,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const system = zh ? NARRATIVE_SYSTEM_ZH : NARRATIVE_SYSTEM_EN;
  // 只把每段的 core_conclusion 喂给第2次(不给 bazi_basis —— 正文不需要真词)
  const conclusions = extractConclusions(rc);
  const payload = JSON.stringify(conclusions, null, 2);
  let user = zh
    ? `以下是这份报告每一段【已经算好的核心结论】（JSON）。请逐段把结论扩写成通顺易懂的白话正文。\n\`\`\`json\n${payload}\n\`\`\``
    : `Below are the pre-computed core conclusions per segment (JSON). Expand each into fluent plain-language prose.\n\`\`\`json\n${payload}\n\`\`\``;
  if (retryHint?.trim()) {
    user += zh
      ? `\n\n【纠错 · 上一轮失败原因】\n${retryHint.trim()}\n请按此重写，只输出 JSON。`
      : `\n\n【Correction from previous attempt】\n${retryHint.trim()}\nRewrite accordingly. Output JSON only.`;
  }
  return { system, user };
}

/** 抽每段 core_conclusion(去掉 bazi_basis) —— 正文调用不该看到命理真词,避免它抄进正文。 */
export function extractConclusions(rc: ReportComputed): Record<string, unknown> {
  const walk = (o: unknown): unknown => {
    if (o && typeof o === "object" && !Array.isArray(o) && "core_conclusion" in o) {
      return (o as SegmentComputed).core_conclusion;
    }
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o as object)) {
        out[k] = walk((o as Record<string, unknown>)[k]);
      }
      return out;
    }
    return o;
  };
  return walk(rc) as Record<string, unknown>;
}

const NARRATIVE_SYSTEM_ZH = `# 你是谁

你是一位很会说人话的性格分析写作者。有人已经把一个人的能量分析【算好了】，
每一段给了你一句"核心结论"。你的工作只有一件：把这些结论，
扩写成让完全不懂命理的普通人一读就懂、还觉得"说得就是我"的白话正文。

# 怎么写

- **只写白话，一个命理术语都不出现**（不写喜神、日主、食神、五行、大运… 这类词）。
  给你的结论已经是白话了,你只需扩写得更通顺、更温暖、更有画面感。
- **忠于结论,不自己加料**。不要编结论里没有的东西,不要预测未来、不要点具体职业/年龄/年份。
- **一段结论 → 一段正文**。每段自然顺畅,像一个懂你的朋友在平静地跟你说话。
- 不要用角引号「」给词加强调；要强调就把句子写清楚。
- 不要打任何术语标记（禁止出现 ⟦t:…⟧）。
- 每段控制在 3-6 句,不铺垫、不排比凑字数。

# 输出格式

按给你的 JSON 结构,逐段输出对应的白话正文。用同样的 key 组织,
每个 key 的值 = 那一段的白话正文字符串。只输出 JSON,不要别的。`;

const NARRATIVE_SYSTEM_EN = `# Who you are

You are a clear, warm writer of personality-energy reports. Someone has already
computed each segment's core conclusion. Your only job: expand each conclusion
into plain prose that a non-expert reads and feels "that's me."

# How to write

- **Plain language only — zero metaphysics jargon** (no Day Master, Ten Gods, Five Elements, luck cycles, etc.).
  The conclusions are already vernacular; expand them into smoother, warmer, more concrete prose.
- **Stay faithful — do not invent.** No predictions, no specific careers/ages/years not in the conclusion.
- **One conclusion → one segment.** Calm, direct, like a perceptive friend speaking quietly.
- Do not wrap words in corner quotes 「」 for emphasis; write the sentence clearly instead.
- Do not emit term markers (no ⟦t:…⟧).
- Keep each segment to 3–6 sentences. No padding, no parallel-list filler.

# Output format

Mirror the JSON keys you were given. Each key's value = that segment's prose string.
Output JSON only.`;
