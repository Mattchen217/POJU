/**
 * Page02 per-section input field contracts (architecture SSOT).
 */

import type { Page02SectionId } from "./sections";
import type { Page02GapStatus } from "./gaps";

export const PAGE02_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page02InputSourceKind =
  (typeof PAGE02_INPUT_SOURCE_KINDS)[number];

export type Page02InputFieldContract = {
  field_id: string;
  section_id: Page02SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page02InputSourceKind;
  source_path: string;
  required: boolean;
  allow_empty: boolean;
  /** When field is absent/empty. */
  missing_handling:
    | "omit_dependent_units"
    | "block_page_generation"
    | "gap_note_only"
    | "use_empty_section_display";
  affects_content: string;
  follow_up_collect_hint: string;
};

export type Page02InputManifestEntry = {
  field_id: string;
  section_id: Page02SectionId;
  source_kind: Page02InputSourceKind;
  present: boolean;
  /** Collection / integrity status at assemble time. */
  collection_status: Page02GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE02_INPUT_FIELD_CONTRACTS: readonly Page02InputFieldContract[] =
  [
    {
      field_id: "page01_core_judgment",
      section_id: "page_summary",
      meaning: "Page01 core judgment text for alignment (not to copy).",
      data_type: "string",
      source_kind: "analytical_result",
      source_path: "page01.core_judgment.text",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "page_summary + why_judgment_fits framing",
      follow_up_collect_hint: "Ensure Page01 is generated and approved first.",
    },
    {
      field_id: "decision_question",
      section_id: "page_summary",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page02 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "personal_readings_available",
      section_id: "relevant_personal_factors",
      meaning: "Whether certified personal readings exist for this topic.",
      data_type: "boolean",
      source_kind: "personal_analysis",
      source_path: "slice.personal_analysis.approved_readings",
      required: false,
      allow_empty: true,
      missing_handling: "use_empty_section_display",
      affects_content: "relevant_personal_factors units",
      follow_up_collect_hint:
        "Optional: ensure chart packs / readings are available; do not invent.",
    },
    {
      field_id: "confirmed_reality_facts",
      section_id: "personal_reality_interplay",
      meaning: "DC reality facts with status=confirmed usable on Page02.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "reality_fact units and confirmed boundary lists",
      follow_up_collect_hint:
        "Collect and confirm key reality facts before claiming confirmed basis.",
    },
    {
      field_id: "unverified_reality_facts",
      section_id: "explanation_boundary",
      meaning: "DC facts present but unverified — must not be upgraded.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "hypothesis / uncertainty notes only",
      follow_up_collect_hint: "Verify or clarify unverified facts in intake.",
    },
    {
      field_id: "open_conflicts",
      section_id: "explanation_boundary",
      meaning: "Unresolved DC conflicts that bound explanations.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.conflicts[state!=clarified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "uncertainty_notes and conditional language",
      follow_up_collect_hint: "Clarify conflicting statements in intake.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "why_judgment_fits",
      meaning: "Page02-slice evidence registry claims the model may cite.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page02_slice]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids on content_units",
      follow_up_collect_hint:
        "Ensure BookJudgment / registry seeding produced Page02 claims.",
    },
    {
      field_id: "available_personal_domains",
      section_id: "relevant_personal_factors",
      meaning: "Which personal domains (bazi/ziwei/…) are available.",
      data_type: "string[]",
      source_kind: "system_metadata",
      source_path: "production.available_domains",
      required: false,
      allow_empty: true,
      missing_handling: "use_empty_section_display",
      affects_content: "personal_interpretation.source_domain allowlist",
      follow_up_collect_hint: "Optional chart availability; never invent domains.",
    },
    {
      field_id: "report_locale",
      section_id: "page_summary",
      meaning: "Output locale for vernacular body.",
      data_type: "string",
      source_kind: "system_metadata",
      source_path: "report.locale",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all user-facing text",
      follow_up_collect_hint: "Set report locale before generation.",
    },
  ] as const;

export function page02InputContractsForSection(
  sectionId: Page02SectionId,
): Page02InputFieldContract[] {
  return PAGE02_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page02InputContractById(
  fieldId: string,
): Page02InputFieldContract | null {
  return (
    PAGE02_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null
  );
}
