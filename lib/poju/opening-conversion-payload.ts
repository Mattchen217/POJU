/**
 * Opening conversion envelope — scheme skeleton + agenda in one LLM turn (legacy path).
 */
import { mapBreakthroughCorePayload } from "@/lib/llm/deepseek/breakthrough-core";
import { extractJson } from "@/lib/llm/phases/phase-transport";
import { repairChatTermMarkers, stripForbiddenShenSha } from "@/lib/llm/sanitize/compliance-terms";
import type {
  BreakthroughCore,
  ModernActionFrame,
  QuestionCategory,
} from "@/lib/poju/agent-state";
import { parseBreakthroughCoreUpdatesFromLlm } from "@/lib/poju/agent-state";
import { extractQuestionCategory } from "@/lib/poju/context-extractor";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import {
  parseAgendaFrameIndex,
  parseAgendaFrameKind,
  parseInvestigationAgenda,
} from "@/lib/poju/investigation-agenda";

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
    const frame_kind =
      parseAgendaFrameKind(o.frame_kind) ??
      (o.direction_index != null || o.frame_index != null ? "modern_action" : undefined);
    const frame_index =
      parseAgendaFrameIndex(o.frame_index) ?? parseAgendaFrameIndex(o.direction_index);
    items.push({
      id,
      label,
      critical: typeof o.critical === "boolean" ? o.critical : false,
      status,
      ...(frame_kind != null ? { frame_kind } : {}),
      ...(frame_index != null ? { frame_index } : {}),
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
  const situation_conclusion =
    partial?.situation_conclusion?.trim() ||
    (typeof record.situation_conclusion === "string" ? record.situation_conclusion.trim() : "") ||
    (typeof record.relationship_conclusion === "string"
      ? record.relationship_conclusion.trim()
      : "") ||
    response.trim().slice(0, 400);

  if (!situation_conclusion) {
    throw new Error("Missing situation_conclusion for salvage");
  }

  let modern_action_frames: ModernActionFrame[] = partial?.modern_action_frames ?? [];
  if (modern_action_frames.length < 2) {
    const seeds = agenda.slice(0, 3);
    for (const item of seeds) {
      if (modern_action_frames.length >= 2) break;
      if (modern_action_frames.some((d) => d.direction === item.label)) continue;
      modern_action_frames.push({
        direction: item.label,
        why_fits: "待 collecting 轮补全适配理由",
        structural_basis: "待 collecting 轮补全结构依据",
        needs_validation: item.label,
        status: "hypothesis",
      });
    }
  }

  if (modern_action_frames.length < 2) {
    throw new Error("modern_action_frames salvage failed");
  }

  const needs = modern_action_frames[0]?.needs_validation || "待补验证点";

  return {
    situation_conclusion,
    ...(response.trim() ? { response: response.trim() } : {}),
    key_crossroads: partial?.key_crossroads ?? {
      real_fork: "待补真正分岔点",
      path_costs: "待补路径代价",
      decision_traits: "待补决策特质",
      structural_basis: "待补结构依据",
      needs_validation: needs,
    },
    modern_action_frames: modern_action_frames.slice(0, 3),
    energy_retune_frame: partial?.energy_retune_frame ?? {
      direction_fit: "待补使力方向",
      timing_ripeness: "条件成熟后再推进",
      daily_retune: "待补日常调频方向",
      complementary: "待补互补/避开",
      structural_basis: "待补结构依据",
      needs_validation: needs,
      status: "hypothesis",
    },
    rhythm_frame: partial?.rhythm_frame ?? {
      phase1_observe: "先观察关键信号",
      phase2_adjust: "再做小幅调整",
      phase3_consolidate: "巩固已验证方向",
    },
    self_check_signals: partial?.self_check_signals?.length
      ? partial.self_check_signals
      : ["走对了的信号待补", "该停下调整的信号待补", "外部反馈信号待补"],
    generated_at: new Date().toISOString(),
  };
}

function agendaFromActionFrames(record: Record<string, unknown>): AgendaItem[] | null {
  const rawDirs = record.modern_action_frames ?? record.breakthrough_directions;
  if (!Array.isArray(rawDirs) || rawDirs.length < 2) return null;
  const items: AgendaItem[] = [];
  for (let i = 0; i < rawDirs.length; i++) {
    const d = rawDirs[i];
    if (!d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    const label =
      (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
      (typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "") ||
      (typeof row.direction === "string" ? row.direction.trim() : "");
    if (!label) continue;
    items.push({
      id: `agenda_${i + 1}`,
      label: label.slice(0, 40),
      critical: i < 2,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: i + 1,
      supports: typeof row.direction === "string" ? row.direction : "",
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
      problem_summary: problem_summary || breakthrough_core.situation_conclusion.slice(0, 200),
    };
  } catch (fullError) {
    let agenda = parseAgendaLenient(normalized.investigation_agenda);
    if (!agenda?.length) {
      agenda = agendaFromActionFrames(normalized);
      if (agenda?.length) {
        console.info("[opening-conversion] salvaged agenda from modern_action_frames", {
          agenda: agenda.length,
        });
      }
    }
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
        problem_summary: problem_summary || breakthrough_core.situation_conclusion.slice(0, 200),
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
