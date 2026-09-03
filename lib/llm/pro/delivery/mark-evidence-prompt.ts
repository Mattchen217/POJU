import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
import {
  PLAIN_FALLBACK_BODY_SINGLES,
  PLAIN_FALLBACK_COMPOUNDS,
  SSOT_DERIVED_FALLBACK,
} from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Mark-step mode:
 * - combined: one connective call in the **delivery locale** (zh or target language).
 * - split: kept for env compatibility; same as combined (body translation is separate).
 *
 * Pipeline (P5): evidence LLM writes `⟦w:真词⟧` → this step rewrites connective only
 * while keeping every word-slot → code encodes to `⟦t:slug|…⟧` after mark succeeds.
 */
export type DeliveryMarkMode = "combined" | "split";

export type MarkEvidenceContext = {
  /** User's original question / dilemma — drives situational connective prose. */
  original_question?: string | null;
};

export type MarkEvidenceArgInput = {
  /** Narrative argument body (for situational gloss). */
  body: string;
  /** Raw evidence with `⟦w:真词⟧` slots — mark only rewrites connective between slots. */
  evidence: string;
};

export function resolveDeliveryMarkMode(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkMode {
  return env.DELIVERY_MARK_MODE?.trim() === "split" ? "split" : "combined";
}

function isZhLocale(locale: string): boolean {
  return locale.trim().toLowerCase().startsWith("zh");
}

function questionBlock(ctx: MarkEvidenceContext | undefined, zh: boolean): string {
  const q = ctx?.original_question?.trim();
  if (!q) {
    return zh
      ? "（用户问题未注入 — 仍须按本条论点正文写贴题串联，勿抄词典定义。）"
      : "(No user question injected — still write situational connective from the argument body.)";
  }
  return zh ? `「${q}」` : `"${q}"`;
}

/** Extra jargon often left in connective even after marking. */
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

/**
 * 命理四字格 / 行话成语 — 只禁槽外连接白话里出现。
 * 发现新的再往表里加；不要改成「禁止一切四字成语」(会伤正常白话)。
 * 槽内 `⟦w:天乙贵人⟧` 等真词不受影响（扫描前会先剥槽）。
 */
export const MARK_MINGLI_CHENGYU_BAN_ZH = [
  // --- 1. 十神与格局生克 ---
  "官印相生",
  "杀印相生",
  "财官相生",
  "食神制杀",
  "食神生财",
  "伤官生财",
  "伤官见官",
  "伤官配印",
  "比劫夺财",
  "比劫争财",
  "比劫帮身",
  "官杀混杂",
  "羊刃驾杀",
  "贪财坏印",
  "财星破印",
  "枭神夺食",
  "偏印夺食",
  "七杀攻身",
  "七杀缠身",
  "伤官伤尽",
  "财杀相生",
  "财生官杀",
  "食伤泄秀",
  "化杀为权",
  "以杀化权",
  "印绶护身",
  "印来护身",
  "官来克身",

  // --- 2. 身强身弱与状态 ---
  "财多身弱",
  "财多身旺",
  "印旺身强",
  "印旺身弱",
  "杀重身轻",
  "身杀两停",
  "从财而化",
  "克泄交加",
  "生扶无力",
  "通关无力",
  "通关有力",
  "身旺无依",
  "身弱难支",
  "身弱不胜",
  "财官双美",
  "通根得地",
  "透干得令",
  "日坐羊刃",

  // --- 3. 五行象形与调候 ---
  "火旺木焚",
  "水旺木浮",
  "水泛木浮",
  "土多金埋",
  "土重埋金",
  "金寒水冷",
  "木火通明",
  "水火既济",
  "燥土焦金",
  "湿木无焰",
  "水多土荡",
  "水大土崩",
  "火烈土燥",
  "火多土焦",
  "火炎土燥",
  "木多火塞",
  "木塞火熄",
  "金水相涵",
  "金水聪明",
  "金多水浊",
  "金沉水底",
  "寒木向阳",
  "木旺土崩",

  // --- 4. 神煞类（槽外禁写标签；槽内真词仍可保留）---
  "驿马星动",
  "驿马奔波",
  "天乙贵人",
  "文昌贵人",
  "天罗地网",
  "华盖入命",
  "孤辰寡宿",
  "咸池桃花",
  "羊刃倒戈",
  "桃花入命",
  "劫煞入命",
  "亡神入命",
  "空亡入命",
  "天德月德",
  "红鸾天喜",
  "阴差阳错",
  "阴阳差错",
  "十恶大败",
  "孤鸾入命",
  "血刃入命",
  "元辰入命",

  // --- 5. 岁运与刑冲合害 ---
  "天克地冲",
  "天冲地克",
  "天合地合",
  "天合地冲",
  "干合支冲",
  "岁运并临",
  "伏吟反吟",
  "双重伏吟",
  "三刑会冲",
  "丑未戌刑",
  "寅巳申刑",
  "盖头截脚",
  "三合会局",
  "半合会局",
  "子午相冲",
  "卯酉相冲",
  "辰戌相冲",
  "丑未相冲",
  "寅申相冲",
  "巳亥相冲",
  "流年冲命",
  "大运冲命",
  "交脱之际",
  // --- 截图/实出泄漏补洞 ---
  "火局泄木",
  "火旺木焚",
  "水多木漂",
  "土重埋金",
  "金寒水冷",
] as const;

/**
 * Short 命理 fragments that survive after a compound is split across a word-slot
 * (e.g. ⟦w:食神⟧制杀 → connective only has「制杀」).
 */
export const MARK_CONNECTIVE_SHORT_JARGON_ZH = [
  "制杀",
  "泄木",
  "泄身",
  "火局",
  "合官",
  "合身",
  "见官",
  "攻身",
  "夺食",
  "夺财",
  "破印",
  "化杀",
  "化权",
  "护身",
  "克身",
  "帮身",
  "生扶",
  "通根",
  "得根",
  "失令",
  "得令",
  "身弱",
  "身强",
  "日主",
  "用神",
  "忌神",
  "喜神",
  "七杀",
  "正官",
  "伤官",
  "食神",
  "正印",
  "偏印",
  "比肩",
  "劫财",
  "正财",
  "偏财",
] as const;

function buildMarkPlainBanListZh(): string {
  const fromSsot = [...BANNED_TERMS_ZH].filter((w) => w.length >= 2);
  const merged = [...new Set([...fromSsot, ...MARK_PLAIN_EXTRA_BAN_ZH])].sort(
    (a, b) => b.length - a.length,
  );
  return merged.join(" / ");
}

const MARK_PLAIN_BAN_LIST_ZH = buildMarkPlainBanListZh();
const MARK_MINGLI_CHENGYU_LIST_ZH = MARK_MINGLI_CHENGYU_BAN_ZH.join(" / ");

/** Strip `⟦w:…⟧` / `⟦词:…⟧` so bans apply only to connective vernacular. */
export function stripWordSlotsForBanScan(text: string): string {
  return (text ?? "").replace(/⟦(?:w|词):[^⟧]*⟧/g, "");
}

/** First hit of a 命理四字格 in connective (outside word-slots), or null. */
export function findMingliChengyuOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  // Longer phrases first so「双重伏吟」等不被短词误伤匹配顺序干扰。
  const ranked = [...MARK_MINGLI_CHENGYU_BAN_ZH].sort((a, b) => b.length - a.length);
  for (const phrase of ranked) {
    if (connective.includes(phrase)) return phrase;
  }
  return null;
}

