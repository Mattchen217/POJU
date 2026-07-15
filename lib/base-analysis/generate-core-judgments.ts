/**
 * Option ② — independent medium call for interpretive core_judgments fields.
 * refs ALWAYS filled from structured in code (never model). Fallback = deterministic expand.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildCoreJudgmentsFromStructured,
  buildCoreJudgmentsRefsFromStructured,
  isCoreJudgments,
  type CoreJudgments,
} from "@/lib/base-analysis/core-judgments";
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";

const INTERPRETIVE_KEYS = [
  "identity_anchor",
  "drive_mechanism",
  "structural_gap",
  "balance_anchor",
  "exchange_mode",
  "leverage_state",
  "climate_now",
] as const;

type InterpretiveOnly = Pick<CoreJudgments, (typeof INTERPRETIVE_KEYS)[number]>;

function parseInterpretiveJson(raw: string): InterpretiveOnly | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const out: Partial<InterpretiveOnly> = {};
    for (const key of INTERPRETIVE_KEYS) {
      const v = obj[key];
      if (typeof v !== "string" || !v.trim()) return null;
      out[key] = v.trim();
    }
    return out as InterpretiveOnly;
  } catch {
    return null;
  }
}

function buildCoreJudgmentsLlmPrompt(
  structured: ProfileStructured,
  locale: string,
): { system: string; user: string } {
  const zh = locale.startsWith("zh");
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const system = zh
    ? `你把本地排盘 structured 展开为 Layer-1 机器层判断（给下游四产品用）。
规则：
1) 只输出 JSON；字段仅：identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state, climate_now
2) 【禁止】输出 refs（代码会填）
3) 只展开 structured，【禁止】改判强弱/用神/喜忌/格局
4) 无比喻、无场景、无职业/婚恋、无年龄/干支纪年/公历年；climate_now 只写「当前这步」能量气候
5) 每字段 1 句中性短读数（中文）`
    : `Expand local chart structured into Layer-1 machine judgments for four products.
Rules:
1) JSON only; keys: identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state, climate_now
2) Never output refs (code fills them)
3) Expand only — never re-judge strength/yong/xi/ji/pattern
4) No metaphor, scene, career/romance, age/Ganzhi/calendar year; climate_now = current-step energy climate only
5) One short neutral sentence per field (English)`;

  const user = `${zh ? "structured + refs（只读）" : "structured + refs (read-only)"}:\n\`\`\`json\n${JSON.stringify(
    {
      day_master: structured.day_master,
      strength: structured.strength,
      yong_shen: structured.yong_shen,
      xi_shen: structured.xi_shen,
      ji_shen: structured.ji_shen,
      pattern: structured.pattern,
      refs,
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
 * Per-profile medium call (~$0.003). refs always from code.
 * On failure → deterministic template + loud warn (products keep working).
 */
export async function generateCoreJudgmentsForProfile(input: {
  structured: ProfileStructured;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
}): Promise<GenerateCoreJudgmentsResult> {
  const refs = buildCoreJudgmentsRefsFromStructured(input.structured);
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

    const interpretive = parseInterpretiveJson(result.text ?? "");
    if (!interpretive) {
      console.warn("[fallback] core_judgments LLM parse failed — using template", {
        finish_reason: result.finish_reason,
      });
      return { judgments: fallback, source: "template_fallback" };
    }

    const merged: CoreJudgments = { ...interpretive, refs };
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
