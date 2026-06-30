/**
 * Opening conversion envelope — relationship_conclusion + directions + agenda in one LLM turn.
 */
import { mapBreakthroughCorePayload } from "@/lib/llm/deepseek/breakthrough-core";
import { repairChatTermMarkers, stripForbiddenShenSha } from "@/lib/llm/sanitize/compliance-terms";
import type { BreakthroughCore, QuestionCategory } from "@/lib/poju/agent-state";
import { extractQuestionCategory } from "@/lib/poju/context-extractor";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import { parseInvestigationAgenda } from "@/lib/poju/investigation-agenda";

export type OpeningConversionPayload = {
  response: string;
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  question_category: QuestionCategory;
  problem_summary: string;
};

function normalizeAgendaRaw(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== "object") return entry;
    const o = { ...(entry as Record<string, unknown>) };
    if (typeof o.id !== "string" || !o.id.trim()) {
      o.id = `agenda_${i + 1}`;
    }
    if (typeof o.label !== "string" || !o.label.trim()) return o;
    if (typeof o.status !== "string") o.status = "unexplored";
    if (o.supports == null) o.supports = "";
    return o;
  });
}

function stripAgendaLabels(agenda: AgendaItem[]): AgendaItem[] {
  return agenda.map((a) => ({
    ...a,
    label: stripForbiddenShenSha(a.label).trim() || a.label,
  }));
}

/** Parse conversion fields when opening sets understanding_sufficient=true. */
export function parseOpeningConversionPayload(
  parsed: Record<string, unknown>,
  response: string,
  locale = "zh",
): OpeningConversionPayload | null {
  try {
    const normalized = {
      ...parsed,
      investigation_agenda: normalizeAgendaRaw(parsed.investigation_agenda),
    };
    const { breakthrough_core, investigation_agenda } = mapBreakthroughCorePayload(normalized);
    const question_category = extractQuestionCategory(parsed);
    const problem_summary =
      typeof parsed.problem_summary === "string" ? parsed.problem_summary.trim() : "";

    return {
      response: repairChatTermMarkers(stripForbiddenShenSha(response), locale),
      breakthrough_core,
      investigation_agenda: stripAgendaLabels(investigation_agenda),
      question_category,
      problem_summary: problem_summary || breakthrough_core.relationship_conclusion.slice(0, 200),
    };
  } catch (e) {
    console.warn("[opening-conversion] parse failed:", e);
    return null;
  }
}

/** Lenient agenda-only parse for tests / salvage. */
export function normalizeAgendaFromLlm(raw: unknown): AgendaItem[] | null {
  return parseInvestigationAgenda(normalizeAgendaRaw(raw));
}
