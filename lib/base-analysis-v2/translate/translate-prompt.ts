import { buildMarkerDictionary } from "@/lib/base-analysis-v2/translate/marker-dictionary";

/** 母语者人设：国籍 + 母语（加新语言只加一行）。 */
export const NATIVE_PERSONA: Record<
  string,
  { nationality: string; language: string; langLabel: string }
> = {
  en: { nationality: "美国", language: "英语", langLabel: "英文" },
  es: { nationality: "西班牙", language: "西班牙语", langLabel: "西班牙文" },
  de: { nationality: "德国", language: "德语", langLabel: "德文" },
  fr: { nationality: "法国", language: "法语", langLabel: "法文" },
};

export function resolveNativePersona(locale: string): {
  nationality: string;
  language: string;
  langLabel: string;
} {
  const lang = locale.toLowerCase().slice(0, 2);
  return NATIVE_PERSONA[lang] ?? NATIVE_PERSONA.en!;
}

/** 按 locale 生成母语者人设（命理体系写全）。 */
export function buildTranslatePersona(locale: string): string {
  const p = resolveNativePersona(locale);
  return `你是一位${p.nationality}人,你的母语是${p.language},所以你精通${p.language},能写出最地道、最自然、母语者读起来毫无翻译腔的${p.language}文字。同时,你又精通中文,对中国传统的易经、八字、五行、十神、神煞、天干地支、格局、用神喜忌、大运流年等命理体系都有深入理解。你既能读懂中文命理报告的深层含义,又能把它翻译成让${p.language}母语者觉得亲切、自然、专业的文字。`;
}

export type TranslateSummaryInput = {
  keywords: readonly string[];
  current_theme: string;
  dos: readonly string[];
  donts: readonly string[];
};

/**
 * 第4次翻译 prompt。
 * payload 结构：
 *   { narrative: {...}, evidence: {...}, summary?: {...} }
 * summary 仅 Task4（retune_card）携带。
 */
export function buildTranslatePrompt(
  locale: string,
  payload: Record<string, unknown>,
  retryHint?: string | null,
): { system: string; user: string } {
  const p = resolveNativePersona(locale);
  const dictionary = buildMarkerDictionary(locale);
  const system = `${buildTranslatePersona(locale)}

# 你的任务

把下面的中文能量报告片段翻译成【${p.langLabel}】。输入 JSON 含 narrative（正文）与 evidence（依据）；若有 summary 短词也一并译。

# 翻译规则（最高优先级）

1. 【标记原样保留】:文本里的 \`⟦t:…⟧\` 标记一律【原封不动保留】——不翻译、不改动、不删除、不拆开。
   标记的多语言显示由系统渲染,你不用管。

2. 【理解标记语义再翻译周围文字】:虽然标记原样保留,但你翻译标记【周围的中文】时,
   必须理解这个标记代表什么(见下方标记词典),才能把整句翻通顺、翻准确。
   例:"⟦t:weak_self|⟧的人容易被消耗" —— 理解 ⟦t:weak_self|⟧ 是"身弱/weak self",
   翻成 "A person with ⟦t:weak_self|⟧ tends to get depleted"（语言按目标语调整）。
   【绝不能】因为不懂标记就把周围文字孤立地翻错。

3. 【标记词典】(理解用,不要翻译这张表):
${dictionary}

4. 翻译要通顺、地道、口语化,像${p.language}母语者写的性格分析,不要翻译腔。
5. narrative 正文里【没有标记】(纯白话),正常翻译即可。
6. evidence 依据里含标记——保留标记,只译周围说明文字;五行原字 金木水火土可保留或按目标语习惯写 Metal/Wood 等,但已有的 \`⟦t:…⟧\` 绝不动。
7. 保持 JSON 结构与 key 完全一致,只翻译 value（字符串）。
8. 若输入含 summary（keywords / current_theme / dos / donts）,把这些短词也译成${p.langLabel}。

# 输出格式

只输出与输入同结构的 JSON。不要 Markdown 代码块,不要额外说明。`;

  const payloadJson = JSON.stringify(payload, null, 2);
  let user = `请将下列中文报告片段翻译成【${p.langLabel}】。严格保留所有 \`⟦t:…⟧\` 标记原样。\n\`\`\`json\n${payloadJson}\n\`\`\``;
  if (retryHint?.trim()) {
    user += `\n\n【纠错 · 上一轮失败原因】\n${retryHint.trim()}\n请按此重译，只输出 JSON。`;
  }
  return { system, user };
}
