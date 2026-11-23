/**
 * Program-only Claim–DIR enrichment for BookJudgmentPack (Page02 trust root).
 *
 * Algorithm: program_unit_dir_authority_v1
 *
 * R6: bindings come from Program-Owned Unit Slot Plan edges
 * (association_basis = program_owned_unit_slot). Many-to-many allowed:
 * one unit → many DIRs; one DIR → many units — each edge independently
 * sourced from the Slot Plan / DDR requirement SSOT.
 *
 * Synthetic `program_authority_edge` remains for resolver unit tests only.
 * Face02 production rebuilds edges only from pack.page02_unit_slot_plan.
 *
 * Forbidden: model anchors, ordinal pairing, page-union bulk grant, etc.
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

export const RELATED_DIR_ASSOCIATION_BASES = [
  /** SYNTHETIC resolver tests only. */
  "program_authority_edge",
  /** Production Slot Plan → DDR requirement SSOT. */
  "program_owned_unit_slot",
] as const;
export type RelatedDirAssociationBasis =
  | (typeof RELATED_DIR_ASSOCIATION_BASES)[number]
  | "none";

export const MISSING_UNIT_DIR_AUTHORITY_REF =
  "missing:unit_dir_authority" as const;

export type ProgramUnitDirAuthorityEdge = {
  unit_id: string;
  dir_id: string;
  source_ref: string;
  association_basis: (typeof RELATED_DIR_ASSOCIATION_BASES)[number];
  slot_id?: string;
  requirement_id?: string;
  source_type?: string;
  source_id?: string;
  source_version?: string;
  source_hash?: string;
  dc_content_hash?: string | null;
};

export type RelatedDirEnrichmentBinding = {
  unit_id: string;
  related_dir_ids: string[];
  source_ref: string;
  association_basis: RelatedDirAssociationBasis;
  slot_id?: string;
  requirement_id?: string;
  source_version?: string;
  source_hash?: string;
  reasons: string[];
};

