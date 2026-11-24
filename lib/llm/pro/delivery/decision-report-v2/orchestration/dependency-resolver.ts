/**
 * Ready / blocked resolution against the report DAG — Batch 1 SSOT.
 * Distinguishes Page07 applicability-gate ready from model-generation ready.
 * Does not publish tasks or call models.
 */

import {
  REPORT_DERIVED_NODE_REGISTRY,
  REPORT_PAGE_REGISTRY,
  reportPageDefinition,
} from "./page-registry";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_UPSTREAM_SATISFYING_OUTCOMES,
  type ReportBlockedReason,
  type ReportDerivedNodeId,
  type ReportPageId,
  type ReportPageOutcome,
  type ReportPageRuntimeState,
  type ReportReadyResolution,
  type ReportUpstreamSatisfyingOutcome,
} from "./types";

function isSatisfyingOutcome(
  outcome: ReportPageOutcome,
): outcome is ReportUpstreamSatisfyingOutcome {
  return (REPORT_UPSTREAM_SATISFYING_OUTCOMES as readonly string[]).includes(
    outcome,
  );
}

function stateMap(
  states: readonly ReportPageRuntimeState[],
): Map<ReportPageId, ReportPageRuntimeState> {
  const map = new Map<ReportPageId, ReportPageRuntimeState>();
  for (const s of states) map.set(s.page_id, s);
  return map;
}

const IN_FLIGHT_OR_SETTLED: ReadonlySet<ReportPageOutcome> = new Set([
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
  "queued",
  "running",
  "validating",
  "repair_queued",
  "cancelled",
]);

export function missingRequiredUpstream(
  pageId: ReportPageId,
  states: readonly ReportPageRuntimeState[],
): ReportPageId[] {
  const map = stateMap(states);
  const def = reportPageDefinition(pageId);
  const missing: ReportPageId[] = [];
  for (const up of def.required_upstream) {
    const st = map.get(up);
    if (!st || !isSatisfyingOutcome(st.outcome)) {
      missing.push(up);
    }
  }
  return missing;
}

function selfOutcome(
  pageId: ReportPageId,
  states: readonly ReportPageRuntimeState[],
): ReportPageOutcome {
  return stateMap(states).get(pageId)?.outcome ?? "pending";
}

/**
 * Non-conditional page: upstream satisfied and not already settled/in-flight.
 * Page07 must use gate / model-generation helpers instead.
 */
export function isUnconditionalPageModelReady(
  pageId: ReportPageId,
  states: readonly ReportPageRuntimeState[],
): boolean {
  const def = reportPageDefinition(pageId);
  if (def.conditional) return false;
  if (IN_FLIGHT_OR_SETTLED.has(selfOutcome(pageId, states))) return false;
  return missingRequiredUpstream(pageId, states).length === 0;
}

/**
 * Page07: upstream satisfied, applicability not yet decided → run gate (no LLM).
 */
export function isPage07ApplicabilityGateReady(
  states: readonly ReportPageRuntimeState[],
): boolean {
  const map = stateMap(states);
  const self = map.get("07");
  const outcome = self?.outcome ?? "pending";
  if (IN_FLIGHT_OR_SETTLED.has(outcome)) return false;
  if (self?.applicability_status) return false;
  return missingRequiredUpstream("07", states).length === 0;
}

/**
 * Page07: applicability === applicable and page not yet settled → model task.
 */
export function isPage07ModelGenerationReady(
  states: readonly ReportPageRuntimeState[],
): boolean {
  const map = stateMap(states);
  const self = map.get("07");
  const outcome = self?.outcome ?? "pending";
  if (IN_FLIGHT_OR_SETTLED.has(outcome)) return false;
  if (self?.applicability_status !== "applicable") return false;
  return missingRequiredUpstream("07", states).length === 0;
}

/**
 * @deprecated Prefer isUnconditionalPageModelReady / isPage07* helpers.
 * Kept for callers that mean "may start next work unit" — for Page07 this means
 * gate OR model depending on applicability, never treating gate as LLM.
 */
export function isPageReadyToDispatch(
  pageId: ReportPageId,
  states: readonly ReportPageRuntimeState[],
): boolean {
  if (pageId === "07") {
    return (
      isPage07ApplicabilityGateReady(states) ||
      isPage07ModelGenerationReady(states)
    );
  }
  return isUnconditionalPageModelReady(pageId, states);
}

