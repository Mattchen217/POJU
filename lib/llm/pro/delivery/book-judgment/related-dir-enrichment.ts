/**
 * Program-only Claim–DIR enrichment for BookJudgmentPack (Page02 trust root).
 *
 * Algorithm: program_unit_dir_authority_v1
 *
 * Binding requires an explicit program authority edge:
 *   BookJudgment unit_id → active linked DIR
 * with a canonical source_ref + association_basis.
 *
 * Production callers pass no authority_edges. Today no generation-time
 * Unit→DIR provenance exists (Fact→DIR on DC is not Unit→DIR). Enrichment
 * therefore writes an empty-binding certificate that documents the gap.
 *
 * Forbidden as proof (never used to invent edges):
 * - model anchors / declared_related_dir_ids / claim / explanation
 * - track / serves_face / serves_segment
 * - unit-id sort / DIR-id sort / ordinal or round-robin assignment
 * - “same page / same face” co-membership
 * - DIR count ≈ unit count
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { selectRealityFactsForPage01 } from "@/lib/llm/pro/delivery/decision-report-v2/fact-relevance";
import {
  linkedStructuredDirIds,
  structuredLinkedDirsForFact,
  activeDirsById,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/credible-fact-claim";
import type { BookJudgmentPack, BookJudgmentUnit } from "./schema";

export const RELATED_DIR_ENRICHMENT_VERSION = 1 as const;
export const RELATED_DIR_ENRICHMENT_ALGORITHM =
  "program_unit_dir_authority_v1" as const;

/** Closed association bases that may accompany a non-empty binding. */
export const RELATED_DIR_ASSOCIATION_BASES = [
  /** Explicit program edge supplied to enricher (tests / future seed). */
  "program_authority_edge",
] as const;
export type RelatedDirAssociationBasis =
  | (typeof RELATED_DIR_ASSOCIATION_BASES)[number]
  | "none";

export const MISSING_UNIT_DIR_AUTHORITY_REF =
  "missing:unit_dir_authority" as const;

export type ProgramUnitDirAuthorityEdge = {
  unit_id: string;
  dir_id: string;
  /**
   * Canonical program reference, e.g.
   * `program_unit_dir_edge:{unit_id}:{dir_id}:{basis_token}`
   */
  source_ref: string;
  association_basis: (typeof RELATED_DIR_ASSOCIATION_BASES)[number];
};

export type RelatedDirEnrichmentBinding = {
  unit_id: string;
  related_dir_ids: string[];
  source_ref: string;
  association_basis: RelatedDirAssociationBasis;
  reasons: string[];
};

export type RelatedDirEnrichmentCertificate = {
  version: typeof RELATED_DIR_ENRICHMENT_VERSION;
  algorithm: typeof RELATED_DIR_ENRICHMENT_ALGORITHM;
  certified_at: string;
  dc_content_hash: string | null;
  /** Audit: Fact→DIR linked set (does NOT imply Unit→DIR). */
  linked_dir_ids: string[];
  /** Why non-empty bindings were unavailable, when applicable. */
  missing_authority: string | null;
  bindings: RelatedDirEnrichmentBinding[];
};

export function isRelatedDirEnrichmentCertificate(
  value: unknown,
): value is RelatedDirEnrichmentCertificate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    o.version === RELATED_DIR_ENRICHMENT_VERSION &&
    o.algorithm === RELATED_DIR_ENRICHMENT_ALGORITHM &&
    typeof o.certified_at === "string" &&
    Array.isArray(o.bindings) &&
    Array.isArray(o.linked_dir_ids) &&
    (o.missing_authority === null || typeof o.missing_authority === "string")
  );
}

export function isAllowedAssociationBasis(
  value: unknown,
): value is RelatedDirAssociationBasis {
  if (value === "none") return true;
  return (
    typeof value === "string" &&
    (RELATED_DIR_ASSOCIATION_BASES as readonly string[]).includes(value)
  );
}

export function canonicalProgramUnitDirEdgeRef(edge: {
  unit_id: string;
  dir_id: string;
  association_basis: string;
}): string {
  return `program_unit_dir_edge:${edge.unit_id}:${edge.dir_id}:${edge.association_basis}`;
}

