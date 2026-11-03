/**
 * Phase 3 S4 — Call B Agenda Validate → Normalize → unique Normalized Object (Contract §13.4).
 * Fingerprint fields: id, label, collection_goal, role, frame_kind, supports, serves_page, critical.
 * status / captured_answer / stale_turns / etc. are NOT included unless Mapper later reads them
 * (then bump CALL_B_FINGERPRINT_VERSION).
 */

import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import {
  NormalizeError,
  NORMALIZE_ILLEGAL_TYPE,
  NORMALIZE_VALIDATION_FAILED,
  normalizeMapperBoolean,
  normalizeMapperString,
} from "./normalize";

export const DUPLICATE_AGENDA_ID = "DUPLICATE_AGENDA_ID" as const;

export interface NormalizedAgendaItem {
  id: string;
  label: string | null;
  collection_goal: string | null;
  role: string | null;
  frame_kind: string | null;
  supports: string | null;
  serves_page: string | null;
  critical: boolean;
}

/** Unique Normalized Object for Call B Fingerprint + Mapper (order preserved). */
export interface NormalizedCallBInput {
  agenda: NormalizedAgendaItem[];
}

function normalizeOneAgendaItem(
  raw: unknown,
  index: number,
): NormalizedAgendaItem {
  if (raw === null || raw === undefined) {
    throw new NormalizeError(
      NORMALIZE_VALIDATION_FAILED,
      `Agenda[${index}] is null/undefined — empty slots not allowed for Call B items`,
      `agenda[${index}]`,
    );
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Agenda[${index}] must be an object`,
      `agenda[${index}]`,
    );
  }
  const row = raw as Record<string, unknown>;
  const id = normalizeMapperString(row.id, `agenda[${index}].id`);
  if (!id) {
    throw new NormalizeError(
      NORMALIZE_VALIDATION_FAILED,
      `Agenda[${index}].id is required after normalization`,
      `agenda[${index}].id`,
    );
  }
  const criticalRaw = normalizeMapperBoolean(
    row.critical,
    `agenda[${index}].critical`,
  );
  if (criticalRaw === null) {
    throw new NormalizeError(
      NORMALIZE_VALIDATION_FAILED,
      `Agenda[${index}].critical is required (boolean)`,
      `agenda[${index}].critical`,
    );
  }
  return {
    id,
    label: normalizeMapperString(row.label, `agenda[${index}].label`),
    collection_goal: normalizeMapperString(
      row.collection_goal,
      `agenda[${index}].collection_goal`,
    ),
    role: normalizeMapperString(row.role, `agenda[${index}].role`),
    frame_kind: normalizeMapperString(
      row.frame_kind,
      `agenda[${index}].frame_kind`,
    ),
    supports: normalizeMapperString(
      row.supports,
      `agenda[${index}].supports`,
    ),
    serves_page: normalizeMapperString(
      row.serves_page,
      `agenda[${index}].serves_page`,
    ),
    critical: criticalRaw,
  };
}

/**
 * Validate + normalize agenda array. Preserves order.
 * Duplicate Agenda IDs → HARD FAIL (no silent Map merge).
 */
export function normalizeCallBInput(raw: unknown): NormalizedCallBInput {
  if (raw === null || raw === undefined) {
    return { agenda: [] };
  }
  if (!Array.isArray(raw)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      "Call B agenda must be an array",
      "agenda",
    );
  }

  const seen = new Set<string>();
  const agenda: NormalizedAgendaItem[] = [];

  // Preserve indices: null slots are illegal for Call B (each slot must be an AgendaItem).
  // Use length-based walk so holes are detected as validation failures.
  for (let i = 0; i < raw.length; i++) {
    if (!(i in raw) || raw[i] === undefined || raw[i] === null) {
      throw new NormalizeError(
        NORMALIZE_VALIDATION_FAILED,
        `Agenda[${i}] empty slot — Call B requires concrete AgendaItem (no filter-renumber)`,
        `agenda[${i}]`,
      );
    }
    const item = normalizeOneAgendaItem(raw[i], i);
    if (seen.has(item.id)) {
      throw new NormalizeError(
        DUPLICATE_AGENDA_ID,
        `Duplicate Agenda ID "${item.id}" — HARD FAIL (no silent Map merge)`,
        `agenda[${i}].id`,
      );
    }
    seen.add(item.id);
    agenda.push(item);
  }

  return { agenda };
}

export function normalizeAgendaForCallB(
  agenda: AgendaItem[] | null | undefined,
): NormalizedCallBInput {
  return normalizeCallBInput(agenda ?? []);
}

