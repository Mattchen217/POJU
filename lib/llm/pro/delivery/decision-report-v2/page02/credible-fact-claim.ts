/**
 * Read-only credible (claim_id, fact_id) pairs from DC structured fields only.
 *
 * Chain: linked RealityFact.related_dir_ids ∩ active DIR (with role match)
 *      → program-certified claim.related_dir_ids
 *
 * Never uses claim.body_text / evidence.explanation substring matching.
 * Never mutates supports_claim_ids to force validation pass.
 */

import type { DecisionContext, DIR, RealityFact } from "@/lib/poju/decision-context/types";
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

export function crediblePairKey(claimId: string, factId: string): string {
  return `${claimId}::${factId}`;
}

function activeDirsById(dc: DecisionContext): Map<string, DIR> {
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

/**
 * Per-claim DIR candidates from pack unit anchors (structured tokens only).
 * Accepts exact active dir_id, `dir:<dir_id>`, or an exact required_fact_role
 * that appears on an active DIR. Never parses free-text body/explanation.
 */
export function resolveStructuredDirsFromAnchors(
  anchors: readonly string[] | undefined,
  dirsById: ReadonlyMap<string, DIR>,
): string[] {
  if (!anchors?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (dirId: string) => {
    const t = dirId.trim();
    if (!t || seen.has(t) || !dirsById.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  for (const raw of anchors) {
    const a = String(raw ?? "").trim();
    if (!a) continue;
    if (dirsById.has(a)) {
      push(a);
      continue;
    }
    const dirPref = /^dir:(.+)$/i.exec(a);
    if (dirPref?.[1]) {
      push(dirPref[1].trim());
      continue;
    }
    const rolePref = /^role:(.+)$/i.exec(a);
    const role = (rolePref?.[1] ?? a).trim();
    if (!role) continue;
    for (const dir of dirsById.values()) {
      if ((dir.required_fact_roles ?? []).includes(role)) {
        push(dir.dir_id);
      }
    }
  }
  return out;
}

/**
 * Program-certify claim.related_dir_ids per claim (no bulk cross-claim grant).
 *
 * - reality_analysis: keep only dirs already seeded on the claim that are
 *   also present among linked-fact structured dirs.
 * - all other claim types: [].
 * Does not read claim.body_text or evidence.explanation.
 * Does not assign the union of all linked DIRs to every reality_analysis claim.
 */
export function certifyClaimDirBindings(input: {
  registry: EvidenceRegistry;
  dc: DecisionContext;
  fact_selection: FactSelectionResult;
}): void {
  const dirsById = activeDirsById(input.dc);
  const linkedDirs = new Set<string>();

  for (const row of input.fact_selection.selected) {
    if (row.kind !== "linked") continue;
    for (const d of structuredLinkedDirsForFact(row.source, dirsById)) {
      linkedDirs.add(d);
    }
  }

  for (const claim of Object.values(input.registry.claims)) {
    if (claim.claim_type !== "reality_analysis") {
      claim.related_dir_ids = [];
      continue;
    }
    const seeded = (claim.related_dir_ids ?? [])
      .map((d) => d.trim())
      .filter(Boolean);
    // Per-claim isolation: only retain this claim's own seeded dirs ∩ linked.
    claim.related_dir_ids = seeded.filter(
      (d) => linkedDirs.has(d) && dirsById.has(d),
    );
  }
}

/**
 * Build selective credible pairs from program-certified claim.related_dir_ids
 * intersecting structured linked-fact dirs. Candidate facts never pair.
 */
export function buildCrediblePage02FactClaimPairs(input: {
  registry: EvidenceRegistry;
  fact_selection: FactSelectionResult;
  dc: DecisionContext;
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

    for (const claim of Object.values(input.registry.claims)) {
      const claimDirs = (claim.related_dir_ids ?? [])
        .map((d) => d.trim())
        .filter(Boolean);
      if (!claimDirs.length) continue;

      const overlap = claimDirs.filter((d) => factDirSet.has(d));
      if (!overlap.length) continue;

      // Every overlapping dir must still resolve in DC.
      if (overlap.some((d) => !dirsById.has(d))) continue;

      const key = crediblePairKey(claim.claim_id, factId);
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      pairs.push({
        claim_id: claim.claim_id,
        fact_id: factId,
        evidence_id,
        related_dir_ids: overlap,
        reasons: [
          `selection:${row.kind}`,
          `dir_overlap:${overlap.join(",")}`,
          ...row.reasons.slice(0, 4),
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
