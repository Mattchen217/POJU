/**
 * Trusted Claim↔DIR↔Fact association for Page02.
 *
 * Trust root = pack.related_dir_enrichment certificate after full validation.
 * Bare unit.related_dir_ids / model anchors / declared_* are never authority.
 *
 * Never mutates supports_claim_ids to force validation pass.
 */

import type { DecisionContext, DIR, RealityFact } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  RELATED_DIR_ENRICHMENT_ALGORITHM,
  RELATED_DIR_ENRICHMENT_VERSION,
  MISSING_UNIT_DIR_AUTHORITY_REF,
  isAllowedAssociationBasis,
  canonicalProgramUnitDirEdgeRef,
  canonicalProgramUnitSlotBindingRef,
  parseProgramUnitSlotBindingRef,
  computeLinkedDirIdsForRelatedDirEnrichment,
  type RelatedDirEnrichmentCertificate,
  type RelatedDirEnrichmentBinding,
} from "@/lib/llm/pro/delivery/book-judgment/related-dir-enrichment";
import { page02UnitRequirementById } from "@/lib/llm/pro/delivery/book-judgment/page02-unit-requirement-ssot";
import type { EvidenceRegistry, ReportClaim } from "../types";
import type { FactSelectionResult } from "../fact-relevance";
import { factEvidenceIdFor } from "./fact-id";

export type CredibleFactClaimPair = {
  claim_id: string;
  fact_id: string;
  evidence_id: string;
  related_dir_ids: string[];
  reasons: string[];
};

/** Program-certified per-claim DIR binding — sole trust root for pairs. */
export type TrustedClaimDirBinding = {
  claim_id: string;
  unit_id: string;
  related_dir_ids: string[];
  reasons: string[];
  source_ref?: string;
  association_basis?: string;
};

export function crediblePairKey(claimId: string, factId: string): string {
  return `${claimId}::${factId}`;
}

export function activeDirsById(dc: DecisionContext): Map<string, DIR> {
  const map = new Map<string, DIR>();
  for (const d of dc.dirs ?? []) {
    if (d.id_lifecycle !== "active") continue;
    map.set(d.dir_id, d);
  }
  return map;
}

/**
 * Structured dirs for a linked DC fact: related_dir_ids that exist as active
 * DIRs and share at least one required_fact_role with the fact's fact_roles.
 */
export function structuredLinkedDirsForFact(
  fact: RealityFact,
  dirsById: ReadonlyMap<string, DIR>,
): string[] {
  const roles = new Set((fact.fact_roles ?? []).map((r) => r.trim()).filter(Boolean));
  const out: string[] = [];
  for (const raw of fact.related_dir_ids ?? []) {
    const dirId = raw.trim();
    if (!dirId) continue;
    const dir = dirsById.get(dirId);
    if (!dir) continue;
    const dirRoles = dir.required_fact_roles ?? [];
    if (!dirRoles.some((r) => roles.has(r))) continue;
    out.push(dirId);
  }
  return out;
}

/** Linked-fact DIR set from fact selection (structured only). */
export function linkedStructuredDirIds(input: {
  dc: DecisionContext;
  fact_selection: FactSelectionResult;
}): Set<string> {
  const dirsById = activeDirsById(input.dc);
  const out = new Set<string>();
  for (const row of input.fact_selection.selected) {
    if (row.kind !== "linked") continue;
    for (const d of structuredLinkedDirsForFact(row.source, dirsById)) {
      out.add(d);
    }
  }
  return out;
}

/**
 * Role → DIR only when exactly one active DIR in the allowed set requires that
 * role. Ambiguous (0 or ≥2) → null (fail-closed, no auto multi-grant).
 */
export function resolveRoleToUniqueDir(
  role: string,
  dirsById: ReadonlyMap<string, DIR>,
  allowedDirIds?: ReadonlySet<string>,
): string | null {
  const r = role.trim();
  if (!r) return null;
  const matches: string[] = [];
  for (const dir of dirsById.values()) {
    if (allowedDirIds && !allowedDirIds.has(dir.dir_id)) continue;
    if ((dir.required_fact_roles ?? []).includes(r)) {
      matches.push(dir.dir_id);
    }
  }
  if (matches.length !== 1) return null;
  return matches[0]!;
}