export function resolveReadyPages(
  states: readonly ReportPageRuntimeState[],
): {
  ready_model_generations: ReportPageId[];
  ready_applicability_gates: ReportPageId[];
  blocked: ReportBlockedReason[];
} {
  const ready_model_generations: ReportPageId[] = [];
  const ready_applicability_gates: ReportPageId[] = [];
  const blocked: ReportBlockedReason[] = [];
  const map = stateMap(states);

  for (const page of REPORT_PAGE_REGISTRY) {
    const pageId = page.page_id;
    const outcome = map.get(pageId)?.outcome ?? "pending";

    if (pageId === "07") {
      if (isPage07ApplicabilityGateReady(states)) {
        ready_applicability_gates.push("07");
        continue;
      }
      if (isPage07ModelGenerationReady(states)) {
        ready_model_generations.push("07");
        continue;
      }
      if (IN_FLIGHT_OR_SETTLED.has(outcome)) continue;
      // applicability decided as not_applicable / insufficient but outcome not
      // yet written as terminal — not model-ready; surface as blocked detail.
      const app = map.get("07")?.applicability_status;
      if (app === "not_applicable" || app === "insufficient_information") {
        blocked.push({
          page_id: "07",
          missing_upstream: [],
          detail: `page07 applicability=${app}; await terminal settlement (no model generation)`,
        });
        continue;
      }
      const missing = missingRequiredUpstream("07", states);
      if (missing.length) {
        blocked.push({
          page_id: "07",
          missing_upstream: missing,
          detail: `waiting on ${missing.join(", ")} before applicability gate`,
        });
      }
      continue;
    }

    if (isUnconditionalPageModelReady(pageId, states)) {
      ready_model_generations.push(pageId);
      continue;
    }
    if (IN_FLIGHT_OR_SETTLED.has(outcome)) continue;
    const missing = missingRequiredUpstream(pageId, states);
    if (missing.length) {
      blocked.push({
        page_id: pageId,
        missing_upstream: missing,
        detail: `waiting on ${missing.join(", ")}`,
      });
    }
  }

  return { ready_model_generations, ready_applicability_gates, blocked };
}

export function isDerivedNodeReady(
  nodeId: ReportDerivedNodeId,
  states: readonly ReportPageRuntimeState[],
): boolean {
  const def = REPORT_DERIVED_NODE_REGISTRY.find((d) => d.node_id === nodeId);
  if (!def) return false;
  const map = stateMap(states);
  for (const up of def.required_upstream) {
    const st = map.get(up);
    if (!st || !isSatisfyingOutcome(st.outcome)) return false;
  }
  return true;
}

export function resolveReadyDerived(
  states: readonly ReportPageRuntimeState[],
): {
  ready_derived: ReportDerivedNodeId[];
  blocked_derived: ReportBlockedReason[];
} {
  const ready_derived: ReportDerivedNodeId[] = [];
  const blocked_derived: ReportBlockedReason[] = [];
  for (const node of REPORT_DERIVED_NODE_REGISTRY) {
    if (isDerivedNodeReady(node.node_id, states)) {
      ready_derived.push(node.node_id);
      continue;
    }
    const map = stateMap(states);
    const missing: ReportPageId[] = [];
    for (const up of node.required_upstream) {
      const st = map.get(up);
      if (!st || !isSatisfyingOutcome(st.outcome)) missing.push(up);
    }
    blocked_derived.push({
      page_id: node.node_id,
      missing_upstream: missing,
      detail: `derived ${node.node_id} waiting on ${missing.join(", ")}`,
    });
  }
  return { ready_derived, blocked_derived };
}

/** Full ready resolution for pages + derived nodes. */
export function resolveReportReadyState(
  states: readonly ReportPageRuntimeState[],
): ReportReadyResolution {
  const pages = resolveReadyPages(states);
  const derived = resolveReadyDerived(states);
  return {
    graph_version: REPORT_ORCHESTRATION_GRAPH_VERSION,
    ready_model_generations: pages.ready_model_generations,
    ready_applicability_gates: pages.ready_applicability_gates,
    blocked: pages.blocked,
    ready_derived: derived.ready_derived,
    blocked_derived: derived.blocked_derived,
  };
}

/** Convenience: all pages pending (initial job state). */
export function initialPendingPageStates(): ReportPageRuntimeState[] {
  return REPORT_PAGE_REGISTRY.map((p) => ({
    page_id: p.page_id,
    outcome: "pending" as const,
  }));
}
