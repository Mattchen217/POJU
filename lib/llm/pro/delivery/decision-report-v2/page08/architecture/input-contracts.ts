/**
 * Page08 per-section input field contracts (architecture SSOT).
 * Required upstream fields block generation. Page07 never blocks.
 */

import type { Page08SectionId } from "./sections";
import type { Page08GapStatus } from "./gaps";

export const PAGE08_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page08InputSourceKind =
  (typeof PAGE08_INPUT_SOURCE_KINDS)[number];

export type Page08InputFieldContract = {
  field_id: string;
  section_id: Page08SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page08InputSourceKind;
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

export type Page08InputManifestEntry = {
  field_id: string;
  section_id: Page08SectionId;
  source_kind: Page08InputSourceKind;
  present: boolean;
  collection_status: Page08GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE08_INPUT_FIELD_CONTRACTS: readonly Page08InputFieldContract[] =
  [
    {
      field_id: "decision_question",
      section_id: "risks",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page08 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "risks",
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
      field_id: "page01_structured_payload",
      section_id: "risks",
      meaning: "Page01 V2 structured conclusion. Read-only. Do not rewrite it.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page01 Face01V2 fields",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "which recommendation the review is watching",
      follow_up_collect_hint: "Generate Page01 before Page08.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page02_foundation_payload",
      section_id: "evidence_boundary",
      meaning: "Page02 V2 content units and explanation boundary.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page02 Face02V2 content_units",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "personal and reality grounding already written",
      follow_up_collect_hint: "Generate Page02 before Page08.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page04_bottleneck_payload",
      section_id: "risks",
      meaning: "Page04 V2 bottleneck units and evidence boundary.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page04 Face04V2 content_units + evidence_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "risks that echo the bottleneck",
      follow_up_collect_hint: "Generate Page04 before Page08.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page05_paths_payload",
      section_id: "triggers",
      meaning:
        "Page05 V2 preferred paths. related_path_ids must be a subset. Do not invent paths.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page05 Face05V2 preferred_path_ids + path_units",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "related_path_ids and affected_path_ids",
      follow_up_collect_hint: "Generate Page05 with at least one preferred path first.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page06_monitoring_payload",
      section_id: "observation_signals",
      meaning:
        "Page06 V2 primary path, action ids, and monitoring_contract (observe signals and stop/continue/adjust triggers).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page06 Face06V2 monitoring_contract + action ids",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "observation signals and related_action_ids",
      follow_up_collect_hint: "Generate Page06 with a monitoring_contract before Page08.",
      depends_on: ["page05_paths_payload"],
    },
    {
      field_id: "page07_field_payload",
      section_id: "reassessment_conditions",
      meaning:
        "Page07 V2 when present. not_applicable does not block. insufficient_information and missing are gaps. Never relabel Page07 as applicable.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page07 Face07V2 applicability + units",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content:
        "When missing or insufficient, record a gap. Never relabel Page07 as applicable or invent field facts.",
      follow_up_collect_hint:
        "Use stored Page07 only when applicability_status is applicable.",
      depends_on: ["page06_monitoring_payload"],
    },
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "evidence_boundary",
      meaning: "DC reality_facts with status=confirmed. Status is preserved.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "confirmed_fact_ids",
      follow_up_collect_hint: "Confirm facts in intake before listing them as confirmed.",
    },
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "evidence_boundary",
      meaning: "DC reality_facts with status=unverified. Do not upgrade them.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "unverified_fact_ids and conditional wording",
      follow_up_collect_hint: "Do not treat estimates as confirmed.",
    },
    {
      field_id: "reality_constraints",
      section_id: "risks",
      meaning: "DC constraints with status preserved.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "resource and execution risks",
      follow_up_collect_hint: "Capture hard constraints when they bound monitoring.",
    },
    {
      field_id: "dirs_payload",
      section_id: "reassessment_conditions",
      meaning: "DC information requirements (need / why / state).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.dirs[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "reassessment scope when a DIR is still unknown",
      follow_up_collect_hint: "Unknown DIR needs stay unknown.",
    },
    {
      field_id: "book_judgment_face08_units",
      section_id: "evidence_boundary",
      meaning: "BookJudgment units with serves_face including 08.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "pack.units[serves_face includes 08]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "optional personal grounding",
      follow_up_collect_hint: "Face 08 units are optional.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "risks",
      meaning: "Page08 registry claim records.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page_id=08]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids and evidence_ids citations",
      follow_up_collect_hint: "Seed Page08 registry from BookJudgment + DC facts.",
      depends_on: ["decision_question"],
    },
  ];

export function page08InputContractsForSection(
  sectionId: Page08SectionId,
): Page08InputFieldContract[] {
  return PAGE08_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page08InputContractById(
  fieldId: string,
): Page08InputFieldContract | null {
  return (
    PAGE08_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null
  );
}
