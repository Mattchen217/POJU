/**
 * Page07 per-section content norms — field and relationship vernacular.
 */

import type { Page07SectionId } from "./sections";

export type Page07ContentKind =
  | "field_resource"
  | "field_constraint"
  | "field_entry_exit"
  | "power_interest"
  | "communication"
  | "commitment_conflict"
  | "collaboration"
  | "evidence_boundary"
  | "alignment";

export type Page07SectionContentSpec = {
  section_id: Page07SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page07ContentKind[];
};

export const PAGE07_SECTION_CONTENT_SPECS: readonly Page07SectionContentSpec[] =
  [
    {
      section_id: "field_judgment",
      purpose:
        "Judge whether the current or target setting supplies resources, what limits it, and the conditions for entering, staying, or leaving.",
      user_should_understand:
        "What the setting does and does not support for this decision.",
      content_boundary:
        "Only settings already named in the decision, facts, constraints, or known DIR needs. Do not invent an organization or city.",
      language_style: "Concrete vernacular. No raw metaphysics jargon.",
      length_guidance: "0–4 field units when applicable; empty when the page is skipped.",
      must_include: [
        "kind field_resource | field_constraint | field_entry_exit",
        "claim_ids when the page is applicable",
        "participant_ids that already exist",
      ],
      must_not_include: [
        "A second main recommendation",
        "Invented scores or probabilities",
        "Third-party personality",
      ],
      allowed_unit_kinds: [
        "field_resource",
        "field_constraint",
        "field_entry_exit",
      ],
    },
    {
      section_id: "relationship_interaction",
      purpose:
        "Describe power, interest, communication, commitment, conflict, or collaboration using facts the user already gave.",
      user_should_understand:
        "Whether goals, information, and responsibility are clear among people already in the facts.",
      content_boundary:
        "Do not invent a third party. Do not apply the user's personal analysis to anyone else.",
      language_style: "Factual and conditional.",
      length_guidance: "0–4 relationship units. Empty is valid when no relationship is in scope.",
      must_include: [
        "When present: a real participant_id and at least one claim_id",
        "uncertainty_notes when a fact is unverified",
      ],
      must_not_include: [
        "Personality, character, or chart language about another person without an authorized partner profile",
        "Applying Face02 personal_interpretation units to a non-self participant",
        "Moral verdicts about another person's character",
      ],
      allowed_unit_kinds: [
        "power_interest",
        "communication",
        "commitment_conflict",
        "collaboration",
      ],
    },
    {
      section_id: "evidence_boundary",
      purpose:
        "Separate confirmed facts, hypotheses, uncertainty, and third-party data limits.",
      user_should_understand:
        "What is known, what is only a hypothesis, and what cannot be said about other people.",
      content_boundary:
        "confirmed_fact_ids may list only confirmed DC facts. Personal interpretation refs are for the user only.",
      language_style: "Boundary language.",
      length_guidance: "uncertainty_notes required when applicable.",
      must_include: [
        "third_party_data_limits stating that other people are not analyzed as personalities",
        "claim_ids when applicable",
      ],
      must_not_include: [
        "Upgrading unverified facts to confirmed",
        "Compatibility scores",
      ],
      allowed_unit_kinds: ["evidence_boundary"],
    },
    {
      section_id: "alignment_with_main",
      purpose:
        "Say whether the field or relationship changes the Page01 recommendation or the Page05 path order, and how it touches Page06 execution.",
      user_should_understand:
        "This page is an auxiliary condition unless it explicitly changes the main decision.",
      content_boundary:
        "related_page05_path_ids must already exist on Page05. related_page06_action_ids must already exist on Page06. Do not invent a new main plan.",
      language_style: "Direct. Default the change flags to false unless the evidence requires a change.",
      length_guidance: "One alignment object.",
      must_include: [
        "changes_page01_recommendation",
        "changes_page05_path_order",
        "effect_on_page06_execution",
        "summary",
      ],
      must_not_include: [
        "A competing recommendation that ignores Page01",
        "A new path id",
        "A new Page06 action id",
      ],
      allowed_unit_kinds: ["alignment"],
    },
  ];

export function page07ContentSpecForSection(
  sectionId: Page07SectionId,
): Page07SectionContentSpec | null {
  return (
    PAGE07_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ??
    null
  );
}
