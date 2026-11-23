/**
 * Page02 per-section content norms (architecture SSOT · vernacular body).
 */

import type { Page02SectionId } from "./sections";

export type Page02ContentKind =
  | "personal_interpretation"
  | "reality_fact"
  | "reality_mechanism"
  | "conditional_explanation";

export type Page02SectionContentSpec = {
  section_id: Page02SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page02ContentKind[];
};

export const PAGE02_SECTION_CONTENT_SPECS: readonly Page02SectionContentSpec[] =
  [
    {
      section_id: "page_summary",
      purpose: "Orient the reader: why this judgment relates to them now.",
      user_should_understand:
        "The fit is about this person + this situation, not a generic tip.",
      content_boundary:
        "Explain relevance only; do not restate Page01 verdict or prescribe actions.",
      language_style: "Vernacular; no raw metaphysics jargon in body.",
      length_guidance: "1–3 short units; each ≤ ~3 sentences.",
      must_include: [
        "Tie to the decision question",
        "Point at person+situation fit without copying Page01 full text",
      ],
      must_not_include: [
        "Full Page01 conclusion copy",
        "Path ranking / action prescriptions",
        "Invented reality facts",
        "Raw metaphysics proper nouns in body",
      ],
      allowed_unit_kinds: ["conditional_explanation", "personal_interpretation"],
    },
    {
      section_id: "relevant_personal_factors",
      purpose: "Show only certified personal-structure evidence that matters here.",
      user_should_understand:
        "Which personal patterns are actually used — and that empty means unavailable, not hidden.",
      content_boundary:
        "personal_interpretation only when readings exist; never invent domains.",
      language_style: "Behavior/energy vernacular mapped from certified terms.",
      length_guidance: "0–6 units; empty section is valid.",
      must_include: [
        "Certified evidence_ids when a unit is present",
        "source_domain matching available domains",
      ],
      must_not_include: [
        "Forged personal readings",
        "Means / ops prescriptions",
        "Unrelated chart dumps",
      ],
      allowed_unit_kinds: ["personal_interpretation"],
    },
    {
      section_id: "personal_reality_interplay",
      purpose: "Connect personal structure with collected reality conditions.",
      user_should_understand:
        "How personal tendencies meet confirmed (or clearly conditional) reality constraints.",
      content_boundary:
        "Confirmed facts stay confirmed; unverified stay conditional/hypothesis.",
      language_style: "Plain conditional language; mark uncertainty explicitly.",
      length_guidance: "0–6 units.",
      must_include: [
        "Distinguish confirmed vs conditional when reality is discussed",
        "related_reality_fact_unit_ids when discussing DC facts",
      ],
      must_not_include: [
        "Upgrading unverified facts to confirmed",
        "Filling missing reality with common-sense invention",
        "Page04 bottleneck diagnosis",
      ],
      allowed_unit_kinds: [
        "reality_fact",
        "reality_mechanism",
        "conditional_explanation",
      ],
    },
    {
      section_id: "why_judgment_fits",
      purpose: "Explain why Page01 judgment matches this situation.",
      user_should_understand:
        "The judgment is conditional on the listed person+reality basis — not fate.",
      content_boundary: "Explanation only; no new decision, no action plan.",
      language_style: "Vernacular explanatory prose.",
      length_guidance: "1–4 units.",
      must_include: [
        "Reference to Page01 judgment alignment (not copy)",
        "At least one claim_id from registry",
      ],
      must_not_include: [
        "Re-issuing a new primary/backup path",
        "Scare / destiny prediction",
        "Invented facts to force fit",
      ],
      allowed_unit_kinds: [
        "conditional_explanation",
        "reality_mechanism",
        "personal_interpretation",
      ],
    },
    {
      section_id: "explanation_boundary",
      purpose: "Make the epistemic boundary visible to the reader.",
      user_should_understand:
        "What is personal analysis, what is confirmed fact, what is hypothesis, what is missing.",
      content_boundary:
        "Boundary lists + uncertainty; must surface gaps without fabricating closure.",
      language_style: "Clear labels; short notes.",
      length_guidance: "Required uncertainty_notes ≥1 when any gap or hypothesis exists.",
      must_include: [
        "Separation of personal / confirmed / hypothesis",
        "uncertainty_notes that do not alter DC fact status",
      ],
      must_not_include: [
        "Scare language",
        "Treating gaps as resolved facts",
        "Hiding missing_inputs",
      ],
      allowed_unit_kinds: [
        "personal_interpretation",
        "reality_fact",
        "conditional_explanation",
      ],
    },
  ] as const;

export function page02ContentSpecForSection(
  sectionId: Page02SectionId,
): Page02SectionContentSpec | null {
  return (
    PAGE02_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ?? null
  );
}
