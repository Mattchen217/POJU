/**
 * Product Stage 4 — formal Decision Context slice for delivery page prompts.
 * Read-only projection; does not invent facts or upgrade hypotheses.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { DecisionContext, DecisionContextBinding } from "./types";
import { bindingFromDecisionContext } from "./read-bound";

/** Pages that must receive the formal DC slice when Stage 4 path is active. */
export const STAGE4_DC_FEED_PAGES: readonly DecisionPageId[] = [
  "01",
  "02",
  "04",
  "05",
  "06",
  "08",
] as const;

export function pageReceivesDecisionContextFeed(
  pageId: string,
): pageId is DecisionPageId {
  return (STAGE4_DC_FEED_PAGES as readonly string[]).includes(pageId);
}

export type DecisionContextPageFeed = {
  binding: DecisionContextBinding;
  delivery_mode: DecisionContext["delivery_mode"];
  definition: DecisionContext["definition"];
  confirmed_facts: Array<{
    fact_id: string;
    statement: string;
    verification_level: string;
    user_confirmed: boolean;
  }>;
  unverified_or_estimate_facts: Array<{
    fact_id: string;
    statement: string;
    status: string;
    verification_level: string;
  }>;
  unknowns_and_boundaries: string[];
  constraints: Array<{
    constraint_id: string;
    statement: string;
    category: string;
    rigidity: string;
    status: string;
    user_confirmed: boolean;
  }>;
  hypotheses: Array<{
    hypothesis_id: string;
    statement: string;
    state: string;
    validation_need: string | null;
    related_dir_ids: string[];
  }>;
  dirs: Array<{
    dir_id: string;
    need: string;
    why: string;
    current_state: string;
    may_affect_p5_ranking: boolean;
  }>;
  conflicts: Array<{
    conflict_id: string;
    state: string;
    conflict_field: string;
    statements_snapshot: string[];
    affects_preferred_path: boolean | undefined;
  }>;
  stage4_rules: string[];
};

function stage4RulesForPage(pageId: DecisionPageId): string[] {
  const shared = [
    "Treat confirmed + user_confirmed facts as user-confirmed reality only.",
    "Treat unverified / estimate / hypothesis as non-facts; never upgrade them.",
    "Unresolved conflicts that affect preferred path must condition or demote the preferred path.",
    "Do not invent KPI, success probability, or numeric thresholds not present in DC.",
    "Report generation is read-only: do not propose mutating this Decision Context.",
  ];
  if (pageId === "05") {
    return [
      ...shared,
      "P5: 2–4 paths; allow hidden/combo/phased/reversible/low-cost trial paths when DC supports them.",
      "P5: each path needs basis, cost, preconditions, risks, reversibility, exit, and ranking reason.",
      "P5: preferred path must be conditional; list unknowns that may change ranking (esp. may_affect_p5_ranking DIRs).",
      "P5: missing data ≠ infeasible; mark as unknown-conditioned, not auto-rejected.",
    ];
  }
  if (pageId === "06") {
    return [
      ...shared,
      "P6: one verification experiment answering: hypothesis, action, observe, window, success, if_fail, defer_costs.",
      "P6: prefer low-cost reversible actions that raise information quality.",
      "P6: forbid generic 30-day / checkbox task lists as the primary plan.",
    ];
  }
  if (pageId === "08") {
    return [
      ...shared,
      "P8: review_decision must be continue|adjust|stop|rerun using shared core metrics with P6.",
      "P8: path-specific metrics may supplement but must not replace shared core metrics.",
      "P8: each judgment needs trigger, evidence, basis, sufficiency, and whether user confirm is needed.",
    ];
  }
  return shared;
}

/**
 * Build a page-scoped formal DC feed object (JSON-serializable).
 */
export function buildDecisionContextPageFeed(
  dc: DecisionContext,
  pageId: DecisionPageId,
): DecisionContextPageFeed {
  const binding = bindingFromDecisionContext(dc);
  const confirmed_facts = dc.reality_facts
    .filter((f) => f.status === "confirmed" || f.user_confirmed)
    .map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      verification_level: f.verification_level,
      user_confirmed: f.user_confirmed,
    }));
  const unverified_or_estimate_facts = dc.reality_facts
    .filter(
      (f) =>
        f.status === "unverified" ||
        f.status === "unknown" ||
        f.verification_level === "user_estimate" ||
        f.verification_level === "none",
    )
    .map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      status: f.status,
      verification_level: f.verification_level,
    }));
  const unknowns_and_boundaries = [
    ...(dc.information_boundaries ?? []),
    ...dc.dirs
      .filter((d) => d.current_state === "unknown" || d.may_affect_p5_ranking)
      .map(
        (d) =>
          `DIR ${d.dir_id} [${d.current_state}${d.may_affect_p5_ranking ? "; may_affect_p5" : ""}]: ${d.need}`,
      ),
  ];

  return {
    binding,
    delivery_mode: dc.delivery_mode ?? null,
    definition: dc.definition,
    confirmed_facts,
    unverified_or_estimate_facts,
    unknowns_and_boundaries,
    constraints: dc.constraints.map((c) => ({
      constraint_id: c.constraint_id,
      statement: c.statement,
      category: c.category,
      rigidity: c.rigidity,
      status: c.status,
      user_confirmed: c.user_confirmed,
    })),
    hypotheses: dc.hypotheses.map((h) => ({
      hypothesis_id: h.hypothesis_id,
      statement: h.statement,
      state: h.state,
      validation_need: h.validation_need,
      related_dir_ids: [...h.related_dir_ids],
    })),
    dirs: dc.dirs.map((d) => ({
      dir_id: d.dir_id,
      need: d.need,
      why: d.why,
      current_state: d.current_state,
      may_affect_p5_ranking: Boolean(d.may_affect_p5_ranking),
    })),
    conflicts: dc.conflicts.map((c) => ({
      conflict_id: c.conflict_id,
      state: c.state,
      conflict_field: c.conflict_field,
      statements_snapshot: [...c.statements_snapshot],
      affects_preferred_path: c.affects_preferred_path,
    })),
    stage4_rules: stage4RulesForPage(pageId),
  };
}

/** Markdown/JSON block for body USER_FEED. Empty string when page is not Stage-4 DC-fed. */
export function formatDecisionContextSliceForPage(
  dc: DecisionContext | null | undefined,
  pageId: string,
): string {
  if (!dc || !pageReceivesDecisionContextFeed(pageId)) return "";
  const feed = buildDecisionContextPageFeed(dc, pageId);
  return [
    `## Formal Decision Context (frozen · read-only · Stage 4)`,
    `binding: ${feed.binding.context_id}@v${feed.binding.context_version} hash=${feed.binding.context_hash}`,
    "```json",
    JSON.stringify(feed, null, 2),
    "```",
  ].join("\n");
}
