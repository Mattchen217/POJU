/**
 * Opening conversion envelope — relationship_conclusion + directions + agenda in one LLM turn.
 */
import { mapBreakthroughCorePayload } from "@/lib/llm/deepseek/breakthrough-core";
import { extractJson } from "@/lib/llm/phases/phase-transport";
import { repairChatTermMarkers, stripForbiddenShenSha } from "@/lib/llm/sanitize/compliance-terms";
import type { BreakthroughCore, QuestionCategory } from "@/lib/poju/agent-state";
import { parseBreakthroughCoreUpdatesFromLlm } from "@/lib/poju/agent-state";
import { extractQuestionCategory } from "@/lib/poju/context-extractor";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import { parseInvestigationAgenda } from "@/lib/poju/investigation-agenda";

export type OpeningConversionPayload = {
  response: string;
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  question_category: QuestionCategory;
  problem_summary: string;
  /** Agenda recovered while core fields were incomplete — core may be backfilled later. */
  salvaged?: boolean;
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

function parseAgendaLenient(raw: unknown): AgendaItem[] | null {
  const normalized = normalizeAgendaRaw(raw);
  if (!Array.isArray(normalized) || normalized.length < 2) return null;
  const items: AgendaItem[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const entry = normalized[i];
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `agenda_${i + 1}`;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const status =
      o.status === "partial" || o.status === "covered" || o.status === "unexplored"
        ? o.status
        : "unexplored";
    items.push({
      id,
      label,
      critical: typeof o.critical === "boolean" ? o.critical : false,
      status,
      supports: typeof o.supports === "string" ? o.supports : "",
    });
  }
  if (items.length < 2) return null;
  while (items.length < 3) {
    items.push({
      id: `agenda_${items.length + 1}`,
      label: "待补关键信息",
      critical: false,
      status: "unexplored",
    });
  }
  return items;
}

function stripAgendaLabels(agenda: AgendaItem[]): AgendaItem[] {
  return agenda.map((a) => ({
    ...a,
    label: stripForbiddenShenSha(a.label).trim() || a.label,
  }));
}

/** Coerce mixed prose+JSON or partial records into a plain object. */
export function coerceOpeningConversionRecord(parsed: unknown): Record<string, unknown> {
  if (typeof parsed === "string") {
    try {
      return JSON.parse(extractJson(parsed)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function buildSalvagedBreakthroughCore(
  record: Record<string, unknown>,
  response: string,
  agenda: AgendaItem[],
): BreakthroughCore {
  const partial = parseBreakthroughCoreUpdatesFromLlm(record);
  const relationship_conclusion =
    partial?.relationship_conclusion?.trim() ||
    (typeof record.relationship_conclusion === "string" ? record.relationship_conclusion.trim() : "") ||
    response.trim().slice(0, 400);

  if (!relationship_conclusion) {
    throw new Error("Missing relationship_conclusion for salvage");
  }

  let breakthrough_directions = partial?.breakthrough_directions ?? [];
  if (breakthrough_directions.length < 2) {
    const seeds = agenda.slice(0, 3);
    for (const item of seeds) {
      if (breakthrough_directions.length >= 2) break;
      if (breakthrough_directions.some((d) => d.direction === item.label)) continue;
      breakthrough_directions.push({
        direction: item.label,
        structural_basis: "待 collecting 轮补全结构依据",
        timing: "当前阶段",
        what_would_confirm: item.label,
        status: "hypothesis",
      });
    }
  }

  if (breakthrough_directions.length < 2) {
    throw new Error("breakthrough_directions salvage failed");
  }

  return {
    relationship_conclusion,
    breakthrough_directions: breakthrough_directions.slice(0, 3),
    generated_at: new Date().toISOString(),
  };
}

/** Parse conversion fields when opening sets understanding_sufficient=true. */
export function parseOpeningConversionPayload(
  parsed: Record<string, unknown> | string,
  response: string,
  locale = "zh",
): OpeningConversionPayload | null {
  const record = coerceOpeningConversionRecord(parsed);
  const normalized: Record<string, unknown> = {
    ...record,
    investigation_agenda: normalizeAgendaRaw(record.investigation_agenda),
  };

  try {
    const { breakthrough_core, investigation_agenda } = mapBreakthroughCorePayload(normalized);
    const question_category = extractQuestionCategory(normalized);
    const problem_summary =
      typeof normalized.problem_summary === "string" ? normalized.problem_summary.trim() : "";

    return {
      response: repairChatTermMarkers(stripForbiddenShenSha(response), locale),
      breakthrough_core,
      investigation_agenda: stripAgendaLabels(investigation_agenda),
      question_category,
      problem_summary: problem_summary || breakthrough_core.relationship_conclusion.slice(0, 200),
    };
  } catch (fullError) {
    const agenda = parseAgendaLenient(normalized.investigation_agenda);
    if (!agenda?.length) {
      console.warn("[opening-conversion] parse failed — no agenda to salvage:", fullError);
      return null;
    }

    try {
      const breakthrough_core = buildSalvagedBreakthroughCore(normalized, response, agenda);
      const question_category = extractQuestionCategory(normalized);
      const problem_summary =
        typeof normalized.problem_summary === "string" ? normalized.problem_summary.trim() : "";

      console.info("[opening-conversion] salvaged agenda-first envelope (core partial)", {
        agenda: agenda.length,
      });

      return {
        response: repairChatTermMarkers(stripForbiddenShenSha(response), locale),
        breakthrough_core,
        investigation_agenda: stripAgendaLabels(agenda),
        question_category,
        problem_summary: problem_summary || breakthrough_core.relationship_conclusion.slice(0, 200),
        salvaged: true,
      };
    } catch (salvageError) {
      console.warn("[opening-conversion] salvage failed:", salvageError);
      return null;
    }
  }
}

/** Lenient agenda-only parse for tests / salvage. */
export function normalizeAgendaFromLlm(raw: unknown): AgendaItem[] | null {
  return parseInvestigationAgenda(normalizeAgendaRaw(raw)) ?? parseAgendaLenient(raw);
}
