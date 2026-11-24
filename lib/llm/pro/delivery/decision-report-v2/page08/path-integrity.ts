/**
 * Face08 id / signal / trigger / path / action integrity.
 */

import type { Face08V2 } from "../schemas";

export type Face08UpstreamRefs = {
  page05_all_path_ids: readonly string[];
  page06_action_ids: readonly string[];
};

export function assertFace08PathIntegrity(
  page: Face08V2,
  upstream: Face08UpstreamRefs,
): string[] {
  const issues: string[] = [];
  const paths = new Set(upstream.page05_all_path_ids);
  const actions = new Set(upstream.page06_action_ids);
  const riskIds = new Set<string>();
  const signalIds = new Set<string>();
  const triggerIds = new Set<string>();
  const reassessmentIds = new Set<string>();
  const allIds = new Set<string>();

  const noteId = (bucket: Set<string>, kind: string, id: string) => {
    if (bucket.has(id) || allIds.has(id)) {
      issues.push(`duplicate ${kind}: ${id}`);
    }
    bucket.add(id);
    allIds.add(id);
  };

  for (const risk of page.risks) noteId(riskIds, "risk_id", risk.risk_id);
  for (const signal of page.observation_signals) {
    noteId(signalIds, "signal_id", signal.signal_id);
  }
  for (const trigger of page.triggers) {
    noteId(triggerIds, "trigger_id", trigger.trigger_id);
  }
  for (const item of page.reassessment_conditions) {
    noteId(reassessmentIds, "reassessment_id", item.reassessment_id);
  }

  const checkPaths = (label: string, ids: readonly string[]) => {
    for (const id of ids) {
      if (!paths.has(id)) {
        issues.push(`${label} path not in page05: ${id}`);
      }
    }
  };
  const checkActions = (label: string, ids: readonly string[]) => {
    for (const id of ids) {
      if (!actions.has(id)) {
        issues.push(`${label} action not in page06: ${id}`);
      }
    }
  };

  for (const signal of page.observation_signals) {
    if (signal.related_risk_ids.length < 1) {
      issues.push(`signal ${signal.signal_id} cites no risk`);
    }
    for (const id of signal.related_risk_ids) {
      if (!riskIds.has(id)) {
        issues.push(`signal cites unknown risk: ${id}`);
      }
    }
  }

  for (const trigger of page.triggers) {
    if (trigger.related_risk_ids.length < 1) {
      issues.push(`trigger ${trigger.trigger_id} cites no risk`);
    }
    if (trigger.related_signal_ids.length < 1) {
      issues.push(`trigger ${trigger.trigger_id} cites no signal`);
    }
    for (const id of trigger.related_risk_ids) {
      if (!riskIds.has(id)) {
        issues.push(`trigger cites unknown risk: ${id}`);
      }
    }
    for (const id of trigger.related_signal_ids) {
      if (!signalIds.has(id)) {
        issues.push(`trigger cites unknown signal: ${id}`);
      }
    }
    checkPaths(trigger.trigger_id, trigger.related_path_ids ?? []);
    checkActions(trigger.trigger_id, trigger.related_action_ids ?? []);
  }

  for (const risk of page.risks) {
    checkPaths(risk.risk_id, risk.related_path_ids ?? []);
    checkActions(risk.risk_id, risk.related_action_ids ?? []);
  }
  for (const item of page.reassessment_conditions) {
    checkPaths(item.reassessment_id, item.affected_path_ids ?? []);
  }

  return issues;
}