/**
 * Parse model suggestion tokens (anchors / declared_*) into DIR id suggestions.
 * Audit / negative-test helper only — NEVER a trust root for granting.
 * Ambiguous roles yield no DIR (fail-closed).
 */
export function parseModelDirSuggestions(
  tokens: readonly string[] | undefined,
  dirsById: ReadonlyMap<string, DIR>,
  allowedDirIds?: ReadonlySet<string>,
): { suggested_dir_ids: string[]; rejected_tokens: string[] } {
  const suggested: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  if (!tokens?.length) return { suggested_dir_ids: suggested, rejected_tokens: rejected };

  const allow = (id: string): boolean => {
    if (!dirsById.has(id)) return false;
    if (allowedDirIds && !allowedDirIds.has(id)) return false;
    return true;
  };

  for (const raw of tokens) {
    const a = String(raw ?? "").trim();
    if (!a) continue;
    if (dirsById.has(a)) {
      if (allow(a) && !seen.has(a)) {
        seen.add(a);
        suggested.push(a);
      } else {
        rejected.push(a);
      }
      continue;
    }
    const dirPref = /^dir:(.+)$/i.exec(a);
    if (dirPref?.[1]) {
      const id = dirPref[1].trim();
      if (allow(id) && !seen.has(id)) {
        seen.add(id);
        suggested.push(id);
      } else {
        rejected.push(a);
      }
      continue;
    }
    const rolePref = /^role:(.+)$/i.exec(a);
    const role = (rolePref?.[1] ?? a).trim();
    const unique = resolveRoleToUniqueDir(role, dirsById, allowedDirIds);
    if (unique && !seen.has(unique)) {
      seen.add(unique);
      suggested.push(unique);
    } else {
      rejected.push(a);
    }
  }
  return { suggested_dir_ids: suggested, rejected_tokens: rejected };
}

/** @deprecated Name kept for tests — suggestions only, not trust root. */
export function resolveStructuredDirsFromAnchors(
  anchors: readonly string[] | undefined,
  dirsById: ReadonlyMap<string, DIR>,
): string[] {
  return parseModelDirSuggestions(anchors, dirsById).suggested_dir_ids;
}

function unitIdFromClaimId(claimId: string): string | null {
  if (!claimId.startsWith("claim_")) return null;
  const id = claimId.slice("claim_".length).trim();
  return id || null;
}

export type CertificateValidationFail = {
  ok: false;
  reasons: string[];
};

export type CertificateValidationOk = {
  ok: true;
  certificate: RelatedDirEnrichmentCertificate;
  /** unit_id → validated binding (dirs already filtered to active∩linked). */
  bindingsByUnit: Map<string, RelatedDirEnrichmentBinding>;
};

function isPage02ScienceOrConvergenceUnit(unit: BookJudgmentUnit): boolean {
  return (
    (unit.track === "science" || unit.track === "convergence") &&
    unit.serves_face.includes("02")
  );
}

/** Certificate bindable: face-02 destiny/science/convergence (Slot Plan may authorize destiny). */
function isPage02RelatedDirCertUnit(unit: BookJudgmentUnit): boolean {
  return (
    (unit.track === "science" ||
      unit.track === "convergence" ||
      unit.track === "destiny") &&
    unit.serves_face.includes("02")
  );
}

function sortedUniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Full certificate gate — version/algorithm presence alone is insufficient.
 * Non-empty bindings require exact canonical source_ref(unit, dir, basis).
 * A matching string shape is not proof of real business provenance.
 */
