import { syncroCacheSessionId } from "@/lib/llm/cache-session-id";
import { getOpenRouterDefaultModel, openRouterRequestExtras } from "@/lib/llm/openrouter-shared";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { buildSyncroOutputDefenseSections } from "@/lib/llm/prompts/syncro-base";
import { resolveSyncroBatchOutputLocale } from "@/lib/syncro/syncro-batch-prompt";
import { sanitizeSyncroHourAdvice } from "@/lib/syncro/sanitize-output";
import {
  appendToStream,
  cacheLlmInput,
  cacheLlmOutput,
  clearStream,
  getCachedOutput,
} from "@/lib/syncro/syncro-kv";

export interface SyncroLlmHourInput {
  session_id: string;
  hour_id: string;
  hour_label: string;
  hour_range: string;
  cells: Array<{
    key: string;
    direction: string;
    current_level: string;
    key_hints?: string[];
  }>;
  task_description: string;
  profile_summary: string;
  locale: string;
}

export interface SyncroLlmHourCallbacks {
  onConnecting?: () => void;
  onReasoning?: () => void;
  onWriting?: () => void;
  onReasoningChunk?: (text: string) => void;
  onContentChunk?: (text: string) => void;
}

export interface SyncroHourAdviceCell {
  short_advice: string;
  detailed_advice: string;
  rationale: string;
}

export interface SyncroLlmHourResult {
  advice: Record<string, SyncroHourAdviceCell>;
  raw_content: string;
  from_cache: boolean;
}

export class SyncroLlmHttpError extends Error {
  readonly retryable: boolean;
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string, retryable: boolean) {
    super(`Syncro LLM HTTP ${status}: ${detail}`);
    this.name = "SyncroLlmHttpError";
    this.status = status;
    this.detail = detail;
    this.retryable = retryable;
  }
}

export class SyncroParseError extends Error {
  readonly raw_content: string;

  constructor(raw_content: string, message?: string) {
    super(message ?? "missing advice field");
    this.name = "SyncroParseError";
    this.raw_content = raw_content;
  }
}

type DirectionAdvice = {
  short?: string;
  detailed?: string;
  rationale?: string;
};

