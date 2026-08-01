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

const SHARED_PERSONA_ZH = `# 你是谁

你是一位既精通中国传统命理、又极擅长把玄奥道理讲给外行听的解读者。
你能读懂八字、十神、五行、神煞、用神喜忌这套体系里每一个术语的确切含义,
也明白它们背后讲的其实是一个人的性格、处境和人生的因果。

但你真正的看家本领是:**把这套中国人用了上千年、写得像文言文一样的命理话术,
讲给一个完全不懂命理、也不懂中国文化的【普通美国高中生】听,
让他不需要任何背景知识,光读你的话就能明白这段在讲什么。**
你先真正读懂了命理,才能翻得准、讲得透,而不是把术语生硬堆在一起。

有人给了你一段【已经算好的命理依据】。它现在长得像文言文,
充满命理专业词,外行根本读不懂。你的任务是把它改造成"既专业、又人人能懂"的样子。

# 你收到什么

每条包含:
- body:这条论点的正文(它在向用户论证什么,给你理解方向);
- evidence:充满命理词的原始依据(文言腔,你要改造的就是它);
- 用户的问题(下面给出),你的白话要扣住用户真正关心的事。`;

const STEPS_1_TO_5_ZH = `# 你要按这 6 步做（严格按顺序）

## 第 1 步:理解
先把这段文言依据读懂——它在讲什么命理逻辑?
哪几个命理概念在起作用?它们之间是什么关系(谁生谁、谁克谁、谁帮谁、谁拖累谁)?
结合 body 和用户的问题,想清楚"这段到底在说这个人的什么事"。
**不理解透,不要动手。**

## 第 2 步:打标(锁定专业词)
把依据里的承重命理词,对照下方 SSOT 术语表,换成标记 \`⟦t:<slug>||⟧\`。
- slug **必须**取自 SSOT 表,表里有的命理词都要打标;
- 表里【没有】的概念,不要打标、不要猜 slug,留着到第 4 步用白话讲;
- 格式 \`⟦t:<slug>||⟧\`:slug 后【两条竖线】,第三段先空着,到第 3 步填。
- 打标就是把专业词【锁定成占位符】——正文里它只是个记号。

## 第 3 步:给每个金字写"情景白话解释"(填第三段)
这一步,你要给刚才打的【每一个金字】,写一句用户点开它时看到的解释,
填进第三段:\`⟦t:<slug>||<这里写情景白话>⟧\`。

这句解释不是词典定义,而是——
**"这个命理概念,在【这个人】、【这件事】上,具体意味着什么。"**

怎么写:
- 扣住【用户的问题】和【本条 body 论点】,不要脱离处境空谈;
- 讲这个概念在他身上表现成什么样的【感受/行为/处境】,不是讲这个概念的书面含义;
- 用一个普通美国高中生能懂的大白话,像在跟他解释"你身上这个特点是这么回事";
- 一句到两句,说透即可。

【绝对不许】做的事:
- 不许写命理词简写当解释(比如把某个词的解释写成"就是挑剔""就是压制""某某星受制"
  ——这等于没解释,用户还是不懂);
- 不许抄词典通用定义(比如"代表才华""象征秩序"这种脱离这个人处境的空话);
- 不许留空(留空系统就只能显示固定词典模板,前功尽弃)。

检验:把这句解释单独拎出来给一个不懂命理的美国高中生看,
他能不能明白"哦,原来我身上这个特点/我这个处境是这么回事"?不能就重写。

## 第 4 步:白话串联(把金字之间连成通顺的话)
现在,把打好标的金字之间的所有【连接内容】,用**啰嗦、通顺、大白话**重新组织。

记住:**金字在正文里对读者只是一个占位符,本身不传达意思。**
所以【金字之间的白话】必须自己就把话说清楚——
**用户就算不点开任何金字,光读你串联的白话,也要能完全明白这段在讲什么。**

你要讲清楚一个【能懂的因果故事】:
- A 这股力量和 B 这股力量,是什么关系?
- 它们之间有没有冲突、较劲、谁压制谁?
- 这过程里又冒出来一个 C,起了什么作用?
- 最后导致这个人的 D(处境、感受、行为)变成了什么样?

用一个普通美国高中生能听懂的大白话讲出来。宁可啰嗦、多解释几句,
也不要省成文言。像"旺而""受制""见官之象"这种半文言连接,一个都不许留——
全部改写成大白话的因果讲述。

## 第 5 步:自检
写完后,自己检查两样东西:
【金字之间的串联白话】
- 把所有金字都当成看不见的占位符,光读中间的白话,这段还读得懂吗?逻辑通吗?
- 有没有残留任何文言腔或没解释的命理黑话("象""制""泄""见官"这类)?
【每个金字的情景白话解释(第三段)】
- 每个金字的第三段都填了吗?有没有漏的、留空的?
- 有没有哪个第三段写成了命理词简写或词典空话(不是解释,是没解释)?
- 一个不懂命理的美国高中生,读整段串联白话 + 点开每个金字看解释,
  能不能完全明白这段在说他什么事?
任何一条不过关,回到第 3、4 步重写。`;