export type RelatedDirEnrichmentCertificate = {
  version: typeof RELATED_DIR_ENRICHMENT_VERSION;
  algorithm: typeof RELATED_DIR_ENRICHMENT_ALGORITHM;
  certified_at: string;
  dc_content_hash: string | null;
  linked_dir_ids: string[];
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

/** Full-set binding ref for a Slot Plan unit (dirs sorted, joined with +). */
export function canonicalProgramUnitSlotBindingRef(input: {
  slot_id: string;
  requirement_id: string;
  unit_id: string;
  dir_ids: readonly string[];
}): string {
  const dirs = [...input.dir_ids].map((d) => d.trim()).filter(Boolean).sort();
  return `program_unit_slot_v1:${input.slot_id}:${input.requirement_id}:${input.unit_id}:${dirs.join("+")}`;
}

export function parseProgramUnitSlotBindingRef(source_ref: string): {
  slot_id: string;
  requirement_id: string;
  unit_id: string;
  dir_ids: string[];
} | null {
  const m =
    /^program_unit_slot_v1:([^:]+):([^:]+):([^:]+):(.+)$/.exec(
      source_ref.trim(),
    );
  if (!m) return null;
  return {
    slot_id: m[1]!,
    requirement_id: m[2]!,
    unit_id: m[3]!,
    dir_ids: m[4]!
      .split("+")
      .map((d) => d.trim())
      .filter(Boolean),
  };
}

function page02BindableUnits(
  units: readonly BookJudgmentUnit[],
): BookJudgmentUnit[] {
  return units.filter(
    (u) =>
      (u.track === "science" ||
        u.track === "convergence" ||
        u.track === "destiny") &&
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

export function computeLinkedDirIdsForRelatedDirEnrichment(
  dc: DecisionContext,
): string[] {
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

type ResolvedUnitBinding = {
  unit_id: string;
  dir_ids: string[];
  source_ref: string;
  association_basis: (typeof RELATED_DIR_ASSOCIATION_BASES)[number];
  slot_id?: string;
  requirement_id?: string;
  source_version?: string;
  source_hash?: string;
  reasons: string[];
};

/**
 * Resolve edges → per-unit DIR sets.
 * - program_owned_unit_slot: multi-DIR + shared DIR across units allowed
 * - program_authority_edge (synthetic): single DIR, exclusive (test harness)
 */
function resolveAuthorityAssignments(input: {
  edges: readonly ProgramUnitDirAuthorityEdge[];
  unitIds: ReadonlySet<string>;
  linkedDirIds: ReadonlySet<string>;
  dirsById: ReturnType<typeof activeDirsById>;
  dc_content_hash: string | null;
}): {
  byUnit: Map<string, ResolvedUnitBinding>;
  rejected: Map<string, string[]>;
} {
  const byUnit = new Map<string, ResolvedUnitBinding>();
  const rejected = new Map<string, string[]>();
  const pushReject = (unitId: string, reason: string) => {
    const list = rejected.get(unitId) ?? [];
    list.push(reason);
    rejected.set(unitId, list);
  };

  type ValidEdge = {
    unit_id: string;
    dir_id: string;
    edge: ProgramUnitDirAuthorityEdge;
  };
  const slotEdges: ValidEdge[] = [];
  const syntheticEdges: ValidEdge[] = [];

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

    if (edge.association_basis === "program_owned_unit_slot") {
      if (
        edge.dc_content_hash !== undefined &&
        edge.dc_content_hash !== input.dc_content_hash
      ) {
        pushReject(
          unit_id,
          `reject_edge_dc_hash_mismatch:${String(edge.dc_content_hash)}`,
        );
        continue;
      }
      const slot_id = (edge.slot_id ?? "").trim();
      const requirement_id = (edge.requirement_id ?? "").trim();
      if (!slot_id || !requirement_id) {
        pushReject(unit_id, "reject_slot_edge_missing_ids");
        continue;
      }
      slotEdges.push({ unit_id, dir_id, edge });
      continue;
    }

    if (edge.association_basis === "program_authority_edge") {
      const expectedRef = canonicalProgramUnitDirEdgeRef({
        unit_id,
        dir_id,
        association_basis: edge.association_basis,
      });
      if (edge.source_ref.trim() !== expectedRef) {
        pushReject(unit_id, `reject_source_ref_mismatch:${edge.source_ref}`);
        continue;
      }
      syntheticEdges.push({ unit_id, dir_id, edge });
      continue;
    }

    pushReject(unit_id, `reject_unknown_basis:${edge.association_basis}`);
  }

  // Slot edges: group by unit; shared DIR across units OK; multi-DIR OK.
  const slotByUnit = new Map<string, ValidEdge[]>();
  for (const row of slotEdges) {
    const list = slotByUnit.get(row.unit_id) ?? [];
    list.push(row);
    slotByUnit.set(row.unit_id, list);
  }
  for (const [unitId, rows] of slotByUnit) {
    const first = rows[0]!.edge;
    const edgeRef = first.source_ref.trim();
    const parsed = parseProgramUnitSlotBindingRef(edgeRef);
    if (
      !parsed ||
      parsed.unit_id !== unitId ||
      parsed.slot_id !== (first.slot_id ?? "").trim() ||
      parsed.requirement_id !== (first.requirement_id ?? "").trim()
    ) {
      pushReject(unitId, `reject_slot_source_ref_mismatch:${edgeRef}`);
      continue;
    }
    if (rows.some((r) => r.edge.source_ref.trim() !== edgeRef)) {
      pushReject(unitId, "reject_slot_source_ref_inconsistent");
      continue;
    }
    // Accepted dirs = intersection of edge dirs with linked∩active and with ref set.
    const refDirSet = new Set(parsed.dir_ids);
    const dir_ids = [
      ...new Set(
        rows
          .map((r) => r.dir_id)
          .filter((d) => refDirSet.has(d)),
      ),
    ].sort((a, b) => a.localeCompare(b));
    if (!dir_ids.length) {
      pushReject(unitId, "reject_slot_no_linked_dirs");
      continue;
    }
    // Re-validate ref encodes a superset (SSOT full set) of accepted dirs.
    const expectedFull = canonicalProgramUnitSlotBindingRef({
      slot_id: parsed.slot_id,
      requirement_id: parsed.requirement_id,
      unit_id: unitId,
      dir_ids: parsed.dir_ids,
    });
    if (edgeRef !== expectedFull) {
      pushReject(unitId, `reject_slot_source_ref_canonical:${edgeRef}`);
      continue;
    }
    byUnit.set(unitId, {
      unit_id: unitId,
      dir_ids,
      source_ref: edgeRef,
      association_basis: "program_owned_unit_slot",
      slot_id: first.slot_id,
      requirement_id: first.requirement_id,
      source_version: first.source_version,
      source_hash: first.source_hash,
      reasons: [
        "algorithm:program_unit_dir_authority_v1",
        "basis:program_owned_unit_slot",
        ...dir_ids.map((d) => `accept:${d}`),
      ],
    });
  }

  // Synthetic exclusive single-DIR (tests)
  const synthByUnit = new Map<string, ValidEdge[]>();
  for (const row of syntheticEdges) {
    const list = synthByUnit.get(row.unit_id) ?? [];
    list.push(row);
    synthByUnit.set(row.unit_id, list);
  }
  const synthDirOwners = new Map<string, string>();
  for (const [unitId, rows] of synthByUnit) {
    if (byUnit.has(unitId)) {
      pushReject(unitId, "reject_synthetic_conflicts_with_slot");
      continue;
    }
    const dirs = [...new Set(rows.map((r) => r.dir_id))];
    if (dirs.length !== 1) {
      pushReject(unitId, `reject_ambiguous_unit_dirs:${dirs.join(",")}`);
      continue;
    }
    const dirId = dirs[0]!;
    const prior = synthDirOwners.get(dirId);
    if (prior && prior !== unitId) {
      pushReject(unitId, `reject_illegal_multi_claim_dir:${dirId}`);
      pushReject(prior, `reject_illegal_multi_claim_dir:${dirId}`);
      byUnit.delete(prior);
      continue;
    }
    synthDirOwners.set(dirId, unitId);
    byUnit.set(unitId, {
      unit_id: unitId,
      dir_ids: [dirId],
      source_ref: rows[0]!.edge.source_ref,
      association_basis: "program_authority_edge",
      reasons: [
        "algorithm:program_unit_dir_authority_v1",
        "basis:program_authority_edge",
        `accept:${dirId}`,
      ],
    });
  }

  return { byUnit, rejected };
}

/**
 * Enrich pack units with program-certified related_dir_ids + pack certificate.
 */
export function enrichBookJudgmentRelatedDirIds(input: {
  pack: BookJudgmentPack;
  dc: DecisionContext | null | undefined;
  /**
   * Internal edges from Slot Plan (production) or SYNTHETIC tests.
   * Face02 must rebuild from pack.page02_unit_slot_plan — never caller-arbitrary.
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
  const bindable = page02BindableUnits(units);
  const edges = input.authority_edges ?? [];

  if (!input.dc) {
    const certificate: RelatedDirEnrichmentCertificate = {
      version: RELATED_DIR_ENRICHMENT_VERSION,
      algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
      certified_at,
      dc_content_hash: null,
      linked_dir_ids: [],
      missing_authority: "no_dc",
      bindings: bindable.map((u) =>
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

  const linked_dir_ids = computeLinkedDirIdsForRelatedDirEnrichment(input.dc);
  const linkedSet = new Set(linked_dir_ids);
  const dirsById = activeDirsById(input.dc);
  const unitIds = new Set(bindable.map((u) => u.id));
  const dc_content_hash = input.dc.content_hash ?? null;

  const { byUnit, rejected } = resolveAuthorityAssignments({
    edges,
    unitIds,
    linkedDirIds: linkedSet,
    dirsById,
    dc_content_hash,
  });

  const bindings: RelatedDirEnrichmentBinding[] = [];
  for (const unit of bindable) {
    const reasons: string[] = ["algorithm:program_unit_dir_authority_v1"];
    reasons.push(...(rejected.get(unit.id) ?? []));
    const assigned = byUnit.get(unit.id);
    if (!assigned || !assigned.dir_ids.length) {
      reasons.push("missing_unit_dir_provenance");
      if (!edges.length) reasons.push("no_program_authority_edges");
      bindings.push(emptyBinding(unit.id, reasons));
      continue;
    }
    reasons.push(...assigned.reasons.filter((r) => !r.startsWith("algorithm:")));
    bindings.push({
      unit_id: unit.id,
      related_dir_ids: [...assigned.dir_ids],
      source_ref: assigned.source_ref,
      association_basis: assigned.association_basis,
      slot_id: assigned.slot_id,
      requirement_id: assigned.requirement_id,
      source_version: assigned.source_version,
      source_hash: assigned.source_hash,
      reasons,
    });
    const target = units.find((u) => u.id === unit.id);
    if (target) target.related_dir_ids = [...assigned.dir_ids];
  }

  const anyBound = bindings.some((b) => b.related_dir_ids.length > 0);
  const certificate: RelatedDirEnrichmentCertificate = {
    version: RELATED_DIR_ENRICHMENT_VERSION,
    algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
    certified_at,
    dc_content_hash,
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
