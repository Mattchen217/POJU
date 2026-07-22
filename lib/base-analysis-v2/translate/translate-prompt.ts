/** 母语者人设：国籍 + 母语（加新语言只加一行）。 */
export const NATIVE_PERSONA: Record<
  string,
  {
    nationality: string;
    language: string;
    langLabel: string;
    /** 对用户说话的第二人称（译文必须用这个，禁止第三人称）。 */
    youForms: string;
    /** 禁止出现的第三人称示例（反例用）。 */
    banThirdPerson: string;
  }
> = {
  en: {
    nationality: "美国",
    language: "英语",
    langLabel: "英文",
    youForms: "you / your / you're",
    banThirdPerson: "he / him / his / she / her / they（指这位用户）",
  },
  es: {
    nationality: "西班牙",
    language: "西班牙语",
    langLabel: "西班牙文",
    youForms: "tú / tu / te",
    banThirdPerson: "él / ella / su（指这位用户）",
  },
  de: {
    nationality: "德国",
    language: "德语",
    langLabel: "德文",
    youForms: "du / dein / dir",
    banThirdPerson: "er / sie / sein / ihr（指这位用户）",
  },
  fr: {
    nationality: "法国",
    language: "法语",
    langLabel: "法文",
    youForms: "tu / ton / ta / te",
    banThirdPerson: "il / elle / son / sa（指这位用户）",
  },
};

