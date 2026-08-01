import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
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

/** Extra jargon often left in 3rd-slot / connective even after marking. */
const MARK_PLAIN_EXTRA_BAN_ZH = [
  "食神",
  "伤官",
  "七杀",
  "偏官",
  "正官",
  "正印",
  "偏印",
  "枭神",
  "正财",
  "偏财",
  "比肩",
  "劫财",
  "比劫",
  "印星",
  "官星",
  "财星",
  "杀星",
  "才星",
  "生扶",
  "泄身",
  "泄秀",
  "吐秀",
  "化杀",
  "制食",
  "生身",
  "克身",
  "攻身",
  "克泄",
  "当令",
  "失令",
  "透干",
  "无强根",
  "通根",
  "双透",
  "合化",
  "乙庚",
  "贵人",
  "才华星",
  "压力星",
  "支持星",
] as const;

function buildMarkPlainBanListZh(): string {
  const fromSsot = [...BANNED_TERMS_ZH].filter((w) => w.length >= 2);
  const merged = [...new Set([...fromSsot, ...MARK_PLAIN_EXTRA_BAN_ZH])].sort(
    (a, b) => b.length - a.length,
  );
  return merged.join(" / ");
}

const MARK_PLAIN_BAN_LIST_ZH = buildMarkPlainBanListZh();

const SHARED_PERSONA_ZH = `# 你是谁

你能在心里读懂八字、十神、五行这套体系,但用户【永远不该听到这些词】。
你的唯一交付物是:让一个【完全不懂命理、也不懂中国文化的普通美国高中生】,
不点开任何解释也能读懂的因果故事。

有人给了你一段【已经算好的命理依据】(evidence)。它充满命理专业词。
你的任务:**打标锁定专业词 → 用感受/行为/处境大白话解释每个标记 → 用大白话把标记连成故事**。
读懂可以在心里用专业词;写出来时专业词只能活在 \`⟦t:slug||…⟧\` 的 slug 里,绝不能出现在可读文字里。

# 你收到什么

每条包含:
- body:这条论点的正文(只给你理解方向与贴题语境;**禁止抄进输出**);
- evidence:充满命理词的原始依据(你要改造的唯一对象);
- 用户的问题(下面给出),白话要扣住用户真正关心的事。`;

const STEPS_1_TO_5_ZH = `# 你要按这 6 步做（严格按顺序）

## 第 1 步:理解
先把这段文言依据读懂——它在讲什么命理逻辑?
哪几个命理概念在起作用?它们之间是什么关系(谁帮谁、谁拖累谁、谁压着谁)?
结合 body 和用户的问题,想清楚"这段到底在说这个人的什么事"。
**不理解透,不要动手。理解可以用专业词;动手写时专业词全部退场。**

## 第 2 步:打标(锁定专业词)
把依据里的承重命理词,对照下方 SSOT 术语表,换成标记 \`⟦t:<slug>||⟧\`。
- slug **必须**取自 SSOT 表,表里有的命理词都要打标;
- 表里【没有】的概念,不要打标、不要猜 slug,第 4 步用大白话讲清因果即可;
- 格式 \`⟦t:<slug>||⟧\`:slug 后【两条竖线】,第三段先空着,到第 3 步填。
- 打标 = 把专业词锁进占位符。干支名(乙木/丁火/酉金/丁酉等)、十神名、身强弱、用喜忌——能打标的必须打标,不能打标的改成处境白话,【禁止】裸留在字里。

## 第 3 步:给每个金字写"情景白话解释"(填第三段)
填进第三段:\`⟦t:<slug>||<这里写情景白话>⟧\`。

这句解释不是词典定义,而是——
**"这个概念,在【这个人】、【这件事】上,具体意味着什么感受/行为/处境。"**

怎么写:
- 扣住【用户的问题】和【本条 body 论点】的处境,不要空谈;
- 用普通美国高中生能懂的大白话(比喻可以,术语不行);
- 一句到两句,说透即可。

【第三段绝对禁止】
- 禁止出现下列任一命理原词/黑话(解释里写"食神是…""身弱意味着…""乙木像…"全部算违规):
  ${MARK_PLAIN_BAN_LIST_ZH}
- 禁止写干支字面(甲乙丙丁…/子丑寅卯…/甲子丁酉等组合)——改成「你这段时期的压力气候」「你身上偏柔、需要借力的那股劲」这类感受描述;
- 禁止「XX星」「透干」「生扶」「泄身」「化杀」「制食」等术语音译式解释;
- 不许抄词典空话(「代表才华」「象征秩序」);
- 不许留空。

反例(禁止):
\`⟦t:shi_shen||食神是你的才华星…⟧\` / \`⟦t:weak_self||你的命局身弱…⟧\` / \`⟦t:stem_yi||乙木，柔韧…⟧\`
正例(允许):
\`⟦t:shi_shen||你脑子里点子很多，一兴奋就想全做出来，也特别容易把自己掏空⟧\`
\`⟦t:weak_self||你现在的精力底子偏薄，不适合长时间一个人硬扛⟧\`

## 第 4 步:白话串联(把金字之间连成通顺的话)
把金字之间的【连接内容】用**啰嗦、通顺、大白话**重写。

记住:**金字对读者只是占位符。**
用户就算不点开任何金字,光读串联白话也要完全明白这段在讲什么。

讲清楚因果故事:谁在消耗你、谁在压你、缺了什么补给、因此他现在会有什么感受/该注意什么节奏。

【串联白话绝对禁止】
- 与第 3 步同一张禁词表——遮住所有 \`⟦t:…⟧\` 之后,可读文字里【零命理词】【零干支字面】;
- 禁止半文言连接:旺而/受制/见官之象/克泄交加/生扶无力/泄身过重…;
- 禁止「来生扶你」「印星的力量」「七杀没有东西来化解」这类术语气连接——改成「找能给你充电的人/方法」「那股压力没人帮你挡住」;
- 【禁止复述或改写 body 正文】:不要抄 body 的金句、周计划(第一周/第二周)、行动清单、「战略不是偷懒」类收束。body 只帮你理解,输出只改造 evidence。

## 第 5 步:自检(不过关必须重写)
1. 把所有金字当成看不见,光读串联白话——美国高中生能懂吗?有没有禁词表里的字?
2. 逐个打开第三段——有没有禁词表里的字、干支、XX星、生克泄扶?
3. 输出是否抄了 body 的句子或周计划?有则删掉,只保留依据层的结构因果。
任何一条不过关,回到第 3、4 步重写。`;

