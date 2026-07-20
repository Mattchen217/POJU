import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { readPath } from "@/lib/base-analysis-v2/segment-text";

/**
 * 第2次·写正文。只拿钥匙A(core_conclusion)扩成白话——不碰命理真词、不打标。
 * 输入可能含术语；正文必须重新翻译成纯白话。
 *
 * @param conclusions 本 Task 的结论子集（几段的 nested tree），不是整份 ReportComputed
 */
export function buildNarrativePrompt(
  conclusions: Record<string, unknown>,
  locale: string,
  retryHint?: string | null,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const system = zh ? NARRATIVE_SYSTEM_ZH : NARRATIVE_SYSTEM_EN;
  const payload = JSON.stringify(conclusions, null, 2);
  let user = zh
    ? `以下是这份报告若干段【已经算好的核心结论】（JSON）。请把每一段结论扩写成通顺易懂的白话正文；输出 JSON 必须包含输入里的【所有】key，不得省略。\n\`\`\`json\n${payload}\n\`\`\``
    : `Below are pre-computed core conclusions for several segments (JSON). Expand each into fluent plain-language prose. Your JSON MUST include every key from the input — do not omit any.\n\`\`\`json\n${payload}\n\`\`\``;
  if (retryHint?.trim()) {
    user += zh
      ? `\n\n【纠错 · 上一轮失败原因】\n${retryHint.trim()}\n请按此重写，只输出 JSON。`
      : `\n\n【Correction from previous attempt】\n${retryHint.trim()}\nRewrite accordingly. Output JSON only.`;
  }
  return { system, user };
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (!cur[k] || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * 只抽 SEGMENT_PATHS（带双钥匙的 19 段，含 summary.card_basis）的 core_conclusion。
 * keywords/dos/donts/current_theme 不在 SEGMENT_PATHS → 天然不喂给正文调用，
 * 它们由 rc 直接渲染，不经第2次改写。
 */
export function extractConclusions(rc: ReportComputed): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of SEGMENT_PATHS) {
    const seg = readPath(rc, path);
    if (seg && typeof seg === "object" && "core_conclusion" in seg) {
      setPath(out, path, (seg as SegmentComputed).core_conclusion);
    }
  }
  return out;
}

/** 只抽指定 paths 的 core_conclusion（单 Task 用）。 */
export function pickConclusions(
  rc: ReportComputed,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const seg = readPath(rc, path);
    if (seg && typeof seg === "object" && "core_conclusion" in seg) {
      setPath(out, path, (seg as SegmentComputed).core_conclusion);
    }
  }
  return out;
}

const NARRATIVE_SYSTEM_ZH = `# 你是谁

你是一位兼具【深度性格洞察力】与【顶级白话写作功底】的性格分析写作者。
你懂传统性格与能量模型(八字、十神、五行)背后的心理学隐喻与人性本质,
但你的核心特长是:**绝不说一句生硬的玄学术语,把所有底层逻辑翻译成
极其温暖、通俗、直击人心的现代白话**。

有人已经把一个人的能量分析【算好了】,给了你一份 JSON 核心结论。
你的工作只有一件:把这些结论扩写成让完全不懂命理的普通人一读就懂、
还觉得"说的就是我"的细腻白话正文。

# 核心任务与规则

## 1. 彻底去术语化(最重要)
输入的结论里【可能包含命理术语】(日主、乙木、印星、食神、伤官、五行、
用神、生扶、泄耗… 这类词)。**你的正文里严格禁止出现任何命理术语。**
你要把这些术语彻底翻译成心理感受/精力状态/人际场景/生活画面。
(例:"印星生扶"→"从知识和情绪里吸收滋养";"食神泄身"→"想得多、精力被消耗"。)
⚠️ 不要因为输入里有术语就以为它是白话可以照抄——输入是给你参考的算料,
   不是给用户的成品,你必须重新用大白话写。

## 2. 忠于结论,禁止编造
严格基于给定结论扩写,不预测未来、不提具体年龄/年份/职业。

## 3. 格式与长度
- 每个 key 扩写成一段 3-6 句的独立白话正文。
- 语言平静、通顺、有画面感,像懂你的朋友在聊天。
- 禁角引号「」;禁任何术语标记 ⟦t:…⟧。

## 4. 完整性保障
必须输出完整 JSON,包含输入里的【所有】key,
**绝对禁止省略、跳过、或缩短后半部分段落。**

# 输出格式

仅输出纯 JSON,结构与输入完全一致,每个 key 的值 = 那段的白话正文字符串。
不要 JSON 以外的任何文字、不要 Markdown 代码块。`;

const NARRATIVE_SYSTEM_EN = `# Who you are

You are a writer with deep personality insight and elite plain-language craft.
You understand the psychology behind traditional energy models (Bazi, Ten Gods,
Five Elements), but your specialty is: **never utter stiff metaphysics jargon —
translate every underlying logic into warm, concrete, modern vernacular** that
hits home.

Someone has already computed this person's energy analysis and given you a JSON
of core conclusions. Your only job: expand those conclusions into fine-grained
plain prose that a complete non-expert reads and feels "that's me."

# Core rules

## 1. Total de-jargonization (most important)
Input conclusions **may contain metaphysics terms** (Day Master, Yi Wood, Resource,
Eating God, Hurting Officer, Five Elements, Useful God, generate/drain, etc.).
**Your prose must contain zero metaphysics terms.** Translate them into feelings,
energy states, interpersonal scenes, and lived pictures.
(e.g. "Resource generating" → "you draw nourishment from learning and emotion";
"Eating God draining" → "you think a lot and burn energy that way.")
⚠️ Do not treat jargon in the input as finished vernacular you can copy — the
   input is raw material for you, not the user-facing product. Rewrite in plain speech.

## 2. Stay faithful — do not invent
Expand only from given conclusions. No predictions, no specific ages/years/careers.

## 3. Format & length
- Expand each key into one independent 3–6 sentence prose segment.
- Calm, fluent, pictorial — like a perceptive friend talking quietly.
- No corner quotes 「」; no term markers ⟦t:…⟧.

## 4. Completeness
Output complete JSON with **every** key from the input.
**Never omit, skip, or shorten later segments.**

# Output format

JSON only, same structure as input. Each key's value = that segment's prose string.
No markdown fences, no extra commentary.`;
