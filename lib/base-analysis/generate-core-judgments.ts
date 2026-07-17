/**
 * Option ② — independent medium call for interpretive core_judgments fields.
 * refs + climate_now ALWAYS filled from structured in code (never model).
 * Fallback = deterministic expand.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildClimateNowFromStructured,
  buildCoreJudgmentsFromStructured,
  buildCoreJudgmentsRefsFromStructured,
  isCoreJudgments,
  type CoreJudgments,
} from "@/lib/base-analysis/core-judgments";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";
import { isEmptyResponseError } from "@/lib/llm/openrouter-retry";

/**
 * 预算按【真实胃口】给,不按想当然(铁律 #7 —— 已在 90s超时 / 12000token / max_attempts:1 上栽过三次)。
 *
 * 900 是「照抄时代」的数:当时提示词里有 4 条示范句,模型抄一遍几乎不用 reasoning。
 * 示范句删掉后它开始【真推导】,而 reasoning token 是【计入 max_tokens 的】——
 * 实测 7 次调用 output 全部卡死在 900、finish_reason 全部 length、content 一个字都没吐。
 *
 * 对照同仓基线:底座叙事 10,000(route.ts)、违规修补 1,400(repair-violations.ts)。
 * max_tokens 是【上限不是预付】—— 给宽不花钱,给窄会把整条链锁死。
 */
const CORE_JUDGMENTS_MAX_TOKENS = 4000;

/** 外层重试次数。注意:传输层自己还有 MAX_EMPTY_CONTENT_RESEND=3,两层会相乘 —— 见下方 catch。 */
const MAX_ATTEMPTS = 3;

/** core_judgments 失败不该让用户看不到报告 —— route 目前 await 在叙事流之前。 */
const CORE_JUDGMENTS_TOTAL_TIMEOUT_MS = 45_000;

/** Model only writes these — climate_now / refs are code. */
const LLM_INTERPRETIVE_KEYS = [
  "identity_anchor",
  "drive_mechanism",
  "structural_gap",
  "balance_anchor",
  "exchange_mode",
  "leverage_state",
] as const;

type LlmInterpretive = Pick<CoreJudgments, (typeof LLM_INTERPRETIVE_KEYS)[number]>;

function parseLlmInterpretiveJson(raw: string): LlmInterpretive | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const out: Partial<LlmInterpretive> = {};
    for (const key of LLM_INTERPRETIVE_KEYS) {
      const v = obj[key];
      if (typeof v !== "string" || !v.trim()) return null;
      out[key] = v.trim();
    }
    return out as LlmInterpretive;
  } catch {
    return null;
  }
}

/** Reject charts blackspeak that must never reach four products. */
export function hasCoreJudgmentsBlackspeak(text: string): boolean {
  if (!text?.trim()) return false;
  if (/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/.test(text)) return true;
  const bans = [
    "日主",
    "身弱",
    "身强",
    "身旺",
    "用神",
    "喜神",
    "忌神",
    "天干",
    "地支",
    "藏干",
    "大运",
    "流年",
    "刑冲",
    "合冲",
    "相冲",
    "相刑",
    "相合",
    "六合",
    "三合",
    "穿害",
    "相害",
    "刑害",
    "十神",
  ];
  return bans.some((b) => text.includes(b));
}

/**
 * 提示词里的任何常量串一旦出现在输出里 = 照抄 = 这个用户拿到的是别人的读数。
 * 铁律 #1：示范句会被逐字照抄。示范句已删，这道闸负责它以后别再长回来。
 * 同时比对代码兜底模板 —— 输出 ≈ 兜底 = 这次 LLM 调用白烧，也该重发。
 */
