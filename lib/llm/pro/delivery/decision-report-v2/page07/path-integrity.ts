/**
 * Face07 path / participant / upstream-id integrity.
 */

import type { Face07V2 } from "../schemas";

export type Face07UpstreamRefs = {
  page05_all_path_ids: readonly string[];
  page06_action_ids: readonly string[];
};

const SELF_IDS = new Set(["self", "user", "me"]);

export function isSelfParticipantId(participantId: string): boolean {
  return SELF_IDS.has(participantId.trim().toLowerCase());
}

export function assertFace07PathIntegrity(
  page: Face07V2,
  upstream: Face07UpstreamRefs,
): string[] {
  const issues: string[] = [];
  const paths = new Set(upstream.page05_all_path_ids);
  const actions = new Set(upstream.page06_action_ids);
  const participants = new Set(page.participants.map((p) => p.participant_id));

  const seenParticipants = new Set<string>();
  for (const p of page.participants) {
    if (seenParticipants.has(p.participant_id)) {
      issues.push(`duplicate participant_id: ${p.participant_id}`);
    }
    seenParticipants.add(p.participant_id);
  }

  const citeParticipant = (label: string, id: string) => {
    if (!participants.has(id)) {
      issues.push(`${label} cites unknown participant_id: ${id}`);
    }
  };

  const seenUnits = new Set<string>();
  const noteUnit = (id: string) => {
    if (seenUnits.has(id)) issues.push(`duplicate unit_id: ${id}`);
    seenUnits.add(id);
  };

  for (const unit of page.field_units) {
    noteUnit(unit.unit_id);
    for (const id of unit.participant_ids) citeParticipant(unit.unit_id, id);
  }
  for (const unit of page.relationship_units) {
    noteUnit(unit.unit_id);
    for (const id of unit.participant_ids) citeParticipant(unit.unit_id, id);
  }

  for (const id of page.alignment_with_main.related_page05_path_ids ?? []) {
    if (!paths.has(id)) {
      issues.push(
        `related_page05_path_ids not subset of page05 all paths: ${id}`,
      );
    }
  }
  for (const id of page.alignment_with_main.related_page06_action_ids ?? []) {
    if (!actions.has(id)) {
      issues.push(
        `related_page06_action_ids not subset of page06 action ids: ${id}`,
      );
    }
  }

  if (page.applicability_status === "applicable") {
    if (page.field_units.length + page.relationship_units.length < 1) {
      issues.push(
        "applicable page requires at least one field unit or relationship unit",
      );
    }
  } else {
    if (page.field_units.length || page.relationship_units.length) {
      issues.push(
        `${page.applicability_status} requires empty field_units and relationship_units`,
      );
    }
    if (!(page.skip_note ?? "").trim()) {
      issues.push(
        `${page.applicability_status} requires skip_note`,
      );
    }
  }

  return issues;
}