/** First short 命理 fragment in connective outside slots, or null. */
export function findConnectiveShortJargonOutsideSlots(text: string): string | null {
  const connective = stripWordSlotsForBanScan(text);
  const ranked = [...MARK_CONNECTIVE_SHORT_JARGON_ZH].sort((a, b) => b.length - a.length);
  for (const phrase of ranked) {
    if (connective.includes(phrase)) return phrase;
  }
  return null;
}

function lookupMarkPlainFallback(term: string): string | undefined {
  return (
    PLAIN_FALLBACK_COMPOUNDS[term] ??
    PLAIN_FALLBACK_BODY_SINGLES[term] ??
    SSOT_DERIVED_FALLBACK.get(term)
  );
}

/**
 * Replace known short jargon in connective (outside `⟦w:⟧` / `⟦词:⟧` / `⟦t:⟧`)
 * using plain-fallback map — zero LLM. Unknown jargon left for gate → LLM retry.
 */
export function repairMarkConnectivePlainJargon(text: string): {
  text: string;
  repaired_terms: string[];
} {
  if (!text?.trim()) return { text: text ?? "", repaired_terms: [] };

  const slots: string[] = [];
  let work = text.replace(/⟦(?:w|词|t):[^⟧]*⟧/g, (m) => {
    const i = slots.length;
    slots.push(m);
    return `\u0000S${i}\u0000`;
  });

  const repaired_terms: string[] = [];
  for (let n = 0; n < 12; n++) {
    const ranked = [...MARK_CONNECTIVE_SHORT_JARGON_ZH].sort((a, b) => b.length - a.length);
    let hit: string | null = null;
    for (const phrase of ranked) {
      if (work.includes(phrase) && lookupMarkPlainFallback(phrase)) {
        hit = phrase;
        break;
      }
    }
    if (!hit) break;
    const plain = lookupMarkPlainFallback(hit)!;
    work = work.split(hit).join(plain);
    if (!repaired_terms.includes(hit)) repaired_terms.push(hit);
  }

  const restored = work.replace(/\u0000S(\d+)\u0000/g, (_, i: string) => slots[Number(i)] ?? "");
  return { text: restored, repaired_terms };
}

