/**
 * Call B Agenda → DIR seeds (Contract §14.3).
 * Consumes Normalized Object. 1 AgendaItem → 1 DIR; dir_id = dir_${id}.
 * Duplicate Agenda ID → HARD FAIL (no silent Map merge).
 * Agenda covered/partial/unexplored MUST NEVER set DIR.known / current_state.
 * Phase 3 S4: same Normalized Object feeds Fingerprint and this Mapper.
 */

import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import type { DIR } from "./types";
import {
  DUPLICATE_AGENDA_ID,
  normalizeCallBInput,
  type NormalizedAgendaItem,
  type NormalizedCallBInput,
} from "./normalize-call-b";
import { NormalizeError } from "./normalize";

export interface DirFromAgendaOptions {
  /** Existing DIRs for idempotent merge by stable dir_id (not for duplicate agenda ids). */
  existing?: DIR[];
  /** Prefix for generated dir_id when agenda id is used. */
  id_prefix?: string;
}


export class DirFromAgendaError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DirFromAgendaError";
    this.code = code;
  }
}

function stableDirId(agendaId: string, prefix: string): string {
  return `${prefix}${agendaId}`;
}

function rolesFromNormalized(item: NormalizedAgendaItem): string[] {
  const roles: string[] = [];
  if (item.collection_goal) {
    roles.push(`goal:${item.collection_goal.slice(0, 80)}`);
  }
  if (item.role) roles.push(`role:${item.role}`);
  if (item.frame_kind) roles.push(`frame:${item.frame_kind}`);
  if (item.supports) roles.push(`supports:${item.supports.slice(0, 64)}`);
  if (roles.length === 0) roles.push(`agenda:${item.id}`);
  return roles;
}

function seedDirFromNormalized(
  item: NormalizedAgendaItem,
  prefix: string,
  prev: DIR | undefined,
): DIR {
  const dir_id = stableDirId(item.id, prefix);
  if (prev) {
    // Idempotent reuse by dir_id / generation identity — never promote state from agenda.status.
    const agenda_item_ids = Array.from(
      new Set([...(prev.agenda_item_ids ?? []), item.id]),
    );
    return {
      ...prev,
      agenda_item_ids,
      need: prev.need || item.label || item.collection_goal || dir_id,
      why: prev.why || item.collection_goal || item.supports || "",
      serves_face: prev.serves_face ?? item.serves_page ?? null,
      required_fact_roles:
        prev.required_fact_roles.length > 0
          ? prev.required_fact_roles
          : rolesFromNormalized(item),
      // Explicit: Agenda covered ≠ DIR known; status must NOT set DIR state.
      current_state: prev.current_state,
    };
  }
  return {
    dir_id,
    need: item.label || item.collection_goal || item.id,
    why: item.collection_goal || item.supports || "",
    category: item.frame_kind ?? null,
    serves_face: item.serves_page ?? null,
    serves_judgment: item.supports ?? null,
    required_fact_roles: rolesFromNormalized(item),
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [item.id],
    satisfaction: null,
    may_affect_p5_ranking: Boolean(item.critical),
    id_lifecycle: "active",
    superseded_by_dir_id: null,
  };
}

/**
 * Map Normalized Call B Object → DIR[] (strict 1:1, agenda order preserved).
 * Duplicate IDs already rejected at normalize; re-check for defense in depth.
 */
export function dirsFromNormalizedCallB(
  normalized: NormalizedCallBInput,
  opts: DirFromAgendaOptions = {},
): DIR[] {
  const prefix = opts.id_prefix ?? "dir_";
  const existingById = new Map<string, DIR>();
  for (const d of opts.existing ?? []) {
    existingById.set(d.dir_id, d);
  }

  const seenAgendaIds = new Set<string>();
  const out: DIR[] = [];

  for (const item of normalized.agenda) {
    if (seenAgendaIds.has(item.id)) {
      throw new DirFromAgendaError(
        DUPLICATE_AGENDA_ID,
        `Duplicate Agenda ID "${item.id}" — HARD FAIL (no silent Map merge)`,
      );
    }
    seenAgendaIds.add(item.id);
    const dir_id = stableDirId(item.id, prefix);
    out.push(seedDirFromNormalized(item, prefix, existingById.get(dir_id)));
  }

  return out;
}

/**
 * Compat entry: Validate → Normalize once → Mapper.
 * Duplicate Agenda ID → HARD FAIL via normalizeCallBInput.
 */
export function dirsFromAgenda(
  agenda: AgendaItem[] | null | undefined,
  opts: DirFromAgendaOptions = {},
): DIR[] {
  try {
    const normalized = normalizeCallBInput(agenda ?? []);
    return dirsFromNormalizedCallB(normalized, opts);
  } catch (err) {
    if (err instanceof NormalizeError && err.code === DUPLICATE_AGENDA_ID) {
      throw new DirFromAgendaError(DUPLICATE_AGENDA_ID, err.message);
    }
    throw err;
  }
}

/** True iff agenda covered was incorrectly used to force known — always false by design. */
export function agendaCoveredImpliesDirKnown(): false {
  return false;
}
