/**
 * Read-only credible (claim_id, fact_id) pairs from DC structure.
 * Never mutates registry claim.evidence_ids or evidence.supports_claim_ids.
 *
 * A linked DC fact is credible for a claim only when the claim's own body /
 * unit evidence text contains an explicit structured marker for that fact
 * (fact_id or one of the fact's related_dir_ids). Candidate facts never pair.
 */

import type { EvidenceRegistry } from "../types";
import type { FactSelectionResult } from "../fact-relevance";
import { factEvidenceIdFor } from "./fact-id";

export type CredibleFactClaimPair = {
  claim_id: string;
  fact_id: string;
  evidence_id: string;
  reasons: string[];
};

export function crediblePairKey(claimId: string, factId: string): string {
  return `${claimId}::${factId}`;
}

/**
 * Build selective credible pairs. Unrelated claims stay unpaired.
 */
export function buildCrediblePage02FactClaimPairs(input: {
  registry: EvidenceRegistry;
  fact_selection: FactSelectionResult;
}): {
  pairs: CredibleFactClaimPair[];
  pairKeys: Set<string>;
} {
  const pairs: CredibleFactClaimPair[] = [];
  const pairKeys = new Set<string>();

  for (const row of input.fact_selection.selected) {
    if (row.kind !== "linked") continue;
    const factId = row.fact.fact_id;
    const evidence_id = factEvidenceIdFor(factId);
    if (!input.registry.evidence[evidence_id]) continue;

    const markers = new Set<string>();
    markers.add(factId.toLowerCase());
    for (const d of row.source.related_dir_ids ?? []) {
      const t = d.trim().toLowerCase();
      if (t) markers.add(t);
    }

    for (const claim of Object.values(input.registry.claims)) {
      const blobParts = [claim.body_text];
      for (const eid of claim.evidence_ids) {
        const ev = input.registry.evidence[eid];
        if (!ev || ev.source_type === "reality_fact") continue;
        blobParts.push(ev.explanation ?? "");
      }
      const blob = blobParts.join("\n").toLowerCase();
      const hitMarkers: string[] = [];
      for (const m of markers) {
        if (m.length >= 3 && blob.includes(m)) hitMarkers.push(m);
      }
      if (!hitMarkers.length) continue;

      const key = crediblePairKey(claim.claim_id, factId);
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      pairs.push({
        claim_id: claim.claim_id,
        fact_id: factId,
        evidence_id,
        reasons: [
          `selection:${row.kind}`,
          ...row.reasons.slice(0, 4),
          `marker:${hitMarkers.join(",")}`,
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

/**
 * Detect DC facts whose content (or id) is materially present in text.
 * Used to reject omitted structured reality_fact_ids — not a status authority.
 */
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
