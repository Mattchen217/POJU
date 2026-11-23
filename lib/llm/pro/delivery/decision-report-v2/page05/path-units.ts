/**
 * Face05 path unit integrity helpers.
 */

import type { Face05V2 } from "../schemas";

export function assertFace05PathIdIntegrity(page: Face05V2): string[] {
  const issues: string[] = [];
  const ids = page.path_units.map((u) => u.path_id);
  if (new Set(ids).size !== ids.length) {
    issues.push("duplicate path_units.path_id");
  }
  const index = new Map(page.path_units.map((u) => [u.path_id, u]));

  const checkList = (label: string, list: readonly string[]) => {
    for (const id of list) {
      if (!index.has(id)) issues.push(`${label} unknown path_id=${id}`);
    }
  };
  checkList("preferred_path_ids", page.preferred_path_ids);
  checkList("alternative_path_ids", page.alternative_path_ids);
  checkList("cautious_path_ids", page.cautious_path_ids);

  for (const id of page.preferred_path_ids) {
    const u = index.get(id);
    if (u && u.path_role !== "preferred") {
      issues.push(`preferred_path_ids requires preferred role, got ${u.path_role} for ${id}`);
    }
  }
  for (const id of page.alternative_path_ids) {
    const u = index.get(id);
    if (u && u.path_role !== "alternative") {
      issues.push(
        `alternative_path_ids requires alternative role, got ${u.path_role} for ${id}`,
      );
    }
  }
  for (const id of page.cautious_path_ids) {
    const u = index.get(id);
    if (u && u.path_role !== "cautious") {
      issues.push(
        `cautious_path_ids requires cautious role, got ${u.path_role} for ${id}`,
      );
    }
  }

  for (const row of page.path_comparison.rows) {
    if (!index.has(row.path_id)) {
      issues.push(`path_comparison unknown path_id=${row.path_id}`);
    }
  }

  for (const rule of page.switching_rules) {
    if (!index.has(rule.source_path_id)) {
      issues.push(
        `switching_rules ${rule.rule_id} unknown source_path_id=${rule.source_path_id}`,
      );
    }
    if (rule.action === "switch") {
      const target = (rule.target_path_id ?? "").trim();
      if (!target) {
        issues.push(
          `switching_rules ${rule.rule_id} action=switch requires target_path_id`,
        );
      } else if (!index.has(target)) {
        issues.push(
          `switching_rules ${rule.rule_id} unknown target_path_id=${target}`,
        );
      }
    }
  }

  if (page.preferred_path_ids.length < 1) {
    issues.push("preferred_path_ids must contain at least one path");
  }
  if (
    page.cautious_path_ids.length === 0 &&
    !(page.evidence_boundary.cautious_absent_note ?? "").trim()
  ) {
    issues.push(
      "cautious path absent requires evidence_boundary.cautious_absent_note",
    );
  }

  for (const u of page.path_units) {
    if (!u.title.trim() || !u.description.trim()) {
      issues.push(`empty shell path ${u.path_id}`);
    }
  }

  return issues;
}
