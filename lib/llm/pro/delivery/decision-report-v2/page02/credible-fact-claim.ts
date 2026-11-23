/**
 * Trusted Claim↔DIR↔Fact association for Page02.
 *
 * Trust root = program-certified bindings (BookJudgmentUnit.related_dir_ids ∩
 * DC linked structured dirs). Never trust model anchors / body_text /
 * explanation / declared_* as authority.
 *
 * Never mutates supports_claim_ids to force validation pass.
 */

import type { DecisionContext, DIR, RealityFact } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
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

/**
 * Build trusted per-claim DIR bindings from pack.related_dir_enrichment only.
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
  const enrich = input.pack?.related_dir_enrichment;
  const certOk =
    enrich &&
    enrich.version === 1 &&
    enrich.algorithm === "exclusive_linked_dir_slots_v1" &&
    Array.isArray(enrich.bindings);

  const unitsById = new Map<string, BookJudgmentUnit>();
  for (const u of input.pack?.units ?? []) {
    unitsById.set(u.id, u);
  }

  const bindingByUnit = new Map<
    string,
    { related_dir_ids: string[]; reasons: string[] }
  >();
  if (certOk) {
    for (const b of enrich.bindings) {
      bindingByUnit.set(b.unit_id, {
        related_dir_ids: [...(b.related_dir_ids ?? [])],
        reasons: [...(b.reasons ?? [])],
      });
    }
  }

  for (const claim of Object.values(input.registry.claims)) {
    if (claim.claim_type !== "reality_analysis") continue;
    const unitId = unitIdFromClaimId(claim.claim_id);
    if (!unitId) continue;
    const unit = unitsById.get(unitId);
    if (!unit) continue;
    if (unit.track !== "science" && unit.track !== "convergence") continue;

    const reasons: string[] = [];
    if (!certOk) {
      reasons.push("reject:missing_related_dir_enrichment_certificate");
      // Even if unit.related_dir_ids is populated, ignore without certificate.
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

    const fromCert = bindingByUnit.get(unitId);
    reasons.push("source:related_dir_enrichment");
    if (!fromCert) {
      reasons.push("no_certificate_binding_for_unit");
      out.set(claim.claim_id, {
        claim_id: claim.claim_id,
        unit_id: unitId,
        related_dir_ids: [],
        reasons,
      });
      continue;
    }
    reasons.push(...fromCert.reasons.slice(0, 8));

    const certified: string[] = [];
    for (const dirId of fromCert.related_dir_ids.map((d) => d.trim()).filter(Boolean)) {
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

    // Model suggestions never expand.
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
