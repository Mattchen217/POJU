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

function buildCoreJudgmentsLlmPrompt(
  structured: ProfileStructured,
  locale: string,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const climate_now = buildClimateNowFromStructured(structured, locale);

  const system = zh
    ? `# core_judgments = 【已裁定的中立判断层】，不是术语复述

你把 structured 的技术数据，翻译成【中立、白话、可被下游四产品直接引用】的判断。

规则：
1) 只输出 JSON；字段仅：identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state
2) 【禁止】输出 refs / climate_now（代码已算好）
3) 只展开 structured，【禁止】改判强弱/用神方向/喜忌/格局
4) 无比喻套话、无职业/婚恋场景、无年龄/干支纪年/公历年
5) 每字段 1 句中性短读数（中文）

【禁止】出现：裸干支（乙/庚/寅/巳…）、日主、身弱/身强、用神/喜神/忌神、刑/冲/合/害/穿 等关系黑话。
【必须】用普通人能懂的中性机制语言。

反例（术语复述 · 零价值 · 会传染下游）：
  ✗ "identity_anchor": "乙木日主，根基偏弱，依赖水木生扶。"
  ✗ "exchange_mode": "天干乙庚合，地支寅巳刑害。"
正例（中立判断 · 下游可直接用）：
  ✓ "identity_anchor": "借力生长型：能量靠连接与节奏放大，硬撑则折。"
  ✓ "exchange_mode": "需要被稳定结构供给；擅长以协调与表达给出。"
  ✓ "structural_gap": "冷却机制不足，信息未齐就容易锁定决策。"

自检：这句话如果被 POJU/Match/Glyph/Syncro 直接引用给用户看，会不会露出命理黑话？会 → 重写。`
    : `# core_judgments = settled neutral Layer-1 judgments — NOT jargon restatement

Translate structured tech data into neutral vernacular judgments four products can quote to users.

Rules:
1) JSON only; keys: identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state
2) Never output refs / climate_now (code fills them)
3) Expand only — never re-judge strength / favorable directions / pattern
4) No stock metaphors, career/romance scenes, age/Ganzhi/calendar years
5) One short neutral sentence per field (English)

Banned: bare Ganzhi, day-master / weak-self jargon, clash/combine relation jargon.
Self-check: if POJU/Match/Glyph/Syncro quotes this to a user, would it leak chart jargon? If yes → rewrite.`;

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
 * On failure / blackspeak → deterministic template + loud warn.
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

  try {
    const { system, user } = buildCoreJudgmentsLlmPrompt(input.structured, input.locale);
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.35,
      max_tokens: 900,
      json_mode: true,
      reasoning_effort: "medium",
      session_id: input.session_id,
      call_type: "core_judgments",
      phase_name: "core_judgments_medium",
      signal: input.signal,
    });

    const interpretive = parseLlmInterpretiveJson(result.text ?? "");
    if (!interpretive) {
      console.warn("[fallback] core_judgments LLM parse failed — using template", {
        finish_reason: result.finish_reason,
        preview: (result.text ?? "").slice(0, 120),
      });
      return { judgments: fallback, source: "template_fallback" };
    }

    const joined = Object.values(interpretive).join("\n");
    if (hasCoreJudgmentsBlackspeak(joined)) {
      console.warn("[fallback] core_judgments LLM blackspeak rejected — using template", {
        preview: joined.slice(0, 160),
      });
      return { judgments: fallback, source: "template_fallback" };
    }

    const merged: CoreJudgments = { ...interpretive, climate_now, refs };
    if (!isCoreJudgments(merged)) {
      console.warn("[fallback] core_judgments LLM shape invalid — using template");
      return { judgments: fallback, source: "template_fallback" };
    }
    return { judgments: merged, source: "llm" };
  } catch (e) {
    console.warn("[fallback] core_judgments LLM call failed — using template", {
      reason: e instanceof Error ? e.message : String(e),
    });
    return { judgments: fallback, source: "template_fallback" };
  }
}
