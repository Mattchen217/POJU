/**
 * Face05 path unit integrity helpers — bidirectional coverage.
 */

import type { Face05V2 } from "../schemas";

export function assertFace05PathIdIntegrity(page: Face05V2): string[] {
  const issues: string[] = [];
  const ids = page.path_units.map((u) => u.path_id);
  if (new Set(ids).size !== ids.length) {
    issues.push("duplicate path_units.path_id");
  }
  const index = new Map(page.path_units.map((u) => [u.path_id, u]));

  const preferred = page.preferred_path_ids ?? [];
  const alternative = page.alternative_path_ids ?? [];
  const cautious = page.cautious_path_ids ?? [];

  const checkList = (label: string, list: readonly string[]) => {
    for (const id of list) {
      if (!index.has(id)) issues.push(`${label} unknown path_id=${id}`);
    }
  };
  checkList("preferred_path_ids", preferred);
  checkList("alternative_path_ids", alternative);
  checkList("cautious_path_ids", cautious);

  // No cross-list duplicates.
  const roleBuckets: Array<{ label: string; list: readonly string[] }> = [
    { label: "preferred_path_ids", list: preferred },
    { label: "alternative_path_ids", list: alternative },
    { label: "cautious_path_ids", list: cautious },
  ];
  const seenInLists = new Map<string, string>();
  for (const bucket of roleBuckets) {
    const localSeen = new Set<string>();
    for (const id of bucket.list) {
      if (localSeen.has(id)) {
        issues.push(`${bucket.label} duplicate path_id=${id}`);
      }
      localSeen.add(id);
      const prior = seenInLists.get(id);
      if (prior) {
        issues.push(
          `path_id ${id} appears in both ${prior} and ${bucket.label}`,
        );
      } else {
        seenInLists.set(id, bucket.label);
      }
    }
  }

  for (const id of preferred) {
    const u = index.get(id);
    if (u && u.path_role !== "preferred") {
      issues.push(
        `preferred_path_ids requires preferred role, got ${u.path_role} for ${id}`,
      );
    }
  }
  for (const id of alternative) {
    const u = index.get(id);
    if (u && u.path_role !== "alternative") {
      issues.push(
        `alternative_path_ids requires alternative role, got ${u.path_role} for ${id}`,
      );
    }
  }
  for (const id of cautious) {
    const u = index.get(id);
    if (u && u.path_role !== "cautious") {
      issues.push(
        `cautious_path_ids requires cautious role, got ${u.path_role} for ${id}`,
      );
    }
  }

  // Reverse: every path_unit must appear in exactly one role list.
  for (const u of page.path_units) {
    const bucket = seenInLists.get(u.path_id);
    if (!bucket) {
      issues.push(
        `path_unit ${u.path_id} not referenced by preferred/alternative/cautious lists`,
      );
      continue;
    }
    const expected =
      bucket === "preferred_path_ids"
        ? "preferred"
        : bucket === "alternative_path_ids"
          ? "alternative"
          : "cautious";
    if (u.path_role !== expected) {
      issues.push(
        `path_unit ${u.path_id} role=${u.path_role} mismatches list ${bucket}`,
      );
    }
  }

  // Comparison rows: 1:1 with path_units (no missing, no extras, no dupes).
  const comparisonIds = page.path_comparison.rows.map((r) => r.path_id);
  if (new Set(comparisonIds).size !== comparisonIds.length) {
    issues.push("path_comparison duplicate path_id");
  }
  for (const row of page.path_comparison.rows) {
    if (!index.has(row.path_id)) {
      issues.push(`path_comparison unknown path_id=${row.path_id}`);
    }
  }
  const comparisonSet = new Set(comparisonIds);
  for (const u of page.path_units) {
    if (!comparisonSet.has(u.path_id)) {
      issues.push(
        `path_unit ${u.path_id} missing path_comparison.rows entry`,
      );
    }
  }
  if (comparisonIds.length !== page.path_units.length) {
    issues.push(
      `path_comparison.rows count (${comparisonIds.length}) must equal path_units count (${page.path_units.length})`,
    );
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

  if (preferred.length < 1) {
    issues.push("preferred_path_ids must contain at least one path");
  }
  if (
    cautious.length === 0 &&
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