export function looksCopiedFromPromptOrTemplate(
  interpretive: Record<string, string>,
  fallback: CoreJudgments,
): { copied: boolean; hits: string[] } {
  const hits: string[] = [];
  const norm = (s: string) => s.replace(/[\s。；;,，.…—\-"'「」“”]/g, "");
  for (const [key, value] of Object.entries(interpretive)) {
    const v = norm(value);
    if (v.length < 8) {
      hits.push(`${key}: too short to be a readout`);
      continue;
    }
    const tpl = norm(String((fallback as Record<string, unknown>)[key] ?? ""));
    // 与代码兜底几乎一致 → LLM 没带来任何东西
    if (tpl && (v === tpl || v.includes(tpl) || tpl.includes(v))) {
      hits.push(`${key}: ≈ template fallback`);
    }
  }
  return { copied: hits.length > 0, hits };
}

function buildCoreJudgmentsLlmPrompt(
  structured: ProfileStructured,
  locale: string,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const climate_now = buildClimateNowFromStructured(structured, locale);

  const system = zh
    ? `# core_judgments = 【机制读数】给机器的中立判断层（不是诗意、不是术语复述）

把 structured 译成【具体、可被下游直接引用】的机制读数。

## 六个字段各自读什么（这是定义，不是可选项）

- identity_anchor —— **这套系统靠什么维持自己**。读 day_master 五行 + strength：
  供给从哪来、在什么条件下会断。写"运转条件"，不写性格形容词。
- drive_mechanism —— **什么动作能真的推进它**。读 pattern + 在场十神 + strength：
  哪条通道是推进、哪条是消耗。⚠️ 供给偏弱时，泄身通道是**消耗**，不是驱动 —— 别把消耗写成驱动。
- structural_gap —— **它最先在哪里失效**。读 ji_shen + strength + natal_relations：
  过载时先垮的是哪个环节。写失效点，不写"缺点"。
- balance_anchor —— **补哪一路能把它拉回可用区**。读 yong_shen + xi_shen：
  只写"补什么方向"，**不写做什么动作**（行动是下游第4段的活，这里越界会锁死下游）。
- exchange_mode —— **它跟外界怎么换能量**。读在场十神的进/出两侧：
  需要外界给什么、最擅长给出什么。
- leverage_state —— **哪一个条件成熟时收益最大**。读 yong_shen 得力与否 + natal_relations：
  写"条件"，不写"时机"，不写"你应该"。

## 硬规则

1) 只输出 JSON；字段仅上述六项，每项 1 句。
2) 【禁止】输出 refs / climate_now（代码已算好）。
3) 只展开 structured，【禁止】改判强弱/用神方向/喜忌/格局。
4) 【禁止】裸干支、日主、身弱/身强、用神/喜神/忌神、刑冲合害原词。
5) 【禁止】比喻、职业/婚恋场景、年龄/干支纪年、行动清单。
6) **每条必须能被换成另一个命盘时失效** —— 六条里有任何一条换盘还成立，那条就是套话，重写。
7) refs 里的 shensha_instances 与 natal_relations 是这盘**独有**的算料：
   至少 structural_gap 与 leverage_state 必须落到其中具体条目上，不能只用强弱/喜忌三标签。

## 反例（照这个方向避）

  ✗ "identity_anchor": "乙木日主，根基偏弱，依赖水木生扶。"（术语复述 + 裸干支）
  ✗ "identity_anchor": "像一场温柔却坚定的苏醒。"（空诗意，无机制）
  ✗ "drive_mechanism": "表达与创造是主引擎"（当供给偏弱、泄身为忌时：把消耗当驱动）
  ✗ "balance_anchor": "多做冥想、每天早起半小时。"（越界写成行动清单）
  ✗ 任何一条读起来像「大部分人都这样」的句子。`
    : `# core_judgments = mechanism readouts for machines (not poetry, not jargon)

Translate structured into concrete mechanism lines four products can quote.

## What each field reads (definitions — not optional)

- identity_anchor —— **what keeps this system running**. Read day_master element + strength:
  where supply comes from, and under what conditions it cuts off. Write operating conditions, not personality adjectives.
- drive_mechanism —— **which actions actually advance it**. Read pattern + present ten-gods + strength:
  which channel is propulsion vs drain. When supply is weak, depleting outlets are **drains**, not drive — never write a drain as drive.
- structural_gap —— **where it fails first**. Read ji_shen + strength + natal_relations:
  which link collapses under overload. Write the failure point, not a "flaw".
- balance_anchor —— **which direction restores usability**. Read yong_shen + xi_shen:
  only "what to replenish" — **not** action checklists (actions belong to downstream delivery).
- exchange_mode —— **how it swaps energy with the outside**. Read present ten-gods on intake/output sides:
  what it needs from outside, what it gives best.
- leverage_state —— **which condition unlocks the highest payoff**. Read whether yong_shen is supported + natal_relations:
  write the condition — not timing, not "you should".

## Hard rules

1) JSON only; the six keys above; one sentence each.
2) Never output refs / climate_now (code-filled).
3) Expand only — never re-judge strength / favorable directions / pattern.
4) Banned: bare Ganzhi, day-master / weak-self / favorable-element jargon, clash/combine jargon.
5) Banned: metaphors, career/romance scenes, age/calendar years, action lists.
6) **Every line must fail on a different chart** — if any line still fits most people, rewrite it.
7) refs.shensha_instances and natal_relations are this chart's unique material:
   at least structural_gap and leverage_state must land on a concrete item from them — not only strength / xi-ji labels.

## Bad (avoid these directions)

  ✗ "identity_anchor": bare Ganzhi + "weak self needs water/wood support" (jargon restatement)
  ✗ "identity_anchor": poetic abstraction with no mechanism
  ✗ "drive_mechanism": calling a depleting outlet the drive when supply is weak
  ✗ "balance_anchor": meditation / wake-up checklists (action overreach)
  ✗ any sentence that still works for most other charts`;

  const user = `${zh ? "structured 摘要 + 代码已填字段（只读）" : "structured summary + code-filled fields (read-only)"}:\n\`\`\`json\n${JSON.stringify(
    {
      day_master_element_only: structured.day_master,
      strength: structured.strength,
      yong_shen_direction: structured.yong_shen,
      xi_shen: structured.xi_shen,
      ji_shen: structured.ji_shen,
      pattern: structured.pattern,
      refs,
      climate_now_code_filled: climate_now,
      note: zh
        ? "climate_now 已由代码填好——你不要写 climate_now；不要推算大运干支"
        : "climate_now is code-filled — do not invent decade stems",
    },
    null,
    2,
  )}\n\`\`\``;

  return { system, user };
}

export type GenerateCoreJudgmentsResult = {
  judgments: CoreJudgments;
  source: "llm" | "template_fallback";
};

/**
 * Per-profile medium call. refs + climate_now from code.
 * On failure / blackspeak / copy → same-params retry (max 3), then deterministic template + loud warn.
 */
export async function generateCoreJudgmentsForProfile(input: {
  structured: ProfileStructured;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
}): Promise<GenerateCoreJudgmentsResult> {
  const refs = buildCoreJudgmentsRefsFromStructured(input.structured);
  const climate_now = buildClimateNowFromStructured(input.structured, input.locale);
  const fallback = buildCoreJudgmentsFromStructured(input.structured, input.locale);

  // 总超时:core_judgments 是 Layer1 给机器的,它失败【不该】让用户看不到 Layer2 报告。
  // route 目前是 await 在叙事流【之前】的 —— 在改成并行之前,这道闸是页面不卡死的唯一保证。
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("core_judgments_total_timeout")),
    CORE_JUDGMENTS_TOTAL_TIMEOUT_MS,
  );
  input.signal?.addEventListener("abort", () => ctrl.abort(input.signal?.reason), { once: true });
  const deadline = Date.now() + CORE_JUDGMENTS_TOTAL_TIMEOUT_MS;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline) {
        console.warn(
          `[core_judgments] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})—— 落代码模板,绝不拖住叙事流。`,
        );
        break;
      }
      try {
        const { system, user } = buildCoreJudgmentsLlmPrompt(input.structured, input.locale);
        const result = await openRouterChatCompletion({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.35,
          max_tokens: CORE_JUDGMENTS_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "medium",
          session_id: input.session_id,
          call_type: "core_judgments",
          phase_name: "core_judgments_medium",
          signal: ctrl.signal,
        });

        // 【确定性失败】必须响亮 —— 这是 2026-07 那次「7 次调用 + 页面卡死」的唯一真信号,
        // 当时它被 "call failed" 那句糊掉了整整一轮排查(铁律 #5)。
        if (result.finish_reason === "length") {
          console.warn(
            `[core_judgments] ⚠️ finish_reason=length —— max_tokens(${CORE_JUDGMENTS_MAX_TOKENS}) 被吃光。` +
              `这是【确定性失败】:同参数重发多少次都还是 length。要【加预算】,不是加重试。`,
            { text_preview: (result.text ?? "").slice(0, 80) },
          );
        }

        const interpretive = parseLlmInterpretiveJson(result.text ?? "");
        if (!interpretive) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — parse failed, resending same params`,
            { finish_reason: result.finish_reason },
          );
          continue;
        }
        if (hasCoreJudgmentsBlackspeak(Object.values(interpretive).join("\n"))) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — blackspeak, resending same params`,
          );
          continue;
        }
        const copy = looksCopiedFromPromptOrTemplate(interpretive, fallback);
        if (copy.copied) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — 疑似照抄/套话,同参数重发`,
            { hits: copy.hits },
          );
          continue;
        }
        const merged: CoreJudgments = { ...interpretive, climate_now, refs };
        if (!isCoreJudgments(merged)) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — shape invalid, resending same params`,
          );
          continue;
        }
        return { judgments: merged, source: "llm" };
      } catch (e) {
        // 传输层已经同参数重发过 MAX_EMPTY_CONTENT_RESEND=3 次了。
        // 外层【绝不能】再套一圈 —— 那不是"重试",那是把 3 次变成 9 次。
        // 连续空回复 = 确定性失败(多半 max_tokens 不够,reasoning 吃光预算),重发解决不了。
        if (isEmptyResponseError(e)) {
          console.warn(
            "[core_judgments] 传输层重发已用尽(openrouter_empty_after_resend)—— 外层不再重试,直接落模板。" +
              "【多半是 max_tokens 不够,先查 finish_reason 是不是 length,别加重试。】",
          );
          break;
        }
        if (ctrl.signal.aborted) {
          console.warn("[core_judgments] 已中止(超时或上游取消)—— 落模板。");
          break;
        }
        console.warn(
          `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — call failed, resending same params`,
          { reason: e instanceof Error ? e.message : String(e) },
        );
      }
    }
  } finally {
    clearTimeout(timer);
  }

  console.warn(
    "[fallback] core_judgments 落代码模板。**这份底座是套话,四产品都会受影响** —— 别当正常情况放过。",
  );
  return { judgments: fallback, source: "template_fallback" };
}
