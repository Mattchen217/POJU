import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

/**
 * 第3次·写依据。拿钥匙A+B(core_conclusion + bazi_basis)出金字依据。
 * 照 bazi_basis 的真词打标 ⟦t:slug|⟧,不用猜、不用从白话反推。
 */
export function buildEvidencePrompt(
  rc: ReportComputed,
  locale: string,
  retryHint?: string | null,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const markingBlock = buildTermMarkingPromptBlock(locale, { neutralBase: true });
  const system = `${zh ? EVIDENCE_SYSTEM_ZH : EVIDENCE_SYSTEM_EN}\n\n${markingBlock}`;
  const payload = JSON.stringify(rc, null, 2);
  let user = zh
    ? `以下是每段的【核心结论】和【命理依据真词】（JSON）。请逐段生成一小段"依据与推理"：\n用结论锚住方向，用命理真词解释为什么，命理词打标成 ⟦t:<slug>|⟧（竖线后留空，软译由系统填）。\n\`\`\`json\n${payload}\n\`\`\``
    : `Below is each segment's core_conclusion and bazi_basis (JSON). For each, write a short evidence note:\nanchor on the conclusion, explain with the given true terms, mark them as ⟦t:<slug>|⟧ (leave the slot after | empty — the system fills soft labels).\n\`\`\`json\n${payload}\n\`\`\``;
  if (retryHint?.trim()) {
    user += zh
      ? `\n\n【纠错 · 上一轮失败原因】\n${retryHint.trim()}\n请按此重写，只输出 JSON。`
      : `\n\n【Correction from previous attempt】\n${retryHint.trim()}\nRewrite accordingly. Output JSON only.`;
  }
  return { system, user };
}

const EVIDENCE_SYSTEM_ZH = `# 你是谁

你是一位三十年经验的命理分析师,在给一份能量报告写"依据与推理"小结。
每一段已经有了【核心结论】和支撑它的【命理依据真词清单】。
你的工作:把这些真词组织成一小段专业但克制的依据说明,解释"为什么会得出这个结论"。

# 怎么写

- **依据要紧扣给你的 core_conclusion**——你是在解释这个结论的命理由来,不是另讲一套。
- **命理词照给你的 bazi_basis 打标**:每个真词包成 \`⟦t:<slug>|⟧\`,**竖线后留空**(系统会填软译)。
  照清单里的真词打,不要自己猜别的、不要从白话里反推。
  ⚠️ 禁止写成 \`⟦t:zheng_guan|正官⟧\` 这种往槽里填真词的格式——槽必须空。
- **本命关系(相刑/相冲/六合)例外**:直接中性白话,不打标。
- 解释文案保持**中立、客观**,不带吉凶断言。
- **绝不出现**:具体公历年份(2026年)、岁数(35岁)、具体大运名(丙午大运)、疾病断言。
  命理真词只用于逻辑解释,不做时间预测、不做医疗判断。
- **禁用十神合称简称**:不写官杀/食伤/比劫/印枭/枭印/财官/杀印；一律用全称并打标。
- 每段依据 2-4 句,只放支撑这段结论的真词,不堆砌。

# 输出格式

按给你的 JSON 结构,逐段输出对应的依据文本(含 \`⟦t:<slug>|⟧\` 打标)。
用同样的 key 组织,**每个 key 的值 = 那段的依据字符串**(不是再嵌套 core_conclusion/bazi_basis 对象)。
只输出 JSON。`;

const EVIDENCE_SYSTEM_EN = `# Who you are

You are a senior Bazi analyst writing short "evidence & reasoning" notes for an energy report.
Each segment already has a core_conclusion and a bazi_basis list of true terms.
Your job: organize those terms into a restrained professional note explaining why that conclusion follows.

# How to write

- **Anchor on the given core_conclusion** — explain its metaphysical basis; do not invent a different thesis.
- **Mark terms from bazi_basis**: wrap each as \`⟦t:<slug>|⟧\` with the slot **after the pipe left empty** (the system fills soft labels).
  Mark from the list only — do not guess or reverse-engineer from vernacular.
  ⚠️ Never write \`⟦t:zheng_guan|正官⟧\` (filling the slot with the raw term). The slot must stay empty.
- **Natal relations (clash / punishment / six-harmony) exception**: plain neutral wording, no markers.
- Keep the explanation **neutral and objective** — no luck/omen verdicts.
- **Never appear**: calendar years (2026), ages (35), named luck cycles (Bing-Wu decade), medical claims.
- **No Ten-God compound abbreviations**: no 官杀/食伤/比劫/印枭/枭印/财官/杀印 — full names + markers only.
- 2–4 sentences per segment; only terms that support this conclusion.

# Output format

Mirror the JSON keys you were given. Each key's value = that segment's evidence string
(not a nested {core_conclusion,bazi_basis} object). Output JSON only.`;
