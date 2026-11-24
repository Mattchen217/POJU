/**
 * Page07 per-section input field contracts (architecture SSOT).
 * Required upstream fields block generation only when applicability is `applicable`.
 */

import type { Page07SectionId } from "./sections";
import type { Page07GapStatus } from "./gaps";

export const PAGE07_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page07InputSourceKind =
  (typeof PAGE07_INPUT_SOURCE_KINDS)[number];

export type Page07InputFieldContract = {
  field_id: string;
  section_id: Page07SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page07InputSourceKind;
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

export type Page07InputManifestEntry = {
  field_id: string;
  section_id: Page07SectionId;
  source_kind: Page07InputSourceKind;
  present: boolean;
  collection_status: Page07GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE07_INPUT_FIELD_CONTRACTS: readonly Page07InputFieldContract[] =
  [
    {
      field_id: "decision_question",
      section_id: "field_judgment",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "applicability and all Page07 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "field_judgment",
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
      field_id: "applicability_gate",
      section_id: "field_judgment",
      meaning:
        "Program applicability status from structured DC. Never ask the model to decide whether the page exists.",
      data_type: "enum",
      source_kind: "derived_data",
      source_path: "evaluatePage07Applicability",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "skip vs generate",
      follow_up_collect_hint: "Applicability is computed; do not collect it from the model.",
    },
    {
      field_id: "page01_structured_payload",
      section_id: "alignment_with_main",
      meaning: "Page01 V2 structured conclusion.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page01 Face01V2 fields",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "whether the field changes the main recommendation",
      follow_up_collect_hint: "Generate Page01 before Page07.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page02_foundation_payload",
      section_id: "evidence_boundary",
      meaning:
        "Page02 content_units. personal_interpretation ids are for the user only.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page02 Face02V2 content_units",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "user-self evidence only; never third-party personality",
      follow_up_collect_hint: "Generate Page02 before Page07.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page04_bottleneck_payload",
      section_id: "field_judgment",
      meaning: "Page04 bottleneck units + evidence boundary.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page04 Face04V2 content_units + evidence_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "field constraints that echo the bottleneck",
      follow_up_collect_hint: "Generate Page04 before Page07.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page05_paths_payload",
      section_id: "alignment_with_main",
      meaning: "Page05 preferred paths. Page07 must not invent paths.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page05 Face05V2 preferred_path_ids + path_units",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "related_page05_path_ids",
      follow_up_collect_hint: "Generate Page05 with at least one preferred path first.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page06_execution_payload",
      section_id: "alignment_with_main",
      meaning:
        "Page06 primary_path_id and action ids (first step + execution actions).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page06 Face06V2 primary_path_id + action ids",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "effect_on_page06_execution and related_page06_action_ids",
      follow_up_collect_hint: "Generate Page06 before Page07.",
      depends_on: ["page05_paths_payload"],
    },
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "evidence_boundary",
      meaning: "DC reality_facts with status=confirmed.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "confirmed_fact_ids and participant grounding",
      follow_up_collect_hint: "Confirm field or relationship facts in intake when they decide the page.",
    },
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "relationship_interaction",
      meaning: "DC reality_facts with status=unverified.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "conditional relationship language",
      follow_up_collect_hint: "Do not treat estimates as confirmed.",
    },
    {
      field_id: "reality_constraints",
      section_id: "field_judgment",
      meaning: "DC constraints.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "field constraints",
      follow_up_collect_hint: "Capture org, move, or partnership constraints when relevant.",
    },
    {
      field_id: "dirs_payload",
      section_id: "field_judgment",
      meaning: "DC information requirements (need / why / state).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.dirs[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "field entry conditions and unknown DIR gaps",
      follow_up_collect_hint: "Unknown DIR field needs stay unknown.",
    },
    {
      field_id: "book_judgment_face07_units",
      section_id: "evidence_boundary",
      meaning: "BookJudgment units with serves_face including 07.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "pack.units[serves_face includes 07]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "user-self grounding only",
      follow_up_collect_hint: "Face 07 units are optional; never apply them to a third party.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "field_judgment",
      meaning: "Page07 registry claim records.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page_id=07]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids citations when the page is applicable",
      follow_up_collect_hint: "Seed Page07 registry from BookJudgment + DC facts.",
      depends_on: ["decision_question"],
    },
  ];

export function page07InputContractsForSection(
  sectionId: Page07SectionId,
): Page07InputFieldContract[] {
  return PAGE07_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page07InputContractById(
  fieldId: string,
): Page07InputFieldContract | null {
  return (
    PAGE07_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null
  );
}