export function resolveNativePersona(locale: string): {
  nationality: string;
  language: string;
  langLabel: string;
  youForms: string;
  banThirdPerson: string;
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
 * ★ 入参已是「页面渲染态」：术语岛为 `[软译:释义]`，无 SSOT 大表、无真算数据。
 * ★ 第二人称对用户说话；先理解再意译；禁止字面直译（按类反例）。
 * ★ 只有半角 `[软译:释义]`（含冒号）是岛；【平替】已在入参侧拆掉。
 * ★ 零正例。
 */
export function buildTranslatePrompt(
  locale: string,
  payload: Record<string, unknown>,
): { system: string; user: string } {
  const p = resolveNativePersona(locale);
  const system = `${buildTranslatePersona(locale)}

# 你的任务（最重要）

下面 JSON 是**唯一**待译材料（已由代码整理成读者可读形态）：
- 术语位置：半角 \`[软译:一句释义]\`（方便你理解该概念）
- 【没有】代号大表、【没有】真算底稿、【没有】要你查询的词典

请把每一段**岛外文字**意译成地道的【${p.langLabel}】。
输入含 narrative（正文）与 evidence（依据）；若有 summary 短词也一并译。

# 人称（硬 · 最高优先级之一）

中文原文里的「你」= 正在读报告的这位用户。
译文必须用第二人称对用户说话：\`${p.youForms}\`。
【绝对禁止】改成第三人称旁观：\`${p.banThirdPerson}\`。
例如英文里出现 His energy / he tends to → 一律改为 Your energy / you tend to。
narrative、evidence、summary 全部适用。

# 翻译方法（硬 · 缺一不可）

1. **先通读整段**，搞清它在判断什么、论证什么，再下笔。
2. **意译，绝不字面直译。** 合格译文 = 母语者读着自然、专业；不合格 = 教材对照表、修仙小说腔、逐字搬汉字。
3. 你懂命理，读得懂原文连接说法——但输出时只许用${p.language}把**意思**说清楚。
4. 译文读起来应像${p.language}母语者写的性格/能量分析，**不像**从中文抠出来的对照翻译。

# 字面直译 = 不合格（按类禁止 · 反例钉失败模式）

下列是**失败类型**。每类只举几条；**不止这些**——凡属同类教材腔/搬字，一律不合格，按段意用自然${p.langLabel}重说。

## A. 行话连接类（中文连接词按字搬进外语）
- 帮身 → helps the body
- 透出 → seeps out / leaks out
- 有根气 → has root qi
- 制杀 → controls the kill
- 半合水局 → half-combines into a water bureau
- 调候 → regulates the climate
- 当令 / 通根 / 泄身 → in season / through-root / leaks the body

## B. 干支教材腔 / 生肖硬翻类（整类禁）
- 天干 / 地支 → Heavenly Stems / Earthly Branches
- 巳火 / 寅木 / 辰土 → Si Fire / Yin Wood / Chen Earth
- 未月 / 申金 → Wei month / Shen Metal / Shen branch
- 申金 → Monkey metal（生肖硬翻，最糟）
- 子水 / 午火 → Rat water / Horse fire（同类生肖硬翻）
- 长生 / 帝旺 / 入墓 → Birth / Imperial Prosperity / Entering the Tomb
- 魁罡日 → Kui Gang day（音译堆砌、无解释）

岛外若出现「申金、巳火、未月」这类干支+五行/月份：
用自然母语写能量意思（如 metal energy in the chart / fire-season month），
【禁止】拼音+元素、【禁止】生肖动物名、【禁止】Shen branch 这类半译。

## C. 结构术语硬翻类
- 日柱 / 月令 / 年干 → Day Pillar / Month Decree / Year Stem（教材目录腔）
- 命局 / 原局 → natal bureau / original bureau
- 大运 / 流年 → Great Luck / flowing year（字面）

## D. 把岛内中文或平替原样留下
- 译文里残留汉字
- 留下 \`【内在本色】\` 或把中文改包成 \`[能量结构]\` 却不译

看到以上任一气味：停 → 回到整段意思 → 用自然${p.langLabel}重写岛外文字。

# 方括号岛（硬 · 唯一勿译形态）

**只有**这种算岛，必须原样保留：
\`[软译:一句释义]\`
——半角 \`[\` \`]\`，**中间必须有冒号 \`:\`**。

- 位置、个数、括号内每一个字都原样保留——不翻译、不删、不改、不把释义抄进正文
- 译文写在岛的**两边**；岛是不可拆占位符
- 【不允许】把岛改成普通词；【不允许】为保护岛而整段粘贴中文

**不是岛（必须意译掉）：**
- 全角 \`【…】\`（若仍出现）→ 译成自然母语，去掉括号与中文
- 无冒号的 \`[中文]\` → 当普通中文译掉
- 金木水火土 / 五行 → 按目标语习惯写（Wood, Fire… / Five Elements 或 Wuxing），不要中文、不要硬包括号

# 必须翻译的范围
- narrative 每一段 → 全部意译成${p.langLabel}（第二人称）
- evidence 每一段 → **软译岛以外每一个字**都意译成${p.langLabel}（第二人称）
- summary（若有）→ 全部意译（第二人称）
- 【绝对禁止】evidence 整段留中文；【绝对禁止】译文残留汉字；【绝对禁止】第三人称指用户

# 输出格式
- 保持 JSON key 结构与输入完全一致，只改 value 字符串
- 只输出同结构 JSON，不要 Markdown 代码块，不要说明

# 输出前自检（必须过）
1. 全文是否用第二人称（\`${p.youForms}\`）对用户说话？有没有 \`${p.banThirdPerson}\`？有 → 改成第二人称
2. 去掉所有 \`[软译:释义]\` 后，还剩汉字或【】吗？有 → 译掉
3. 是否出现 Monkey metal / Si Fire / Shen branch / Heavenly Stems 或 A–D 类搬字？有 → 按段意重写
4. 软译岛个数是否与输入一致、内容未改？
5. 读一句：母语者会不会觉得像对照翻译？会 → 再意译一遍`;

  const payloadJson = JSON.stringify(payload, null, 2);
  const user = `请把下列 JSON 的 narrative 与 evidence（及 summary，若有）意译成【${p.langLabel}】。
硬规则：第二人称对用户说话（${p.youForms}），禁止第三人称（${p.banThirdPerson}）；先理解整段再意译；禁止字面直译、干支拼音硬贴、生肖硬翻（Monkey metal / Si Fire / Shen branch）。
只有半角 \`[软译:释义]\`（必须含冒号）是岛，原样保留；岛外中文与任何【】平替必须全部译成${p.langLabel}；禁止 evidence 粘贴中文、禁止译文留汉字。
\`\`\`json
${payloadJson}
\`\`\``;
  return { system, user };
}