const HARD_RULES_ZH = `# 硬规则

- 金字格式:\`⟦t:<slug>||<情景白话>⟧\`(三段位):
  - 中间(两竖线之间)留空——正文显示的合规软译由系统填;
  - 第三段【情景白话】必须写满,且【零命理原词】【零干支字面】;
- 只改 evidence 的"怎么讲",不删结构因果;【不】把 body 并进 evidence;
- 【严禁自造 slug】slug **只能**取自下方 SSOT 表。下列全部禁止:
  - bare_ganzhi / bare_* / 任何自造拼音拼凑;
  - shensha_* 表里没有的神煞 id;
  - 英文意译式 slug(DayMaster / OfficerStar 等)。
  表里没有的概念:**不要打标**,第 4 步用大白话直接讲进串联句。
- 类称只用于【心里对照→选 slug】,【禁止】把类称写进第三段或串联:
  官星→slug zheng_guan/qi_sha;财星→zheng_cai/pian_cai;印星→zheng_yin/pian_yin;
  伤官→shang_guan;食神→shi_shen;比劫→bi_jian/jie_cai。
  干支对若表无 slug:**禁止**自造 bare_ganzhi,改用白话讲阶段感/气候感。

# 输出格式
仅输出 JSON(本调用只处理一个段,调用方已知段 key,不必再包一层):
\`{ "arguments": [ { "evidence": "改造后的依据" }, ... ] }\`
- arguments 长度与输入该段一致,顺序一致;
- 只填 evidence 字段(可省略 body);
- 若输入某条 evidence 为空字符串:输出同位置 evidence 也必须是空字符串,【禁止】用 body 冒充依据;
- 不要 JSON 以外任何文字、不要 Markdown 代码块。`;