export function validateRelatedDirEnrichmentCertificate(input: {
  pack: BookJudgmentPack;
  dc: DecisionContext;
  fact_selection: FactSelectionResult;
  enrich: unknown;
}): CertificateValidationOk | CertificateValidationFail {
  const reasons: string[] = [];
  const enrich = input.enrich;
  if (!enrich || typeof enrich !== "object" || Array.isArray(enrich)) {
    return { ok: false, reasons: ["reject:missing_related_dir_enrichment_certificate"] };
  }
  const c = enrich as Record<string, unknown>;

  if (c.version !== RELATED_DIR_ENRICHMENT_VERSION) {
    reasons.push(`reject:bad_version:${String(c.version)}`);
  }
  if (c.algorithm !== RELATED_DIR_ENRICHMENT_ALGORITHM) {
    reasons.push(`reject:bad_algorithm:${String(c.algorithm)}`);
  }
  if (typeof c.certified_at !== "string" || !c.certified_at.trim()) {
    reasons.push("reject:missing_certified_at");
  }
  if (!("dc_content_hash" in c)) {
    reasons.push("reject:missing_dc_content_hash_field");
  } else {
    const certHash =
      c.dc_content_hash === null || c.dc_content_hash === undefined
        ? null
        : String(c.dc_content_hash);
    const dcHash = input.dc.content_hash ?? null;
    if (certHash !== dcHash) {
      reasons.push(
        `reject:dc_content_hash_mismatch:cert=${certHash ?? "null"}:dc=${dcHash ?? "null"}`,
      );
    }
  }

  const expectedLinked = computeLinkedDirIdsForRelatedDirEnrichment(input.dc);
  if (!Array.isArray(c.linked_dir_ids)) {
    reasons.push("reject:missing_linked_dir_ids");
  } else {
    const rawLinked = c.linked_dir_ids.map((d) => String(d).trim()).filter(Boolean);
    if (rawLinked.length !== new Set(rawLinked).size) {
      reasons.push("reject:duplicate_linked_dir_ids");
    }
    const certLinked = sortedUniqueStrings(rawLinked);
    if (
      certLinked.length !== expectedLinked.length ||
      certLinked.some((id, i) => id !== expectedLinked[i])
    ) {
      reasons.push(
        `reject:linked_dir_ids_mismatch:cert=${certLinked.join(",")}:dc=${expectedLinked.join(",")}`,
      );
    }
  }

  if (!("missing_authority" in c)) {
    reasons.push("reject:missing_missing_authority_field");
  } else if (
    c.missing_authority !== null &&
    typeof c.missing_authority !== "string"
  ) {
    reasons.push("reject:bad_missing_authority_type");
  } else if (
    typeof c.missing_authority === "string" &&
    !c.missing_authority.trim()
  ) {
    reasons.push("reject:empty_missing_authority_string");
  }

  if (!Array.isArray(c.bindings)) {
    reasons.push("reject:missing_bindings");
    return { ok: false, reasons };
  }

  const unitsById = new Map<string, BookJudgmentUnit>();
  for (const u of input.pack.units) unitsById.set(u.id, u);

  const dirsById = activeDirsById(input.dc);
  const linkedDirs = new Set(expectedLinked);
  const seenUnits = new Set<string>();
  /** Exclusive ownership only for synthetic program_authority_edge. */
  const synthDirOwners = new Map<string, string>();
  const bindingsByUnit = new Map<string, RelatedDirEnrichmentBinding>();
  let nonemptyBindingCount = 0;

  for (const raw of c.bindings) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      reasons.push("reject:malformed_binding");
      continue;
    }
    const b = raw as Record<string, unknown>;
    const unit_id = typeof b.unit_id === "string" ? b.unit_id.trim() : "";
    if (!unit_id) {
      reasons.push("reject:binding_missing_unit_id");
      continue;
    }
    if (seenUnits.has(unit_id)) {
      reasons.push(`reject:duplicate_unit_binding:${unit_id}`);
      continue;
    }
    seenUnits.add(unit_id);

    const unit = unitsById.get(unit_id);
    if (!unit) {
      reasons.push(`reject:unknown_unit:${unit_id}`);
      continue;
    }
    if (!isPage02RelatedDirCertUnit(unit)) {
      reasons.push(`reject:unit_not_page02_bindable:${unit_id}`);
      continue;
    }

    const source_ref =
      typeof b.source_ref === "string" ? b.source_ref.trim() : "";
    if (!source_ref) {
      reasons.push(`reject:missing_source_ref:${unit_id}`);
      continue;
    }
    if (!isAllowedAssociationBasis(b.association_basis)) {
      reasons.push(
        `reject:bad_association_basis:${unit_id}:${String(b.association_basis)}`,
      );
      continue;
    }
    const association_basis =
      b.association_basis as RelatedDirEnrichmentBinding["association_basis"];
    const rawDirs = Array.isArray(b.related_dir_ids)
      ? b.related_dir_ids.map((d) => String(d).trim()).filter(Boolean)
      : null;
    if (!rawDirs) {
      reasons.push(`reject:bad_related_dir_ids:${unit_id}`);
      continue;
    }
    if (rawDirs.length !== new Set(rawDirs).size) {
      reasons.push(`reject:duplicate_dir_in_binding:${unit_id}`);
      continue;
    }
    const bindingReasons = Array.isArray(b.reasons)
      ? b.reasons.map((r) => String(r)).filter(Boolean)
      : [];

    if (rawDirs.length === 0) {
      if (association_basis !== "none") {
        reasons.push(`reject:empty_dirs_non_none_basis:${unit_id}`);
        continue;
      }
      if (source_ref !== MISSING_UNIT_DIR_AUTHORITY_REF) {
        reasons.push(`reject:empty_dirs_bad_source_ref:${unit_id}`);
        continue;
      }
      bindingsByUnit.set(unit_id, {
        unit_id,
        related_dir_ids: [],
        source_ref,
        association_basis,
        reasons: bindingReasons,
      });
      continue;
    }

    if (association_basis === "none") {
      reasons.push(`reject:nonempty_with_none_basis:${unit_id}`);
      continue;
    }

    // --- Production Slot Plan basis: multi-DIR + shared DIR OK ---
    if (association_basis === "program_owned_unit_slot") {
      const parsed = parseProgramUnitSlotBindingRef(source_ref);
      const slot_id =
        typeof b.slot_id === "string" ? b.slot_id.trim() : "";
      const requirement_id =
        typeof b.requirement_id === "string" ? b.requirement_id.trim() : "";
      if (
        !parsed ||
        parsed.unit_id !== unit_id ||
        (slot_id && parsed.slot_id !== slot_id) ||
        (requirement_id && parsed.requirement_id !== requirement_id)
      ) {
        reasons.push(
          `reject:slot_source_ref_mismatch:${unit_id}:got=${source_ref}`,
        );
        continue;
      }
      const expectedRef = canonicalProgramUnitSlotBindingRef({
        slot_id: parsed.slot_id,
        requirement_id: parsed.requirement_id,
        unit_id,
        dir_ids: parsed.dir_ids,
      });
      if (source_ref !== expectedRef) {
        reasons.push(
          `reject:slot_source_ref_canonical:${unit_id}:got=${source_ref}`,
        );
        continue;
      }
      const refDirSet = new Set(parsed.dir_ids);
      let slotDirsOk = true;
      for (const dirId of rawDirs) {
        if (!refDirSet.has(dirId)) {
          reasons.push(`reject:dir_not_in_slot_ref:${unit_id}:${dirId}`);
          slotDirsOk = false;
          continue;
        }
        if (!dirsById.has(dirId)) {
          reasons.push(`reject_inactive_or_missing:${dirId}`);
          slotDirsOk = false;
          continue;
        }
        if (!linkedDirs.has(dirId)) {
          reasons.push(`reject_not_linked:${dirId}`);
          slotDirsOk = false;
        }
      }
      if (!slotDirsOk) continue;

      const req = page02UnitRequirementById(parsed.requirement_id);
      if (!req) {
        reasons.push(
          `reject:unknown_requirement:${unit_id}:${parsed.requirement_id}`,
        );
        continue;
      }
      const source_version =
        typeof b.source_version === "string" ? b.source_version.trim() : "";
      const source_hash =
        typeof b.source_hash === "string" ? b.source_hash.trim() : "";
      if (source_version && source_version !== req.source_version) {
        reasons.push(
          `reject:source_version_mismatch:${unit_id}:got=${source_version}`,
        );
        continue;
      }
      if (source_hash && source_hash !== req.source_hash) {
        reasons.push(
          `reject:source_hash_mismatch:${unit_id}:got=${source_hash}`,
        );
        continue;
      }
      let ssotDirsOk = true;
      for (const dirId of rawDirs) {
        if (!req.dir_ids.includes(dirId)) {
          reasons.push(
            `reject:dir_not_in_requirement_ssot:${unit_id}:${dirId}`,
          );
          ssotDirsOk = false;
        }
      }
      if (!ssotDirsOk) continue;

      const plan = input.pack.page02_unit_slot_plan;
      if (!plan?.slots?.length) {
        reasons.push(`reject:missing_page02_unit_slot_plan:${unit_id}`);
        continue;
      }
      const planSlot = plan.slots.find((s) => s.slot_id === parsed.slot_id);
      if (!planSlot || planSlot.unit_id !== unit_id) {
        reasons.push(`reject:slot_not_in_plan:${unit_id}:${parsed.slot_id}`);
        continue;
      }
      if (plan.dc_content_hash !== (input.dc.content_hash ?? null)) {
        reasons.push(
          `reject:slot_plan_dc_hash_mismatch:plan=${plan.dc_content_hash ?? "null"}:dc=${input.dc.content_hash ?? "null"}`,
        );
        continue;
      }
      nonemptyBindingCount += 1;
      bindingsByUnit.set(unit_id, {
        unit_id,
        related_dir_ids: sortedUniqueStrings(rawDirs),
        source_ref,
        association_basis,
        slot_id: parsed.slot_id,
        requirement_id: parsed.requirement_id,
        source_version: source_version || req.source_version,
        source_hash: source_hash || req.source_hash,
        reasons: bindingReasons,
      });
      continue;
    }

    // --- Synthetic exclusive single-DIR (resolver tests only) ---
    if (association_basis !== "program_authority_edge") {
      reasons.push(`reject:unsupported_basis:${unit_id}:${association_basis}`);
      continue;
    }
    if (!isPage02ScienceOrConvergenceUnit(unit)) {
      reasons.push(`reject:unit_not_page02_science:${unit_id}`);
      continue;
    }
    if (rawDirs.length !== 1) {
      reasons.push(
        `reject:nonempty_must_be_singleton_dir:${unit_id}:n=${rawDirs.length}`,
      );
      continue;
    }
    const dirId = rawDirs[0]!;
    const expectedRef = canonicalProgramUnitDirEdgeRef({
      unit_id,
      dir_id: dirId,
      association_basis,
    });
    if (source_ref !== expectedRef) {
      reasons.push(
        `reject:source_ref_mismatch:${unit_id}:got=${source_ref}:expected=${expectedRef}`,
      );
      continue;
    }
    if (!dirsById.has(dirId)) {
      reasons.push(`reject_inactive_or_missing:${dirId}`);
      continue;
    }
    if (!linkedDirs.has(dirId)) {
      reasons.push(`reject_not_linked:${dirId}`);
      continue;
    }
    const priorOwner = synthDirOwners.get(dirId);
    if (priorOwner && priorOwner !== unit_id) {
      reasons.push(
        `reject:illegal_multi_claim_dir:${dirId}:units=${priorOwner},${unit_id}`,
      );
      continue;
    }
    synthDirOwners.set(dirId, unit_id);
    nonemptyBindingCount += 1;

    bindingsByUnit.set(unit_id, {
      unit_id,
      related_dir_ids: [dirId],
      source_ref,
      association_basis,
      reasons: bindingReasons,
    });
  }

  // missing_authority must agree with binding occupancy.
  if (!reasons.some((r) => r.startsWith("reject:bad_missing_authority") || r === "reject:missing_missing_authority_field" || r === "reject:empty_missing_authority_string")) {
    const ma = c.missing_authority;
    if (nonemptyBindingCount > 0) {
      if (ma !== null) {
        reasons.push(
          `reject:missing_authority_with_nonempty_bindings:${String(ma)}`,
        );
      }
    } else if (ma === null) {
      reasons.push("reject:missing_authority_null_while_all_empty");
    }
  }

  if (reasons.length) {
    return { ok: false, reasons };
  }

  return {
    ok: true,
    certificate: enrich as RelatedDirEnrichmentCertificate,
    bindingsByUnit,
  };
}

