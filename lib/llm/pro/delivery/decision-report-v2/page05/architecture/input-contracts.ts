/**
 * Page05 per-section input field contracts (architecture SSOT).
 */

import type { Page05SectionId } from "./sections";
import type { Page05GapStatus } from "./gaps";

export const PAGE05_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page05InputSourceKind =
  (typeof PAGE05_INPUT_SOURCE_KINDS)[number];

export type Page05InputFieldContract = {
  field_id: string;
  section_id: Page05SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page05InputSourceKind;
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

export type Page05InputManifestEntry = {
  field_id: string;
  section_id: Page05SectionId;
  source_kind: Page05InputSourceKind;
  present: boolean;
  collection_status: Page05GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE05_INPUT_FIELD_CONTRACTS: readonly Page05InputFieldContract[] =
  [
    {
      field_id: "decision_question",
      section_id: "preferred_path",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page05 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "preferred_path",
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
      section_id: "preferred_path",
      meaning:
        "Page01 V2 structured conclusion (core, conditions, not_recommended, boundary).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page01 Face01V2 fields",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "path ranking alignment (not copy-as-body)",
      follow_up_collect_hint: "Ensure Page01 is generated and approved first.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page02_foundation_payload",
      section_id: "alternative_path",
      meaning: "Page02 canonical content_units + explanation_boundary.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page02 Face02V2 content_units + explanation_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "personal fit for preferred/alternative/cautious ranking",
      follow_up_collect_hint: "Generate Page02 before Page05.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page04_bottleneck_payload",
      section_id: "preferred_path",
      meaning: "Page04 canonical content_units + evidence_boundary (relevant slice).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page04 Face04V2 content_units + evidence_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "bottleneck-aware path ranking",
      follow_up_collect_hint: "Generate Page04 before Page05.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "path_comparison",
      meaning: "DC reality_facts with status=confirmed (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "comparison grounding / confirmed_fact_ids",
      follow_up_collect_hint: "Confirm critical facts in intake when possible.",
    },
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "switching_exit",
      meaning: "DC reality_facts with status=unverified (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "conditional switch/stop language",
      follow_up_collect_hint: "Verify estimates before treating as confirmed.",
    },
    {
      field_id: "declined_unknown_na_facts_payload",
      section_id: "cautious_path",
      meaning: "DC facts declined/unknown/not_applicable (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status in declined|unknown|not_applicable]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "cautious path / gap notes",
      follow_up_collect_hint: "Respect declined/NA; do not invent replacements.",
    },
    {
      field_id: "open_conflicts",
      section_id: "switching_exit",
      meaning: "Unresolved DC conflicts.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.conflicts[state=open|unresolved_in_final]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "switch/stop uncertainty framing",
      follow_up_collect_hint: "Clarify conflicting statements when blocking.",
    },
    {
      field_id: "reality_constraints",
      section_id: "path_comparison",
      meaning: "DC constraints (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "resource/cost comparison realism",
      follow_up_collect_hint: "Capture hard constraints in intake.",
    },
    {
      field_id: "book_judgment_face05_units",
      section_id: "preferred_path",
      meaning: "BookJudgment units with serves_face including 05.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "pack.units[serves_face includes 05]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "personal grounding for path ranking",
      follow_up_collect_hint: "Ensure BookJudgment pack covers face 05 when needed.",
    },
    {
      field_id: "approved_personal_readings",
      section_id: "preferred_path",
      meaning: "Approved personal reading objects usable for Page05.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "seeded.readings[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "personal evidence density",
      follow_up_collect_hint: "Provide chart packs when personal grounding is needed.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "preferred_path",
      meaning: "Actual Page05 registry claim records (not unit counts).",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page_id=05]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids citations",
      follow_up_collect_hint: "Seed Page05 registry from BookJudgment + DC facts.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page07_field_payload",
      section_id: "cautious_path",
      meaning: "Page07 field/relation — not required for Page05 Batch1.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page07 (topic-gated)",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "optional field constraints only",
      follow_up_collect_hint: "Enable Page07 only when topic requires it.",
    },
  ];

export function page05InputContractsForSection(
  sectionId: Page05SectionId,
): Page05InputFieldContract[] {
  return PAGE05_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page05InputContractById(
  fieldId: string,
): Page05InputFieldContract | null {
  return PAGE05_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null;
}
