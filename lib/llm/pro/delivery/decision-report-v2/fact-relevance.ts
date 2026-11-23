/**
 * Page 01 RealityFact selection — structured DC links only.
 * No keyword heuristics (cash/job/relationship) as relevance authority.
 */

import type {
  Conflict,
  DecisionContext,
  DIR,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { DecisionReportRealityFact } from "./types";
import { realityFactsFromDecisionContext } from "./page01/slice";

export type FactSelectionKind = "linked" | "candidate";

export type FactSelectionRow = {
  fact: DecisionReportRealityFact;
  /** Original DC fact (status/verification unchanged). */
  source: RealityFact;
  kind: FactSelectionKind;
  /** Higher = stronger structured link to this decision. */
  score: number;
  reasons: string[];
};

export type FactSelectionResult = {
  selected: FactSelectionRow[];
  excluded_fact_ids: string[];
  /** True when selection used only weak/unlinked candidates (DC lacked structured links). */
  sparse_structured_links: boolean;
};

function activeDirs(dc: DecisionContext): DIR[] {
  return (dc.dirs ?? []).filter((d) => d.id_lifecycle === "active");
}

function requiredRoles(dirs: readonly DIR[]): Set<string> {
  const roles = new Set<string>();
  for (const d of dirs) {
    for (const r of d.required_fact_roles ?? []) {
      const t = r.trim();
      if (t) roles.add(t);
    }
  }
  return roles;
}

function activeDirIds(dirs: readonly DIR[]): Set<string> {
  return new Set(dirs.map((d) => d.dir_id));
}

function conflictFactIds(conflicts: readonly Conflict[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts ?? []) {
    if (c.state === "clarified") continue;
    for (const id of c.fact_ids ?? []) {
      if (id.trim()) ids.add(id);
    }
  }
  return ids;
}

function constraintLinkedDirIds(dc: DecisionContext): Set<string> {
  const ids = new Set<string>();
  for (const c of dc.constraints ?? []) {
    for (const d of c.related_dir_ids ?? []) {
      if (d.trim()) ids.add(d);
    }
  }
  return ids;
}

/**
 * Score a DC fact for Page 01 using DIR roles, related_dir_ids, conflicts, constraints.
 * Does not inspect statement text for topical keywords.
 */
export function scoreRealityFactForPage01(
  fact: RealityFact,
  input: {
    requiredRoles: ReadonlySet<string>;
    activeDirIds: ReadonlySet<string>;
    conflictFactIds: ReadonlySet<string>;
    constraintDirIds: ReadonlySet<string>;
  },
): { score: number; reasons: string[]; kind: FactSelectionKind } {
  let score = 0;
  const reasons: string[] = [];

  const roles = fact.fact_roles ?? [];
  const matchedRoles = roles.filter((r) => input.requiredRoles.has(r));
  if (matchedRoles.length) {
    score += 40 + matchedRoles.length;
    reasons.push(`fact_roles:${matchedRoles.join(",")}`);
  }

  const dirHits = (fact.related_dir_ids ?? []).filter((d) =>
    input.activeDirIds.has(d),
  );
  if (dirHits.length) {
    score += 50 + dirHits.length * 5;
    reasons.push(`related_dir:${dirHits.join(",")}`);
  }

  // Constraint-bound DIRs: fact shares a DIR that a constraint also binds.
  const constraintDirHits = (fact.related_dir_ids ?? []).filter((d) =>
    input.constraintDirIds.has(d),
  );
  if (constraintDirHits.length) {
    score += 25;
    reasons.push(`constraint_dir:${constraintDirHits.join(",")}`);
  }

  if (input.conflictFactIds.has(fact.fact_id)) {
    score += 35;
    reasons.push("conflict_member");
  }

  // Corrects / is part of a correction chain for a linked fact — mild boost only
  // when already otherwise linked; alone does not promote hobby noise.
  if (score > 0 && (fact.corrects_fact_ids?.length ?? 0) > 0) {
    score += 5;
    reasons.push("correction_chain");
  }

  if (score > 0) {
    return { score, reasons, kind: "linked" };
  }

  // No structured link — may still be kept as capped candidate when quota remains.
  if (roles.length > 0) {
    return {
      score: 1,
      reasons: ["unmatched_fact_roles"],
      kind: "candidate",
    };
  }
  return { score: 0, reasons: ["unlinked"], kind: "candidate" };
}

/**
 * Select Page 01 facts: rank by structured score (not confirmed-first).
 * Never mutates status / verification_level.
 */
export function selectRealityFactsForPage01(input: {
  dc: DecisionContext;
  maxFacts?: number;
}): FactSelectionResult {
  const maxFacts = input.maxFacts ?? 16;
  const dirs = activeDirs(input.dc);
  const roles = requiredRoles(dirs);
  const dirIds = activeDirIds(dirs);
  const conflicts = conflictFactIds(input.dc.conflicts);
  const constraintDirs = constraintLinkedDirIds(input.dc);
  const sparse =
    roles.size === 0 &&
    dirIds.size === 0 &&
    conflicts.size === 0 &&
    constraintDirs.size === 0;

  const mapped = realityFactsFromDecisionContext(input.dc);
  const byId = new Map(mapped.map((f) => [f.fact_id, f]));
  const scored: FactSelectionRow[] = [];

  for (const source of input.dc.reality_facts ?? []) {
    const fact = byId.get(source.fact_id);
    if (!fact) continue;
    // Preserve exact status/verification from mapping (already 1:1).
    const { score, reasons, kind } = scoreRealityFactForPage01(source, {
      requiredRoles: roles,
      activeDirIds: dirIds,
      conflictFactIds: conflicts,
      constraintDirIds: constraintDirs,
    });
    scored.push({ fact, source, kind, score, reasons });
  }

  // Sort by score desc; tie-break by original DC order (stable), NEVER by confirmed.
  const orderIndex = new Map(
    (input.dc.reality_facts ?? []).map((f, i) => [f.fact_id, i]),
  );
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      (orderIndex.get(a.fact.fact_id) ?? 0) - (orderIndex.get(b.fact.fact_id) ?? 0)
    );
  });

  const linked = scored.filter((r) => r.kind === "linked");
  const candidates = scored.filter((r) => r.kind === "candidate");

  const selected: FactSelectionRow[] = [];
  for (const row of linked) {
    if (selected.length >= maxFacts) break;
    selected.push(row);
  }
  // Fill remaining quota with unlinked candidates — explicitly candidate, not "relevant".
  for (const row of candidates) {
    if (selected.length >= maxFacts) break;
    selected.push(row);
  }

  const selectedIds = new Set(selected.map((r) => r.fact.fact_id));
  const excluded_fact_ids = scored
    .map((r) => r.fact.fact_id)
    .filter((id) => !selectedIds.has(id));

  return {
    selected,
    excluded_fact_ids,
    sparse_structured_links: sparse,
  };
}
