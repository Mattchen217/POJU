/**
 * Flatten Face02 for cite / scare / substance gates.
 */

import { isFace02Legacy, isFace02V2 } from "./legacy-adapter";
import type { Face02V2 } from "../schemas";

export function face02BodyTextBlob(page: unknown): string {
  if (isFace02V2(page)) {
    const p = page as Face02V2;
    return [
      p.page_title,
      p.page_subtitle,
      p.page_summary,
      ...p.relevant_personal_factors.map((f) => `${f.title} ${f.text}`),
      ...p.personal_reality_interplay.map(
        (r) => `${r.text} ${r.conditionality}`,
      ),
      p.why_judgment_fits.text,
      p.why_judgment_fits.page01_judgment_ref,
      ...p.explanation_boundary.personal_analysis_basis,
      ...p.explanation_boundary.confirmed_fact_basis,
      ...p.explanation_boundary.hypothesis_notes,
      ...p.explanation_boundary.uncertainty_notes,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (isFace02Legacy(page)) {
    // D anchors are evidence-layer — exclude from visible body blob.
    return [
      page.page_title,
      page.page_subtitle,
      page.destiny_reason,
      page.science_mechanism,
      page.convergence,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function face02EvidenceIdBlob(page: unknown): string[] {
  if (!isFace02V2(page)) return [];
  const p = page as Face02V2;
  return [
    ...p.relevant_personal_factors.flatMap((f) => f.evidence_ids),
    ...p.personal_reality_interplay.flatMap((r) => [
      ...r.personal_evidence_ids,
      ...r.mechanism_evidence_ids,
    ]),
    ...p.why_judgment_fits.evidence_ids,
    ...(p.explanation_boundary.personal_analysis_evidence_ids ?? []),
  ];
}

export function collectFace02RealizedEvidenceIds(page: Face02V2): string[] {
  return [...new Set(face02EvidenceIdBlob(page))];
}
