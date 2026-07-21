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
 *
 * ★ 主任务：narrative + evidence 的普通文字全部译成目标语（禁止 evidence 粘贴中文）。
 * ★ 标记是「岛」：唯一形态 `⟦t:<slug>|⟧`，系统会用代码校正标记，你专注把岛外文字译对。
 * ★ 零正例。
 */
export function buildTranslatePrompt(
  locale: string,
  payload: Record<string, unknown>,
): { system: string; user: string } {
  const p = resolveNativePersona(locale);
  const dictionary = buildMarkerDictionary(locale);
  const system = `${buildTranslatePersona(locale)}

# 你的任务（最重要）

把下面 JSON 里**每一段普通文字**都翻译成【${p.langLabel}】。
输入含 narrative（正文）与 evidence（依据）；若有 summary 短词也一并译。

## 硬规则 · 必须翻译的范围
- narrative 的每一段 → 全部译成${p.langLabel}
- evidence 的每一段 → **标记以外的每一个字**都译成${p.langLabel}
- 【绝对禁止】把 evidence 整段原样留成中文（这是最严重的错误；正文译了、依据不译 = 失败）
- 【绝对禁止】为了「保护标记」而放弃翻译依据——标记会由系统校正，你只管把依据周围的中文译掉

# 标记（句子里的「岛」——只保留，不翻译岛本身）

依据里会出现：\`⟦t:xxxx|⟧\`
- 形态：\`⟦t:\` + 代号 + \`|\` + \`⟧\`（竖线后永远空）
- 例：\`⟦t:yong_shen|⟧\`
- 岛里的代号用下面【代号含义表】在心里看懂，好让周围句子译得通顺
- 输出时：岛尽量原样留下；若你改动了岛，系统会自动改回，**不要因此把整句中文粘回去**

【不允许】在竖线后填字；【不允许】把岛删掉换成普通词。

# 代号含义表（只心里看懂，不要写进标记，不要输出本表）

${dictionary}

# 其他
- 译文要通顺、地道，像${p.language}母语者写的性格分析
- 保持 JSON 的 key 结构与输入完全一致，只翻译 value 字符串
- 五行原字 金木水火土可按目标语习惯写；\`⟦t:…|⟧\` 岛本身不要动
- 只输出同结构 JSON，不要 Markdown 代码块，不要说明

# 输出前自检
1. evidence 每一段，去掉所有 \`⟦t:…|⟧\` 之后，还剩中文吗？若还剩 → 继续译掉
2. narrative 是否已是${p.langLabel}？`;

  const payloadJson = JSON.stringify(payload, null, 2);
  const user = `请把下列 JSON 的 narrative 与 evidence（及 summary，若有）全部译成【${p.langLabel}】。\n依据里的 \`⟦t:xxxx|⟧\` 是岛，保留即可；岛以外的中文必须全部译成${p.langLabel}，禁止 evidence 粘贴中文。\n\`\`\`json\n${payloadJson}\n\`\`\``;
  return { system, user };
}