function page02ScienceUnits(
  units: readonly BookJudgmentUnit[],
): BookJudgmentUnit[] {
  // Pool filter only — never proof of DIR semantics.
  return units.filter(
    (u) =>
      (u.track === "science" || u.track === "convergence") &&
      u.serves_face.includes("02"),
  );
}

function emptyBinding(
  unitId: string,
  reasons: string[],
): RelatedDirEnrichmentBinding {
  return {
    unit_id: unitId,
    related_dir_ids: [],
    source_ref: MISSING_UNIT_DIR_AUTHORITY_REF,
    association_basis: "none",
    reasons,
  };
}

function collectLinkedDirIds(dc: DecisionContext): string[] {
  const fact_selection = selectRealityFactsForPage01({
    dc,
    maxFacts: 24,
  });
  const dirsById = activeDirsById(dc);
  const linkedSet = linkedStructuredDirIds({
    dc,
    fact_selection,
  });
  return [...linkedSet]
    .filter((dirId) => {
      if (!dirsById.has(dirId)) return false;
      return fact_selection.selected.some((row) => {
        if (row.kind !== "linked") return false;
        return structuredLinkedDirsForFact(row.source, dirsById).includes(
          dirId,
        );
      });
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve authority edges into unique unit→DIR maps.
 * Ambiguous DIR (claimed by ≥2 units without a distinct exclusive edge proof)
 * → neither unit receives that DIR (fail-closed).
 */
function resolveAuthorityAssignments(input: {
  edges: readonly ProgramUnitDirAuthorityEdge[];
  unitIds: ReadonlySet<string>;
  linkedDirIds: ReadonlySet<string>;
  dirsById: ReturnType<typeof activeDirsById>;
}): {
  byUnit: Map<string, { dir_id: string; edge: ProgramUnitDirAuthorityEdge }>;
  rejected: Map<string, string[]>;
} {
  const byUnit = new Map<
    string,
    { dir_id: string; edge: ProgramUnitDirAuthorityEdge }
  >();
  const rejected = new Map<string, string[]>();
  const pushReject = (unitId: string, reason: string) => {
    const list = rejected.get(unitId) ?? [];
    list.push(reason);
    rejected.set(unitId, list);
  };

  // First pass: validate edges individually (no ordinal pairing).
  type ValidEdge = {
    unit_id: string;
    dir_id: string;
    edge: ProgramUnitDirAuthorityEdge;
  };
  const valid: ValidEdge[] = [];
  for (const edge of input.edges) {
    const unit_id = edge.unit_id.trim();
    const dir_id = edge.dir_id.trim();
    if (!unit_id || !dir_id) continue;
    if (!input.unitIds.has(unit_id)) {
      pushReject(unit_id || "_", `reject_unknown_unit:${unit_id}`);
      continue;
    }
    if (!input.dirsById.has(dir_id)) {
      pushReject(unit_id, `reject_inactive_or_missing_dir:${dir_id}`);
      continue;
    }
    if (!input.linkedDirIds.has(dir_id)) {
      pushReject(unit_id, `reject_dir_not_linked:${dir_id}`);
      continue;
    }
    if (edge.association_basis !== "program_authority_edge") {
      pushReject(unit_id, `reject_unknown_basis:${edge.association_basis}`);
      continue;
    }
    const expectedRef = canonicalProgramUnitDirEdgeRef({
      unit_id,
      dir_id,
      association_basis: edge.association_basis,
    });
    if (edge.source_ref.trim() !== expectedRef) {
      pushReject(unit_id, `reject_source_ref_mismatch:${edge.source_ref}`);
      continue;
    }
    valid.push({ unit_id, dir_id, edge });
  }

  // DIR → units: illegal multi-claim without multi-grant basis → clear all.
  const dirToUnits = new Map<string, string[]>();
  for (const row of valid) {
    const list = dirToUnits.get(row.dir_id) ?? [];
    list.push(row.unit_id);
    dirToUnits.set(row.dir_id, list);
  }
  const blockedDirs = new Set<string>();
  for (const [dirId, units] of dirToUnits) {
    const uniqueUnits = [...new Set(units)];
    if (uniqueUnits.length > 1) {
      blockedDirs.add(dirId);
      for (const uid of uniqueUnits) {
        pushReject(
          uid,
          `reject_illegal_multi_claim_dir:${dirId}`,
        );
      }
    }
  }

  // Unit → at most one DIR; conflicting edges for same unit → empty.
  const unitToDirs = new Map<string, ValidEdge[]>();
  for (const row of valid) {
    if (blockedDirs.has(row.dir_id)) continue;
    const list = unitToDirs.get(row.unit_id) ?? [];
    list.push(row);
    unitToDirs.set(row.unit_id, list);
  }
  for (const [unitId, rows] of unitToDirs) {
    const uniqueDirs = [...new Set(rows.map((r) => r.dir_id))];
    if (uniqueDirs.length !== 1) {
      pushReject(unitId, `reject_ambiguous_unit_dirs:${uniqueDirs.join(",")}`);
      continue;
    }
    byUnit.set(unitId, { dir_id: uniqueDirs[0]!, edge: rows[0]!.edge });
  }

  return { byUnit, rejected };
}

/**
 * Enrich pack units with program-certified related_dir_ids + pack certificate.
 * Idempotent. Without DC or without authority edges → empty dirs + documented gap.
 */
export function enrichBookJudgmentRelatedDirIds(input: {
  pack: BookJudgmentPack;
  dc: DecisionContext | null | undefined;
  /**
   * Program-proven unit→DIR edges only. Production must omit / pass [].
   * Never derived from model text or ordinal slots.
   */
  authority_edges?: readonly ProgramUnitDirAuthorityEdge[];
}): {
  pack: BookJudgmentPack;
  certificate: RelatedDirEnrichmentCertificate;
} {
  const certified_at = new Date().toISOString();
  const units = input.pack.units.map((u) => {
    const next: BookJudgmentUnit = { ...u };
    next.related_dir_ids = [];
    return next;
  });
  const scienceUnits = page02ScienceUnits(units);
  const edges = input.authority_edges ?? [];

  if (!input.dc) {
    const certificate: RelatedDirEnrichmentCertificate = {
      version: RELATED_DIR_ENRICHMENT_VERSION,
      algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
      certified_at,
      dc_content_hash: null,
      linked_dir_ids: [],
      missing_authority: "no_dc",
      bindings: scienceUnits.map((u) =>
        emptyBinding(u.id, ["no_dc", "missing_unit_dir_provenance"]),
      ),
    };
    return {
      pack: {
        ...input.pack,
        units,
        related_dir_enrichment: certificate,
      },
      certificate,
    };
  }

  const linked_dir_ids = collectLinkedDirIds(input.dc);
  const linkedSet = new Set(linked_dir_ids);
  const dirsById = activeDirsById(input.dc);
  const unitIds = new Set(scienceUnits.map((u) => u.id));

  const { byUnit, rejected } = resolveAuthorityAssignments({
    edges,
    unitIds,
    linkedDirIds: linkedSet,
    dirsById,
  });

  const bindings: RelatedDirEnrichmentBinding[] = [];
  for (const unit of scienceUnits) {
    const reasons: string[] = ["algorithm:program_unit_dir_authority_v1"];
    const rejectReasons = rejected.get(unit.id) ?? [];
    reasons.push(...rejectReasons);

    const assigned = byUnit.get(unit.id);
    if (!assigned) {
      reasons.push("missing_unit_dir_provenance");
      if (!edges.length) {
        reasons.push("no_program_authority_edges");
      }
      bindings.push(emptyBinding(unit.id, reasons));
      continue;
    }

    reasons.push(`accept:${assigned.dir_id}`);
    reasons.push(`source_ref:${assigned.edge.source_ref}`);
    bindings.push({
      unit_id: unit.id,
      related_dir_ids: [assigned.dir_id],
      source_ref: assigned.edge.source_ref,
      association_basis: assigned.edge.association_basis,
      reasons,
    });
    const target = units.find((u) => u.id === unit.id);
    if (target) target.related_dir_ids = [assigned.dir_id];
  }

  const anyBound = bindings.some((b) => b.related_dir_ids.length > 0);
  const certificate: RelatedDirEnrichmentCertificate = {
    version: RELATED_DIR_ENRICHMENT_VERSION,
    algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
    certified_at,
    dc_content_hash: input.dc.content_hash ?? null,
    linked_dir_ids,
    missing_authority: anyBound
      ? null
      : edges.length
        ? "authority_edges_rejected_or_unproven"
        : "no_program_unit_dir_edges",
    bindings,
  };

  return {
    pack: {
      ...input.pack,
      units,
      related_dir_enrichment: certificate,
    },
    certificate,
  };
}
