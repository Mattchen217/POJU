/**
 * Build user-visible "thinking process" text from OpenRouter reasoning tokens
 * and optional POJU `thought` JSON (context score / missing keys).
 */

export type PojuThoughtSlice = {
  current_context_score?: number;
  missing_keys?: string[];
  next_best_action?: string;
  /** First collecting turn: hidden breakthrough hypotheses (not in response). */
  breakthrough_hypotheses?: string[];
  agenda_derivation_note?: string;
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
  hypotheses: string;
  derivation: string;
} {
  const lang = locale.split("-")[0];
  if (lang === "zh") {
    return {
      section: "POJU 结构化判断（模型 JSON）",
      score: "上下文完整度",
      missing: "仍缺信息",
      next: "建议下一步",
      hypotheses: "破局假设（隐藏 · 不进回复）",
      derivation: "议程倒推依据",
    };
  }
  return {
    section: "POJU structured assessment (model JSON)",
    score: "Context completeness",
    missing: "Still missing",
    next: "Suggested next step",
    hypotheses: "Breakthrough hypotheses (hidden · not in reply)",
    derivation: "Agenda derivation note",
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
  if (Array.isArray(thought.breakthrough_hypotheses) && thought.breakthrough_hypotheses.length > 0) {
    lines.push(`${labels.hypotheses}: ${thought.breakthrough_hypotheses.join(" · ")}`);
  }
  if (typeof thought.agenda_derivation_note === "string" && thought.agenda_derivation_note.trim()) {
    lines.push(`${labels.derivation}: ${thought.agenda_derivation_note.trim()}`);
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
  const breakthrough_hypotheses = Array.isArray(t.breakthrough_hypotheses)
    ? t.breakthrough_hypotheses.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    : undefined;
  const agenda_derivation_note =
    typeof t.agenda_derivation_note === "string" ? t.agenda_derivation_note : undefined;

  if (typeof t.current_context_score === "number") {
    return {
      current_context_score: t.current_context_score,
      missing_keys: Array.isArray(t.missing_keys)
        ? t.missing_keys.filter((k): k is string => typeof k === "string")
        : [],
      next_best_action: typeof t.next_best_action === "string" ? t.next_best_action : undefined,
      breakthrough_hypotheses,
      agenda_derivation_note,
    };
  }

  if (breakthrough_hypotheses?.length || agenda_derivation_note?.trim()) {
    return { breakthrough_hypotheses, agenda_derivation_note };
  }

  return null;
}
