/**
 * Call B Agenda → DIR seeds.
 * AgendaItem.status (unexplored|partial|covered) is process-only.
 * covered MUST NEVER become DIR.known.
 */

import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import type { DIR } from "./types";

export interface DirFromAgendaOptions {
  /** Existing DIRs for idempotent merge by stable dir_id. */
  existing?: DIR[];
  /** Prefix for generated dir_id when agenda id is used. */
  id_prefix?: string;
}

function stableDirId(agendaId: string, prefix: string): string {
  return `${prefix}${agendaId}`;
}

function rolesFromAgenda(item: AgendaItem): string[] {
  const roles: string[] = [];
  if (item.collection_goal?.trim()) {
    roles.push(`goal:${item.collection_goal.trim().slice(0, 80)}`);
  }
  if (item.role) roles.push(`role:${item.role}`);
  if (item.frame_kind) roles.push(`frame:${item.frame_kind}`);
  if (item.supports?.trim()) roles.push(`supports:${item.supports.trim().slice(0, 64)}`);
  // At least one generic role so aggregator can track contribution.
  if (roles.length === 0) roles.push(`agenda:${item.id}`);
  return roles;
}

/**
 * Build DIR[] from agenda. Every DIR starts as `unknown`.
 * Agenda covered/partial/unexplored is ignored for current_state.
 */
export function dirsFromAgenda(
  agenda: AgendaItem[] | null | undefined,
  opts: DirFromAgendaOptions = {},
): DIR[] {
  const prefix = opts.id_prefix ?? "dir_";
  const byId = new Map<string, DIR>();
  for (const d of opts.existing ?? []) {
    byId.set(d.dir_id, d);
  }

  for (const item of agenda ?? []) {
    if (!item?.id) continue;
    const dir_id = stableDirId(item.id, prefix);
    const prev = byId.get(dir_id);
    if (prev) {
      // Merge links; never promote state from agenda.status.
      const agenda_item_ids = Array.from(
        new Set([...(prev.agenda_item_ids ?? []), item.id]),
      );
      byId.set(dir_id, {
        ...prev,
        agenda_item_ids,
        need: prev.need || item.label || item.collection_goal || dir_id,
        why: prev.why || item.collection_goal || item.supports || "",
        serves_face: prev.serves_face ?? item.serves_page ?? null,
        required_fact_roles:
          prev.required_fact_roles.length > 0
            ? prev.required_fact_roles
            : rolesFromAgenda(item),
        // Explicit: agenda covered does not change current_state
        current_state: prev.current_state,
      });
      continue;
    }
    byId.set(dir_id, {
      dir_id,
      need: item.label || item.collection_goal || item.id,
      why: item.collection_goal || item.supports || "",
      category: item.frame_kind ?? null,
      serves_face: item.serves_page ?? null,
      serves_judgment: item.supports ?? null,
      required_fact_roles: rolesFromAgenda(item),
      current_state: "unknown",
      partial_satisfaction: false,
      agenda_item_ids: [item.id],
      satisfaction: null,
      may_affect_p5_ranking: Boolean(item.critical),
      id_lifecycle: "active",
      superseded_by_dir_id: null,
    });
  }

  return Array.from(byId.values());
}

/** True iff agenda covered was incorrectly used to force known — always false by design. */
export function agendaCoveredImpliesDirKnown(): false {
  return false;
}