function extractReasoningDelta(delta: Record<string, unknown> | undefined): string {
  if (!delta) return "";
  if (typeof delta.reasoning_content === "string") return delta.reasoning_content;
  if (typeof delta.reasoning === "string") return delta.reasoning;
  const details = delta.reasoning_details;
  if (Array.isArray(details)) {
    return details
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.content === "string") return o.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function buildPrompt(body: SyncroLlmHourInput) {
  const isZh = body.locale === "zh";

  const now = new Date();
  const dateStr = isZh
    ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
    : now.toISOString().split("T")[0];

  const cellsDesc = body.cells
    .map((c) => {
      const hints = c.key_hints?.length ? ` · 关键信号: ${c.key_hints.join("、")}` : "";
      return `  ${c.direction}: ${c.current_level}${hints}`;
    })
    .join("\n");

  const defenseBlock = stitchPromptSections(...buildSyncroOutputDefenseSections());

  const systemZh = `你是 pojulife Syncro 的资深分析师,为用户即将要做的事情,基于【当前时辰】8 个方位的状态,生成精准贴合命局的指导文案。

═══════════════════════════════════════
# 用户要做的事情
═══════════════════════════════════════

"${body.task_description}"

═══════════════════════════════════════
# 用户命局背景(八字分析摘要)
═══════════════════════════════════════

${body.profile_summary}

═══════════════════════════════════════
# 当前时辰 & 日期
═══════════════════════════════════════

${body.hour_label}时辰(${body.hour_range})
日期:${dateStr}

═══════════════════════════════════════
# 8 个方位的状态(本地已用奇门遁甲算好,严禁修改)
═══════════════════════════════════════

${cellsDesc}

说明:
- current_level 是后台综合 5 维度(奇门盘 + 用神 + 时辰 + 日主 + 任务)计算的【最终结果】
- 你【不能修改】等级,只能为每个方位写文案
- 关键信号是奇门盘的内心依据,可以内化使用,但【不能在文案中直接复读字段名】

═══════════════════════════════════════
# 你的任务:为每个方位写 3 段文案
═══════════════════════════════════════

每个方位生成 3 个字段:

【1】short(15-25 个汉字)
  - 一句话直接行动建议
  - 用于罗盘中心动效下方显示
  - 示例长度:"向北开启坦诚对话,主动抛出核心议题"(17 字)

【2】detailed(100-150 个汉字)
  - 2-3 句具体行动指导
  - 用于"为何此时"弹窗中显示
  - 内容包含:面向哪个方向、做什么动作、避免什么
  - 可引用用户命局元素(如日主天干、五行倾向),但要用大白话

【3】rationale(80-120 个汉字)
  - 1-2 句因果解释,【必须紧扣用户要做的事】
  - 用于"为何此时"弹窗中显示
  - 解释:为什么这个方位 + 时辰,适合(或不适合)做用户这件事
  - 把奇门关键信号转化成用户能懂的话

═══════════════════════════════════════
# 严格规则
═══════════════════════════════════════

# 语言一致性 MUST(关键!)

输出语言必须跟随用户任务"${body.task_description}"的实际语言:
  - 用户用中文描述 → 全部输出简体中文
  - 用户用英文描述 → 全部输出 English
  - 用户用其他语言 → 用对应语言输出
  - 混合语言时,以主体语言为准

不要看 locale 参数,看用户实际输入的语言。

字数按语言调整:
  - 中文输出:short 15-25 字 / detailed 100-150 字 / rationale 80-120 字
  - 英文输出:short 40-60 chars / detailed 220-300 chars / rationale 180-260 chars

字数 MUST(强制,不得超过):
  - short:15-25 字
  - detailed:100-150 字
  - rationale:80-120 字

8 个方位 N/NE/E/SE/S/SW/W/NW 全部必须生成。

针对性 MUST:
  - rationale【必须】明确提及用户要做的事(如"谈判""签约""见面")
  - rationale【必须】至少一次提到 Syncro / 这个 Syncro
  - 不要写通用文案,要让用户感觉"这是为我写的"

禁用词:
  - 禁:占卜、算命、命理、测算、预测、神算、astrology、divination、fortune-telling
  - 禁直接暴露:奇门、八字、用神、日主、大运、key_hints、qimen
  - 用:pojulife / Syncro / 解读 / 分析

禁止句式:
  - ❌ "主要因素:qimen, yong_shen_direction"
  - ❌ "key_hints 是:用神方位匹配"
  - ❌ 堆砌专业术语
  - ✓ 用用户能懂的大白话

等级名翻译(文案中用中文,不用英文):
  - open_current → 通流
  - following_current → 顺流
  - stillwater → 守静
  - crosscurrent → 逆流
  - undertow → 暗潮

═══════════════════════════════════════
# 输出格式(严格 JSON,不输出其他内容)
═══════════════════════════════════════

{
  "advice": {
    "N":  { "short": "...", "detailed": "...", "rationale": "..." },
    "NE": { "short": "...", "detailed": "...", "rationale": "..." },
    "E":  { "short": "...", "detailed": "...", "rationale": "..." },
    "SE": { "short": "...", "detailed": "...", "rationale": "..." },
    "S":  { "short": "...", "detailed": "...", "rationale": "..." },
    "SW": { "short": "...", "detailed": "...", "rationale": "..." },
    "W":  { "short": "...", "detailed": "...", "rationale": "..." },
    "NW": { "short": "...", "detailed": "...", "rationale": "..." }
  }
}

═══════════════════════════════════════
# 长度参考示例(请模仿此长度,但内容要紧扣用户实际任务)
═══════════════════════════════════════

假设用户任务:"明天和客户谈合作签约"

{
  "advice": {
    "N": {
      "short": "向北开启坦诚对话,主动抛出核心议题",
      "detailed": "面向北方与客户落座,合作水到渠成。宜你先开启关键话题,氛围融洽容易达成默契。展现你的舒展力,在共同利益上多停留,避开价格细节的过早较真。",
      "rationale": "签约谈合作需要你气场稳定且能影响对方。这个时辰的北方组合让你既有底气又不咄咄逼人,关键条款能水到渠成地推进,适合主动出击。"
    },
    "NE": {
      "short": "东北方暂缓推进,先观察对方态度",
      "detailed": "东北方此时气场偏沉重,与你日主略有冲突。宜倾听对方意见再回应,不急于表态。可以借此摸清对方真实诉求,避免一时口快说出不利的让步条件。",
      "rationale": "谈合作前期最忌急于表达。这个组合让你更适合扮演倾听者,等对方先暴露底牌,你的位置反而更主动,避免开局就被对方带节奏。"
    }
  }
}

字数核对:
  - short ≈ 17 字 ✓(在 15-25 范围内)
  - detailed ≈ 125 字 ✓(在 100-150 范围内)
  - rationale ≈ 105 字 ✓(在 80-120 范围内)

注意:你输出的 8 个方位文案【各不相同】,反映各自不同的 current_level,
所有文案【紧扣用户当前要做的事】。`;

  const systemEn = `You are a senior pojulife Syncro analyst. Generate precise, life-aware guidance for the 8 directions of the current hour, tailored to what the user is about to do.

═══════════════════════════════════════
# What the user is about to do
═══════════════════════════════════════

"${body.task_description}"

═══════════════════════════════════════
# User profile (life chart summary)
═══════════════════════════════════════

${body.profile_summary}

═══════════════════════════════════════
# Current hour & date
═══════════════════════════════════════

Hour: ${body.hour_label} (${body.hour_range})
Date: ${dateStr}

═══════════════════════════════════════
# 8 direction states (precomputed locally, DO NOT MODIFY)
═══════════════════════════════════════

${cellsDesc}

Notes:
- current_level is the final result computed from 5 dimensions
- You CANNOT modify levels, only write copy
- key_hints are internal signals; you can internalize them but DO NOT echo field names

═══════════════════════════════════════
# Your task: 3 fields per direction
═══════════════════════════════════════

【1】short (40-60 chars)
  - One-sentence direct action advice
  - Shown below the compass center

【2】detailed (220-300 chars)
  - 2-3 sentences specific action guidance
  - Shown in "Why This Hour" modal

【3】rationale (180-260 chars)
  - 1-2 sentences cause-and-effect, MUST tie to what the user is doing
  - Shown in "Why This Hour" modal
  - Translate internal signals into user-friendly language

═══════════════════════════════════════
# Strict Rules
═══════════════════════════════════════

# Language Consistency MUST (CRITICAL!)

Output language MUST match the actual language of user's task "${body.task_description}":
  - User describes in Chinese → output in Simplified Chinese
  - User describes in English → output in English
  - User uses other language → match that language
  - Mixed → use the primary language

Do NOT rely on locale param. Look at what language the user actually typed.

Character limits by output language:
  - Chinese: short 15-25 chars / detailed 100-150 chars / rationale 80-120 chars
  - English: short 40-60 chars / detailed 220-300 chars / rationale 180-260 chars

Character limits MUST be respected:
  - short: 40-60 chars
  - detailed: 220-300 chars
  - rationale: 180-260 chars

All 8 directions (N/NE/E/SE/S/SW/W/NW) MUST be included.

Specificity MUST:
  - rationale MUST mention what the user is about to do
  - rationale MUST mention Syncro / this Syncro at least once per direction
  - No generic copy

Forbidden:
  - astrology, divination, fortune-telling, predict, destiny
  - Don't expose: qimen, yong_shen, day_master, key_hints
  - Use: pojulife / Syncro / reading / analysis

Level names (use these in copy):
  - open_current, following_current, stillwater, crosscurrent, undertow

═══════════════════════════════════════
# Output format (strict JSON, nothing else)
═══════════════════════════════════════

{
  "advice": {
    "N":  { "short": "...", "detailed": "...", "rationale": "..." },
    "NE": { "short": "...", "detailed": "...", "rationale": "..." },
    ... all 8 directions ...
  }
}`;

  const system = isZh ? `${systemZh}\n\n${defenseBlock}` : `${systemEn}\n\n${defenseBlock}`;

  const userMsg = isZh
    ? `请为${body.hour_label}时辰(${body.hour_range})的 8 个方位生成文案,严格按字数约束,内容紧扣用户当前要做的事。只输出 JSON,不输出其他文字。`
    : `Generate copy for the 8 directions of ${body.hour_label} (${body.hour_range}). Strict character limits. Tie every rationale to what the user is doing. Output JSON only.`;

  return { system, user: userMsg };
}

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  else headers["HTTP-Referer"] = "https://pojulife.com";
  if (title) headers["X-Title"] = title;
  else headers["X-Title"] = "pojulife";
  return headers;
}

