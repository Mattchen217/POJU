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
    ? `# core_judgments = 【机制读数】给机器的中立判断层（不是诗意、不是术语复述）

把 structured 译成【具体、可被下游直接引用】的机制读数。

规则：
1) 只输出 JSON；字段仅：identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state
2) 【禁止】输出 refs / climate_now（代码已算好）
3) 只展开 structured，【禁止】改判强弱/用神方向/喜忌/格局
4) 无比喻套话、无职业/婚恋场景、无年龄/干支纪年
5) 每字段 1 句——写【机制】（供给/消耗/缺口/杠杆），不要抽象意境

【禁止】裸干支、日主、身弱/身强、用神/喜神/忌神、刑冲合害原词。

反例（术语复述 / 空诗意）：
  ✗ "identity_anchor": "乙木日主，根基偏弱，依赖水木生扶。"
  ✗ "identity_anchor": "像一场温柔却坚定的苏醒。"
正例（机制读数 · 下游可直接用）：
  ✓ "identity_anchor": "供给端靠连接放大；硬撑独扛时输出会断。"
  ✓ "drive_mechanism": "表达与协调是主引擎；外部认可加速推进。"
  ✓ "structural_gap": "冷却阀偏弱——信息未齐就容易锁死决策。"
  ✓ "balance_anchor": "补稳定供给、减持续消耗，比加新任务更有效。"

自检：下游能否直接写成「锚元不足 + 耗元偏重 → …」式依据？不能 → 重写。`
    : `# core_judgments = mechanism readouts for machines (not poetry, not jargon)

Translate structured into concrete mechanism lines four products can quote.

Rules:
1) JSON only; keys: identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state
2) Never output refs / climate_now
3) Expand only — never re-judge strength / favorable directions / pattern
4) No metaphors, career/romance scenes, age/calendar years
5) One sentence per field — write mechanisms (supply / drain / gap / leverage), not vibes

Banned: bare Ganzhi, day-master / weak-self jargon, clash/combine jargon.

Bad: poetic abstraction or chart jargon.
Good: "Supply scales via connection; solo forcing cuts output." / "Cooling valve is weak — locks decisions before data is in."

Self-check: can a product turn this into an evidence line like "anchor short + drain heavy → …"? If not → rewrite.`;

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
