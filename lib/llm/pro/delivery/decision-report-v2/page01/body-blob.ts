/**
 * Extract user-visible body text from Face01 (v2 or legacy) for gates/polish.
 */

import { isFace01V2, isFace01Legacy } from "./legacy-adapter";

export function face01BodyTextBlob(page: Record<string, unknown>): string {
  if (isFace01V2(page)) {
    const parts = [
      page.core_judgment.text,
      ...page.why_this_path.map((w) => w.text),
      ...page.recommendation_conditions.map((c) => c.condition),
      ...page.not_recommended.flatMap((n) => [
        n.option,
        n.reason,
        n.cost_or_conflict,
      ]),
      ...page.applicability_boundary.current_basis,
      ...page.applicability_boundary.invalidation_conditions,
      String(page.page_title ?? ""),
      String(page.page_subtitle ?? ""),
    ];
    return parts.filter(Boolean).join("\n");
  }
  if (isFace01Legacy(page)) {
    return [
      page.main_recommendation,
      page.conditions,
      page.not_choosing,
      String(page.page_title ?? ""),
      String(page.page_subtitle ?? ""),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Evidence-pointer / page02 target ids blob for cite gates. */
export function face01EvidenceCiteBlob(page: Record<string, unknown>): string {
  if (isFace01V2(page)) {
    const ids = [
      ...page.why_this_path.flatMap((w) => [
        ...w.evidence_ids,
        ...w.target_evidence_ids,
      ]),
      ...page.applicability_boundary.page02_evidence_ids,
      ...page.core_judgment.claim_ids,
    ];
    return ids.join("\n");
  }
  if (isFace01Legacy(page)) {
    return String(page.evidence_pointer ?? "");
  }
  return "";
}
