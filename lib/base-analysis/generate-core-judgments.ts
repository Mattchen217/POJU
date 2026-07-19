/**
 * Option ② — independent medium call for interpretive core_judgments fields.
 * refs + climate_now ALWAYS filled from structured in code (never model).
 * Fallback = deterministic expand.
 *
 * core_judgments 给下游【原始真词】（零打标）—— 合规在叙事输出端。
 * 只拦恐吓/宿命红线（OUT_OF_SET_FORBIDDEN_HAN）。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildClimateNowFromStructured,
  buildCoreJudgmentsFromStructured,
  buildCoreJudgmentsRefsFromStructured,
  isCoreJudgments,
  type CoreJudgments,
} from "@/lib/base-analysis/core-judgments";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";
import { isEmptyResponseError } from "@/lib/llm/openrouter-retry";

const CJ_INTERPRETIVE_KEYS = [
  "identity_anchor",
  "drive_mechanism",
  "structural_gap",
  "balance_anchor",
  "exchange_mode",
  "leverage_state",
] as const;

// softMarkInterpretiveFields 已删 —— core_judgments 给下游原始真词，不打标。
// 合规在叙事【输出端】做（叙事有 5 类打标器+审计）。

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

/**
 * 兜底,不是预算(铁律 #7 —— 已在 90s超时 / 12000token / max_attempts:1 / 900-token 预算上栽过四次)。
 *
 * 真实胃口:2026-07-17 生产实测【单次约 80 秒】—— 示范句删掉后模型开始真推导,
 * reasoning 里要逐条自检「换个命盘会不会失效」、要把判断锚到 refs 的具体条目上。
 * 上一版给 45 秒 → 第 45 秒 abort → 一次【完全合格】的输出被丢掉 → 落套话模板。
 *
 * 这道闸只防"卡到天荒地老",不该参与决定成败:
 * 页面不卡死已由「外层不重试 openrouter_empty_after_resend」保证(最多 3 次调用)。
 * 3 次 × ~80s ≈ 240s,给 180s 意味着最多吃掉最后一次重试 —— 可接受。
 * ⚠️ 改小之前先看 OpenRouter 后台的真实耗时,别想当然。
 */
const CORE_JUDGMENTS_TOTAL_TIMEOUT_MS = 180_000;

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

/**
 * 只拦【恐吓/宿命红线】进 core_judgments —— 十恶大败/孤鸾煞/空亡这类，
 * 即使给下游也会把宿命论算进推理（用户原则：带恐吓的真算也不喂）。
 *
 * 【中性真词全部放行】：喜神/大运/相刑/贵人/十神… 都是下游真算的数据源，
 * core_judgments 给原始真词，合规在叙事【输出端】做。不再禁中性命理词。
 * 裸干支（甲乙…）也放行 —— 下游要它真算；叙事输出端会打标软译。
 */