/**
 * Dedicated mark (+ foreign 意译) + **情景白话** + **白话串联** step.
 * Markers must be three-slot: `⟦t:<slug>||<贴题白话>⟧` (soft left empty; system fills SSOT soft).
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  // Align with base evidence: inject slug ↔ 真词 table (not soft glosses like 锚元/助元).
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale, { neutralBase: true });
  const q = questionBlock(ctx, zh);
  const deliveryFormatOverride = zh
    ? `# 交付打标格式覆盖（优先于上表「中立底座」空槽规则）
上表只提供 slug ↔ 命理真词对照——【不要】把软译词(锚元/助元/供源等)写进可读文字。
金字格式仍用三段位:\`⟦t:<slug>||<情景白话>⟧\`——中间软译留空(系统填);第三段情景白话【必须】写满且零命理原词。`
    : `# Delivery mark format override (overrides empty-slot rules above)
The table is slug ↔ real 命理 terms only — do **not** write soft glosses into prose.
Marker format remains three-slot: \`⟦t:<slug>||<situational plain>⟧\` — leave soft empty (system fills); 3rd slot **must** be filled with zero jargon.`;

  const system = zh
    ? `${SHARED_PERSONA_ZH}

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译
中文站:不翻译,保持中文白话。

${HARD_RULES_ZH}

${markingBlock}

${deliveryFormatOverride}

# 用户的问题
${q}
`
    : `${SHARED_PERSONA_ZH}

你还要把改造后的大白话写成【地道、自然的目标语言】(${locale})。

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译成地道外语
把你串联好的大白话,翻译成【地道、自然的目标语言】(${locale})(不是生硬直译)。
- 金字 \`⟦t:<slug>||<情景白话>⟧\`:slug 原样保留;**第三段要翻译成目标语言**,且仍【零命理原词/零干支字面】;
- 金字之间的白话,翻译成目标语言里"一个高中生会这么说话"的自然表达;
- 【绝对禁止】Officer Star / Hurting Officer / Day Master 等生硬堆砌。

# 自检(外文站额外)
把金字当占位符遮住,光读你的外语白话,一个母语读者能顺畅读懂、觉得像人话吗?
不过关就重写第 4、6 步。

${HARD_RULES_ZH}

${markingBlock}

${deliveryFormatOverride}

# 用户的问题
${q}
`;

  const payload = JSON.stringify(segments, null, 2);
  const user = zh
    ? `按 6 步改造下列依据:理解→打标→情景白话(零命理词)→白话串联(零命理词、勿抄 body)→自检→(中文站不翻译)。用户问题见 system。输出 JSON 形状为 {"arguments":[{"evidence":"..."},...]}(长度与输入该段一致)。\n\`\`\`json\n${payload}\n\`\`\``
    : `Follow the 6 steps: understand → mark → situational gloss (zero jargon) → plain connective prose (zero jargon; do not copy body) → self-check → translate into natural ${locale}. User question is in system. Output JSON as {"arguments":[{"evidence":"..."},...]} matching input length.\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Foreign-only: 意译命理依据 → 地道外文，禁止打标。 */
export function buildTranslateEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你是命理依据意译专员。上游是中文命理话术;你只做**理解后的地道意译**,不打标、不改推理。
把文言腔改成一个【普通美国高中生】能听懂的目标语言(${locale})因果故事——宁可啰嗦,不要半文言直译。

# 铁律
- 目标语言: ${locale}
- 【禁止】直译命理词(Officer Star / Day Master 等生硬堆砌)。
- 【禁止】输出 ⟦t: 标记。
- 【禁止】输出中文命理原词/干支字面(食神/七杀/身弱/乙木/丁酉等)——全部化成目标语言处境白话。
- 保留完整因果与主语;句子通顺自然。像"旺而""受制""见官之象"这类连接,全部改写成大白话因果。

# 输出 JSON(严格)
本调用只处理一个段,输出:
\`{ "arguments": [ { "evidence": "意译后的依据" }, ... ] }\`
arguments 长度与输入该段一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `将下列中文命理依据意译为 ${locale}(不打标;白话因果串联;零命理原词)。输出 {"arguments":[{"evidence":"..."},...]}。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/**
 * Mark-only + situational plain + plain connective prose
 * (after split translate, or zh fallback). Evidence already in target locale.
 */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale, { neutralBase: true });
  const q = questionBlock(ctx, zh);
  const deliveryFormatOverride = zh
    ? `# 交付打标格式覆盖（优先于上表「中立底座」空槽规则）
上表只提供 slug ↔ 命理真词对照——【不要】把软译词(锚元/助元/供源等)写进可读文字。
金字格式仍用三段位:\`⟦t:<slug>||<情景白话>⟧\`——中间软译留空(系统填);第三段情景白话【必须】写满且零命理原词。`
    : `# Delivery mark format override (overrides empty-slot rules above)
The table is slug ↔ real 命理 terms only — do **not** write soft glosses into prose.
Marker format remains three-slot: \`⟦t:<slug>||<situational plain>⟧\` — leave soft empty (system fills); 3rd slot **must** be filled with zero jargon.`;
  const system = `${SHARED_PERSONA_ZH}

上游依据已是目标语言通顺句;你**不再另起意译**,但仍须完成:打标→情景白话→白话串联→自检。
第三段与串联白话仍适用同一张命理禁词表;禁止抄 body。

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译
本步输入已是目标语言:不再翻译,保持现有语言的大白话。

${HARD_RULES_ZH}

${markingBlock}

${deliveryFormatOverride}

# 用户的问题
${q}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `为下列依据打标、写情景白话(零命理词),并用啰嗦大白话串联金字(勿抄 body)。输出 {"arguments":[{"evidence":"..."},...]}(长度与输入一致)。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/**
 * Pack argument tree for the mark step (body + evidence).
 * Never substitutes body for missing evidence (that would make the model "mark"
 * narrative prose). Empty evidence stays "" — keep row count for zip alignment.
 */
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
        evidence: (a.evidence ?? "").trim(),
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
        evidence: (a.evidence ?? "").trim(),
      })),
    };
  }
  return out;
}