/**
 * Build trusted per-claim DIR bindings from validated pack.related_dir_enrichment only.
 * Bare unit.related_dir_ids / model anchors are never the trust root.
 */
export function buildTrustedClaimDirBindings(input: {
  pack: BookJudgmentPack | null | undefined;
  dc: DecisionContext;
  fact_selection: FactSelectionResult;
  registry: EvidenceRegistry;
}): Map<string, TrustedClaimDirBinding> {
  const out = new Map<string, TrustedClaimDirBinding>();
  const dirsById = activeDirsById(input.dc);
  const linkedDirs = linkedStructuredDirIds(input);

  const unitsById = new Map<string, BookJudgmentUnit>();
  for (const u of input.pack?.units ?? []) {
    unitsById.set(u.id, u);
  }

  const validated =
    input.pack != null
      ? validateRelatedDirEnrichmentCertificate({
          pack: input.pack,
          dc: input.dc,
          fact_selection: input.fact_selection,
          enrich: input.pack.related_dir_enrichment,
        })
      : ({ ok: false, reasons: ["reject:missing_pack"] } as const);

  for (const claim of Object.values(input.registry.claims)) {
    if (claim.claim_type !== "reality_analysis") continue;
    const unitId = unitIdFromClaimId(claim.claim_id);
    if (!unitId) continue;
    const unit = unitsById.get(unitId);
    if (!unit) continue;
    if (unit.track !== "science" && unit.track !== "convergence") continue;

    const reasons: string[] = [];
    if (!validated.ok) {
      reasons.push("reject:invalid_related_dir_enrichment_certificate");
      reasons.push(...validated.reasons.slice(0, 8));
      if ((unit.related_dir_ids ?? []).length) {
        reasons.push("ignore_uncertified_unit_related_dir_ids");
      }
      out.set(claim.claim_id, {
        claim_id: claim.claim_id,
        unit_id: unitId,
        related_dir_ids: [],
        reasons,
      });
      continue;
    }

    const fromCert = validated.bindingsByUnit.get(unitId);
    reasons.push("source:related_dir_enrichment");
    if (!fromCert) {
      reasons.push("no_certificate_binding_for_unit");
      out.set(claim.claim_id, {
        claim_id: claim.claim_id,
        unit_id: unitId,
        related_dir_ids: [],
        reasons,
        source_ref: MISSING_UNIT_DIR_AUTHORITY_REF,
        association_basis: "none",
      });
      continue;
    }
    reasons.push(...fromCert.reasons.slice(0, 8));

    // Re-check active∩linked (defense in depth after cert validation).
    const certified: string[] = [];
    for (const dirId of fromCert.related_dir_ids) {
      if (!dirsById.has(dirId)) {
        reasons.push(`reject_inactive_or_missing:${dirId}`);
        continue;
      }
      if (!linkedDirs.has(dirId)) {
        reasons.push(`reject_not_linked:${dirId}`);
        continue;
      }
      certified.push(dirId);
      reasons.push(`accept:${dirId}`);
    }

    const suggestions = parseModelDirSuggestions(
      [
        ...(unit.declared_related_dir_ids ?? []),
        ...(unit.anchors ?? []),
      ],
      dirsById,
      linkedDirs,
    );
    for (const s of suggestions.suggested_dir_ids) {
      if (!certified.includes(s)) {
        reasons.push(`ignore_model_suggestion:${s}`);
      }
    }

    out.set(claim.claim_id, {
      claim_id: claim.claim_id,
      unit_id: unitId,
      related_dir_ids: certified,
      reasons,
      source_ref: fromCert.source_ref,
      association_basis: fromCert.association_basis,
    });
  }

  return out;
}