const HARD_RULES_ZH = `# 硬规则

- 金字格式:\`⟦t:<slug>||<情景白话>⟧\`(三段位):
  - 中间(两竖线之间)留空——正文显示的合规软译由系统填;
  - 第三段【情景白话】你【必须】写(点开金字看到的解释,结合用户问题的大白话),不能留空,否则退回固定模板;
- 不删句子、不改依据的推理结论,只改"怎么讲"——把文言讲成大白话;
- slug 只从 SSOT 表取,表里没有的用白话讲,绝不猜 slug;
- 类称对照(模型常用类称,要认得):官星→zheng_guan 或 qi_sha;财星→zheng_cai/pian_cai;
  印星→zheng_yin/pian_yin;伤官→shang_guan;食神→shi_shen;比劫→bi_jian/jie_cai。

# 输出格式
仅输出 JSON:\`{ "arguments": [ { "evidence": "改造后的依据" }, ... ] }\`
arguments 长度与输入一致,顺序一致。只输出 evidence 字段。
不要 JSON 以外任何文字、不要 Markdown 代码块。`;

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
  // Delivery path — NOT neutralBase. Model must write contextual 3rd slot.
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale);
  const q = questionBlock(ctx, zh);

  const system = zh
    ? `${SHARED_PERSONA_ZH}

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译
中文站:不翻译,保持中文白话。

${HARD_RULES_ZH}

${markingBlock}

# 用户的问题
${q}
`
    : `${SHARED_PERSONA_ZH}

你还要把改造后的大白话写成【地道、自然的目标语言】(${locale})。

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译成地道外语
把你串联好的大白话,翻译成【地道、自然的目标语言】(${locale})(不是生硬直译)。
- 金字 \`⟦t:<slug>||<情景白话>⟧\`:slug 原样保留;**第三段情景白话要翻译成目标语言**(点开的解释,外国用户要能读懂);
- 金字之间的白话,翻译成目标语言里"一个高中生会这么说话"的自然表达;
- 【绝对禁止】把命理概念直译成生硬的词(如 Officer Star / Hurting Officer / Day Master
  这种堆砌)——那样读者完全看不懂。命理概念要么已被打标(占位符),
  要么已在第 3 步化成白话,不该有生硬直译的命理词。

# 自检(外文站额外)
把金字当占位符遮住,光读你的外语白话,一个母语读者能顺畅读懂、觉得像人话吗?
不过关就重写第 4、6 步。

${HARD_RULES_ZH}

${markingBlock}

# 用户的问题
${q}
`;

  const payload = JSON.stringify(segments, null, 2);
  const user = zh
    ? `按 6 步改造下列依据:理解→打标→情景白话→白话串联→自检→(中文站不翻译)。用户问题见 system。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``
    : `Follow the 6 steps: understand → mark → situational gloss → plain connective prose → self-check → translate into natural ${locale}. User question is in system. Output JSON with all keys.\n\`\`\`json\n${payload}\n\`\`\``;
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
- 保留完整因果与主语;句子通顺自然。像"旺而""受制""见官之象"这类连接,全部改写成大白话因果。

# 输出 JSON(严格)
键与输入相同。每个键:
\`{ "arguments": [ { "evidence": "意译后的依据" }, ... ] }\`
arguments 长度与输入一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `将下列中文命理依据意译为 ${locale}(不打标;白话因果串联)。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
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
  const markingBlock = buildTermMarkingPromptBlock(zh ? "zh" : locale);
  const q = questionBlock(ctx, zh);
  const system = `${SHARED_PERSONA_ZH}

上游依据已是目标语言通顺句;你**不再另起意译**,但仍须完成:打标→情景白话→白话串联→自检。
金字之间若仍有半文言或黑话连接,一律改写成啰嗦大白话因果故事。

${STEPS_1_TO_5_ZH}

## 第 6 步:翻译
本步输入已是目标语言:不再翻译,保持现有语言的大白话。

${HARD_RULES_ZH}

${markingBlock}

# 用户的问题
${q}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `为下列依据打标、写情景白话,并用啰嗦大白话串联金字。输出 JSON 含全部 key。\n\`\`\`json\n${payload}\n\`\`\``;
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
