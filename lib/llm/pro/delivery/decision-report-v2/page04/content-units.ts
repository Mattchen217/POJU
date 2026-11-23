/**
 * Face04 content unit helpers — resolve / display / body blob.
 */

import type { Face04ContentUnit, Face04V2 } from "../schemas";

export function indexFace04ContentUnits(
  units: readonly Face04ContentUnit[],
): Map<string, Face04ContentUnit> {
  const map = new Map<string, Face04ContentUnit>();
  for (const u of units) {
    if (!map.has(u.unit_id)) map.set(u.unit_id, u);
  }
  return map;
}

export function resolveFace04Units(
  page: Face04V2,
  unitIds: readonly string[],
): Face04ContentUnit[] {
  const index = indexFace04ContentUnits(page.content_units);
  const out: Face04ContentUnit[] = [];
  const seen = new Set<string>();
  for (const id of unitIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const u = index.get(id);
    if (u) out.push(u);
  }
  return out;
}

export function face04UnitDisplayText(unit: Face04ContentUnit): string {
  if (unit.kind === "bottleneck_label" && unit.title?.trim()) {
    return `${unit.title.trim()}\n${unit.text}`;
  }
  return unit.text;
}

export function face04AssembledBodyBlob(page: Face04V2): string {
  const parts = [
    ...resolveFace04Units(page, page.bottleneck_naming_unit_ids).map(
      face04UnitDisplayText,
    ),
    ...resolveFace04Units(page, page.manifestation_unit_ids).map(
      face04UnitDisplayText,
    ),
    ...resolveFace04Units(page, page.force_through_cost_unit_ids).map(
      face04UnitDisplayText,
    ),
    ...resolveFace04Units(page, page.leverage_point_unit_ids).map(
      face04UnitDisplayText,
    ),
    ...resolveFace04Units(
      page,
      page.evidence_boundary.evidence_note_unit_ids,
    ).map(face04UnitDisplayText),
    ...page.evidence_boundary.hypothesis_notes,
    ...page.evidence_boundary.uncertainty_notes,
  ];
  return parts.filter(Boolean).join("\n");
}

export function assertFace04UnitIdIntegrity(page: Face04V2): string[] {
  const issues: string[] = [];
  const ids = page.content_units.map((u) => u.unit_id);
  if (new Set(ids).size !== ids.length) {
    issues.push("duplicate content_units.unit_id");
  }
  const index = indexFace04ContentUnits(page.content_units);
  const check = (label: string, list: readonly string[]) => {
    for (const id of list) {
      if (!index.has(id)) issues.push(`${label} unknown unit_id=${id}`);
    }
  };
  check("bottleneck_naming_unit_ids", page.bottleneck_naming_unit_ids);
  check("manifestation_unit_ids", page.manifestation_unit_ids);
  check("force_through_cost_unit_ids", page.force_through_cost_unit_ids);
  check("leverage_point_unit_ids", page.leverage_point_unit_ids);
  check(
    "evidence_boundary.evidence_note_unit_ids",
    page.evidence_boundary.evidence_note_unit_ids,
  );
  return issues;
}
