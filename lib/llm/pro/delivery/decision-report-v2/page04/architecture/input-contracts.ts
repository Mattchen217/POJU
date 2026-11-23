/**
 * Page04 per-section input field contracts (architecture SSOT).
 */

import type { Page04SectionId } from "./sections";
import type { Page04GapStatus } from "./gaps";

export const PAGE04_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page04InputSourceKind =
  (typeof PAGE04_INPUT_SOURCE_KINDS)[number];

export type Page04InputFieldContract = {
  field_id: string;
  section_id: Page04SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page04InputSourceKind;
  source_path: string;
  required: boolean;
  allow_empty: boolean;
  missing_handling:
    | "omit_dependent_units"
    | "block_page_generation"
    | "gap_note_only"
    | "use_empty_section_display";
  affects_content: string;
  follow_up_collect_hint: string;
  depends_on?: readonly string[];
};

export type Page04InputManifestEntry = {
  field_id: string;
  section_id: Page04SectionId;
  source_kind: Page04InputSourceKind;
  present: boolean;
  collection_status: Page04GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE04_INPUT_FIELD_CONTRACTS: readonly Page04InputFieldContract[] =
  [
    {
      field_id: "decision_question",
      section_id: "bottleneck_naming",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page04 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "bottleneck_naming",
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
    {
      field_id: "page01_core_judgment",
      section_id: "bottleneck_naming",
      meaning: "Page01 core judgment text for alignment (not to copy as body).",
      data_type: "string",
      source_kind: "analytical_result",
      source_path: "page01.core_judgment.text",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "bottleneck framing relative to the decision",
      follow_up_collect_hint: "Ensure Page01 is generated and approved first.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page01_recommendation_conditions",
      section_id: "leverage_point",
      meaning: "Page01 recommendation_conditions that bound leverage language.",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "page01.recommendation_conditions[]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "conditional leverage / force-through framing",
      follow_up_collect_hint: "Generated with Page01; clarify condition sources in intake.",
      depends_on: ["page01_core_judgment"],
    },
    {
      field_id: "page02_foundation_payload",
      section_id: "manifestation",
      meaning:
        "Approved Page02 content_units / boundary notes usable as personal+reality grounding.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page02 Face02V2 content_units + explanation_boundary",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "manifestation / evidence grounding depth",
      follow_up_collect_hint:
        "Generate Page02 foundation before Page04 when personal structure is needed.",
      depends_on: ["page01_core_judgment"],
    },
    {
      field_id: "page03_pattern_payload",
      section_id: "bottleneck_naming",
      meaning:
        "Page03 personal decision-pattern payload when present (optional; N/A if not generated).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page03 schema (when product page exists)",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "optional pattern framing — must not become full Page04 conclusion",
      follow_up_collect_hint:
        "Page03 not required for Page04 Batch1; mark not_applicable when absent.",
    },
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "manifestation",
      meaning:
        "Confirmed DC facts with statement/status/verification_level/source/related_dir_ids.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "manifestation confirmed grounding",
      follow_up_collect_hint:
        "Collect fact statement + roles; user confirm before status=confirmed.",
    },
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "evidence_boundary",
      meaning: "Unverified DC facts — must not upgrade.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "conditional manifestation / uncertainty notes",
      follow_up_collect_hint: "Verify or clarify unverified facts in intake.",
    },
    {
      field_id: "declined_or_unknown_facts",
      section_id: "evidence_boundary",
      meaning: "DC facts with declined/unknown/not_applicable status.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status in declined|unknown|not_applicable]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "boundary gap notes; omit as confirmed",
      follow_up_collect_hint:
        "Respect declined; clarify unknown; mark N/A explicitly when applicable.",
    },
    {
      field_id: "open_conflicts",
      section_id: "evidence_boundary",
      meaning: "Unresolved DC conflicts that bound bottleneck claims.",
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
      field_id: "reality_constraints",
      section_id: "force_through_cost",
      meaning: "DC constraints informing force-through cost language.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "force_through_cost grounding",
      follow_up_collect_hint: "Collect hard/soft constraints in intake.",
    },
    {
      field_id: "book_judgment_face04_units",
      section_id: "bottleneck_naming",
      meaning: "BookJudgment units serving face 04 (bottleneck claim seeds).",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "pack.units[serves_face includes 04]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "bottleneck claim seeds",
      follow_up_collect_hint: "Produced by BookJudgment pack step before Page04 body.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "evidence_boundary",
      meaning: "Page04-slice evidence registry claims the model may cite.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page04_slice]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids on content_units",
      follow_up_collect_hint:
        "Ensure BookJudgment / registry seeding produced Page04 claims.",
      depends_on: ["decision_question", "page01_core_judgment"],
    },
    {
      field_id: "personal_readings_payload",
      section_id: "evidence_boundary",
      meaning:
        "Approved personal reading objects (id, domain, excerpt) for evidence fold.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "slice.personal_analysis.approved_readings[]",
      required: false,
      allow_empty: true,
      missing_handling: "use_empty_section_display",
      affects_content: "evidence_note personal-structure fold",
      follow_up_collect_hint:
        "Need reading_id + domain + short certified excerpt; do not invent.",
    },
  ] as const;

export function page04InputContractsForSection(
  sectionId: Page04SectionId,
): Page04InputFieldContract[] {
  return PAGE04_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page04InputContractById(
  fieldId: string,
): Page04InputFieldContract | null {
  return (
    PAGE04_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null
  );
}
