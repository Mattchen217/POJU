/**
 * 从 LLM 的 context_updates 合并到 ContextCollection（Part1 · Step 5）
 */

import type { ContextCollection, POJUAgentState, QuestionCategory } from "@/lib/poju/agent-state";

export interface LLMContextUpdates {
  duration?: string | null;
  trigger_event?: string | null;
  emotional_state?: string | null;
  what_tried?: string[];
  desired_outcome?: string | null;
  category_specific?: Record<string, unknown>;
}

const RESERVED_CONTEXT_KEYS = new Set([
  "duration",
  "trigger_event",
  "emotional_state",
  "what_tried",
  "desired_outcome",
  "category_specific",
  "question_category",
  "concern_area",
]);

/** 将 LLM 返回的扁平 `context_updates` 转为结构化增量（未知键进入 `category_specific`）。 */
export function recordToLLMContextUpdates(raw: Record<string, unknown> | null | undefined): LLMContextUpdates {
  const out: LLMContextUpdates = {};
  if (!raw || typeof raw !== "object") return out;

  if (raw.duration !== undefined) out.duration = raw.duration as string | null;
  if (raw.trigger_event !== undefined) out.trigger_event = raw.trigger_event as string | null;
  if (raw.emotional_state !== undefined) out.emotional_state = raw.emotional_state as string | null;
  if (raw.desired_outcome !== undefined) out.desired_outcome = raw.desired_outcome as string | null;

  if (raw.what_tried !== undefined) {
    if (Array.isArray(raw.what_tried)) out.what_tried = raw.what_tried.map((x) => String(x));
    else if (typeof raw.what_tried === "string" && raw.what_tried.trim())
      out.what_tried = [raw.what_tried.trim()];
  }

  if (raw.category_specific !== undefined && raw.category_specific !== null && typeof raw.category_specific === "object") {
    out.category_specific = { ...(raw.category_specific as Record<string, unknown>) };
  }

  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (RESERVED_CONTEXT_KEYS.has(k)) continue;
    extra[k] = v;
  }
  if (Object.keys(extra).length > 0) {
    out.category_specific = { ...out.category_specific, ...extra };
  }

  return out;
}

const CATEGORY_ALIASES: Record<string, QuestionCategory> = {
  career: "career",
  job: "career",
  work: "career",
  relationship: "relationship",
  love: "relationship",
  wealth: "wealth",
  money: "wealth",
  health: "health",
  family: "family",
  decision: "decision",
  interpersonal: "interpersonal",
  other: "other",
  事业: "career",
  感情: "relationship",
  财富: "wealth",
  健康: "health",
  家庭: "family",
  决策: "decision",
  人际: "interpersonal",
};

export function extractQuestionCategory(raw: Record<string, unknown> | null | undefined): QuestionCategory {
  if (!raw || typeof raw !== "object") return null;
  const rawCat = raw.question_category ?? raw.concern_area;
  if (rawCat == null) return null;
  const s = String(rawCat).trim();
  if (!s) return null;
  const key = s.toLowerCase();
  if (key in CATEGORY_ALIASES) return CATEGORY_ALIASES[key]!;
  if (s in CATEGORY_ALIASES) return CATEGORY_ALIASES[s]!;
  const allowed: QuestionCategory[] = [
    "career",
    "relationship",
    "wealth",
    "health",
    "family",
    "decision",
    "interpersonal",
    "other",
  ];
  return allowed.includes(key as QuestionCategory) ? (key as QuestionCategory) : null;
}

export function mergeContextUpdates(
  existing: ContextCollection,
  updates: LLMContextUpdates | null | undefined,
): ContextCollection {
  if (!updates || typeof updates !== "object") return existing;

  const merged: ContextCollection = {
    ...existing,
    category_specific: { ...existing.category_specific },
  };

  if (updates.duration !== undefined) merged.duration = updates.duration;
  if (updates.trigger_event !== undefined) merged.trigger_event = updates.trigger_event;
  if (updates.emotional_state !== undefined) merged.emotional_state = updates.emotional_state;
  if (updates.desired_outcome !== undefined) merged.desired_outcome = updates.desired_outcome;
  if (Array.isArray(updates.what_tried)) {
    const combined = [...existing.what_tried, ...updates.what_tried];
    merged.what_tried = [...new Set(combined.map((s) => String(s).trim()).filter(Boolean))];
  }
  if (updates.category_specific && typeof updates.category_specific === "object") {
    merged.category_specific = {
      ...merged.category_specific,
      ...updates.category_specific,
    };
  }

  return merged;
}

export function formatContextForPrompt(state: POJUAgentState): string {
  const c = state.context_collected;
  const lines: string[] = [];

  lines.push("## 已收集情境信息");
  lines.push(`- 持续时间: ${c.duration ?? "未提供"}`);
  lines.push(`- 触发事件: ${c.trigger_event ?? "未提供"}`);
  lines.push(`- 情绪状态: ${c.emotional_state ?? "未提供"}`);
  lines.push(`- 已尝试: ${(c.what_tried ?? []).length > 0 ? (c.what_tried ?? []).join("；") : "未提供"}`);
  lines.push(`- 期望结果: ${c.desired_outcome ?? "未提供"}`);

  if (state.question_category) {
    lines.push(`\n## 问题类别: ${state.question_category}`);
    const keys = Object.keys(c.category_specific ?? {});
    if (keys.length > 0) {
      lines.push("### 类别相关字段");
      for (const k of keys) {
        const v = c.category_specific[k];
        lines.push(`- ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatMissingFieldsForPrompt(missing: { general: string[]; category_specific: string[] }): string {
  const lines: string[] = ["## 仍需收集的信息"];
  if (missing.general.length > 0) {
    lines.push("### 通用");
    for (const f of missing.general) lines.push(`- ${f}`);
  }
  if (missing.category_specific.length > 0) {
    lines.push("### 类别相关");
    for (const f of missing.category_specific) lines.push(`- ${f}`);
  }
  if (missing.general.length === 0 && missing.category_specific.length === 0) {
    lines.push("（暂无明确缺口，可继续追问细节或进入确认）");
  }
  return lines.join("\n");
}