function buildOpenRouterBody(
  model: string,
  system: string,
  user: string,
  includeReasoning: boolean,
  sessionId?: string,
): Record<string, unknown> {
  return {
    model,
    stream: true,
    ...(includeReasoning ? { reasoning: { effort: "high" } } : {}),
    response_format: { type: "json_object" },
    ...openRouterRequestExtras(sessionId ? syncroCacheSessionId(sessionId) : undefined),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

function adviceByDirectionToCells(
  input: SyncroLlmHourInput,
  advice: Record<string, DirectionAdvice>,
): Record<string, SyncroHourAdviceCell> {
  const adviceByKey: Record<string, SyncroHourAdviceCell> = {};
  for (const cell of input.cells) {
    const dirAdvice = advice[cell.direction];
    if (dirAdvice) {
      adviceByKey[cell.key] = {
        short_advice: (dirAdvice.short ?? "").trim(),
        detailed_advice: (dirAdvice.detailed ?? "").trim(),
        rationale: (dirAdvice.rationale ?? "").trim(),
      };
    }
  }
  return adviceByKey;
}

function parseAdviceJson(
  accumContent: string,
  input: SyncroLlmHourInput,
): Record<string, SyncroHourAdviceCell> {
  const parsed = JSON.parse(accumContent) as { advice?: Record<string, DirectionAdvice> };
  const advice = parsed.advice ?? null;
  if (!advice) {
    throw new SyncroParseError(accumContent, "missing advice field");
  }
  return adviceByDirectionToCells(input, advice);
}

async function streamOpenRouterCompletion(
  input: SyncroLlmHourInput,
  system: string,
  user: string,
  model: string,
  callbacks: SyncroLlmHourCallbacks | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

  callbacks?.onConnecting?.();

  console.log(`[helper] ${input.hour_id} start fetch, model=${model}`);

  let llmRes = await fetch(openRouterUrl, {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(buildOpenRouterBody(model, system, user, true, input.session_id)),
    signal,
  });

  if (!llmRes.ok && llmRes.status >= 400 && llmRes.status < 500) {
    llmRes = await fetch(openRouterUrl, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(buildOpenRouterBody(model, system, user, false, input.session_id)),
      signal,
    });
  }

  if (!llmRes.ok || !llmRes.body) {
    const errText = await llmRes.text().catch(() => "unknown");
    console.error(
      `[syncro-llm-core] ${input.hour_id} LLM HTTP ${llmRes.status}:`,
      errText.slice(0, 300),
    );
    throw new SyncroLlmHttpError(
      llmRes.status,
      errText.slice(0, 200),
      llmRes.status === 429 || llmRes.status >= 500,
    );
  }

  const reader = llmRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumContent = "";
  let inReasoning = false;
  let writingPhaseSent = false;
  let chunkCount = 0;
  let firstContentChunkLogged = false;

  callbacks?.onReasoning?.();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]" || !payload) continue;

      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
        const delta = choice?.delta as Record<string, unknown> | undefined;
        if (!delta) continue;

        const reasoningText = extractReasoningDelta(delta);
        if (reasoningText) {
          if (!inReasoning) {
            inReasoning = true;
          }
          callbacks?.onReasoningChunk?.(reasoningText);
        }

        if (typeof delta.content === "string" && delta.content) {
          if (inReasoning) {
            inReasoning = false;
            if (!writingPhaseSent) {
              callbacks?.onWriting?.();
              writingPhaseSent = true;
            }
          } else if (!writingPhaseSent) {
            callbacks?.onWriting?.();
            writingPhaseSent = true;
          }
          accumContent += delta.content;
          chunkCount++;
          if (!firstContentChunkLogged) {
            firstContentChunkLogged = true;
            console.log(`[helper] ${input.hour_id} first content chunk`);
          }
          callbacks?.onContentChunk?.(delta.content);
          void appendToStream(input.session_id, input.hour_id, delta.content).catch((e) => {
            console.warn(`[syncro-llm-core] ${input.hour_id} appendToStream failed:`, e);
          });
        }
      } catch {
        console.warn(`[syncro-llm-core] ${input.hour_id} parse line failed:`, payload.slice(0, 100));
      }
    }
  }

  console.log(
    `[syncro-llm-core] ${input.hour_id} stream done, chunks=${chunkCount}, content len=${accumContent.length}`,
  );

  return accumContent;
}

