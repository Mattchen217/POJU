/**
 * Face04 validation — schema + unit integrity + registry + fact status.
 * Fail-closed. Does not mint associations. No legacy_ bypass for new generation.
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
  /** When true (default for production), reject legacy_* claim/evidence ids. */
  reject_legacy_ids?: boolean;
}): Face04ValidationResult {
  const rejectLegacy = input.reject_legacy_ids !== false;
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

  const checkClaim = (cid: string, path: string) => {
    if (rejectLegacy && cid.startsWith("legacy_")) {
      issues.push({
        code: "legacy_id_forbidden",
        detail: `${path} cites legacy claim_id=${cid} (not allowed in new production)`,
        path,
      });
      return;
    }
    if (!claimSet.has(cid)) {
      issues.push({
        code: "unknown_claim_id",
        detail: `${path} cites unknown claim_id=${cid}`,
        path,
      });
    }
  };
  const checkEvidence = (eid: string, path: string) => {
    if (rejectLegacy && eid.startsWith("legacy_")) {
      issues.push({
        code: "legacy_id_forbidden",
        detail: `${path} cites legacy evidence_id=${eid} (not allowed in new production)`,
        path,
      });
      return;
    }
    if (!evidenceSet.has(eid)) {
      issues.push({
        code: "unknown_evidence_id",
        detail: `${path} cites unknown evidence_id=${eid}`,
        path,
      });
    }
  };

  for (const unit of page.content_units) {
    for (const cid of unit.claim_ids) checkClaim(cid, unit.unit_id);
    for (const eid of unit.evidence_ids ?? []) checkEvidence(eid, unit.unit_id);

    if (
      "related_reality_fact_ids" in unit &&
      Array.isArray(unit.related_reality_fact_ids)
    ) {
      for (const fid of unit.related_reality_fact_ids) {
        if (input.knownFactIds && !input.knownFactIds.has(fid)) {
          issues.push({
            code: "unknown_fact_id",
            detail: `unit ${unit.unit_id} cites unknown fact_id=${fid}`,
            path: unit.unit_id,
          });
          continue;
        }
        const status = input.factStatusById?.get(fid);
        if (
          status &&
          status !== "confirmed" &&
          unit.kind === "manifestation"
        ) {
          // Manifestation may cite non-confirmed facts only with conditional framing;
          // hard rule: never list them later as confirmed_fact_ids (checked below).
          // If unit text claims confirmation while status isn't confirmed — flag.
          if (/已确认|confirmed\s+fact|definitely\s+true/i.test(unit.text)) {
            issues.push({
              code: "fact_status_upgrade",
              detail: `unit ${unit.unit_id} treats fact ${fid} (${status}) as confirmed`,
              path: unit.unit_id,
            });
          }
        }
      }
    }
  }

  for (const cid of page.evidence_boundary.claim_ids) {
    checkClaim(cid, "evidence_boundary.claim_ids");
  }

  for (const fid of page.evidence_boundary.confirmed_fact_ids) {
    if (input.knownFactIds && !input.knownFactIds.has(fid)) {
      issues.push({
        code: "unknown_confirmed_fact_id",
        detail: `evidence_boundary.confirmed_fact_ids cites unknown fact_id=${fid}`,
        path: "evidence_boundary.confirmed_fact_ids",
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status !== "confirmed") {
      issues.push({
        code: "confirmed_fact_status_mismatch",
        detail: `evidence_boundary.confirmed_fact_ids includes ${fid} with status=${status ?? "missing"} (must be confirmed)`,
        path: "evidence_boundary.confirmed_fact_ids",
      });
    }
  }

  const kindChecks: Array<{
    ids: readonly string[];
    kind: string;
    section: string;
  }> = [
    {
      ids: page.bottleneck_naming_unit_ids,
      kind: "bottleneck_label",
      section: "bottleneck_naming",
    },
    {
      ids: page.manifestation_unit_ids,
      kind: "manifestation",
      section: "manifestation",
    },
    {
      ids: page.force_through_cost_unit_ids,
      kind: "force_through_cost",
      section: "force_through_cost",
    },
    {
      ids: page.leverage_point_unit_ids,
      kind: "leverage_point",
      section: "leverage_point",
    },
    {
      ids: page.evidence_boundary.evidence_note_unit_ids,
      kind: "evidence_note",
      section: "evidence_boundary",
    },
  ];
  for (const row of kindChecks) {
    for (const id of row.ids) {
      const u = page.content_units.find((x) => x.unit_id === id);
      if (u && u.kind !== row.kind) {
        issues.push({
          code: "section_kind_mismatch",
          detail: `${row.section} requires ${row.kind}, got ${u.kind} for ${id}`,
          path: id,
        });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
