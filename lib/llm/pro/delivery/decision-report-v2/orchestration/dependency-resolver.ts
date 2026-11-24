/**
 * Ready / blocked resolution against the report DAG — Batch 1 SSOT.
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

/**
 * A page is ready to dispatch when:
 * - it is not already in a terminal/in-flight outcome that should not re-run
 * - every required upstream has a satisfying terminal outcome
 *
 * Batch 1 does not auto-requeue completed pages; callers pass pending/stale/failed.
 */
export function isPageReadyToDispatch(
  pageId: ReportPageId,
  states: readonly ReportPageRuntimeState[],
): boolean {
  const map = stateMap(states);
  const self = map.get(pageId);
  const selfOutcome = self?.outcome ?? "pending";
  if (
    selfOutcome === "completed" ||
    selfOutcome === "skipped_not_applicable" ||
    selfOutcome === "insufficient_information" ||
    selfOutcome === "queued" ||
    selfOutcome === "running" ||
    selfOutcome === "validating" ||
    selfOutcome === "repair_queued" ||
    selfOutcome === "cancelled"
  ) {
    return false;
  }
  // pending | ready | failed | stale → may dispatch when upstream satisfied
  return missingRequiredUpstream(pageId, states).length === 0;
}

export function resolveReadyPages(
  states: readonly ReportPageRuntimeState[],
): {
  ready_pages: ReportPageId[];
  blocked: ReportBlockedReason[];
} {
  const ready_pages: ReportPageId[] = [];
  const blocked: ReportBlockedReason[] = [];
  for (const page of REPORT_PAGE_REGISTRY) {
    if (isPageReadyToDispatch(page.page_id, states)) {
      ready_pages.push(page.page_id);
      continue;
    }
    const map = stateMap(states);
    const self = map.get(page.page_id);
    const selfOutcome = self?.outcome ?? "pending";
    if (
      selfOutcome === "completed" ||
      selfOutcome === "skipped_not_applicable" ||
      selfOutcome === "insufficient_information" ||
      selfOutcome === "queued" ||
      selfOutcome === "running" ||
      selfOutcome === "validating" ||
      selfOutcome === "repair_queued" ||
      selfOutcome === "cancelled"
    ) {
      continue;
    }
    const missing = missingRequiredUpstream(page.page_id, states);
    if (missing.length) {
      blocked.push({
        page_id: page.page_id,
        missing_upstream: missing,
        detail: `waiting on ${missing.join(", ")}`,
      });
    }
  }
  return { ready_pages, blocked };
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
    ready_pages: pages.ready_pages,
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
