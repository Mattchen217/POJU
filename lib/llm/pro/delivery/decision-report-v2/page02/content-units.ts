/**
 * Face02 content-unit assembly — reader/PDF consume validated units only.
 */

import type { Face02ContentUnit, Face02V2 } from "../schemas";
import type { EvidenceRegistry } from "../types";

export function indexFace02ContentUnits(
  units: readonly Face02ContentUnit[],
): Map<string, Face02ContentUnit> {
  const map = new Map<string, Face02ContentUnit>();
  for (const u of units) map.set(u.unit_id, u);
  return map;
}

function nonEmptyIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * B-assembly: fill empty unit/boundary claim_ids from:
 * 1) registry evidence ownership, and/or
 * 2) program-certified credible fact↔claim pairs (for reality_fact units).
 * Never invents associations from free text.
 */
export function assembleFace02ClaimOwnershipSlots(input: {
  raw: unknown;
  registry: EvidenceRegistry;
  /** Optional program-certified pairs for reality_fact claim fill. */
  credibleFactClaimKeys?: ReadonlySet<string>;
}): unknown {
  if (!input.raw || typeof input.raw !== "object" || Array.isArray(input.raw)) {
    return input.raw;
  }
  const page = structuredClone(input.raw) as Record<string, unknown>;
  const unitsRaw = page.content_units;
  if (!Array.isArray(unitsRaw)) return page;

  const claimIdsOwningEvidence = (evidenceId: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      const t = id.trim();
      if (!t || seen.has(t) || !input.registry.claims[t]) return;
      seen.add(t);
      out.push(t);
    };
    const ev = input.registry.evidence[evidenceId];
    if (ev) {
      for (const c of ev.supports_claim_ids ?? []) push(c);
      for (const c of ev.limits_claim_ids ?? []) push(c);
    }
    for (const claim of Object.values(input.registry.claims)) {
      if (claim.evidence_ids.includes(evidenceId)) push(claim.claim_id);
    }
    return out;
  };

  const claimsForFact = (factId: string): string[] => {
    const keys = input.credibleFactClaimKeys;
    if (!keys || keys.size === 0) return [];
    const out: string[] = [];
    for (const key of keys) {
      const sep = key.indexOf("::");
      if (sep < 0) continue;
      const claimId = key.slice(0, sep);
      const fid = key.slice(sep + 2);
      if (fid !== factId) continue;
      if (!input.registry.claims[claimId]) continue;
      out.push(claimId);
    }
    return out;
  };

  for (const item of unitsRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const unit = item as Record<string, unknown>;
    const existing = nonEmptyIdList(unit.claim_ids);
    if (existing.length > 0) {
      unit.claim_ids = existing.slice(0, 8);
      continue;
    }
    const derived: string[] = [];
    const seen = new Set<string>();
    const pushAll = (ids: string[]) => {
      for (const cid of ids) {
        if (seen.has(cid)) continue;
        seen.add(cid);
        derived.push(cid);
      }
    };
    for (const eid of nonEmptyIdList(unit.evidence_ids)) {
      pushAll(claimIdsOwningEvidence(eid));
    }
    if (unit.kind === "reality_fact") {
      for (const fid of nonEmptyIdList(unit.fact_ids)) {
        pushAll(claimsForFact(fid));
      }
    }
    if (derived.length > 0) {
      unit.claim_ids = derived.slice(0, 8);
    }
  }

  const boundary = page.explanation_boundary;
  if (boundary && typeof boundary === "object" && !Array.isArray(boundary)) {
    const b = boundary as Record<string, unknown>;
    const existing = nonEmptyIdList(b.claim_ids);
    if (existing.length === 0) {
      const unitIds = [
        ...nonEmptyIdList(b.personal_unit_ids),
        ...nonEmptyIdList(b.confirmed_fact_unit_ids),
        ...nonEmptyIdList(b.hypothesis_unit_ids),
      ];
      const fromUnits: string[] = [];
      const seen = new Set<string>();
      for (const uid of unitIds) {
        const unit = unitsRaw.find(
          (u) =>
            u &&
            typeof u === "object" &&
            !Array.isArray(u) &&
            (u as { unit_id?: unknown }).unit_id === uid,
        ) as Record<string, unknown> | undefined;
        if (!unit) continue;
        for (const cid of nonEmptyIdList(unit.claim_ids)) {
          if (seen.has(cid) || !input.registry.claims[cid]) continue;
          seen.add(cid);
          fromUnits.push(cid);
        }
      }
      if (fromUnits.length > 0) {
        b.claim_ids = fromUnits.slice(0, 8);
      }
    } else {
      b.claim_ids = existing.slice(0, 8);
    }
  }

  return page;
}

export function resolveFace02Units(
  page: Face02V2,
  unitIds: readonly string[],
): Face02ContentUnit[] {
  const index = indexFace02ContentUnits(page.content_units);
  const out: Face02ContentUnit[] = [];
  const seen = new Set<string>();
  for (const id of unitIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const u = index.get(id);
    if (u) out.push(u);
  }
  return out;
}

export function face02UnitDisplayText(unit: Face02ContentUnit): string {
  if (unit.kind === "personal_interpretation" && unit.title?.trim()) {
    return `${unit.title.trim()}\n${unit.text}`;
  }
  return unit.text;
}

export function assembleFace02SectionText(
  page: Face02V2,
  unitIds: readonly string[],
): string {
  return resolveFace02Units(page, unitIds)
    .map(face02UnitDisplayText)
    .filter(Boolean)
    .join("\n");
}

/** Flatten all assembled section texts for body compliance / scare scans. */
export function face02AssembledBodyBlob(page: Face02V2): string {
  const parts = [
    ...resolveFace02Units(page, page.page_summary_unit_ids).map(face02UnitDisplayText),
    ...resolveFace02Units(page, page.relevant_personal_factor_unit_ids).map(
      face02UnitDisplayText,
    ),
    ...resolveFace02Units(page, page.personal_reality_interplay_unit_ids).map(
      face02UnitDisplayText,
    ),
    ...resolveFace02Units(page, page.why_judgment_fits_unit_ids).map(
      face02UnitDisplayText,
    ),
    page.page01_judgment_ref,
    ...resolveFace02Units(
      page,
      page.explanation_boundary.personal_unit_ids,
    ).map(face02UnitDisplayText),
    ...resolveFace02Units(
      page,
      page.explanation_boundary.confirmed_fact_unit_ids,
    ).map(face02UnitDisplayText),
    ...resolveFace02Units(
      page,
      page.explanation_boundary.hypothesis_unit_ids,
    ).map(face02UnitDisplayText),
    ...(page.explanation_boundary.uncertainty_notes ?? []),
  ];
  return parts.filter(Boolean).join("\n");
}

export function collectFace02UnitEvidenceIds(page: Face02V2): string[] {
  const ids: string[] = [];
  for (const u of page.content_units) {
    ids.push(...u.evidence_ids);
  }
  return [...new Set(ids)];
}
