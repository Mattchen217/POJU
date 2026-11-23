/**
 * Program-only Claim–DIR enrichment for BookJudgmentPack (Page02 trust root).
 *
 * Algorithm: exclusive_linked_dir_slots_v1
 * - Build linked DIR slots from DC RealityFact structured links (not model text).
 * - Select science|convergence units that serve face "02", sorted by unit.id.
 * - Assign at most one linked DIR per unit, exclusively (1:1 by stable sort).
 * - Never read anchors / declared_related_dir_ids / claim / explanation.
 * - Never grant all DIRs to all reality_analysis units.
 * - serves_face/track only select the candidate pool; they do not prove semantics —
 *   the exclusive DC-derived slot list is the program assignment.
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
  "exclusive_linked_dir_slots_v1" as const;

export type RelatedDirEnrichmentBinding = {
  unit_id: string;
  related_dir_ids: string[];
  reasons: string[];
};

export type RelatedDirEnrichmentCertificate = {
  version: typeof RELATED_DIR_ENRICHMENT_VERSION;
  algorithm: typeof RELATED_DIR_ENRICHMENT_ALGORITHM;
  certified_at: string;
  dc_content_hash: string | null;
  linked_dir_ids: string[];
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
    Array.isArray(o.bindings)
  );
}

function page02ScienceUnits(
  units: readonly BookJudgmentUnit[],
): BookJudgmentUnit[] {
  return units
    .filter(
      (u) =>
        (u.track === "science" || u.track === "convergence") &&
        u.serves_face.includes("02"),
    )
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Enrich pack units with program-certified related_dir_ids + pack certificate.
 * Idempotent. Without DC, clears prior dirs and writes an empty certificate.
 */
export function enrichBookJudgmentRelatedDirIds(input: {
  pack: BookJudgmentPack;
  dc: DecisionContext | null | undefined;
}): {
  pack: BookJudgmentPack;
  certificate: RelatedDirEnrichmentCertificate;
} {
  const certified_at = new Date().toISOString();
  const units = input.pack.units.map((u) => {
    const next: BookJudgmentUnit = { ...u };
    // Always clear prior unit field — only certificate + this enrich may refill.
    next.related_dir_ids = [];
    return next;
  });

  if (!input.dc) {
    const certificate: RelatedDirEnrichmentCertificate = {
      version: RELATED_DIR_ENRICHMENT_VERSION,
      algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
      certified_at,
      dc_content_hash: null,
      linked_dir_ids: [],
      bindings: page02ScienceUnits(units).map((u) => ({
        unit_id: u.id,
        related_dir_ids: [],
        reasons: ["no_dc"],
      })),
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

  const fact_selection = selectRealityFactsForPage01({
    dc: input.dc,
    maxFacts: 24,
  });
  const dirsById = activeDirsById(input.dc);
  const linkedSet = linkedStructuredDirIds({
    dc: input.dc,
    fact_selection,
  });
  const linked_dir_ids = [...linkedSet].sort((a, b) => a.localeCompare(b));

  // Prefer dirs that still resolve against at least one linked fact structure.
  const eligibleDirs = linked_dir_ids.filter((dirId) => {
    if (!dirsById.has(dirId)) return false;
    return fact_selection.selected.some((row) => {
      if (row.kind !== "linked") return false;
      return structuredLinkedDirsForFact(row.source, dirsById).includes(dirId);
    });
  });

  const scienceUnits = page02ScienceUnits(units);
  const bindings: RelatedDirEnrichmentBinding[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < scienceUnits.length; i++) {
    const unit = scienceUnits[i]!;
    const dirId = eligibleDirs[i];
    const reasons: string[] = [
      "algorithm:exclusive_linked_dir_slots_v1",
      `unit_index:${i}`,
    ];
    if (!dirId) {
      reasons.push("no_remaining_linked_dir_slot");
      bindings.push({ unit_id: unit.id, related_dir_ids: [], reasons });
      continue;
    }
    if (assigned.has(dirId)) {
      reasons.push(`reject_duplicate_slot:${dirId}`);
      bindings.push({ unit_id: unit.id, related_dir_ids: [], reasons });
      continue;
    }
    assigned.add(dirId);
    reasons.push(`assign:${dirId}`);
    bindings.push({
      unit_id: unit.id,
      related_dir_ids: [dirId],
      reasons,
    });
    const target = units.find((u) => u.id === unit.id);
    if (target) target.related_dir_ids = [dirId];
  }

  const certificate: RelatedDirEnrichmentCertificate = {
    version: RELATED_DIR_ENRICHMENT_VERSION,
    algorithm: RELATED_DIR_ENRICHMENT_ALGORITHM,
    certified_at,
    dc_content_hash: input.dc.content_hash ?? null,
    linked_dir_ids: eligibleDirs,
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