/**
 * Generate Syncro hour advice via OpenRouter (streaming internally; optional callbacks).
 */
export async function generateSyncroHourAdvice(
  input: SyncroLlmHourInput,
  callbacks?: SyncroLlmHourCallbacks,
  signal?: AbortSignal,
): Promise<SyncroLlmHourResult> {
  const outputLocale = resolveSyncroBatchOutputLocale(input.locale, input.task_description);
  const cached = await getCachedOutput(input.session_id, outputLocale, input.hour_id);
  if (cached) {
    console.log(`[syncro-llm-core] ${input.hour_id} 命中 output 缓存,直接返回`);
    return {
      advice: sanitizeSyncroHourAdvice(cached, outputLocale),
      raw_content: "",
      from_cache: true,
    };
  }

  const { system, user } = buildPrompt(input);
  const model = getOpenRouterDefaultModel();

  await cacheLlmInput(input.session_id, input.hour_id, {
    system,
    user,
    model,
  });

  const accumContent = await streamOpenRouterCompletion(
    input,
    system,
    user,
    model,
    callbacks,
    signal,
  );

  let adviceByKey: Record<string, SyncroHourAdviceCell>;
  try {
    adviceByKey = parseAdviceJson(accumContent, input);
    console.log(
      `[helper] ${input.hour_id} parse success, advice keys = ${Object.keys(adviceByKey).length}`,
    );
  } catch (e) {
    if (e instanceof SyncroParseError) {
      console.error(`[helper] ${input.hour_id} parse failed:`, e.message);
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[helper] ${input.hour_id} parse failed:`, message, accumContent.slice(0, 300));
    throw new SyncroParseError(accumContent, message);
  }

  await cacheLlmOutput(input.session_id, outputLocale, input.hour_id, adviceByKey);
  await clearStream(input.session_id, input.hour_id);

  const finalized = sanitizeSyncroHourAdvice(adviceByKey, outputLocale);

  return {
    advice: finalized,
    raw_content: accumContent,
    from_cache: false,
  };
}
