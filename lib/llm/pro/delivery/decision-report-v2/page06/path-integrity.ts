/**
 * Face06 path integrity — Page05 path binding + local id sets.
 */

import type { Face06V2 } from "../schemas";

export type Face06Page05PathSets = {
  preferred_path_ids: readonly string[];
  alternative_path_ids: readonly string[];
  all_path_ids: readonly string[];
};

export function assertFace06PathIntegrity(
  page: Face06V2,
  page05Paths: Face06Page05PathSets,
): string[] {
  const issues: string[] = [];
  const preferred = new Set(page05Paths.preferred_path_ids);
  const alternative = new Set(page05Paths.alternative_path_ids);
  const all = new Set(page05Paths.all_path_ids);

  if (!preferred.has(page.primary_path_id)) {
    issues.push(
      `primary_path_id not in page05 preferred_path_ids: ${page.primary_path_id}`,
    );
  }
  for (const id of page.fallback_path_ids ?? []) {
    if (!alternative.has(id)) {
      issues.push(`fallback_path_ids not subset of alternative: ${id}`);
    }
  }
  if (page.first_step.path_id !== page.primary_path_id) {
    issues.push(
      `first_step.path_id must equal primary_path_id (${page.first_step.path_id} !== ${page.primary_path_id})`,
    );
  }

  const checkPath = (label: string, pathId: string) => {
    if (!all.has(pathId)) {
      issues.push(`${label} path_id not in page05 all_path_ids: ${pathId}`);
    }
  };
  for (const action of page.execution_actions) {
    checkPath(`execution_actions ${action.action_id}`, action.path_id);
  }
  for (const exp of page.validation_experiments) {
    checkPath(`validation_experiments ${exp.experiment_id}`, exp.path_id);
  }
  for (const adj of page.personal_execution_adjustments) {
    checkPath(`personal_execution_adjustments ${adj.adjustment_id}`, adj.path_id);
  }

  const seenActions = new Set<string>();
  const noteDup = (kind: string, id: string, seen: Set<string>) => {
    if (seen.has(id)) issues.push(`duplicate ${kind}: ${id}`);
    seen.add(id);
  };
  noteDup("action_id", page.first_step.action_id, seenActions);
  for (const action of page.execution_actions) {
    noteDup("action_id", action.action_id, seenActions);
  }
  const seenExp = new Set<string>();
  for (const exp of page.validation_experiments) {
    noteDup("experiment_id", exp.experiment_id, seenExp);
  }
  const seenAdj = new Set<string>();
  for (const adj of page.personal_execution_adjustments) {
    noteDup("adjustment_id", adj.adjustment_id, seenAdj);
  }

  const actionById = new Map(
    page.execution_actions.map((a) => [a.action_id, a] as const),
  );
  const experimentById = new Map(
    page.validation_experiments.map((e) => [e.experiment_id, e] as const),
  );

  checkPath("monitoring_contract", page.monitoring_contract.path_id);
  const monitorPath = page.monitoring_contract.path_id;

  for (const id of page.monitoring_contract.action_ids ?? []) {
    const action = actionById.get(id);
    if (!action) {
      issues.push(
        `monitoring action_ids not subset of execution_actions: ${id}`,
      );
      continue;
    }
    if (action.path_id !== monitorPath) {
      issues.push(
        `monitoring action ${id} path_id=${action.path_id} must equal monitoring_contract.path_id=${monitorPath}`,
      );
    }
  }
  for (const id of page.monitoring_contract.experiment_ids ?? []) {
    const exp = experimentById.get(id);
    if (!exp) {
      issues.push(
        `monitoring experiment_ids not subset of validation_experiments: ${id}`,
      );
      continue;
    }
    if (exp.path_id !== monitorPath) {
      issues.push(
        `monitoring experiment ${id} path_id=${exp.path_id} must equal monitoring_contract.path_id=${monitorPath}`,
      );
    }
  }

  if (page.validation_experiments.length === 0) {
    const note = [
      page.experiments_absent_note,
      page.evidence_boundary.experiments_absent_note,
    ]
      .map((s) => (s ?? "").trim())
      .find((s) => s.length > 0);
    if (!note) {
      issues.push("experiments empty requires experiments_absent_note");
    }
  }

  return issues;
}
