/**
 * Face04 validation — schema + unit integrity + registry claim/evidence existence.
 * Fail-closed. Does not mint associations.
 */

import { Face04V2Schema, type Face04V2 } from "../schemas";
import { normalizePage04ReadingOrder } from "./architecture/sections";
import { assertFace04UnitIdIntegrity } from "./content-units";
import type { EvidenceRegistry } from "../types";

export type Face04Issue = {
  code: string;
  detail: string;
  path?: string;
};

export type Face04ValidationResult =
  | { ok: true; page: Face04V2 }
  | { ok: false; issues: Face04Issue[] };

export function validateFace04Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
}): Face04ValidationResult {
  const issues: Face04Issue[] = [];
  const patched =
    input.raw && typeof input.raw === "object"
      ? {
          ...(input.raw as Record<string, unknown>),
          reading_order: normalizePage04ReadingOrder(
            (input.raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : input.raw;
  const parsed = Face04V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: "gate_face_zod_fail",
          detail: parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".")}:${i.message}`)
            .join("; "),
        },
      ],
    };
  }
  const page = parsed.data;
  for (const msg of assertFace04UnitIdIntegrity(page)) {
    issues.push({ code: "unit_integrity", detail: msg });
  }

  const claimSet = new Set(Object.keys(input.registry.claims));
  const evidenceSet = new Set(Object.keys(input.registry.evidence));
  for (const unit of page.content_units) {
    for (const cid of unit.claim_ids) {
      if (!claimSet.has(cid) && !cid.startsWith("legacy_")) {
        issues.push({
          code: "unknown_claim_id",
          detail: `unit ${unit.unit_id} cites unknown claim_id=${cid}`,
          path: unit.unit_id,
        });
      }
    }
    for (const eid of unit.evidence_ids ?? []) {
      if (!evidenceSet.has(eid) && !eid.startsWith("legacy_")) {
        issues.push({
          code: "unknown_evidence_id",
          detail: `unit ${unit.unit_id} cites unknown evidence_id=${eid}`,
          path: unit.unit_id,
        });
      }
    }
    if (
      "related_reality_fact_ids" in unit &&
      Array.isArray(unit.related_reality_fact_ids) &&
      input.knownFactIds
    ) {
      for (const fid of unit.related_reality_fact_ids) {
        if (!input.knownFactIds.has(fid)) {
          issues.push({
            code: "unknown_fact_id",
            detail: `unit ${unit.unit_id} cites unknown fact_id=${fid}`,
            path: unit.unit_id,
          });
        }
      }
    }
  }

  // Kind must match section allowlists (structural).
  for (const id of page.bottleneck_naming_unit_ids) {
    const u = page.content_units.find((x) => x.unit_id === id);
    if (u && u.kind !== "bottleneck_label") {
      issues.push({
        code: "section_kind_mismatch",
        detail: `bottleneck_naming requires bottleneck_label, got ${u.kind}`,
      });
    }
  }
  for (const id of page.manifestation_unit_ids) {
    const u = page.content_units.find((x) => x.unit_id === id);
    if (u && u.kind !== "manifestation") {
      issues.push({
        code: "section_kind_mismatch",
        detail: `manifestation section requires manifestation kind, got ${u.kind}`,
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
