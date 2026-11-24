/**
 * Page06 per-section input field contracts (architecture SSOT).
 */

import type { Page06SectionId } from "./sections";
import type { Page06GapStatus } from "./gaps";

export const PAGE06_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page06InputSourceKind =
  (typeof PAGE06_INPUT_SOURCE_KINDS)[number];

export type Page06InputFieldContract = {
  field_id: string;
  section_id: Page06SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page06InputSourceKind;
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

export type Page06InputManifestEntry = {
  field_id: string;
  section_id: Page06SectionId;
  source_kind: Page06InputSourceKind;
  present: boolean;
  collection_status: Page06GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE06_INPUT_FIELD_CONTRACTS: readonly Page06InputFieldContract[] =
  [
    {
      field_id: "decision_question",
      section_id: "first_step",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page06 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "first_step",
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
      field_id: "page05_paths_payload",
      section_id: "first_step",
      meaning:
        "Page05 V2 paths. Preferred paths must already exist; Page06 does not invent paths.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path:
        "page05 Face05V2 preferred_path_ids + path_units + path_comparison + switching_rules",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "primary/fallback path binding for every action",
      follow_up_collect_hint: "Generate Page05 with at least one preferred path first.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page01_structured_payload",
      section_id: "first_step",
      meaning:
        "Page01 V2 structured conclusion (core, conditions, not_recommended, boundary).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page01 Face01V2 fields",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "execution stays aligned with the decision (not copy-as-body)",
      follow_up_collect_hint: "Ensure Page01 is generated and approved first.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page02_foundation_payload",
      section_id: "personal_execution_adjustments",
      meaning: "Page02 canonical content_units + explanation_boundary.",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page02 Face02V2 content_units + explanation_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "personal execution adjustments cite these unit ids",
      follow_up_collect_hint: "Generate Page02 before Page06.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "page04_bottleneck_payload",
      section_id: "execution_actions",
      meaning: "Page04 canonical content_units + evidence_boundary (relevant slice).",
      data_type: "object",
      source_kind: "analytical_result",
      source_path: "page04 Face04V2 content_units + evidence_boundary",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "bottleneck-aware sequencing and guardrails",
      follow_up_collect_hint: "Generate Page04 before Page06.",
      depends_on: ["page01_structured_payload"],
    },
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "resource_boundaries",
      meaning: "DC reality_facts with status=confirmed (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "resource boundaries / confirmed_fact_ids",
      follow_up_collect_hint: "Confirm critical facts in intake when possible.",
    },
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "validation_experiments",
      meaning: "DC reality_facts with status=unverified (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "conditional experiment language",
      follow_up_collect_hint: "Verify estimates before treating as confirmed.",
    },
    {
      field_id: "declined_unknown_na_facts_payload",
      section_id: "evidence_boundary",
      meaning: "DC facts declined/unknown/not_applicable (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status in declined|unknown|not_applicable]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "uncertainty notes / unknown resource gaps",
      follow_up_collect_hint: "Respect declined/NA; do not invent replacements.",
    },
    {
      field_id: "open_conflicts",
      section_id: "phase_rhythm",
      meaning: "Unresolved DC conflicts.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.conflicts[state=open|unresolved_in_final]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "experiment if_fail / stop framing",
      follow_up_collect_hint: "Clarify conflicting statements when blocking.",
    },
    {
      field_id: "reality_constraints",
      section_id: "resource_boundaries",
      meaning: "DC constraints (full objects).",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "time/money/people/energy boundaries",
      follow_up_collect_hint: "Capture hard constraints in intake.",
    },
    {
      field_id: "book_judgment_face06_units",
      section_id: "first_step",
      meaning: "BookJudgment units with serves_face including 06.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "pack.units[serves_face includes 06]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "personal grounding for execution adjustments",
      follow_up_collect_hint: "Ensure BookJudgment pack covers face 06 when needed.",
    },
    {
      field_id: "approved_personal_readings",
      section_id: "personal_execution_adjustments",
      meaning: "Approved personal reading objects usable for Page06.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "seeded.readings[]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "supporting_personal_unit_refs",
      follow_up_collect_hint: "Provide chart packs when personal grounding is needed.",
    },
    {
      field_id: "evidence_registry_claims",
      section_id: "first_step",
      meaning: "Actual Page06 registry claim records (not unit counts).",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page_id=06]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids citations",
      follow_up_collect_hint: "Seed Page06 registry from BookJudgment + DC facts.",
      depends_on: ["decision_question"],
    },
    {
      field_id: "page07_field_payload",
      section_id: "evidence_boundary",
      meaning: "Page07 field/relation — not required for Page06 Batch1.",
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

export function page06InputContractsForSection(
  sectionId: Page06SectionId,
): Page06InputFieldContract[] {
  return PAGE06_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page06InputContractById(
  fieldId: string,
): Page06InputFieldContract | null {
  return PAGE06_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null;
}