/**
 * Mirror trusted bindings onto claim.related_dir_ids (display/slice only).
 * Trust root remains TrustedClaimDirBinding map.
 */
export function certifyClaimDirBindings(input: {
  registry: EvidenceRegistry;
  trustedBindings: ReadonlyMap<string, TrustedClaimDirBinding>;
}): void {
  for (const claim of Object.values(input.registry.claims)) {
    const trusted = input.trustedBindings.get(claim.claim_id);
    if (!trusted || claim.claim_type !== "reality_analysis") {
      claim.related_dir_ids = [];
      continue;
    }
    claim.related_dir_ids = [...trusted.related_dir_ids];
  }
}

/**
 * Credible pairs from trusted bindings ∩ linked fact dirs.
 * Does not read claim.related_dir_ids as authority (mirror only).
 */
export function buildCrediblePage02FactClaimPairs(input: {
  registry: EvidenceRegistry;
  fact_selection: FactSelectionResult;
  dc: DecisionContext;
  trustedBindings: ReadonlyMap<string, TrustedClaimDirBinding>;
}): {
  pairs: CredibleFactClaimPair[];
  pairKeys: Set<string>;
} {
  const pairs: CredibleFactClaimPair[] = [];
  const pairKeys = new Set<string>();
  const dirsById = activeDirsById(input.dc);

  for (const row of input.fact_selection.selected) {
    if (row.kind !== "linked") continue;
    const factId = row.fact.fact_id;
    const evidence_id = factEvidenceIdFor(factId);
    if (!input.registry.evidence[evidence_id]) continue;

    const factDirs = structuredLinkedDirsForFact(row.source, dirsById);
    if (!factDirs.length) continue;
    const factDirSet = new Set(factDirs);

    for (const [claimId, binding] of input.trustedBindings) {
      if (!input.registry.claims[claimId]) continue;
      if (!binding.related_dir_ids.length) continue;

      const overlap = binding.related_dir_ids.filter((d) => factDirSet.has(d));
      if (!overlap.length) continue;
      if (overlap.some((d) => !dirsById.has(d))) continue;

      const key = crediblePairKey(claimId, factId);
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      pairs.push({
        claim_id: claimId,
        fact_id: factId,
        evidence_id,
        related_dir_ids: overlap,
        reasons: [
          `selection:${row.kind}`,
          `dir_overlap:${overlap.join(",")}`,
          ...binding.reasons.slice(0, 4),
          ...row.reasons.slice(0, 2),
        ],
      });
    }
  }

  return { pairs, pairKeys };
}

export function claimOwnsFactCredibly(
  pairKeys: ReadonlySet<string> | undefined,
  claimId: string,
  factId: string,
): boolean {
  if (!pairKeys || pairKeys.size === 0) return false;
  return pairKeys.has(crediblePairKey(claimId, factId));
}

/** Auxiliary only — never the primary integrity mechanism. */
export function detectAssertedFactIdsInText(
  text: string,
  factContentById: ReadonlyMap<string, string> | undefined,
): string[] {
  if (!text.trim() || !factContentById || factContentById.size === 0) return [];
  const norm = text.replace(/\s+/g, " ").toLowerCase();
  const out: string[] = [];
  for (const [factId, content] of factContentById) {
    const c = (content ?? "").trim();
    if (norm.includes(factId.toLowerCase())) {
      out.push(factId);
      continue;
    }
    if (c.length < 12) continue;
    const frag = c.slice(0, Math.min(28, c.length)).toLowerCase();
    if (frag.length >= 12 && norm.includes(frag)) {
      out.push(factId);
    }
  }
  return out;
}

export function claimHasProgramDirs(claim: ReportClaim | undefined): boolean {
  return Boolean(claim?.related_dir_ids?.some((d) => d.trim()));
}