export function hasCoreJudgmentsRedline(text: string): boolean {
  if (!text?.trim()) return false;
  return (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).some((b) => text.includes(b));
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
    ? `# core_judgments · 给下游机器的机制读数（不是给用户、不是诗意）

你把 structured 译成【具体、可被下游直接引用】的机制读数。下游是机器，给它【原始真词】——
需要写"喜神/大运/相刑/日主"这些命理词就【直接写】，不用软译、不用回避。合规是下游输出时的事，不是你的事。

## 板块一 · 六个字段各读什么（定义）

- identity_anchor —— 这套系统靠什么维持自己。读 day_master 五行 + strength：
  供给从哪来、什么条件下会断。写运转条件，不写性格形容词。
- drive_mechanism —— 什么动作能真的推进它。读 pattern + 在场十神 + strength：
  哪条通道推进、哪条消耗。⚠️ 供给偏弱时，泄身通道是【消耗】不是驱动——别把消耗写成驱动。
- structural_gap —— 它最先在哪里失效。读 ji_shen + strength + natal_relations：过载时先垮哪个环节。
- balance_anchor —— 补哪一路能拉回可用区。读 yong_shen + xi_shen：只写补什么方向，不写做什么动作（行动是下游第4段的活）。
- exchange_mode —— 它跟外界怎么换能量。读在场十神进/出两侧：需要外界给什么、最擅长给出什么。
- leverage_state —— 哪个条件成熟时收益最大。读 yong_shen 得力与否 + natal_relations：写条件，不写时机、不写"你应该"。

## 板块二 · 质量红线（这决定读数有没有用）

- **每条换个命盘就该失效**：六条里任一条换盘还成立 = 套话 = 重写。这是最重要的一条。
- **锚到这盘独有的算料**：structural_gap / leverage_state / balance_anchor 各自【至少锚住 refs 里一条具体条目】
  （某个 shensha_instance 或 natal_relation），不能只用强弱/喜忌三标签。
  · balance_anchor 尤其容易套话——必须说清"补哪一路，为了解开【这盘的哪条具体张力/缺口】"。
  · refs 两个清单都空的盘 → 锚 pattern 里的具体十神组合，说清它在当前强弱+喜忌下是推进还是消耗。
  · 【不为凑条目编造 refs 里没有的东西】。

## 板块三 · 只拦一类词（其余全放行）

- 唯一不能写的：恐吓/宿命词（十恶大败、孤鸾煞、空亡、血刃这类）——它们不是中性数据。
- 除此以外【所有命理真词随便用】：喜神/忌神/用神/大运/流年/相刑/相冲/十神/贵人/日主…
  下游要靠这些真词真算。你只管写准，不用替下游做合规。

## 板块四 · 输出格式

- 只输出 JSON；就这六个字段；每项一句。
- 不输出 refs / climate_now（代码已算好）。
- 只展开 structured，不改判强弱/用神方向/喜忌/格局。
- 不写比喻、不写职业/婚恋场景、不写年龄/纪年、不写行动清单。

## 反例（往反方向避）

  ✗ "identity_anchor": "像一场温柔却坚定的苏醒。"（空诗意，无机制）
  ✗ "drive_mechanism": 供给偏弱、泄身为忌时，把消耗当驱动
  ✗ "balance_anchor": "多做冥想、每天早起。"（越界写行动清单）
  ✗ 任何一条读起来像"大部分人都这样"的句子（套话）`
    : `# core_judgments · mechanism readouts for the downstream machine (not user-facing, not poetry)

Translate structured into concrete mechanism lines the downstream can quote. The downstream is a machine —
give it RAW real terms. If you need to write jargon (favorable-element, luck-pillar, punishment, day-master), write it
DIRECTLY — no soft-labeling, no avoidance. Compliance is the downstream's output job, not yours.

## Block 1 · What each field reads (definitions)
- identity_anchor — what keeps this system running. day_master element + strength: where supply comes from, when it cuts off.
- drive_mechanism — which actions advance it. pattern + present ten-gods + strength: propulsion vs drain (weak supply → outlets are drains).
- structural_gap — where it fails first. ji_shen + strength + natal_relations.
- balance_anchor — which direction restores usability. yong_shen + xi_shen: direction only, no action lists.
- exchange_mode — how it swaps energy outside. present ten-gods intake/output.
- leverage_state — which condition unlocks highest payoff. yong_shen support + natal_relations: condition, not timing/"you should".

## Block 2 · Quality line (this decides if the readout is useful)
- **Every line must fail on a different chart** — any line that still fits most people = stock = rewrite. Most important rule.
- **Anchor this chart's unique material**: structural_gap / leverage_state / balance_anchor each land on ≥1 concrete refs item
  (a shensha_instance or natal_relation), not just strength/xi-ji labels. Never invent items absent from refs.

## Block 3 · Only one class is banned (everything else allowed)
- The only forbidden words: fear/fate terms (the catastrophic-shensha class). Not neutral data.
- Every other real term is allowed: favorable/unfavorable-element, luck-pillar, punishment/clash, ten-gods, day-master…
  The downstream needs them to compute. Write accurately; don't do the downstream's compliance.

## Block 4 · Output format
- JSON only; the six keys; one sentence each. Never output refs / climate_now.
- Expand only — never re-judge strength / directions / pattern.
- No metaphors, no career/romance scenes, no ages/calendar years, no action lists.

## Bad (avoid)
  ✗ poetic abstraction with no mechanism
  ✗ calling a depleting outlet the drive when supply is weak
  ✗ action checklists in balance_anchor
  ✗ any sentence that fits most other charts`;

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
 * On failure / redline / copy → same-params retry (max 3), then deterministic template + loud warn.
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
        // 给下游【原始真词】—— 不打标。只拦【恐吓宿命红线】（十恶大败/孤鸾煞…），
        // 中性真词（喜神/大运/相刑）放行，下游据此真算。合规在叙事输出端。
        if (hasCoreJudgmentsRedline(Object.values(interpretive).join("\n"))) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — 出现恐吓宿命红线词，重发`,
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
        const merged: CoreJudgments = {
          ...(interpretive as Pick<CoreJudgments, (typeof CJ_INTERPRETIVE_KEYS)[number]>),
          climate_now,
          refs,
        };
        if (!isCoreJudgments(merged)) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — shape invalid after merge, resending`,
          );
          continue;
        }
        console.log(`[core_judgments] ok on attempt ${attempt}/${MAX_ATTEMPTS} (raw terms → downstream)`);
        return { judgments: merged, source: "llm" };
      } catch (e) {
        if (isEmptyResponseError(e)) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — empty after transport resend。` +
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
  // 模板路径同样给下游【原始真词】—— 不打标
  const safeFallback: CoreJudgments = {
    ...fallback,
    ...Object.fromEntries(CJ_INTERPRETIVE_KEYS.map((k) => [k, fallback[k]])),
    climate_now: fallback.climate_now,
    refs: fallback.refs,
  };
  return { judgments: safeFallback, source: "template_fallback" };
}
