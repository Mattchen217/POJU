/**
 * Canonical business payload → SHA-256 hex for Freeze / report binding.
 * Excludes lifecycle metadata (status timestamps on container, superseded_*).
 * Phase 3 S4: canonical JSON shared with Fingerprint via normalize.ts (no dual stack).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalStringify } from "./normalize";
import type {
  Conflict,
  Constraint,
  DecisionContext,
  Definition,
  DIR,
  Hypothesis,
  RealityFact,
} from "./types";

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// canonicalStringify lives in normalize.ts (unique stack); imported above for hashing.

export interface BusinessPayload {
  definition: Definition;
  reality_facts: Array<{
    fact_id: string;
    statement: string;
    status: RealityFact["status"];
    verification_level: RealityFact["verification_level"];
    source_stage: RealityFact["source_stage"];
    source_turn_id: RealityFact["source_turn_id"];
    user_confirmed: boolean;
    fact_roles?: string[];
    related_dir_ids?: string[];
    corrects_fact_ids?: string[];
  }>;
  constraints: Array<{
    constraint_id: string;
    statement: string;
    category: Constraint["category"];
    status: Constraint["status"];
    verification_level: Constraint["verification_level"];
    source_stage: Constraint["source_stage"];
    source_turn_id: Constraint["source_turn_id"];
    rigidity: Constraint["rigidity"];
    user_confirmed: boolean;
    related_dir_ids?: string[];
  }>;
  /** Intake ExplicitNaEvidence — sorted by evidence_id for stable hash. */
  explicit_na_evidence: Array<Record<string, unknown>>;
  /** User-declared N/A classifications — sorted by classification_id. */
  explicit_na_classifications: Array<Record<string, unknown>>;
  hypotheses: Array<{
    hypothesis_id: string;
    statement: string;
    supporting_evidence: string[];
    counter_evidence: string[];
    validation_need: string | null;
    state: Hypothesis["state"];
    related_dir_ids: string[];
    source_ref?: string | null;
  }>;
  dirs: Array<{
    dir_id: string;
    need: string;
    why: string;
    category?: string | null;
    serves_face?: string | null;
    serves_judgment?: string | null;
    required_fact_roles: string[];
    current_state: DIR["current_state"];
    partial_satisfaction: boolean;
    agenda_item_ids: string[];
    satisfaction?: string | null;
    may_affect_p5_ranking?: boolean;
    id_lifecycle: DIR["id_lifecycle"];
  }>;
  conflicts: Array<{
    conflict_id: string;
    fact_ids: string[];
    conflict_field: string;
    statements_snapshot: string[];
    source_refs: Conflict["source_refs"];
    state: Conflict["state"];
    resolution: string | null;
    user_confirmation: boolean;
    affects_preferred_path?: boolean;
    related_conflict_ids?: string[];
  }>;
  information_boundaries?: string[];
}

export function extractBusinessPayload(dc: DecisionContext): BusinessPayload {
  return {
    definition: { ...dc.definition },
    reality_facts: dc.reality_facts.map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      status: f.status,
      verification_level: f.verification_level,
      source_stage: f.source_stage,
      source_turn_id: f.source_turn_id,
      user_confirmed: f.user_confirmed,
      ...(f.fact_roles ? { fact_roles: [...f.fact_roles] } : {}),
      ...(f.related_dir_ids ? { related_dir_ids: [...f.related_dir_ids] } : {}),
      ...(f.corrects_fact_ids && f.corrects_fact_ids.length > 0
        ? { corrects_fact_ids: [...f.corrects_fact_ids].sort() }
        : {}),
    })),
    constraints: dc.constraints.map((c) => ({
      constraint_id: c.constraint_id,
      statement: c.statement,
      category: c.category,
      status: c.status,
      verification_level: c.verification_level,
      source_stage: c.source_stage,
      source_turn_id: c.source_turn_id,
      rigidity: c.rigidity,
      user_confirmed: c.user_confirmed,
      ...(c.related_dir_ids
        ? { related_dir_ids: [...c.related_dir_ids].sort() }
        : {}),
    })),
    explicit_na_evidence: [...(dc.explicit_na_evidence ?? [])]
      .map((e) => ({ ...e }) as Record<string, unknown>)
      .sort((a, b) =>
        String(a.evidence_id ?? "").localeCompare(String(b.evidence_id ?? "")),
      ),
    explicit_na_classifications: [...(dc.explicit_na_classifications ?? [])]
      .map((c) => ({ ...c }) as Record<string, unknown>)
      .sort((a, b) =>
        String(a.classification_id ?? "").localeCompare(
          String(b.classification_id ?? ""),
        ),
      ),
    hypotheses: dc.hypotheses.map((h) => ({
      hypothesis_id: h.hypothesis_id,
      statement: h.statement,
      supporting_evidence: [...h.supporting_evidence],
      counter_evidence: [...h.counter_evidence],
      validation_need: h.validation_need,
      state: h.state,
      related_dir_ids: [...h.related_dir_ids],
      ...(h.source_ref != null ? { source_ref: h.source_ref } : {}),
    })),
    dirs: dc.dirs.map((d) => ({
      dir_id: d.dir_id,
      need: d.need,
      why: d.why,
      category: d.category ?? null,
      serves_face: d.serves_face ?? null,
      serves_judgment: d.serves_judgment ?? null,
      required_fact_roles: [...d.required_fact_roles],
      current_state: d.current_state,
      partial_satisfaction: d.partial_satisfaction,
      agenda_item_ids: [...d.agenda_item_ids],
      satisfaction: d.satisfaction ?? null,
      may_affect_p5_ranking: d.may_affect_p5_ranking,
      id_lifecycle: d.id_lifecycle,
    })),
    conflicts: dc.conflicts.map((c) => ({
      conflict_id: c.conflict_id,
      fact_ids: [...c.fact_ids],
      conflict_field: c.conflict_field,
      statements_snapshot: [...c.statements_snapshot],
      source_refs: c.source_refs.map((r) => ({ ...r })),
      state: c.state,
      resolution: c.resolution,
      user_confirmation: c.user_confirmation,
      ...(c.affects_preferred_path !== undefined
        ? { affects_preferred_path: c.affects_preferred_path }
        : {}),
      ...(c.related_conflict_ids
        ? { related_conflict_ids: [...c.related_conflict_ids] }
        : {}),
    })),
    information_boundaries: [...(dc.information_boundaries ?? [])],
  };
}

export function hashBusinessPayload(payload: BusinessPayload): string {
  const canonical = canonicalStringify(payload);
  return bytesToHex(sha256(textEncoder.encode(canonical)));
}

export function computeContentHash(dc: DecisionContext): string {
  return hashBusinessPayload(extractBusinessPayload(dc));
}
