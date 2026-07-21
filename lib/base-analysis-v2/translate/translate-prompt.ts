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
 *
 * ★ 小学生版 + 零正例：只写步骤与【不允许】，不给「该翻成什么样」的对照示范。
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

# 文本里的标记怎么处理（一步一步照做）

文本里会出现这样的标记：⟦t:xxxx⟧
它是一对特殊括号 ⟦ ⟧ 包住一个代号（比如 ⟦t:yong_shen⟧ 里的代号是 yong_shen）。
这个标记是一个整体，代表一个特定的概念。

## 第一步：在心里看懂这个标记是什么意思
- 下面有一张【代号含义表】。按标记里的代号，去表里找到它，就知道它是什么概念、什么意思。
- 这一步只在你【心里】进行——看懂是为了让你翻对标记周围的句子。

## 第二步：翻译标记【周围】的文字
- 你已经在心里看懂这个标记的意思了。翻译周围文字时，就把这个标记当作它代表的那个概念，
  和周围文字连起来，翻译成通顺自然的目标语言。
- 【不允许】因为标记是代号看不懂，就把周围文字生硬地、孤立地翻。
- 【不允许】把标记当空气跳过——它是句子的一部分，句子要围绕它读得通。

## 第三步：标记本身——保持 ⟦t:xxxx⟧ 原样，竖线后永远是空的
- 标记在译文里必须仍然是 ⟦t:xxxx⟧ 这个样子：括号 ⟦ ⟧ 不动，里面就是那个代号，别的什么都没有。
- 若原文标记带竖线（比如 ⟦t:xxxx|⟧），译文里竖线可以保留，但竖线【后面永远不许有任何文字】。
- 【最重要·绝对禁止】：不许在标记里加任何东西。
  标记里【不许】出现概念的名字，【不许】出现概念的解释，【不许】出现竖线后面跟着文字。
  你在第一步从含义表里看到的名字和解释，是给你【心里理解】用的，
  【绝对不许】把它们写进标记里。标记永远保持代号，后面什么都不加。
- 【不允许】翻译标记里的代号，【不允许】改动、删除标记，【不允许】把 ⟦ ⟧ 换成别的括号。

## 第四步：翻完检查
- 译文里每个标记，是不是都还是 ⟦t:xxxx⟧ 这样干净的样子？
- 有没有哪个标记里被你加进了名字、解释、或竖线后的文字？有就删掉，只留代号。
- 标记的个数，和原文一样多吗？

# 代号含义表（只用来【心里看懂】标记，绝对不要把表里的内容写进标记，也不要翻译或输出这张表）

表里给的是命理真词（用神/身弱/七杀…），你作为命理专家一看就懂。看懂是为了翻对周围文字，
但绝不许把「用神」这些字写进标记——标记永远保持代号 ⟦t:xxxx⟧。

${dictionary}

# 其他规则

- 翻译要通顺、地道、口语化，像${p.language}母语者写的性格分析，不要翻译腔。
- narrative 正文里【没有标记】（纯白话），正常翻译即可。
- evidence 依据里含标记——按上面四步处理；五行原字 金木水火土可保留或按目标语习惯写，但已有的 \`⟦t:…⟧\` 绝不动。
- 保持 JSON 结构与 key 完全一致，只翻译 value（字符串）。
- 若输入含 summary（keywords / current_theme / dos / donts），把这些短词也译成${p.langLabel}。

# 输出格式

只输出与输入同结构的 JSON。不要 Markdown 代码块，不要额外说明。`;

  const payloadJson = JSON.stringify(payload, null, 2);
  let user = `请将下列中文报告片段翻译成【${p.langLabel}】。严格按「文本里的标记怎么处理」四步做：标记保持干净代号，竖线后不许填字。\n\`\`\`json\n${payloadJson}\n\`\`\``;
  if (retryHint?.trim()) {
    user += `\n\n【纠错 · 上一轮失败原因】\n${retryHint.trim()}\n请按此重译，只输出 JSON。`;
  }
  return { system, user };
}