/**
 * Adjacent word-slots with insufficient Han vernacular between them (金字贴死 / 虚缝).
 * Fails when any `⟧`…`⟦` gap has fewer than {@link MIN_ADJACENT_VERNACULAR_HAN} Han characters
 * (so single 的/和/与/之 cannot paper over a gold wall).
 */
export const MIN_ADJACENT_VERNACULAR_HAN = 4;

export function countHanChars(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

export function hasAdjacentWordSlotsWithoutVernacular(text: string): boolean {
  const t = text ?? "";
  const re = /⟧([^⟦]*)⟦/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const gap = m[1] ?? "";
    if (countHanChars(gap) < MIN_ADJACENT_VERNACULAR_HAN) return true;
  }
  return false;
}

function buildMarkEvidencePromptZh(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const q = questionBlock(ctx, true);
  const system = `# 你是谁
你能在心里读懂八字体系,但用户【永远不该在串联白话里听到这些词】。
上游依据已用真词槽 \`⟦w:真词⟧\` 标好承重点(例:\`⟦w:正印⟧\` \`⟦w:身弱⟧\`)。你认识这些真词——用它们理解因果。
你的**唯一任务**:只改槽位【之间】的连接白话,写成啰嗦通顺、扣住本段+用户问题的因果故事。

# 你收到什么
每条包含:
- body:论点正文(只给你理解方向;**禁止抄进输出**);
- evidence:带 \`⟦w:真词⟧\` 的依据(你只改槽外连接白话);
- 用户的问题(下面给出)。
本步输入【只有】\`⟦w:真词⟧\` + 连接文字;没有任何别的标记格式。

# 你要做的(只这一件事)
1. 读懂 \`⟦w:…⟧\` 真词之间的因果(真词给你看懂用的);
2. 重写连接白话:什么在消耗你的精力与节奏、什么能让你恢复可用状态、因此你现在会卡在什么感受/选择上;
3. **每一个 \`⟦w:…⟧\` 必须原样保留**(一个都不能删、不能改槽内真词、不能把槽内真词抄到槽外)。

# 硬闸(违反=整条作废)
- 输出里 \`⟦w:…⟧\` 个数必须 ≥ 输入同条个数(通常 ≥2);删光槽位改成纯白话 = 失败。
- 禁止新造槽位;禁止改槽内文字。
- **槽与槽之间必须有实质大白话连接**(缝内至少 ${MIN_ADJACENT_VERNACULAR_HAN} 个汉字的因果/机制白话)——禁止 \`⟧⟦\` 贴死,也禁止只用「的/和/与/之」等虚字糊弄(岁环纪元/时脉登峰一类)。

# 绝对禁止
- 改槽内真词 / 删槽 / 把真词挪到槽外当普通字;
- 翻译成外语(本步出中文串联);
- 碰真算结构(不删承重因果);
- 复述或改写 body 正文/周计划/行动清单;串联白话须简洁,勿长篇大论;
- 串联白话(槽外)出现下列任一命理原词/干支字面:
  ${MARK_PLAIN_BAN_LIST_ZH}
- 半文言连接:旺而/受制/见官之象…
- **命理四字格**(槽外禁止原样写出;不是禁一切成语,只禁这类命理标签)。下表只是**部分示例**,未列全;凡同类命理行话/格局标签/五行象形口诀(四字或近四字),一律不得出现在串联大白话里。若因果就是这类机制,改用**可观察的工作/身心语言**讲清:什么让你透支、什么让你回稳、对眼前选择意味着什么——不要甩四字标签:
  ${MARK_MINGLI_CHENGYU_LIST_ZH}
  展开幅度(原则·勿照抄任何具体改写句):槽外须用可观察的工作/身心白话讲清机制——什么让你透支、什么让你回稳、对眼前选择意味着什么;禁止甩命理四字标签或半文言。
- **短命理残词**(槽外禁止):制杀/泄木/火局/合官/身弱/日主/用神…——槽吃掉半截后残在白话里同样失败。

# 自检
1. 数一遍输出 \`⟦w:\` 是否与输入一样多?
2. 遮住所有 \`⟦w:…⟧\`,光读串联白话——普通读者能懂吗?有禁词/命理四字格/短残词吗?抄了 body 吗?是否啰嗦?
3. 任意两个 \`⟦w:…⟧\` 之间有没有≥4个汉字的实质连接?(没有或只有虚字=失败)
不过关就重写连接白话,**不要动槽**。

# 输出 JSON(严格)
\`{ "arguments": [ { "evidence": "串联后的依据" }, ... ] }\`
- 长度/顺序与输入该段一致;只填 evidence;
- 输入 evidence 为空 → 输出同位置也必须是空字符串。

# 用户的问题
${q}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `只做情景串联(保留全部 ⟦w:真词⟧;槽外零命理词/零命理四字格;勿抄 body)。输出 {"arguments":[{"evidence":"..."},...]}。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

function buildMarkEvidencePromptForeign(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const q = questionBlock(ctx, false);
  const lang = locale.trim() || "en";
  const system = `# Who you are
You understand East-Asian chart structure privately, but the user must NEVER hear technical jargon in the connective prose.
Upstream evidence uses word slots \`⟦w:真词⟧\` (traditional terms). You may READ them to understand causality.

# Your ONLY job
Rewrite the connective prose BETWEEN \`⟦w:…⟧\` slots into clear, situational vernacular in **${lang}** —
a causal story a US high-school reader can follow. Tie it to this argument + the user's question.

# What you receive
- body: argument prose (context only — **do not copy into output**)
- evidence: raw slots \`⟦w:真词⟧\` only + connective text; rewrite ONLY text outside slots
- user question (below)
This step's input has **no** other marker formats.

# Rules
1. Keep every \`⟦w:…⟧\` marker EXACTLY (same inner 真词). Do not delete or edit inside the slot. Do not copy slot text into the connective.
2. Output must keep at least as many \`⟦w:\` slots as the input (usually ≥2). Pure vernacular with zero slots = FAIL.
2b. Every pair of adjacent \`⟦w:…⟧\` slots MUST have substantive vernacular between them (≥4 Han characters of connective story) — never glue markers (no empty \`⟧⟦\`) and never paper over with a single function word.
3. Write connective in **${lang}** now — do NOT write Chinese then translate later.
4. Do not delete structural causality. Do not restate body / weekly plans / action lists.
5. Zero Chinese 命理 leftovers outside slots (食神/七杀/日主/干支字面/正印…). Also ban:
   ${MARK_PLAIN_BAN_LIST_ZH}
6. Ban 命理 four-character labels outside slots (not all Chinese idioms — only chart jargon compounds). The list below is a **partial sample**, not exhaustive; any similar chart jargon / pattern labels / five-element formula phrases must not appear in connective vernacular. If the mechanism is that pattern, explain it in **observable work/body language**: what drains capacity, what restores steadiness, what that means for the choice at hand. Never dump the four-character tag. Known bans (examples):
   ${MARK_MINGLI_CHENGYU_LIST_ZH}
   Degree cue (how far to unpack — do not copy plot): “carrying rules-and-duty while still learning so pressure becomes forward motion” instead of pasting「官印相生」; “output overheating and scorching room to grow” instead of「火旺木焚」.

# Self-check
Count \`⟦w:\` vs input. Cover every slot — can a plain reader follow the story? Any banned jargon / 命理 four-character tags? Copied body?
If not, rewrite connective only — never drop slots.

# Output JSON (strict)
\`{ "arguments": [ { "evidence": "…" }, ... ] }\`
- Same length/order as input; evidence only.
- Empty input evidence → empty string at that index.

# User question
${q}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `Connective-only in ${lang}; keep all ⟦w:…⟧ intact; zero chart jargon / 命理 four-character labels outside slots; do not copy body.\nOutput {"arguments":[{"evidence":"..."},...]}.\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/**
 * Connective-only mark. Locale selects connective language (zh vs delivery language).
 * Input is `⟦w:真词⟧` evidence; code encodes to `⟦t:…⟧` after this step succeeds.
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  if (isZhLocale(locale)) {
    return buildMarkEvidencePromptZh(segments, ctx);
  }
  return buildMarkEvidencePromptForeign(segments, locale, ctx);
}

/** @deprecated Evidence is no longer translated in a separate pass — mark writes locale connective. */
export function buildTranslateEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你把依据里的【串联白话】译成地道 ${locale}。
【铁律】每个 \`⟦w:…⟧\` 原样保留;只译槽外连接文字。禁止发明新槽、禁止改槽内真词。禁止中文命理原词残留在槽外。

# 输出 JSON
\`{ "arguments": [ { "evidence": "…" }, ... ] }\` 长度与输入一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `Translate connective prose only into ${locale}; keep all ⟦w:…⟧ intact.\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Alias — connective language follows delivery locale. */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  return buildMarkEvidencePrompt(segments, locale, ctx);
}

/**
 * Pack argument tree for the mark step (body + evidence).
 * Never substitutes body for missing evidence.
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

/** Evidence-only payload (legacy / tests). */
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
