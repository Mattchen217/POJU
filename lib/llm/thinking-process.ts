/**
 * Build user-visible "thinking process" text from OpenRouter reasoning tokens
 * and optional POJU `thought` JSON (context score / missing keys).
 */

export type PojuThoughtSlice = {
  current_context_score?: number;
  missing_keys?: string[];
  next_best_action?: string;
};

export type ThinkingProcessInput = {
  openRouterReasoning?: string | null;
  reasoning_details?: unknown;
  thought?: PojuThoughtSlice | null;
  locale?: string;
};

export function extractOpenRouterReasoningFields(message: unknown): {
  reasoning?: string;
  reasoning_details?: unknown;
} {
  if (!message || typeof message !== "object") return {};
  const m = message as Record<string, unknown>;
  const reasoning = typeof m.reasoning === "string" ? m.reasoning.trim() : undefined;
  return {
    reasoning: reasoning || undefined,
    reasoning_details: m.reasoning_details,
  };
}

export function formatReasoningDetails(details: unknown): string | undefined {
  if (details == null) return undefined;
  if (typeof details === "string") {
    const t = details.trim();
    return t || undefined;
  }
  if (Array.isArray(details)) {
    const parts: string[] = [];
    for (const item of details) {
      if (typeof item === "string" && item.trim()) {
        parts.push(item.trim());
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const text =
        typeof o.text === "string"
          ? o.text
          : typeof o.content === "string"
            ? o.content
            : typeof o.summary === "string"
              ? o.summary
              : typeof o.reasoning === "string"
                ? o.reasoning
                : null;
      if (text?.trim()) parts.push(text.trim());
    }
    return parts.length ? parts.join("\n\n") : undefined;
  }
  return undefined;
}

function thoughtLabels(locale: string): {
  section: string;
  score: string;
  missing: string;
  next: string;
} {
  const lang = locale.split("-")[0];
  if (lang === "zh") {
    return {
      section: "POJU 结构化判断（模型 JSON）",
      score: "上下文完整度",
      missing: "仍缺信息",
      next: "建议下一步",
    };
  }
  return {
    section: "POJU structured assessment (model JSON)",
    score: "Context completeness",
    missing: "Still missing",
    next: "Suggested next step",
  };
}

export function formatThoughtBlock(
  thought: PojuThoughtSlice | null | undefined,
  locale = "en",
): string | undefined {
  if (!thought || typeof thought !== "object") return undefined;
  const labels = thoughtLabels(locale);
  const lines: string[] = [labels.section];
  if (typeof thought.current_context_score === "number") {
    lines.push(`${labels.score}: ${thought.current_context_score}/10`);
  }
  if (Array.isArray(thought.missing_keys) && thought.missing_keys.length > 0) {
    lines.push(`${labels.missing}: ${thought.missing_keys.join(", ")}`);
  }
  if (typeof thought.next_best_action === "string" && thought.next_best_action.trim()) {
    lines.push(`${labels.next}: ${thought.next_best_action}`);
  }
  return lines.length > 1 ? lines.join("\n") : undefined;
}

/** Merge API reasoning tokens + optional `thought` block for UI / message meta. */
export function buildThinkingProcessDisplay(input: ThinkingProcessInput): string | undefined {
  const parts: string[] = [];
  const apiReasoning = input.openRouterReasoning?.trim();
  if (apiReasoning) parts.push(apiReasoning);

  const detailsText = formatReasoningDetails(input.reasoning_details);
  if (detailsText && detailsText !== apiReasoning) parts.push(detailsText);

  const thoughtBlock = formatThoughtBlock(input.thought, input.locale ?? "en");
  if (thoughtBlock) parts.push(thoughtBlock);

  const joined = parts.filter(Boolean).join("\n\n---\n\n").trim();
  return joined || undefined;
}

export function thinkingFromPhaseTransport(
  transport: { reasoning?: string; reasoning_details?: unknown },
  parsed: Record<string, unknown> | null | undefined,
  locale: string,
): string | undefined {
  return buildThinkingProcessDisplay({
    openRouterReasoning: transport.reasoning,
    reasoning_details: transport.reasoning_details,
    thought: parseThoughtFromUnknown(parsed?.thought),
    locale,
  });
}

export function parseThoughtFromUnknown(raw: unknown): PojuThoughtSlice | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.current_context_score !== "number") return null;
  return {
    current_context_score: t.current_context_score,
    missing_keys: Array.isArray(t.missing_keys)
      ? t.missing_keys.filter((k): k is string => typeof k === "string")
      : [],
    next_best_action: typeof t.next_best_action === "string" ? t.next_best_action : undefined,
  };
}
