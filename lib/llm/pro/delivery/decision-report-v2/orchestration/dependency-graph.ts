/**
 * Report production DAG validation — Batch 1 SSOT.
 */

import {
  REPORT_DERIVED_NODE_REGISTRY,
  REPORT_PAGE_REGISTRY,
  isReportPageId,
} from "./page-registry";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  type ReportGraphValidationIssue,
  type ReportPageId,
} from "./types";

export type ReportDependencyGraph = {
  graph_version: typeof REPORT_ORCHESTRATION_GRAPH_VERSION;
  page_ids: readonly ReportPageId[];
  /** directed edge: from → to means `to` requires `from`. */
  edges: ReadonlyArray<{ from: ReportPageId; to: ReportPageId }>;
  derived: ReadonlyArray<{
    node_id: string;
    requires: readonly ReportPageId[];
  }>;
};

export function buildReportDependencyGraph(): ReportDependencyGraph {
  const edges: Array<{ from: ReportPageId; to: ReportPageId }> = [];
  for (const page of REPORT_PAGE_REGISTRY) {
    for (const up of page.required_upstream) {
      edges.push({ from: up, to: page.page_id });
    }
  }
  return {
    graph_version: REPORT_ORCHESTRATION_GRAPH_VERSION,
    page_ids: [...REPORT_PAGE_IDS],
    edges,
    derived: REPORT_DERIVED_NODE_REGISTRY.map((d) => ({
      node_id: d.node_id,
      requires: [...d.required_upstream],
    })),
  };
}

/**
 * Validate registry uniqueness, edge existence, and absence of cycles.
 */
export function validateReportDependencyGraph(
  graph: ReportDependencyGraph = buildReportDependencyGraph(),
): { ok: true; graph: ReportDependencyGraph } | { ok: false; issues: ReportGraphValidationIssue[] } {
  const issues: ReportGraphValidationIssue[] = [];
  const seen = new Set<string>();
  for (const id of graph.page_ids) {
    if (seen.has(id)) {
      issues.push({ code: "duplicate_page_id", detail: id });
    }
    seen.add(id);
    if (!isReportPageId(id)) {
      issues.push({ code: "unknown_page_id", detail: id });
    }
  }
  for (const expected of REPORT_PAGE_IDS) {
    if (!seen.has(expected)) {
      issues.push({
        code: "missing_page_id",
        detail: `registry missing required page ${expected}`,
      });
    }
  }

  for (const edge of graph.edges) {
    if (!seen.has(edge.from)) {
      issues.push({
        code: "missing_upstream_node",
        detail: `edge ${edge.from}→${edge.to}: upstream ${edge.from} not in graph`,
      });
    }
    if (!seen.has(edge.to)) {
      issues.push({
        code: "missing_downstream_node",
        detail: `edge ${edge.from}→${edge.to}: downstream ${edge.to} not in graph`,
      });
    }
  }

  for (const d of graph.derived) {
    for (const up of d.requires) {
      if (!seen.has(up)) {
        issues.push({
          code: "missing_upstream_node",
          detail: `derived ${d.node_id} requires missing page ${up}`,
        });
      }
    }
  }

  const cycle = detectCycle(graph);
  if (cycle) {
    issues.push({
      code: "cycle_detected",
      detail: `cycle: ${cycle.join(" → ")}`,
    });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, graph };
}

function detectCycle(graph: ReportDependencyGraph): string[] | null {
  const adj = new Map<string, string[]>();
  for (const id of graph.page_ids) adj.set(id, []);
  for (const edge of graph.edges) {
    adj.get(edge.from)?.push(edge.to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      if (visited.has(next)) continue;
      if (visiting.has(next)) {
        const idx = stack.indexOf(next);
        return [...stack.slice(idx), next];
      }
      const found = dfs(next);
      if (found) return found;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const id of graph.page_ids) {
    if (visited.has(id)) continue;
    const found = dfs(id);
    if (found) return found;
  }
  return null;
}

/** Immediate required upstream page ids. */
export function requiredUpstreamOf(pageId: ReportPageId): readonly ReportPageId[] {
  const page = REPORT_PAGE_REGISTRY.find((p) => p.page_id === pageId);
  return page?.required_upstream ?? [];
}

/** Transitive required upstream closure (ancestors), excluding self. */
export function transitiveUpstreamOf(
  pageId: ReportPageId,
): ReportPageId[] {
  const out: ReportPageId[] = [];
  const seen = new Set<string>();
  const walk = (id: ReportPageId) => {
    for (const up of requiredUpstreamOf(id)) {
      if (seen.has(up)) continue;
      seen.add(up);
      out.push(up);
      walk(up);
    }
  };
  walk(pageId);
  return out;
}

/** Pages that would be invalidated when `changedPage` output changes. */
export function downstreamDependentsOf(
  changedPage: ReportPageId,
): ReportPageId[] {
  const out: ReportPageId[] = [];
  for (const page of REPORT_PAGE_REGISTRY) {
    if (page.page_id === changedPage) continue;
    const ancestors = transitiveUpstreamOf(page.page_id);
    if (ancestors.includes(changedPage) || page.required_upstream.includes(changedPage)) {
      out.push(page.page_id);
    }
  }
  return out;
}

/** Assert Page01 and Page02 have no mutual dependency. */
export function assertPage01Page02Independent(): void {
  const p01 = requiredUpstreamOf("01");
  const p02 = requiredUpstreamOf("02");
  if (p01.includes("02") || p02.includes("01")) {
    throw new Error("page01_page02_must_not_depend_on_each_other");
  }
}
